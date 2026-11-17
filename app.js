/* 생성 파일 — 고치지 말 것. 원본은 src/app.jsx, 다시 만들기: npm run build */
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState,
  useEffect,
  useMemo,
  useRef
} = React;
const APP_VER = '20261117';
const CATEGORIES = ['투자', '가족', '집·이사', '자기계발', '건강', '앱개발', '기타'];
const STATUSES = ['대기', '진행', '보류', '완료', '중단'];
const ACTIVE_STATUSES = ['진행', '대기', '보류'];
const PRIORITIES = ['높음', '보통', '낮음'];
const CAT_COLORS = {
  '투자': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  '가족': 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  '집·이사': 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  '자기계발': 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
  '건강': 'bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300',
  '앱개발': 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  '기타': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
};
const STATUS_COLORS = {
  '진행': 'bg-blue-500',
  '대기': 'bg-slate-400',
  '보류': 'bg-amber-400',
  '완료': 'bg-emerald-500',
  '중단': 'bg-slate-500'
};
const PRIO_DOT = {
  '높음': 'bg-red-500',
  '보통': 'bg-amber-400',
  '낮음': 'bg-slate-300 dark:bg-slate-600'
};
const DIM = 'text-slate-500 dark:text-slate-400';
const AUTH_ERRORS = {
  'auth/invalid-email': '이메일 형식이 올바르지 않아요',
  'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않아요',
  'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않아요',
  'auth/user-not-found': '등록되지 않은 계정이에요',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 해주세요',
  'auth/network-request-failed': '네트워크에 연결할 수 없어요',
  'auth/unauthorized-domain': '이 주소가 Firebase 승인 도메인에 없어요'
};
function errText(e) {
  const s = String(e && (e.code || e.message) || e || '').toLowerCase();
  if (s.includes('permission') || s.includes('unauthorized') || s.includes('unauthenticated')) return '권한이 없어요. 로그아웃했다가 다시 로그인해 주세요';
  if (s.includes('disconnect') || s.includes('network') || s.includes('retry-limit') || s.includes('unavailable')) return '연결이 끊겼어요. 잠시 뒤 다시 눌러 주세요';
  if (s.includes('maxretry')) return '다른 기기와 겹쳤어요. 다시 눌러 주세요';
  if (s.includes('quota')) return '저장 공간이 모자라요';
  return '잠시 뒤 다시 해 주세요';
}
const IMG_BUCKET = 'gs://minsung-buboo2-goal-images';
const imgRef = path => firebase.app().storage(IMG_BUCKET).ref(path);
const IMG_MAX = 30 * 1024 * 1024;
function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
function safeName(name) {
  return (name || 'image').replace(/[\/\\#?%*:"<>|]/g, '_');
}
function makeThumb(file, max = 480) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const w = im.naturalWidth,
        h = im.naturalHeight;
      const s = Math.min(1, max / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * s);
      c.height = Math.round(h * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => resolve({
        blob: b,
        width: w,
        height: h
      }), 'image/jpeg', 0.8);
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    im.src = url;
  });
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(d) {
  return d ? d.replaceAll('-', '.') : '─';
}
function dday(targetDate, status) {
  if (!targetDate || status === '완료' || status === '중단') return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(targetDate + 'T00:00:00');
  const n = Math.floor((t - now) / 86400000);
  if (n === 0) return {
    text: 'D-Day',
    cls: 'text-amber-700 dark:text-amber-400 font-bold'
  };
  if (n > 0) return {
    text: `D-${n}`,
    cls: n <= 7 ? 'text-orange-700 dark:text-orange-400 font-semibold' : 'text-sky-700 dark:text-sky-400'
  };
  return {
    text: `D+${Math.abs(n)}`,
    cls: 'text-red-600 dark:text-red-400 font-semibold'
  };
}
function schedDate(s) {
  const d = new Date(s.start);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function schedDone(s) {
  if (s.done) return true;
  return Array.isArray(s.doneDates) && s.doneDates.includes(schedDate(s));
}
function isGoalSchedule(s) {
  return !!s && typeof s.memo === 'string' && s.memo.includes('[목표:');
}
function goalSchedules(val) {
  return Object.entries(val || {}).filter(([, v]) => isGoalSchedule(v)).map(([id, v]) => ({
    ...v,
    id
  }));
}
const TABLET_MQ = '(min-width: 900px) and (orientation: landscape) and (min-height: 500px)';
const FOLD_MQ = '(min-width: 600px) and (max-width: 899px) and (min-height: 500px), (min-width: 600px) and (orientation: portrait)';
function useMQ(query) {
  const [on, setOn] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const f = () => setOn(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', f) : mq.addListener(f);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', f) : mq.removeListener(f);
    };
  }, [query]);
  return on;
}
function Toast({
  toast
}) {
  if (!toast) return null;
  const color = toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800 dark:bg-slate-200 dark:text-slate-900';
  return React.createElement("div", {
    className: `wm-toast fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-max max-w-[92vw] px-4 py-2.5 rounded-xl text-white text-sm text-center shadow-lg ${color}`
  }, toast.msg);
}
const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400";
function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const st = useRef({});
  st.current = {
    email,
    pw,
    busy
  };
  const popup = useRef(false);
  useEffect(() => {
    window.__appBusy = () => !!(popup.current || st.current.busy || st.current.email || st.current.pw);
    return () => {
      delete window.__appBusy;
    };
  }, []);
  function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    firebase.auth().signInWithEmailAndPassword(email.trim(), pw).catch(ex => {
      setErr(AUTH_ERRORS[ex.code] || '로그인에 실패했어요');
      setBusy(false);
    });
  }
  async function google() {
    setErr('');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    popup.current = true;
    try {
      await firebase.auth().signInWithPopup(provider);
    } catch (ex) {
      if (ex.code === 'auth/popup-blocked' || ex.code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await firebase.auth().signInWithRedirect(provider);
          return;
        } catch (e2) {
          ex = e2;
        }
      }
      if (ex.code === 'auth/popup-closed-by-user' || ex.code === 'auth/cancelled-popup-request') return;
      setErr(ex.code === 'auth/admin-restricted-operation' ? '이 구글 계정은 등록되어 있지 않아요. 이메일·비밀번호로 로그인해 주세요' : AUTH_ERRORS[ex.code] || '로그인에 실패했어요');
    } finally {
      popup.current = false;
    }
  }
  return React.createElement("div", {
    className: "min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-6"
  }, React.createElement("form", {
    onSubmit: submit,
    className: "w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow p-6 space-y-4"
  }, React.createElement("div", {
    className: "text-center space-y-1"
  }, React.createElement("div", {
    className: "text-3xl",
    "aria-hidden": "true"
  }, "\uD83D\uDCCB"), React.createElement("h1", {
    className: "text-xl font-bold text-slate-800 dark:text-slate-100"
  }, "\uBAA9\uD45C \uAD00\uB9AC"), React.createElement("p", {
    className: `text-xs ${DIM}`
  }, "\uBBFC\uC131 \uC2A4\uCF00\uC904\uACFC \uAC19\uC740 \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694 (\uC77C\uC815 \uC5F0\uB3D9)")), React.createElement("input", {
    type: "email",
    required: true,
    placeholder: "\uC774\uBA54\uC77C",
    value: email,
    onChange: e => setEmail(e.target.value),
    className: inputCls
  }), React.createElement("input", {
    type: "password",
    required: true,
    placeholder: "\uBE44\uBC00\uBC88\uD638",
    value: pw,
    onChange: e => setPw(e.target.value),
    className: inputCls
  }), err && React.createElement("p", {
    className: "text-xs text-red-600 dark:text-red-400"
  }, err), React.createElement("button", {
    disabled: busy,
    className: "w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
  }, busy ? '로그인 중…' : '로그인'), React.createElement("button", {
    type: "button",
    onClick: google,
    className: "w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold"
  }, "\uAD6C\uAE00 \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778")));
}
function TaskForm({
  onSave,
  onClose,
  dirtyRef
}) {
  const [f, setF] = useState({
    title: '',
    category: CATEGORIES[0],
    status: '진행',
    priority: '보통',
    dueDate: '',
    firstLog: ''
  });
  const dirty = !!(f.title.trim() || f.firstLog.trim());
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => () => {
    dirtyRef.current = false;
  }, []);
  function submit(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    const now = Date.now();
    const task = {
      id: genId(),
      title: f.title.trim(),
      category: f.category,
      status: f.status,
      priority: f.priority,
      dueDate: f.dueDate || null,
      checklist: [],
      log: f.firstLog.trim() ? [{
        id: genId(),
        date: today(),
        text: f.firstLog.trim()
      }] : [],
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };
    if (onSave(task) === false) return;
    onClose();
  }
  return React.createElement("div", {
    className: "fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center",
    onClick: () => {
      if (!dirty) onClose();
    }
  }, React.createElement("form", {
    onSubmit: submit,
    onClick: e => e.stopPropagation(),
    className: "wm-form w-full sm:max-w-md bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-full overflow-y-auto"
  }, React.createElement("h2", {
    className: "font-bold text-slate-800 dark:text-slate-100"
  }, "\uC0C8 \uBAA9\uD45C"), React.createElement("input", {
    autoFocus: true,
    required: true,
    placeholder: "\uBAA9\uD45C \uC81C\uBAA9",
    value: f.title,
    onChange: e => setF({
      ...f,
      title: e.target.value
    }),
    className: inputCls
  }), React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, React.createElement("select", {
    "aria-label": "\uBD84\uB958",
    value: f.category,
    onChange: e => setF({
      ...f,
      category: e.target.value
    }),
    className: inputCls
  }, CATEGORIES.map(c => React.createElement("option", {
    key: c
  }, c))), React.createElement("select", {
    "aria-label": "\uC6B0\uC120\uC21C\uC704",
    value: f.priority,
    onChange: e => setF({
      ...f,
      priority: e.target.value
    }),
    className: inputCls
  }, PRIORITIES.map(p => React.createElement("option", {
    key: p
  }, p)))), React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, React.createElement("select", {
    "aria-label": "\uC0C1\uD0DC",
    value: f.status,
    onChange: e => setF({
      ...f,
      status: e.target.value
    }),
    className: inputCls
  }, ACTIVE_STATUSES.map(s => React.createElement("option", {
    key: s
  }, s))), React.createElement("input", {
    type: "date",
    "aria-label": "\uBAA9\uD45C \uAE30\uD55C (\uC120\uD0DD)",
    value: f.dueDate,
    onChange: e => setF({
      ...f,
      dueDate: e.target.value
    }),
    className: inputCls,
    title: "\uBAA9\uD45C \uAE30\uD55C (\uC120\uD0DD)"
  })), React.createElement("textarea", {
    placeholder: "\uCCAB \uC9C4\uD589 \uAE30\uB85D (\uC120\uD0DD)",
    value: f.firstLog,
    onChange: e => setF({
      ...f,
      firstLog: e.target.value
    }),
    rows: "2",
    className: inputCls
  }), React.createElement("div", {
    className: "flex gap-2 pt-1"
  }, React.createElement("button", {
    type: "button",
    onClick: onClose,
    className: "flex-1 h-11 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200"
  }, "\uCDE8\uC18C"), React.createElement("button", {
    className: "flex-1 h-11 rounded-lg bg-blue-600 text-white text-sm font-semibold"
  }, "\uCD94\uAC00"))));
}
function InfoSheet({
  user,
  tasks,
  onClose
}) {
  function backup() {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], {
      type: 'application/json'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `목표백업_${today()}.json`;
    a.click();
  }
  function logout() {
    if (!confirm('로그아웃할까요?\n이 기기에 받아 둔 사본도 지워져요.')) return;
    firebase.auth().signOut();
  }
  const row = 'flex items-center justify-between gap-3';
  return React.createElement("div", {
    className: "fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center",
    onClick: onClose
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "wm-info w-full sm:max-w-sm bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-full overflow-y-auto"
  }, React.createElement("h2", {
    className: "font-bold text-slate-800 dark:text-slate-100"
  }, "\uC815\uBCF4"), React.createElement("dl", {
    className: "text-sm space-y-2 text-slate-600 dark:text-slate-300"
  }, React.createElement("div", {
    className: row
  }, React.createElement("dt", null, "\uD310"), React.createElement("dd", {
    className: "wm-ver font-medium text-slate-800 dark:text-slate-100"
  }, APP_VER)), React.createElement("div", {
    className: row
  }, React.createElement("dt", {
    className: "shrink-0"
  }, "\uACC4\uC815"), React.createElement("dd", {
    className: "min-w-0 truncate font-medium text-slate-800 dark:text-slate-100"
  }, user.email || '─')), React.createElement("div", {
    className: row
  }, React.createElement("dt", null, "\uBAA9\uD45C"), React.createElement("dd", {
    className: "font-medium text-slate-800 dark:text-slate-100"
  }, tasks.length, "\uAC1C"))), React.createElement("button", {
    onClick: backup,
    className: "w-full h-11 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200"
  }, "\u2B07 \uBC31\uC5C5 \uD30C\uC77C \uBC1B\uAE30"), React.createElement("p", {
    className: `text-xs ${DIM}`
  }, "\uBC31\uC5C5 \uD30C\uC77C\uC5D0\uB294 \uC0AC\uC9C4\uC744 \uC5EC\uB294 \uC8FC\uC18C\uAC00 \uB4E4\uC5B4 \uC788\uC5B4\uC694. \uB0A8\uC5D0\uAC8C \uC8FC\uBA74 \uC0AC\uC9C4\uB3C4 \uBCF4\uC5EC\uC694."), React.createElement("button", {
    onClick: logout,
    className: "w-full h-11 rounded-lg border border-red-300 dark:border-red-800 text-sm text-red-600 dark:text-red-400"
  }, "\u21A9 \uB85C\uADF8\uC544\uC6C3"), React.createElement("button", {
    onClick: onClose,
    className: "w-full h-11 rounded-lg bg-blue-600 text-white text-sm font-semibold"
  }, "\uB2EB\uAE30")));
}
function TaskDetail({
  task,
  uid,
  day,
  schedules,
  onUpdate,
  onDelete,
  onClose,
  onSendSchedule,
  onToast,
  canWrite,
  bridge,
  inline,
  twoCol
}) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(task);
  const [newLog, setNewLog] = useState('');
  const [logDate, setLogDate] = useState(null);
  const [newCheck, setNewCheck] = useState('');
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedDateV, setSchedDateV] = useState(null);
  const [schedTime, setSchedTime] = useState('');
  const [uploading, setUploading] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [titleOpen, setTitleOpen] = useState(false);
  const fileInput = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);
  useEffect(() => {
    if (!editing) setF(task);
  }, [task]);
  const patch = fn => onUpdate(task.id, fn);
  const dirty = editing && ((f.title || '') !== (task.title || '') || f.category !== task.category || f.priority !== task.priority || (f.dueDate || '') !== (task.dueDate || '')) || !!newLog.trim() || !!newCheck.trim();
  const now = useRef({});
  now.current = {
    dirty,
    uploading,
    viewer
  };
  const canLeave = () => !now.current.dirty || confirm('쓰던 글이 있어요. 버리고 나갈까요?');
  useEffect(() => {
    bridge.current = {
      canLeave,
      isBusy: () => !!(now.current.dirty || now.current.uploading),
      back: viewer ? () => setViewer(null) : null
    };
  });
  useEffect(() => () => {
    bridge.current = null;
  }, []);
  const requestClose = () => {
    if (canLeave()) onClose();
  };
  const images = task.images || [];
  async function addImages(fileList) {
    const files = Array.from(fileList || []).filter(x => x.type.startsWith('image/'));
    const clear = () => {
      if (fileInput.current) fileInput.current.value = '';
    };
    if (!files.length) return;
    if (!canWrite()) {
      clear();
      return;
    }
    const tooBig = files.find(x => x.size >= IMG_MAX);
    if (tooBig) {
      onToast(`${tooBig.name}은(는) 30MB를 넘어 올릴 수 없어요`, 'error');
      clear();
      return;
    }
    setUploading({
      done: 0,
      total: files.length,
      pct: 0
    });
    const added = [];
    let failed = null;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const id = genId();
        const name = safeName(file.name);
        const base = `goal-images/${uid}/${task.id}/${id}`;
        const meta = {
          contentType: file.type,
          cacheControl: 'private, max-age=31536000, immutable',
          contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
          customMetadata: {
            taskId: task.id,
            originalName: name
          }
        };
        const ref = imgRef(`${base}_${name}`);
        await new Promise((res, rej) => {
          ref.put(file, meta).on('state_changed', s => {
            if (alive.current) setUploading({
              done: i,
              total: files.length,
              pct: Math.round(s.bytesTransferred / s.totalBytes * 100)
            });
          }, rej, res);
        });
        const url = await ref.getDownloadURL();
        let thumbUrl = null,
          thumbPath = null,
          width = null,
          height = null;
        const th = await makeThumb(file);
        if (th) {
          width = th.width;
          height = th.height;
          if (th.blob) {
            try {
              const tref = imgRef(`${base}_thumb.jpg`);
              await tref.put(th.blob, {
                contentType: 'image/jpeg',
                cacheControl: 'private, max-age=31536000, immutable'
              });
              thumbPath = tref.fullPath;
              thumbUrl = await tref.getDownloadURL();
            } catch (e) {}
          }
        }
        added.push({
          id,
          name,
          path: ref.fullPath,
          url,
          thumbPath,
          thumbUrl,
          size: file.size,
          type: file.type,
          width,
          height,
          createdAt: Date.now()
        });
      }
    } catch (e) {
      failed = e;
    }
    if (added.length) {
      const list = added.slice();
      Promise.resolve(patch(cur => ({
        ...cur,
        images: [...(cur.images || []), ...list]
      }))).then(ok => {
        if (ok) {
          if (!failed) onToast(`이미지 ${list.length}장을 저장했어요 🖼️`);
          return;
        }
        for (const a of list) {
          imgRef(a.path).delete().catch(() => {});
          if (a.thumbPath) imgRef(a.thumbPath).delete().catch(() => {});
        }
      });
    }
    if (failed) onToast('이미지 업로드 실패 — ' + errText(failed), 'error');
    if (alive.current) setUploading(null);
    clear();
  }
  function delImage(img) {
    if (!canWrite()) return;
    if (!confirm(`「${img.name}」을(를) 원본까지 지울까요?`)) return;
    const p = patch(cur => ({
      ...cur,
      images: (cur.images || []).filter(x => x.id !== img.id)
    }));
    if (p === false) return;
    setViewer(null);
    p.then(ok => {
      if (!ok) return;
      imgRef(img.path).delete().catch(() => {});
      if (img.thumbPath) imgRef(img.thumbPath).delete().catch(() => {});
    });
  }
  const viewing = viewer ? images.find(x => x.id === viewer) : null;
  const linked = useMemo(() => schedules.filter(s => (s.memo || '').includes(`[목표:${task.id}]`)).sort((a, b) => b.start - a.start), [schedules, task.id]);
  function saveEdit() {
    const {
      title,
      category,
      priority,
      dueDate
    } = f;
    const p = patch(cur => ({
      ...cur,
      title: (title || '').trim() || cur.title,
      category,
      priority,
      dueDate: dueDate || null
    }));
    if (p === false) return;
    setEditing(false);
    p.then(ok => {
      if (!ok && alive.current) {
        setF(v => ({
          ...v,
          title,
          category,
          priority,
          dueDate
        }));
        setEditing(true);
      }
    });
  }
  function cancelEdit() {
    setF(task);
    setEditing(false);
  }
  function setStatus(st) {
    patch(cur => ({
      ...cur,
      status: st,
      completedAt: st === '완료' ? cur.completedAt || Date.now() : null
    }));
  }
  function addLog() {
    const text = newLog.trim();
    if (!text) return;
    const entry = {
      id: genId(),
      date: logDate || today(),
      text
    };
    const p = patch(cur => ({
      ...cur,
      log: [...(cur.log || []), entry]
    }));
    if (p === false) return;
    setNewLog('');
    p.then(ok => {
      if (!ok && alive.current) setNewLog(v => v || text);
    });
  }
  function delLog(id) {
    if (!canWrite()) return;
    if (!confirm('이 기록을 지울까요?')) return;
    patch(cur => ({
      ...cur,
      log: (cur.log || []).filter(l => l.id !== id)
    }));
  }
  function addCheck() {
    const text = newCheck.trim();
    if (!text) return;
    const entry = {
      id: genId(),
      text,
      done: false,
      doneDate: null
    };
    const p = patch(cur => ({
      ...cur,
      checklist: [...(cur.checklist || []), entry]
    }));
    if (p === false) return;
    setNewCheck('');
    p.then(ok => {
      if (!ok && alive.current) setNewCheck(v => v || text);
    });
  }
  function toggleCheck(id) {
    const cur0 = (task.checklist || []).find(c => c.id === id);
    const done = !(cur0 && cur0.done),
      doneDate = done ? today() : null;
    patch(cur => ({
      ...cur,
      checklist: (cur.checklist || []).map(c => c.id === id ? {
        ...c,
        done,
        doneDate
      } : c)
    }));
  }
  function delCheck(c) {
    if (!canWrite()) return;
    if (!confirm(`「${c.text}」 단계를 지울까요?`)) return;
    patch(cur => ({
      ...cur,
      checklist: (cur.checklist || []).filter(x => x.id !== c.id)
    }));
  }
  function sendSchedule() {
    const ok = onSendSchedule(task, schedDateV === null ? today() : schedDateV, schedTime);
    if (ok === false) return;
    setSchedOpen(false);
    setSchedTime('');
  }
  const checklist = task.checklist || [];
  const log = [...(task.log || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id > a.id ? 1 : -1));
  const doneCount = checklist.filter(c => c.done).length;
  const dd = dday(task.dueDate, task.status);
  const h3 = 'text-sm font-semibold text-slate-700 dark:text-slate-200';
  const linkBtn = 'h-10 -my-2 -mr-2 px-2 text-xs font-medium text-blue-600 dark:text-blue-400';
  const infoCard = React.createElement("div", {
    className: "wm-d-info bg-white dark:bg-slate-800 rounded-xl p-4 space-y-3"
  }, editing ? React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, React.createElement("select", {
    "aria-label": "\uBD84\uB958",
    value: f.category,
    onChange: e => setF({
      ...f,
      category: e.target.value
    }),
    className: inputCls
  }, CATEGORIES.map(c => React.createElement("option", {
    key: c
  }, c))), React.createElement("select", {
    "aria-label": "\uC6B0\uC120\uC21C\uC704",
    value: f.priority,
    onChange: e => setF({
      ...f,
      priority: e.target.value
    }),
    className: inputCls
  }, PRIORITIES.map(p => React.createElement("option", {
    key: p
  }, p))), React.createElement("input", {
    type: "date",
    "aria-label": "\uBAA9\uD45C \uAE30\uD55C",
    value: f.dueDate || '',
    onChange: e => setF({
      ...f,
      dueDate: e.target.value
    }),
    className: `${inputCls} col-span-2`
  })) : React.createElement("div", {
    className: "flex flex-wrap items-center gap-2 text-sm"
  }, React.createElement("span", {
    className: `px-2 py-0.5 rounded-md text-xs font-medium ${CAT_COLORS[task.category] || CAT_COLORS['기타']}`
  }, task.category), React.createElement("span", {
    className: "flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300"
  }, React.createElement("span", {
    className: `w-2 h-2 rounded-full ${PRIO_DOT[task.priority]}`
  }), task.priority), React.createElement("span", {
    className: `text-xs ${DIM}`
  }, "\uAE30\uD55C ", fmtDate(task.dueDate)), dd && React.createElement("span", {
    className: `text-xs ${dd.cls}`
  }, dd.text)), React.createElement("div", {
    className: "flex flex-wrap gap-1.5"
  }, STATUSES.map(st => React.createElement("button", {
    key: st,
    onClick: () => setStatus(st),
    className: `min-h-[36px] px-3.5 rounded-lg text-xs font-medium border transition
              ${task.status === st ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`
  }, st))), task.completedAt && React.createElement("p", {
    className: "text-xs text-emerald-700 dark:text-emerald-400"
  }, "\u2713 ", new Date(task.completedAt).toLocaleDateString('ko-KR'), " \uC644\uB8CC"));
  const imgCard = React.createElement("div", {
    className: "wm-d-img bg-white dark:bg-slate-800 rounded-xl p-4 space-y-2"
  }, React.createElement("div", {
    className: "flex items-center justify-between"
  }, React.createElement("h3", {
    className: h3
  }, "\uD83D\uDDBC\uFE0F \uC774\uBBF8\uC9C0 ", images.length > 0 && React.createElement("span", {
    className: `font-normal text-xs ${DIM}`
  }, "(", images.length, ")")), React.createElement("input", {
    ref: fileInput,
    type: "file",
    accept: "image/*",
    multiple: true,
    hidden: true,
    onChange: e => addImages(e.target.files)
  }), React.createElement("button", {
    onClick: () => fileInput.current && fileInput.current.click(),
    disabled: !!uploading,
    className: `${linkBtn} disabled:opacity-50`
  }, uploading ? `올리는 중 ${uploading.done + 1}/${uploading.total} · ${uploading.pct}%` : '＋ 첨부')), uploading && React.createElement("div", {
    className: "h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"
  }, React.createElement("div", {
    className: "h-full bg-blue-500 rounded-full transition-all",
    style: {
      width: uploading.pct + '%'
    }
  })), images.length === 0 && !uploading ? React.createElement("p", {
    className: `text-xs ${DIM}`
  }, "\uC774 \uBAA9\uD45C\uB97C \uC138\uC6B0\uAC8C \uD55C \uC0AC\uC9C4, \uB3C4\uB2EC\uD588\uC744 \uB54C\uC758 \uBAA8\uC2B5\uC744 \uC6D0\uBCF8 \uADF8\uB300\uB85C \uBCF4\uAD00\uD574\uC694.") : React.createElement("div", {
    className: "wm-d-thumbs grid grid-cols-3 gap-2"
  }, images.map(img => React.createElement("button", {
    key: img.id,
    onClick: () => setViewer(img.id),
    "aria-label": `${img.name} 크게 보기`,
    className: "relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700"
  }, React.createElement("img", {
    src: img.thumbUrl || img.url,
    alt: img.name,
    loading: "lazy",
    className: "w-full h-full object-cover"
  })))));
  const checkCard = React.createElement("div", {
    className: "wm-d-check bg-white dark:bg-slate-800 rounded-xl p-4 space-y-1"
  }, React.createElement("div", {
    className: "flex items-center justify-between"
  }, React.createElement("h3", {
    className: h3
  }, "\uCCB4\uD06C\uB9AC\uC2A4\uD2B8"), checklist.length > 0 && React.createElement("span", {
    className: `text-xs ${DIM}`
  }, doneCount, "/", checklist.length)), checklist.map(c => React.createElement("div", {
    key: c.id,
    className: "flex items-center gap-1 group"
  }, React.createElement("button", {
    onClick: () => toggleCheck(c.id),
    "aria-label": c.done ? '끝냄 표시 풀기' : '끝냄 표시',
    className: "w-10 h-10 -ml-2 shrink-0 flex items-center justify-center"
  }, React.createElement("span", {
    className: `w-6 h-6 rounded-md border flex items-center justify-center text-sm
              ${c.done ? 'bg-emerald-700 border-emerald-700 text-white' : 'border-slate-400 dark:border-slate-500'}`
  }, c.done ? '✓' : '')), React.createElement("span", {
    className: `flex-1 min-w-0 text-sm [overflow-wrap:anywhere] ${c.done ? `line-through ${DIM}` : 'text-slate-700 dark:text-slate-200'}`
  }, c.text), c.done && c.doneDate && React.createElement("span", {
    className: `text-[10px] shrink-0 ${DIM}`
  }, fmtDate(c.doneDate)), React.createElement("button", {
    onClick: () => delCheck(c),
    "aria-label": "\uC774 \uB2E8\uACC4 \uC9C0\uC6B0\uAE30",
    className: `w-10 h-10 -mr-2 shrink-0 flex items-center justify-center text-sm hover:text-red-500 ${DIM}`
  }, "\u2715"))), React.createElement("div", {
    className: "flex gap-2 pt-1"
  }, React.createElement("input", {
    placeholder: "\uD558\uC704 \uB2E8\uACC4 \uCD94\uAC00",
    value: newCheck,
    onChange: e => setNewCheck(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCheck();
      }
    },
    className: inputCls
  }), React.createElement("button", {
    onClick: addCheck,
    "aria-label": "\uB2E8\uACC4 \uCD94\uAC00",
    className: "w-11 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200"
  }, "\uFF0B")));
  const schedCard = React.createElement("div", {
    className: "wm-d-sched bg-white dark:bg-slate-800 rounded-xl p-4 space-y-2"
  }, React.createElement("div", {
    className: "flex items-center justify-between"
  }, React.createElement("h3", {
    className: h3
  }, "\uD83D\uDCC5 \uC77C\uC815 \uC5F0\uB3D9 ", React.createElement("span", {
    className: `font-normal text-xs ${DIM}`
  }, "(\uBBFC\uC131 \uC2A4\uCF00\uC904)")), React.createElement("button", {
    onClick: () => setSchedOpen(!schedOpen),
    className: linkBtn
  }, "\uC77C\uC815\uC73C\uB85C \uBCF4\uB0B4\uAE30")), schedOpen && React.createElement("div", {
    className: "flex flex-wrap gap-2 items-center bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2"
  }, React.createElement("input", {
    type: "date",
    "aria-label": "\uBCF4\uB0BC \uB0A0\uC9DC",
    value: schedDateV === null ? day : schedDateV,
    onChange: e => setSchedDateV(e.target.value),
    className: `${inputCls} !w-auto flex-1`
  }), React.createElement("input", {
    type: "time",
    "aria-label": "\uC2DC\uAC01 (\uBE44\uC6B0\uBA74 \uC885\uC77C)",
    value: schedTime,
    onChange: e => setSchedTime(e.target.value),
    className: `${inputCls} !w-auto`,
    title: "\uBE44\uC6B0\uBA74 \uC885\uC77C"
  }), React.createElement("button", {
    onClick: sendSchedule,
    className: "h-[42px] px-4 rounded-lg bg-blue-600 text-white text-xs font-semibold"
  }, "\uBCF4\uB0B4\uAE30")), linked.length === 0 ? React.createElement("p", {
    className: `text-xs ${DIM}`
  }, "\uC544\uC9C1 \uC5F0\uB3D9\uB41C \uC77C\uC815\uC774 \uC5C6\uC5B4\uC694. \uC2E4\uD589\uD560 \uB0A0\uC744 \uC815\uD558\uBA74 \uC77C\uC815 \uC571\uC5D0 \uB098\uD0C0\uB098\uC694.") : linked.map(s => React.createElement("div", {
    key: s.id,
    className: "flex items-center gap-2 text-sm"
  }, React.createElement("span", {
    className: `w-2 h-2 rounded-full shrink-0 ${schedDone(s) ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`
  }), React.createElement("span", {
    className: "text-slate-600 dark:text-slate-300"
  }, fmtDate(schedDate(s))), React.createElement("span", {
    className: "flex-1 truncate text-slate-600 dark:text-slate-300"
  }, s.title), schedDone(s) && React.createElement("span", {
    className: "text-[10px] text-emerald-700 dark:text-emerald-400 font-medium"
  }, "\uC644\uB8CC"))));
  const logCard = React.createElement("div", {
    className: "wm-d-log bg-white dark:bg-slate-800 rounded-xl p-4 space-y-3"
  }, React.createElement("h3", {
    className: h3
  }, "\uC9C4\uD589 \uB85C\uADF8 ", React.createElement("span", {
    className: `font-normal text-xs ${DIM}`
  }, "(", log.length, ")")), React.createElement("div", {
    className: "space-y-1.5"
  }, React.createElement("div", {
    className: "flex gap-2"
  }, React.createElement("input", {
    type: "date",
    "aria-label": "\uAE30\uB85D \uB0A0\uC9DC",
    value: logDate === null ? day : logDate,
    onChange: e => setLogDate(e.target.value),
    className: `${inputCls} !w-auto`
  }), React.createElement("button", {
    onClick: addLog,
    className: "px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold ml-auto"
  }, "\uAE30\uB85D")), React.createElement("textarea", {
    placeholder: "\uC624\uB298 \uC9C4\uD589\uD55C \uB0B4\uC6A9\u2026",
    value: newLog,
    onChange: e => setNewLog(e.target.value),
    rows: "2",
    className: inputCls
  })), React.createElement("div", {
    className: "space-y-3 pt-1"
  }, log.map(l => React.createElement("div", {
    key: l.id,
    className: "flex gap-3 group"
  }, React.createElement("div", {
    className: "flex flex-col items-center"
  }, React.createElement("span", {
    className: "w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0"
  }), React.createElement("span", {
    className: "flex-1 w-px bg-slate-200 dark:bg-slate-700"
  })), React.createElement("div", {
    className: "flex-1 min-w-0 pb-1"
  }, React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement("span", {
    className: `text-xs font-medium ${DIM}`
  }, fmtDate(l.date)), React.createElement("button", {
    onClick: () => delLog(l.id),
    "aria-label": "\uC774 \uAE30\uB85D \uC9C0\uC6B0\uAE30",
    className: `ml-auto w-10 h-10 -my-3 -mr-2 shrink-0 flex items-center justify-center text-sm hover:text-red-500 ${DIM}`
  }, "\u2715")), React.createElement("p", {
    className: "text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap [overflow-wrap:anywhere]"
  }, l.text)))), log.length === 0 && React.createElement("p", {
    className: `text-xs ${DIM}`
  }, "\uC9C4\uD589 \uAE30\uB85D\uC774 \uC5EC\uAE30\uC5D0 \uC313\uC5EC\uC694.")));
  const delBlock = React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: () => {
      if (!canWrite()) return;
      if (confirm('이 목표를 이력까지 전부 지울까요?\n(끝낸 목표라면 상태를 「완료」로 바꾸면 돼요)')) onDelete(task.id);
    },
    className: "wm-d-del w-full h-11 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm"
  }, "\uBAA9\uD45C \uC0AD\uC81C"), React.createElement("p", {
    className: `wm-d-created text-center text-[10px] pb-4 ${DIM}`
  }, "\uC0DD\uC131 ", new Date(task.createdAt).toLocaleDateString('ko-KR')));
  return React.createElement("div", {
    className: inline ? 'wm-detail-inline' : 'fixed inset-0 z-30 bg-black/40 flex justify-end',
    onClick: inline ? undefined : requestClose
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: inline ? 'wm-detail-scroll bg-slate-50 dark:bg-slate-900' : 'w-full sm:max-w-lg h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto shadow-2xl'
  }, React.createElement("div", {
    className: "sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-2 py-1.5 flex items-center gap-1"
  }, React.createElement("button", {
    onClick: requestClose,
    "aria-label": "\uB2EB\uAE30",
    className: `w-10 h-10 shrink-0 flex items-center justify-center text-xl ${DIM}`
  }, "\u2190"), editing ? React.createElement("input", {
    "aria-label": "\uBAA9\uD45C \uC81C\uBAA9",
    value: f.title,
    onChange: e => setF({
      ...f,
      title: e.target.value
    }),
    className: inputCls
  }) : React.createElement("h2", {
    onClick: () => setTitleOpen(o => !o),
    className: `flex-1 min-w-0 py-1.5 font-bold text-slate-800 dark:text-slate-100 [overflow-wrap:anywhere] ${titleOpen ? '' : 'line-clamp-2'}`
  }, task.title), editing ? React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: cancelEdit,
    className: `h-10 px-2 shrink-0 text-sm ${DIM}`
  }, "\uCDE8\uC18C"), React.createElement("button", {
    onClick: saveEdit,
    className: "h-10 px-2 shrink-0 text-sm font-semibold text-blue-600 dark:text-blue-400"
  }, "\uC800\uC7A5")) : React.createElement("button", {
    onClick: () => setEditing(true),
    className: `h-10 px-2 shrink-0 text-sm ${DIM}`
  }, "\uD3B8\uC9D1")), React.createElement("div", {
    className: "wm-d-body p-4 space-y-5"
  }, inline && twoCol ? React.createElement(React.Fragment, null, infoCard, React.createElement("div", {
    className: "wm-d-col"
  }, imgCard, checkCard, React.createElement("div", {
    className: "wm-d-spacer"
  }), delBlock), React.createElement("div", {
    className: "wm-d-col"
  }, schedCard, logCard)) : React.createElement(React.Fragment, null, infoCard, imgCard, checkCard, schedCard, logCard, delBlock))), viewing && React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/95 flex flex-col",
    onClick: e => {
      e.stopPropagation();
      setViewer(null);
    }
  }, React.createElement("div", {
    className: "flex items-center gap-2 px-2 py-2 text-white/90",
    style: {
      paddingTop: 'calc(env(safe-area-inset-top) + 8px)'
    },
    onClick: e => e.stopPropagation()
  }, React.createElement("button", {
    onClick: () => setViewer(null),
    "aria-label": "\uB2EB\uAE30",
    className: "w-10 h-10 shrink-0 flex items-center justify-center text-xl"
  }, "\u2190"), React.createElement("div", {
    className: "flex-1 min-w-0"
  }, React.createElement("p", {
    className: "text-sm truncate"
  }, viewing.name), React.createElement("p", {
    className: "text-[11px] text-white/70"
  }, viewing.width && viewing.height ? `${viewing.width}×${viewing.height} · ` : '', fmtBytes(viewing.size), viewing.createdAt ? ` · ${new Date(viewing.createdAt).toLocaleDateString('ko-KR')}` : '')), React.createElement("a", {
    href: viewing.url,
    download: viewing.name,
    target: "_blank",
    rel: "noopener",
    className: "h-10 px-3 shrink-0 flex items-center rounded-lg bg-white/15 hover:bg-white/25 text-xs font-medium",
    title: "\uC6D0\uBCF8 \uD30C\uC77C \uB2E4\uC6B4\uB85C\uB4DC"
  }, "\u2B07 \uC6D0\uBCF8"), React.createElement("button", {
    onClick: () => delImage(viewing),
    className: "w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-sm text-red-300 hover:bg-white/10",
    title: "\uC0AD\uC81C",
    "aria-label": "\uC774 \uC0AC\uC9C4 \uC9C0\uC6B0\uAE30"
  }, "\uD83D\uDDD1")), React.createElement("div", {
    className: "flex-1 min-h-0 flex items-center justify-center p-2",
    onClick: e => e.stopPropagation()
  }, React.createElement("img", {
    src: viewing.url,
    alt: viewing.name,
    className: "max-w-full max-h-full object-contain"
  })), images.length > 1 && React.createElement("div", {
    className: "flex gap-1.5 overflow-x-auto px-4 py-3",
    style: {
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)'
    },
    onClick: e => e.stopPropagation()
  }, images.map(img => React.createElement("button", {
    key: img.id,
    onClick: () => setViewer(img.id),
    "aria-label": `${img.name} 보기`,
    className: `w-14 h-14 shrink-0 rounded-md overflow-hidden border-2 ${img.id === viewing.id ? 'border-white' : 'border-transparent opacity-60'}`
  }, React.createElement("img", {
    src: img.thumbUrl || img.url,
    alt: "",
    className: "w-full h-full object-cover"
  }))))));
}
function TaskCard({
  task,
  onSelect,
  active
}) {
  const checklist = task.checklist || [];
  const doneCount = checklist.filter(c => c.done).length;
  const pct = checklist.length ? Math.round(doneCount / checklist.length * 100) : null;
  const lastLog = (task.log || []).reduce((m, l) => (l.date || '') > m ? l.date : m, '');
  const dd = dday(task.dueDate, task.status);
  const cover = (task.images || [])[0];
  return React.createElement("button", {
    onClick: () => onSelect(task),
    className: `wm-card${active ? ' wm-card-active' : ''} w-full text-left bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm hover:shadow transition space-y-2`
  }, React.createElement("div", {
    className: "flex items-start gap-2"
  }, React.createElement("span", {
    className: `w-2 h-2 mt-1.5 rounded-full shrink-0 ${STATUS_COLORS[task.status] || 'bg-slate-400'}`
  }), React.createElement("span", {
    className: "flex-1 min-w-0 font-semibold text-sm text-slate-800 dark:text-slate-100 line-clamp-3 [overflow-wrap:anywhere]"
  }, task.title), dd && React.createElement("span", {
    className: `text-xs shrink-0 mt-0.5 ${dd.cls}`
  }, dd.text), cover && React.createElement("img", {
    src: cover.thumbUrl || cover.url,
    alt: "",
    loading: "lazy",
    className: "w-9 h-9 rounded-md object-cover shrink-0"
  })), React.createElement("div", {
    className: `flex items-center gap-2 text-xs ${DIM}`
  }, React.createElement("span", {
    className: `px-1.5 py-0.5 rounded text-[10px] font-medium ${CAT_COLORS[task.category] || CAT_COLORS['기타']}`
  }, task.category), React.createElement("span", {
    className: `w-1.5 h-1.5 rounded-full ${PRIO_DOT[task.priority]}`
  }), React.createElement("span", null, task.status), lastLog && React.createElement("span", {
    className: "ml-auto"
  }, "\uCD5C\uADFC \uAE30\uB85D ", fmtDate(lastLog))), pct !== null && React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement("div", {
    className: "flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"
  }, React.createElement("div", {
    className: "h-full bg-emerald-500 rounded-full",
    style: {
      width: pct + '%'
    }
  })), React.createElement("span", {
    className: `text-[10px] ${DIM}`
  }, doneCount, "/", checklist.length)));
}
function Overview({
  tasks,
  onSelect
}) {
  const cnt = st => tasks.filter(t => t.status === st).length;
  const active = tasks.filter(t => ACTIVE_STATUSES.includes(t.status));
  const due = active.filter(t => t.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
  const recent = tasks.flatMap(t => (t.log || []).map(l => ({
    ...l,
    task: t
  }))).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id > a.id ? 1 : -1)).slice(0, 6);
  const byCat = CATEGORIES.map(c => [c, active.filter(t => t.category === c).length]).filter(x => x[1] > 0);
  const maxCat = Math.max(1, ...byCat.map(x => x[1]));
  const card = 'bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm';
  const h3 = 'text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3';
  return React.createElement("div", {
    className: "wm-overview"
  }, React.createElement("div", {
    className: "wm-ov-tiles"
  }, STATUSES.map(st => React.createElement("div", {
    key: st,
    className: `${card} !p-4`
  }, React.createElement("div", {
    className: `flex items-center gap-1.5 text-xs ${DIM}`
  }, React.createElement("span", {
    className: `w-2 h-2 rounded-full ${STATUS_COLORS[st]}`
  }), st), React.createElement("div", {
    className: "text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1"
  }, cnt(st))))), React.createElement("div", {
    className: `${card} wm-ov-col`
  }, React.createElement("h3", {
    className: h3
  }, "\u23F0 \uB2E4\uAC00\uC624\uB294 \uAE30\uD55C"), due.length === 0 && React.createElement("p", {
    className: `text-xs ${DIM}`
  }, "\uAE30\uD55C\uC744 \uC815\uD55C \uC9C4\uD589 \uC911 \uBAA9\uD45C\uAC00 \uC5C6\uC5B4\uC694."), due.map(t => {
    const dd = dday(t.dueDate, t.status);
    return React.createElement("button", {
      key: t.id,
      onClick: () => onSelect(t),
      className: "wm-ov-row"
    }, React.createElement("span", {
      className: `w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[t.status]}`
    }), React.createElement("span", {
      className: "flex-1 truncate text-sm text-slate-700 dark:text-slate-200"
    }, t.title), React.createElement("span", {
      className: `text-xs ${DIM}`
    }, fmtDate(t.dueDate)), dd && React.createElement("span", {
      className: `text-xs w-14 text-right ${dd.cls}`
    }, dd.text));
  })), React.createElement("div", {
    className: `${card} wm-ov-col`
  }, React.createElement("h3", {
    className: h3
  }, "\uD83D\uDCDD \uCD5C\uADFC \uC9C4\uD589 \uAE30\uB85D"), recent.length === 0 && React.createElement("p", {
    className: `text-xs ${DIM}`
  }, "\uC9C4\uD589 \uAE30\uB85D\uC774 \uC544\uC9C1 \uC5C6\uC5B4\uC694."), recent.map(l => React.createElement("button", {
    key: l.task.id + l.id,
    onClick: () => onSelect(l.task),
    className: "wm-ov-row !items-start"
  }, React.createElement("span", {
    className: `text-xs font-medium shrink-0 w-20 pt-0.5 ${DIM}`
  }, fmtDate(l.date)), React.createElement("span", {
    className: "flex-1 min-w-0"
  }, React.createElement("span", {
    className: "block text-xs text-blue-600 dark:text-blue-400 truncate"
  }, l.task.title), React.createElement("span", {
    className: "block text-sm text-slate-700 dark:text-slate-200 truncate"
  }, l.text))))), React.createElement("div", {
    className: `${card} wm-ov-cats`
  }, React.createElement("h3", {
    className: h3
  }, "\uBD84\uB958\uBCC4 \uC9C4\uD589 \uC911 \uBAA9\uD45C"), byCat.length === 0 && React.createElement("p", {
    className: `text-xs ${DIM}`
  }, "\uC9C4\uD589 \uC911\uC778 \uBAA9\uD45C\uAC00 \uC5C6\uC5B4\uC694."), React.createElement("div", {
    className: "wm-ov-catlist"
  }, byCat.map(([c, n]) => React.createElement("div", {
    key: c,
    className: "flex items-center gap-3"
  }, React.createElement("span", {
    className: `px-2 py-0.5 rounded-md text-xs font-medium w-20 text-center ${CAT_COLORS[c]}`
  }, c), React.createElement("div", {
    className: "flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"
  }, React.createElement("div", {
    className: "h-full bg-blue-500 rounded-full",
    style: {
      width: n / maxCat * 100 + '%'
    }
  })), React.createElement("span", {
    className: "text-xs text-slate-600 dark:text-slate-300 w-6 text-right"
  }, n))))), React.createElement("p", {
    className: "wm-ov-hint text-xs text-slate-600 dark:text-slate-400"
  }, "\uC67C\uCABD \uBAA9\uB85D\uC5D0\uC11C \uBAA9\uD45C\uB97C \uB204\uB974\uBA74 \uC5EC\uAE30\uC5D0 \uC0C1\uC138\uAC00 \uC5F4\uB824\uC694."));
}
function deviceOffline() {
  try {
    return navigator.onLine === false;
  } catch {
    return false;
  }
}
const OFFLINE_NOTICE = '연결 안 됨 — 연결되면 고칠 수 있어요';
function Main({
  user,
  initial
}) {
  const authed = !user.cached;
  const [tasks, setTasks] = useState(() => initial ? initial.tasks : []);
  const [schedules, setSchedules] = useState(() => initial ? initial.schedules : []);
  const [loaded, setLoaded] = useState(!!initial);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState('active');
  const [catFilter, setCatFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [toast, setToast] = useState(null);
  const [dark, setDark] = useState(() => localStorage.getItem('wm-dark') === 'true' || !localStorage.getItem('wm-dark') && window.matchMedia('(prefers-color-scheme:dark)').matches);
  const [connected, setConnected] = useState(true);
  const [pending, setPending] = useState(0);
  const [notice, setNotice] = useState('');
  const [day, setDay] = useState(today());
  const tablet = useMQ(TABLET_MQ);
  const fold = useMQ(FOLD_MQ);
  const split = tablet || fold;
  const uid = user.uid;
  const tasksRef = () => firebase.database().ref(`long-tasks/${uid}/tasks`);
  const live = useRef({});
  live.current = {
    ready,
    failed,
    authed,
    connected,
    pending,
    notice,
    showForm,
    showInfo,
    selected
  };
  const formDirty = useRef(false);
  const bridge = useRef(null);
  useEffect(() => {
    if (!authed) return;
    const tRef = tasksRef();
    const sRef = firebase.database().ref(`personal-schedules/${uid}`);
    const cRef = firebase.database().ref('.info/connected');
    const onTasks = tRef.on('value', s => {
      const t = Object.values(s.val() || {});
      setTasks(t);
      setLoaded(true);
      setReady(true);
      setFailed(false);
      saveWmCacheSoon(user, {
        tasks: t
      });
    }, e => {
      showToast('불러오기 실패 — ' + errText(e), 'error');
      setLoaded(true);
      setFailed(true);
    });
    const onSched = sRef.on('value', s => {
      const l = goalSchedules(s.val());
      setSchedules(l);
      saveWmCacheSoon(user, {
        schedules: l
      });
    }, e => showToast('불러오기 실패 — ' + errText(e), 'error'));
    const onConn = cRef.on('value', s => setConnected(s.val() === true));
    return () => {
      tRef.off('value', onTasks);
      sRef.off('value', onSched);
      cRef.off('value', onConn);
    };
  }, [authed]);
  useEffect(() => {
    localStorage.setItem('wm-dark', dark);
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  useEffect(() => {
    if (!selected) return;
    const fresh = tasks.find(t => t.id === selected.id);
    if (!fresh) {
      if (loaded) setSelected(null);
    } else if (fresh !== selected) setSelected(fresh);
  }, [tasks]);
  const noticeShown = useRef(false);
  useEffect(() => {
    const CHECKING = '최신 확인 중 — 잠시 뒤에 고칠 수 있어요';
    if (!ready) {
      if (failed) {
        setNotice('불러오지 못했어요 — 앱을 다시 열어 주세요');
        return;
      }
      if (!authed || connected) {
        setNotice(CHECKING);
        return;
      }
      if (deviceOffline()) {
        setNotice(OFFLINE_NOTICE);
        return;
      }
      setNotice(n => n || CHECKING);
      const t = setTimeout(() => setNotice(OFFLINE_NOTICE), 3000);
      return () => clearTimeout(t);
    }
    const text = !connected ? pending ? `연결 안 됨 · 저장 대기 ${pending}건 — 연결될 때까지 앱을 닫지 마세요` : '연결 안 됨 — 다른 기기에서 고친 내용이 안 보일 수 있어요' : pending ? `저장 중… ${pending}건` : '';
    if (!text) {
      noticeShown.current = false;
      setNotice('');
      return;
    }
    if (noticeShown.current || !connected && pending) {
      noticeShown.current = true;
      setNotice(text);
      return;
    }
    const t = setTimeout(() => {
      noticeShown.current = true;
      setNotice(text);
    }, connected ? 500 : 3000);
    return () => clearTimeout(t);
  }, [connected, pending, ready, authed, failed]);
  const toastT = useRef(0);
  function showToast(msg, type = 'success') {
    clearTimeout(toastT.current);
    setToast({
      msg,
      type
    });
    toastT.current = setTimeout(() => setToast(null), type === 'error' ? 4000 : 3000);
  }
  function track(p) {
    setPending(n => n + 1);
    const done = () => setPending(n => n - 1);
    p.then(done, done);
    return p;
  }
  function notReady() {
    const s = live.current;
    if (s.ready) return false;
    const offline = s.authed && !s.connected && (deviceOffline() || s.notice === OFFLINE_NOTICE);
    showToast(s.failed ? '서버에서 불러오지 못해 고칠 수 없어요. 앱을 다시 열어 주세요' : offline ? '아직 연결되지 않았어요. 연결되면 고칠 수 있어요' : '최신 내용을 확인하는 중이에요. 잠시 뒤에 다시 눌러 주세요', 'error');
    return true;
  }
  const canWrite = () => !notReady();
  function saveTask(idOrTask, patch) {
    if (notReady()) return false;
    const id = patch ? idOrTask : idOrTask.id;
    const p = tasksRef().child(id).transaction(cur => {
      if (!patch) return idOrTask;
      if (cur == null) return;
      return {
        ...patch(cur),
        updatedAt: Date.now()
      };
    });
    return track(p).then(r => {
      if (!r.committed) showToast('이미 지워진 목표라 저장하지 않았어요', 'error');
      return !!r.committed;
    }, e => {
      if (e && e.message === 'set') return false;
      showToast('저장 실패 — ' + errText(e), 'error');
      return false;
    });
  }
  function deleteTask(id) {
    if (notReady()) return false;
    const t = tasks.find(x => x.id === id);
    const files = (t && t.images || []).flatMap(img => [img.path, img.thumbPath]).filter(Boolean);
    track(tasksRef().child(id).remove()).then(() => {
      for (const p of files) imgRef(p).delete().catch(() => {});
    }, e => showToast('삭제 실패 — ' + errText(e), 'error'));
    setSelected(null);
    return true;
  }
  function sendSchedule(task, dateStr, timeStr) {
    if (notReady()) return false;
    let start, end, allDay;
    if (timeStr) {
      start = new Date(`${dateStr}T${timeStr}:00`).getTime();
      end = start + 3600000;
      allDay = false;
    } else {
      start = new Date(`${dateStr}T00:00:00`).getTime();
      end = new Date(`${dateStr}T23:59:59`).getTime();
      allDay = true;
    }
    if (!dateStr || isNaN(start)) {
      showToast('날짜를 확인해 주세요', 'error');
      return false;
    }
    const rec = {
      title: task.title,
      start,
      end,
      allDay,
      repeat: 'none',
      done: false,
      location: '',
      memo: `[목표:${task.id}] 목표 관리에서 보냄`,
      createdAt: Date.now()
    };
    const ref = firebase.database().ref(`personal-schedules/${uid}`).push();
    track(ref.set(rec)).then(() => showToast(`${fmtDate(dateStr)} 일정으로 보냈어요 📅`)).catch(e => showToast('일정 전송 실패 — ' + errText(e), 'error'));
    return true;
  }
  useEffect(() => {
    history.pushState({
      wm: 1
    }, '');
    const onPop = () => {
      const s = live.current,
        b = bridge.current;
      if (b && b.back) b.back();else if (s.showInfo) setShowInfo(false);else if (s.showForm) {
        if (!formDirty.current || confirm('쓰던 글이 있어요. 버리고 닫을까요?')) setShowForm(false);
      } else if (s.selected) {
        if (!b || b.canLeave()) setSelected(null);
      }
      history.pushState({
        wm: 1
      }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    const refreshDay = () => setDay(today());
    const kick = () => {
      const s = live.current;
      if (!s.authed || s.pending) return;
      try {
        const db = firebase.database();
        db.goOffline();
        db.goOnline();
      } catch {}
    };
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      refreshDay();
      if (hiddenAt && Date.now() - hiddenAt > 30000) kick();
      hiddenAt = 0;
    };
    const onShow = e => {
      refreshDay();
      if (e.persisted) kick();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onShow);
    const iv = setInterval(refreshDay, 30000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onShow);
      clearInterval(iv);
    };
  }, []);
  useEffect(() => {
    window.__appBusy = () => {
      const s = live.current,
        b = bridge.current;
      return !!(s.showForm || s.showInfo || s.pending || b && b.isBusy());
    };
    return () => {
      delete window.__appBusy;
    };
  }, []);
  function selectTask(t) {
    const s = live.current,
      b = bridge.current;
    if (s.selected && s.selected.id !== t.id && b && !b.canLeave()) return;
    setSelected(t);
  }
  const visible = useMemo(() => {
    const act = tab === 'active';
    const order = {
      '진행': 0,
      '대기': 1,
      '보류': 2,
      '완료': 0,
      '중단': 1
    };
    const prio = {
      '높음': 0,
      '보통': 1,
      '낮음': 2
    };
    const ord = (m, k) => k in m ? m[k] : 9;
    return tasks.filter(t => act ? ACTIVE_STATUSES.includes(t.status) : !ACTIVE_STATUSES.includes(t.status)).filter(t => !catFilter || t.category === catFilter).sort((a, b) => ord(order, a.status) - ord(order, b.status) || (act ? ord(prio, a.priority) - ord(prio, b.priority) : (b.completedAt || b.updatedAt || 0) - (a.completedAt || a.updatedAt || 0)) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }, [tasks, tab, catFilter]);
  const activeCnt = tasks.filter(t => ACTIVE_STATUSES.includes(t.status)).length;
  const archiveCnt = tasks.length - activeCnt;
  const tabCls = on => `min-h-[36px] px-4 rounded-md text-sm font-medium ${on ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`;
  const chipCls = on => `min-h-[36px] px-3 rounded-full text-xs whitespace-nowrap border ${on ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`;
  const detailProps = {
    uid,
    day,
    schedules,
    onUpdate: saveTask,
    onDelete: deleteTask,
    onClose: () => setSelected(null),
    onSendSchedule: sendSchedule,
    onToast: showToast,
    canWrite,
    bridge
  };
  return React.createElement("div", {
    className: "wm-app min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors",
    "data-day": day
  }, React.createElement("header", {
    className: "wm-header sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700"
  }, React.createElement("div", {
    className: "wm-head-top max-w-2xl mx-auto px-4 py-2 flex items-center gap-3"
  }, React.createElement("h1", {
    className: "wm-head-title font-bold text-slate-800 dark:text-slate-100"
  }, "\uD83D\uDCCB \uBAA9\uD45C \uAD00\uB9AC"), React.createElement("div", {
    className: "wm-head-tools ml-auto flex items-center gap-1"
  }, React.createElement("button", {
    onClick: () => setDark(!dark),
    "aria-label": dark ? '밝은 화면으로' : '어두운 화면으로',
    title: dark ? '밝은 화면으로' : '어두운 화면으로',
    className: "w-10 h-10 flex items-center justify-center"
  }, dark ? '☀️' : '🌙'), React.createElement("button", {
    onClick: () => setShowInfo(true),
    className: "wm-info-btn h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300"
  }, "\uC815\uBCF4"))), React.createElement("div", {
    className: "wm-head-filters max-w-2xl mx-auto px-4 pb-2 space-y-2"
  }, React.createElement("div", {
    className: "flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1 w-fit"
  }, React.createElement("button", {
    onClick: () => setTab('active'),
    className: tabCls(tab === 'active')
  }, "\uC9C4\uD589 \uC911 ", activeCnt), React.createElement("button", {
    onClick: () => setTab('archive'),
    className: tabCls(tab === 'archive')
  }, "\uC644\uB8CC\xB7\uC774\uB825 ", archiveCnt)), React.createElement("div", {
    className: "wm-chips flex gap-1.5 overflow-x-auto pb-1"
  }, React.createElement("button", {
    onClick: () => setCatFilter(''),
    className: chipCls(!catFilter)
  }, "\uC804\uCCB4"), CATEGORIES.map(c => React.createElement("button", {
    key: c,
    onClick: () => setCatFilter(catFilter === c ? '' : c),
    className: chipCls(catFilter === c)
  }, c))))), (() => {
    const list = React.createElement("main", {
      className: "wm-list max-w-2xl mx-auto px-4 py-4 space-y-2.5 pb-24"
    }, !loaded && React.createElement("p", {
      className: "text-center text-sm text-slate-600 dark:text-slate-400 py-10"
    }, "\uBD88\uB7EC\uC624\uB294 \uC911\u2026"), loaded && visible.length === 0 && React.createElement("div", {
      className: "text-center py-16 space-y-2"
    }, React.createElement("div", {
      className: "text-4xl",
      "aria-hidden": "true"
    }, tab === 'active' ? '🌱' : '📦'), React.createElement("p", {
      className: "text-sm text-slate-600 dark:text-slate-400"
    }, tab === 'active' ? '진행 중인 목표가 없어요. 새 목표를 추가해 보세요.' : '끝낸 목표가 여기에 쌓여요.')), visible.map(t => React.createElement(TaskCard, {
      key: t.id,
      task: t,
      onSelect: selectTask,
      active: split && selected && selected.id === t.id
    })));
    if (!split) return list;
    return React.createElement("div", {
      className: "wm-split"
    }, list, React.createElement("section", {
      className: "wm-pane"
    }, selected ? React.createElement(TaskDetail, _extends({
      key: selected.id,
      inline: true,
      twoCol: tablet,
      task: selected
    }, detailProps)) : React.createElement(Overview, {
      tasks: tasks,
      onSelect: selectTask
    })));
  })(), React.createElement("button", {
    onClick: () => setShowForm(true),
    "aria-label": "\uC0C8 \uBAA9\uD45C",
    className: "wm-fab fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-2xl shadow-lg flex items-center justify-center"
  }, "\uFF0B"), showForm && React.createElement(TaskForm, {
    onSave: saveTask,
    onClose: () => setShowForm(false),
    dirtyRef: formDirty
  }), selected && !split && React.createElement(TaskDetail, _extends({
    task: selected
  }, detailProps)), showInfo && React.createElement(InfoSheet, {
    user: user,
    tasks: tasks,
    onClose: () => setShowInfo(false)
  }), notice && React.createElement("div", {
    className: "wm-notice fixed bottom-0 inset-x-0 z-40 px-3 py-0.5 text-center text-[11px] leading-4 bg-amber-100 text-amber-900 dark:bg-amber-900/90 dark:text-amber-100",
    style: {
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 2px)'
    }
  }, notice), React.createElement(Toast, {
    toast: toast
  }));
}
const WM_CACHE = 'wm_cache_v1';
function readWmCache() {
  if (/[?&]nocache=1/.test(location.search)) return null;
  try {
    if (localStorage.getItem('wm_signed_in') !== '1') return null;
    const c = JSON.parse(localStorage.getItem(WM_CACHE) || 'null');
    if (!(c && c.uid && Array.isArray(c.tasks) && Array.isArray(c.schedules))) return null;
    const mine = c.schedules.filter(isGoalSchedule);
    if (mine.length !== c.schedules.length) {
      c.schedules = mine;
      try {
        localStorage.setItem(WM_CACHE, JSON.stringify(c));
      } catch {}
    }
    return c;
  } catch {
    return null;
  }
}
const wmCacheData = {
  tasks: null,
  schedules: null
};
let wmCacheT = 0;
function saveWmCacheSoon(user, part) {
  Object.assign(wmCacheData, part);
  if (!wmCacheData.tasks || !wmCacheData.schedules) return;
  clearTimeout(wmCacheT);
  wmCacheT = setTimeout(() => {
    try {
      localStorage.setItem(WM_CACHE, JSON.stringify({
        uid: user.uid,
        email: user.email || '',
        at: Date.now(),
        tasks: wmCacheData.tasks,
        schedules: wmCacheData.schedules
      }));
    } catch {}
  }, 800);
}
function dropWmCache() {
  clearTimeout(wmCacheT);
  wmCacheData.tasks = null;
  wmCacheData.schedules = null;
  try {
    localStorage.removeItem(WM_CACHE);
    localStorage.removeItem('wm_signed_in');
  } catch {}
}
function App() {
  const cached = useMemo(() => readWmCache(), []);
  const [user, setUser] = useState(() => cached ? {
    uid: cached.uid,
    email: cached.email,
    cached: true
  } : undefined);
  useEffect(() => firebase.auth().onAuthStateChanged(u => {
    if (!u) dropWmCache();else {
      if (cached && cached.uid !== u.uid) dropWmCache();
      try {
        localStorage.setItem('wm_signed_in', '1');
      } catch {}
    }
    setUser(u);
  }), []);
  useEffect(() => {
    const dark = localStorage.getItem('wm-dark') === 'true' || !localStorage.getItem('wm-dark') && window.matchMedia('(prefers-color-scheme:dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  }, []);
  if (user === undefined) return React.createElement("div", {
    className: "min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900"
  }, React.createElement("p", {
    className: "text-sm text-slate-600 dark:text-slate-400"
  }, "\uD655\uC778 \uC911\u2026"));
  if (!user) return React.createElement(Login, null);
  return React.createElement(Main, {
    key: user.uid,
    user: user,
    initial: cached && cached.uid === user.uid ? cached : null
  });
}
if (!window.__goalsMoved) ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App, null));
