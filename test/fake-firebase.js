// 시험용 Firebase compat SDK 가짜 (app·auth·database·storage 네 스크립트를 이 파일 하나로 바꿔치기한다).
// 실제 SDK처럼 동작하게 맞춘 부분:
//  - 로컬 쓰기(set·remove·transaction)는 서버 응답 전에 곧바로 value 이벤트를 낸다 (낙관적 반영)
//  - 오프라인이면 쓰기는 큐에 쌓여 멈추고, 다시 연결되면 순서대로 서버에 보낸다
//  - transaction은 서버 값이 그사이 바뀌었으면 그 값으로 update 함수를 다시 돌린다 (undefined 반환 = 중단)
//  - 같은 경로(또는 조상·자손)에 set/remove 가 들어오면 대기 중인 transaction은 Error('set')으로 취소된다
//  - 서버가 거부(PERMISSION_DENIED)하면 promise 가 reject 되고 화면 값은 서버 값으로 되돌아간다
//  - 빈 배열·null 은 지워지고, 숫자 키 객체는 배열로 돌아온다. undefined·NaN 은 set 시점에 동기 예외
//  - .info/connected
// 시험에서 조작하는 손잡이: window.__fake  (db.setOnline · db.serverSet · db.serverGet · db.deny · storage.hold/release/failPattern …)
(function () {
  if (window.firebase) return;

  const seed = window.__fakeSeed || {};
  const uid = seed.uid || 'test-uid';

  // ─────────────── 트리 유틸 (RTDB 의미론) ───────────────
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  function splitPath(p) { return String(p || '').split('/').filter(Boolean); }
  // 저장용으로 정규화: 배열 → 숫자 키 객체, null/undefined/빈 객체 → null
  function normalize(v) {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'object') return v;
    const out = {};
    const entries = Array.isArray(v) ? v.map((x, i) => [String(i), x]) : Object.entries(v);
    for (const [k, x] of entries) {
      const n = normalize(x);
      if (n !== null) out[k] = n;
    }
    return Object.keys(out).length ? out : null;
  }
  // 읽기용: 숫자 키만 있고 충분히 빽빽하면 배열로 (Firebase ChildrenNode.val 과 같은 규칙)
  function toVal(v) {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'object') return v;
    const keys = Object.keys(v);
    let allInt = true, max = -1;
    for (const k of keys) {
      if (!/^(0|[1-9]\d*)$/.test(k)) { allInt = false; break; }
      max = Math.max(max, Number(k));
    }
    if (allInt && keys.length > 0 && keys.length * 2 > max + 1) {
      const arr = new Array(max + 1).fill(null);
      for (const k of keys) arr[Number(k)] = toVal(v[k]);
      return arr;
    }
    const out = {};
    for (const k of keys) out[k] = toVal(v[k]);
    return out;
  }
  function getAt(tree, parts) {
    let cur = tree;
    for (const p of parts) {
      if (cur === null || cur === undefined || typeof cur !== 'object') return null;
      cur = cur[p];
    }
    return cur === undefined ? null : cur;
  }
  function setAt(tree, parts, value) {
    if (parts.length === 0) return normalize(value);
    const root = (tree && typeof tree === 'object') ? { ...tree } : {};
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      cur[k] = (cur[k] && typeof cur[k] === 'object') ? { ...cur[k] } : {};
      cur = cur[k];
    }
    const n = normalize(value);
    if (n === null) delete cur[parts[parts.length - 1]]; else cur[parts[parts.length - 1]] = n;
    // 빈 객체 가지치기
    return prune(root);
  }
  function prune(v) {
    if (v === null || typeof v !== 'object') return v;
    const out = {};
    for (const k of Object.keys(v)) {
      const p = prune(v[k]);
      if (p !== null && p !== undefined) out[k] = p;
    }
    return Object.keys(out).length ? out : null;
  }
  // Firebase 는 set 인자에 undefined·NaN 이 있으면 동기 예외를 던진다
  function validate(v, path, where) {
    if (v === undefined) throw new Error(`Reference.${where} failed: First argument contains undefined in property '${path.join('.')}'`);
    if (typeof v === 'number' && Number.isNaN(v)) throw new Error(`Reference.${where} failed: First argument contains NaN in property '${path.join('.')}'`);
    if (typeof v === 'function') throw new Error(`Reference.${where} failed: First argument contains a function in property '${path.join('.')}'`);
    if (v && typeof v === 'object') for (const k of Object.keys(v)) validate(v[k], path.concat(k), where);
  }
  const isPrefix = (a, b) => a.length <= b.length && a.every((x, i) => x === b[i]);

  // ─────────────── 데이터베이스 ───────────────
  const db = {
    server: normalize(seed.db || {}),  // 진짜 서버
    mirror: null,                      // 이 기기가 마지막으로 받은 서버 모습 (오프라인이면 멈춰 있다)
    pending: [],                       // 서버 응답을 기다리는 로컬 쓰기 (순서대로)
    online: true,
    deny: false,                       // true 면 서버가 모든 쓰기를 거부
    listeners: [],                     // { parts, cb, cancel, last }
    infoListeners: [],
    writes: [],                        // 서버에 실제 반영된 쓰기 기록 (시험 확인용)
    flushing: false,
  };
  db.mirror = db.server;

  function localTree() {
    let tree = db.mirror;
    for (const op of db.pending) tree = applyOp(tree, op, false);
    return tree;
  }
  function applyOp(tree, op, atServer) {
    if (op.type === 'set') return setAt(tree, op.parts, op.value);
    if (op.type === 'remove') return setAt(tree, op.parts, null);
    // transaction: 현재 값으로 update 함수를 돌린다 (서버에서는 서버 값으로 다시 돈다)
    const cur = toVal(getAt(tree, op.parts));
    let next;
    try { next = op.fn(cur); } catch (e) { op.error = e; return tree; }
    if (next === undefined) { op.abortedAt = atServer ? 'server' : 'local'; return tree; }
    op.abortedAt = null;
    return setAt(tree, op.parts, next);
  }
  function snapshot(parts, tree) {
    const raw = getAt(tree, parts);
    const val = toVal(raw);
    return {
      key: parts.length ? parts[parts.length - 1] : null,
      val: () => clone(val),
      exists: () => val !== null,
      exportVal: () => clone(val),
    };
  }
  function fireAll() {
    const tree = localTree();
    for (const l of db.listeners.slice()) {
      const json = JSON.stringify(getAt(tree, l.parts));
      if (l.last !== json) { l.last = json; l.cb(snapshot(l.parts, tree)); }
    }
  }
  function fireInfo() {
    for (const l of db.infoListeners.slice()) l.cb({ key: 'connected', val: () => db.online, exists: () => true });
  }

  // 서버 처리 (연결돼 있을 때만, 큐 순서대로)
  function scheduleFlush() {
    if (db.flushing || !db.online || !db.pending.length) return;
    db.flushing = true;
    setTimeout(() => {
      db.flushing = false;
      if (!db.online) return;
      const op = db.pending.shift();
      if (!op) return;
      if (db.deny) {
        const err = new Error('PERMISSION_DENIED: Permission denied'); err.code = 'PERMISSION_DENIED';
        db.mirror = db.server; fireAll();
        op.reject(err);
      } else if (op.type === 'transaction') {
        db.server = applyOp(db.server, op, true);
        db.mirror = db.server;
        if (op.error) { fireAll(); op.reject(op.error); }
        else {
          if (!op.abortedAt) db.writes.push({ type: 'transaction', path: op.parts.join('/'), value: toVal(getAt(db.server, op.parts)) });
          fireAll();
          op.resolve({ committed: !op.abortedAt, snapshot: snapshot(op.parts, db.server) });
        }
      } else {
        db.server = applyOp(db.server, op, true);
        db.mirror = db.server;
        db.writes.push({ type: op.type, path: op.parts.join('/'), value: op.type === 'set' ? clone(op.value) : null });
        fireAll();
        op.resolve();
      }
      scheduleFlush();
    }, 0);
  }
  function enqueue(op) {
    const p = new Promise((res, rej) => { op.resolve = res; op.reject = rej; });
    op.promise = p;
    db.pending.push(op);
    fireAll();           // 낙관적 반영: 서버 응답 전에 화면이 먼저 바뀐다
    scheduleFlush();
    return p;
  }
  // set/remove 가 같은 경로(조상·자손 포함)에 들어오면 대기 중 transaction 취소 (실제 SDK: Error('set'))
  function abortTransactionsAround(parts) {
    const keep = [];
    for (const op of db.pending) {
      if (op.type === 'transaction' && (isPrefix(parts, op.parts) || isPrefix(op.parts, parts))) {
        setTimeout(() => op.reject(new Error('set')), 0);
      } else keep.push(op);
    }
    db.pending = keep;
  }

  function makeRef(parts) {
    const path = parts.join('/');
    const ref = {
      key: parts.length ? parts[parts.length - 1] : null,
      path,
      toString: () => 'https://fake-rtdb/' + path,
      child: p => makeRef(parts.concat(splitPath(p))),
      get parent() { return parts.length ? makeRef(parts.slice(0, -1)) : null; },
      push(value) {
        const key = '-FAKE' + String(++pushCounter).padStart(8, '0');
        const child = makeRef(parts.concat(key));
        if (value !== undefined) { const p = child.set(value); child.then = p.then.bind(p); child.catch = p.catch.bind(p); }
        return child;
      },
      set(value) {
        validate(value, parts, 'set');
        abortTransactionsAround(parts);
        return enqueue({ type: 'set', parts, value: clone(value) });
      },
      update(values) {
        validate(values, parts, 'update');
        abortTransactionsAround(parts);
        const ops = Object.entries(values).map(([k, v]) => enqueue({ type: 'set', parts: parts.concat(splitPath(k)), value: clone(v) }));
        return Promise.all(ops).then(() => undefined);
      },
      remove() {
        abortTransactionsAround(parts);
        return enqueue({ type: 'remove', parts });
      },
      transaction(fn, onComplete, applyLocally) {
        if (typeof fn !== 'function') throw new Error('Reference.transaction failed: First argument must be a function');
        const op = { type: 'transaction', parts, fn };
        // 첫 실행에서 undefined 를 돌려주면 서버에 보내지 않고 바로 중단된다
        const cur = toVal(getAt(localTree(), parts));
        let first;
        try { first = fn(cur); } catch (e) { const p = Promise.reject(e); if (onComplete) p.catch(err => onComplete(err, false, null)); return p; }
        if (first === undefined) {
          const r = { committed: false, snapshot: snapshot(parts, localTree()) };
          if (onComplete) setTimeout(() => onComplete(null, false, r.snapshot), 0);
          return Promise.resolve(r);
        }
        const p = enqueue(op);
        if (onComplete) p.then(r => onComplete(null, r.committed, r.snapshot), e => onComplete(e, false, null));
        return p;
      },
      on(type, cb, cancel) {
        if (type !== 'value') throw new Error('fake: only value events are supported');
        if (path === '.info/connected') {
          const l = { cb };
          db.infoListeners.push(l);
          setTimeout(() => { if (db.infoListeners.includes(l)) cb({ key: 'connected', val: () => db.online, exists: () => true }); }, 0);
          return cb;
        }
        const l = { parts, cb, cancel, last: undefined };
        db.listeners.push(l);
        // 서버에서 첫 값을 받는다 (비동기). 오프라인이면 연결될 때까지 아무것도 오지 않는다 — 실제 SDK 와 같다
        const deliver = () => {
          if (!db.listeners.includes(l)) return;
          const tree = localTree();
          l.last = JSON.stringify(getAt(tree, parts));
          cb(snapshot(parts, tree));
        };
        if (db.online || db.everOnline) setTimeout(deliver, 0);
        else db.waiting.push(deliver);
        return cb;
      },
      off(type, cb) {
        if (path === '.info/connected') { db.infoListeners = db.infoListeners.filter(l => !cb || l.cb !== cb); return; }
        db.listeners = db.listeners.filter(l => !(l.parts.join('/') === path && (!cb || l.cb === cb)));
      },
      once(type, cb) {
        return new Promise((res, rej) => {
          const h = s => { ref.off(type, h); if (cb) cb(s); res(s); };
          ref.on(type, h, rej);
        });
      },
    };
    return ref;
  }
  let pushCounter = 0;
  db.waiting = [];
  db.everOnline = true;

  const database = {
    ref: p => makeRef(splitPath(p)),
    goOffline: () => controls.db.setOnline(false),
    goOnline: () => controls.db.setOnline(true),
  };

  // ─────────────── 인증 ───────────────
  const auth = {
    user: seed.user === null ? null : (seed.user || { uid, email: 'tester@example.com' }),
    listeners: [],
  };
  function notifyAuth() { for (const cb of auth.listeners.slice()) cb(auth.user); }
  const authInstance = {
    get currentUser() { return auth.user; },
    setPersistence: () => Promise.resolve(),
    onAuthStateChanged(cb) {
      auth.listeners.push(cb);
      setTimeout(() => { if (auth.listeners.includes(cb)) cb(auth.user); }, 0);
      return () => { auth.listeners = auth.listeners.filter(x => x !== cb); };
    },
    signInWithEmailAndPassword(email, pw) {
      if (seed.loginError) { const e = new Error(seed.loginError); e.code = seed.loginError; return Promise.reject(e); }
      auth.user = { uid, email };
      setTimeout(notifyAuth, 0);
      return Promise.resolve({ user: auth.user });
    },
    signOut() { auth.user = null; setTimeout(notifyAuth, 0); return Promise.resolve(); },
  };

  // ─────────────── Storage ───────────────
  const storage = {
    files: {},            // path → { size, contentType, meta }
    hold: false,          // true 면 업로드가 release() 까지 멈춘다 (느린 연결·앱 종료 시험)
    held: [],
    failPattern: null,    // 경로가 맞으면 업로드 실패
    deleteFailPattern: null,
    log: [],
  };
  const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  function downloadUrl(bucket, path) { return `${TINY_PNG}#${bucket}/${encodeURIComponent(path)}`; }
  function storageRef(bucket, path) {
    return {
      bucket, fullPath: path, name: path.split('/').pop(),
      put(blob, meta) {
        const listeners = [];
        let settled = null;
        const total = blob ? blob.size : 0;
        const promise = new Promise((resolve, reject) => {
          const run = () => {
            if (storage.failPattern && storage.failPattern.test(path)) {
              const e = new Error('fake upload failure'); e.code = 'storage/unknown';
              storage.log.push({ op: 'put-fail', path });
              settled = { err: e };
              listeners.forEach(l => l.error && l.error(e));
              reject(e); return;
            }
            const snap = (bytes) => ({ bytesTransferred: bytes, totalBytes: total, state: 'running', ref: storageRef(bucket, path) });
            listeners.forEach(l => l.next && l.next(snap(Math.floor(total / 2))));
            storage.files[path] = { size: total, contentType: meta && meta.contentType, meta: clone(meta || {}) };
            storage.log.push({ op: 'put', path, size: total });
            settled = { ok: true };
            listeners.forEach(l => l.next && l.next(snap(total)));
            listeners.forEach(l => l.complete && l.complete());
            resolve({ ref: storageRef(bucket, path), metadata: meta });
          };
          if (storage.hold) storage.held.push(run); else setTimeout(run, 0);
        });
        promise.catch(() => {});
        return {
          on(_evt, next, error, complete) {
            listeners.push({ next, error, complete });
            if (settled && settled.ok && complete) setTimeout(complete, 0);
            if (settled && settled.err && error) setTimeout(() => error(settled.err), 0);
            return () => {};
          },
          then: promise.then.bind(promise),
          catch: promise.catch.bind(promise),
          snapshot: { ref: storageRef(bucket, path) },
        };
      },
      getDownloadURL() {
        if (!storage.files[path]) { const e = new Error('Object not found'); e.code = 'storage/object-not-found'; return Promise.reject(e); }
        return Promise.resolve(downloadUrl(bucket, path));
      },
      delete() {
        storage.log.push({ op: 'delete', path });
        if (storage.deleteFailPattern && storage.deleteFailPattern.test(path)) { const e = new Error('fake delete failure'); e.code = 'storage/retry-limit-exceeded'; return Promise.reject(e); }
        if (!storage.files[path]) { const e = new Error('Object not found'); e.code = 'storage/object-not-found'; return Promise.reject(e); }
        delete storage.files[path];
        return Promise.resolve();
      },
    };
  }
  const app = {
    name: '[DEFAULT]',
    storage(bucket) { return { ref: p => storageRef(bucket || 'default', p) }; },
    database: () => database,
    auth: () => authInstance,
  };

  // ─────────────── firebase 네임스페이스 ───────────────
  const firebase = {
    initializeApp: () => app,
    app: () => app,
    apps: [app],
    database: () => database,
    storage: bucket => app.storage(bucket),
    SDK_VERSION: 'fake',
  };
  firebase.auth = () => authInstance;
  firebase.auth.Auth = { Persistence: { LOCAL: 'local', SESSION: 'session', NONE: 'none' } };
  firebase.database.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' } };
  window.firebase = firebase;

  // ─────────────── 시험 손잡이 ───────────────
  const controls = {
    db: {
      setOnline(on) {
        on = !!on;
        if (db.online === on) return;
        db.online = on;
        fireInfo();
        if (on) {
          db.everOnline = true;
          // 재연결: 밀린 쓰기를 먼저 보내고, 그 뒤 서버 모습을 받아 화면을 맞춘다
          if (!db.pending.length) { db.mirror = db.server; fireAll(); }
          else scheduleFlush();
          const w = db.waiting; db.waiting = []; w.forEach(f => f());
        }
      },
      isOnline: () => db.online,
      // 다른 기기(또는 다른 앱)가 서버에 쓴 것처럼 — 연결돼 있으면 곧바로 이 기기에 내려온다
      serverSet(path, value) {
        db.server = setAt(db.server, splitPath(path), value);
        db.writes.push({ type: 'external', path, value: clone(value) });
        if (db.online) { db.mirror = db.server; fireAll(); }   // 오프라인이면 재연결 때 내려온다
      },
      serverGet: path => toVal(getAt(db.server, splitPath(path))),
      localGet: path => toVal(getAt(localTree(), splitPath(path))),
      deny(v) { db.deny = !!v; },
      pending: () => db.pending.length,
      writes: () => clone(db.writes),
      listeners: () => db.listeners.map(l => l.parts.join('/')),
    },
    storage: {
      files: () => clone(storage.files),
      log: () => clone(storage.log),
      hold(v) { storage.hold = !!v; if (!storage.hold) controls.storage.release(); },
      release() { const h = storage.held; storage.held = []; h.forEach(f => f()); },
      heldCount: () => storage.held.length,
      failPattern(re) { storage.failPattern = re ? new RegExp(re) : null; },
      deleteFailPattern(re) { storage.deleteFailPattern = re ? new RegExp(re) : null; },
    },
    auth: {
      user: () => auth.user,
      signOut: () => authInstance.signOut(),
    },
  };
  window.__fake = controls;
})();
