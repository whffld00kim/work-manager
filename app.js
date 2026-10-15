/* 생성 파일 — 고치지 말 것. 원본은 src/app.jsx, 다시 만들기: npm run build */
const {
  useState,
  useEffect,
  useMemo,
  useRef
} = React;
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
const AUTH_ERRORS = {
  'auth/invalid-email': '이메일 형식이 올바르지 않아요',
  'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않아요',
  'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않아요',
  'auth/user-not-found': '등록되지 않은 계정이에요',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 해주세요',
  'auth/network-request-failed': '네트워크에 연결할 수 없어요',
  'auth/unauthorized-domain': '이 주소가 Firebase 승인 도메인에 없어요'
};
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
    cls: 'text-amber-500 font-bold'
  };
  if (n > 0) return {
    text: `D-${n}`,
    cls: n <= 7 ? 'text-orange-500 font-semibold' : 'text-sky-500'
  };
  return {
    text: `D+${Math.abs(n)}`,
    cls: 'text-red-500 font-semibold'
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
const TABLET_MQ = '(min-width: 900px) and (orientation: landscape)';
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
  const color = toast.type === 'error' ? 'bg-red-500' : 'bg-slate-800 dark:bg-slate-200 dark:text-slate-900';
  return React.createElement("div", {
    className: `fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-sm shadow-lg ${color}`
  }, toast.msg);
}
function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
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
      setErr(ex.code === 'auth/admin-restricted-operation' ? '이 구글 계정은 등록되어 있지 않아요. 이메일·비밀번호로 로그인해 주세요' : '로그인에 실패했어요 (' + ex.code + ')');
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
    className: "text-3xl"
  }, "\uD83D\uDCCB"), React.createElement("h1", {
    className: "text-xl font-bold text-slate-800 dark:text-slate-100"
  }, "\uBAA9\uD45C \uAD00\uB9AC\uC790"), React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "\uBBFC\uC131 \uC2A4\uCF00\uC904\uACFC \uAC19\uC740 \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778\uD558\uC138\uC694 (\uC77C\uC815 \uC5F0\uB3D9)")), React.createElement("input", {
    type: "email",
    required: true,
    placeholder: "\uC774\uBA54\uC77C",
    value: email,
    onChange: e => setEmail(e.target.value),
    className: "w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100"
  }), React.createElement("input", {
    type: "password",
    required: true,
    placeholder: "\uBE44\uBC00\uBC88\uD638",
    value: pw,
    onChange: e => setPw(e.target.value),
    className: "w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100"
  }), err && React.createElement("p", {
    className: "text-xs text-red-500"
  }, err), React.createElement("button", {
    disabled: busy,
    className: "w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
  }, busy ? '로그인 중…' : '로그인'), React.createElement("button", {
    type: "button",
    onClick: google,
    className: "w-full py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold"
  }, "\uAD6C\uAE00 \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778")));
}
function TaskForm({
  onSave,
  onClose
}) {
  const [f, setF] = useState({
    title: '',
    category: CATEGORIES[0],
    status: '진행',
    priority: '보통',
    dueDate: '',
    firstLog: ''
  });
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
    onSave(task);
    onClose();
  }
  const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100";
  return React.createElement("div", {
    className: "fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center",
    onClick: onClose
  }, React.createElement("form", {
    onSubmit: submit,
    onClick: e => e.stopPropagation(),
    className: "wm-form w-full sm:max-w-md bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
  }, React.createElement("h2", {
    className: "font-bold text-slate-800 dark:text-slate-100"
  }, "\uC0C8 \uACFC\uC81C"), React.createElement("input", {
    autoFocus: true,
    required: true,
    placeholder: "\uACFC\uC81C \uC81C\uBAA9",
    value: f.title,
    onChange: e => setF({
      ...f,
      title: e.target.value
    }),
    className: inputCls
  }), React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, React.createElement("select", {
    value: f.category,
    onChange: e => setF({
      ...f,
      category: e.target.value
    }),
    className: inputCls
  }, CATEGORIES.map(c => React.createElement("option", {
    key: c
  }, c))), React.createElement("select", {
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
    className: "flex-1 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm text-slate-600 dark:text-slate-300"
  }, "\uCDE8\uC18C"), React.createElement("button", {
    className: "flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold"
  }, "\uCD94\uAC00"))));
}
function TaskDetail({
  task,
  uid,
  schedules,
  onUpdate,
  onDelete,
  onClose,
  onSendSchedule,
  onToast,
  inline,
  twoCol
}) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(task);
  const [newLog, setNewLog] = useState('');
  const [logDate, setLogDate] = useState(today());
  const [newCheck, setNewCheck] = useState('');
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedDateV, setSchedDateV] = useState(today());
  const [schedTime, setSchedTime] = useState('');
  const [uploading, setUploading] = useState(null);
  const [viewer, setViewer] = useState(null);
  const fileInput = useRef(null);
  useEffect(() => {
    if (!editing) setF(task);
  }, [task]);
  const patch = fn => onUpdate(task.id, fn);
  const images = task.images || [];
  async function addImages(fileList) {
    const files = Array.from(fileList || []).filter(x => x.type.startsWith('image/'));
    if (!files.length) return;
    if (window.__wmCached) {
      onToast('최신 내용을 확인하는 중이에요. 잠시 뒤에 다시 해 주세요', 'error');
      return;
    }
    const tooBig = files.find(x => x.size >= IMG_MAX);
    if (tooBig) {
      onToast(`${tooBig.name}은(는) 30MB를 넘어 올릴 수 없어요`, 'error');
      return;
    }
    setUploading({
      done: 0,
      total: files.length,
      pct: 0
    });
    const added = [];
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
          ref.put(file, meta).on('state_changed', s => setUploading({
            done: i,
            total: files.length,
            pct: Math.round(s.bytesTransferred / s.totalBytes * 100)
          }), rej, res);
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
      const list = added.slice();
      patch(cur => ({
        ...cur,
        images: [...(cur.images || []), ...list]
      }));
      onToast(`이미지 ${added.length}장을 저장했어요 🖼️`);
    } catch (e) {
      if (added.length) {
        const list = added.slice();
        patch(cur => ({
          ...cur,
          images: [...(cur.images || []), ...list]
        }));
      }
      onToast('이미지 업로드 실패: ' + (e && e.message || e), 'error');
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  function delImage(img) {
    if (!confirm(`「${img.name}」을(를) 원본까지 지울까요?`)) return;
    imgRef(img.path).delete().catch(() => {});
    if (img.thumbPath) imgRef(img.thumbPath).delete().catch(() => {});
    patch(cur => ({
      ...cur,
      images: (cur.images || []).filter(x => x.id !== img.id)
    }));
    setViewer(null);
  }
  const viewing = viewer ? images.find(x => x.id === viewer) : null;
  const linked = useMemo(() => schedules.filter(s => (s.memo || '').includes(`[목표:${task.id}]`)).sort((a, b) => b.start - a.start), [schedules, task.id]);
  const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100";
  function saveEdit() {
    const {
      title,
      category,
      priority,
      dueDate
    } = f;
    patch(cur => ({
      ...cur,
      title: title.trim() || cur.title,
      category,
      priority,
      dueDate: dueDate || null
    }));
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
    if (!newLog.trim()) return;
    const entry = {
      id: genId(),
      date: logDate,
      text: newLog.trim()
    };
    patch(cur => ({
      ...cur,
      log: [...(cur.log || []), entry]
    }));
    setNewLog('');
  }
  function delLog(id) {
    if (!confirm('이 기록을 지울까요?')) return;
    patch(cur => ({
      ...cur,
      log: (cur.log || []).filter(l => l.id !== id)
    }));
  }
  function addCheck() {
    if (!newCheck.trim()) return;
    const entry = {
      id: genId(),
      text: newCheck.trim(),
      done: false,
      doneDate: null
    };
    patch(cur => ({
      ...cur,
      checklist: [...(cur.checklist || []), entry]
    }));
    setNewCheck('');
  }
  function toggleCheck(id) {
    const now = (task.checklist || []).find(c => c.id === id);
    const done = !(now && now.done),
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
  function delCheck(id) {
    patch(cur => ({
      ...cur,
      checklist: (cur.checklist || []).filter(c => c.id !== id)
    }));
  }
  function sendSchedule() {
    onSendSchedule(task, schedDateV, schedTime);
    setSchedOpen(false);
    setSchedTime('');
  }
  const checklist = task.checklist || [];
  const log = [...(task.log || [])].sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
  const doneCount = checklist.filter(c => c.done).length;
  const infoCard = React.createElement(React.Fragment, null, React.createElement("div", {
    className: "wm-d-info bg-white dark:bg-slate-800 rounded-xl p-4 space-y-3"
  }, editing ? React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, React.createElement("select", {
    value: f.category,
    onChange: e => setF({
      ...f,
      category: e.target.value
    }),
    className: inputCls
  }, CATEGORIES.map(c => React.createElement("option", {
    key: c
  }, c))), React.createElement("select", {
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
    className: "flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"
  }, React.createElement("span", {
    className: `w-2 h-2 rounded-full ${PRIO_DOT[task.priority]}`
  }), task.priority), React.createElement("span", {
    className: "text-xs text-slate-400"
  }, "\uAE30\uD55C ", fmtDate(task.dueDate)), dday(task.dueDate, task.status) && React.createElement("span", {
    className: `text-xs ${dday(task.dueDate, task.status).cls}`
  }, dday(task.dueDate, task.status).text)), React.createElement("div", {
    className: "flex flex-wrap gap-1.5"
  }, STATUSES.map(st => React.createElement("button", {
    key: st,
    onClick: () => setStatus(st),
    className: `px-3 py-1.5 rounded-lg text-xs font-medium border transition
                        ${task.status === st ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'}`
  }, st))), task.completedAt && React.createElement("p", {
    className: "text-xs text-emerald-600 dark:text-emerald-400"
  }, "\u2713 ", new Date(task.completedAt).toLocaleDateString('ko-KR'), " \uC644\uB8CC")));
  const imgCard = React.createElement(React.Fragment, null, React.createElement("div", {
    className: "wm-d-img bg-white dark:bg-slate-800 rounded-xl p-4 space-y-2"
  }, React.createElement("div", {
    className: "flex items-center justify-between"
  }, React.createElement("h3", {
    className: "text-sm font-semibold text-slate-700 dark:text-slate-200"
  }, "\uD83D\uDDBC\uFE0F \uC774\uBBF8\uC9C0 ", images.length > 0 && React.createElement("span", {
    className: "font-normal text-xs text-slate-400"
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
    className: "text-xs font-medium text-blue-600 dark:text-blue-400 disabled:opacity-50"
  }, uploading ? `올리는 중 ${uploading.done + 1}/${uploading.total} · ${uploading.pct}%` : '＋ 첨부')), uploading && React.createElement("div", {
    className: "h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"
  }, React.createElement("div", {
    className: "h-full bg-blue-500 rounded-full transition-all",
    style: {
      width: uploading.pct + '%'
    }
  })), images.length === 0 && !uploading ? React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "\uC774 \uBAA9\uD45C\uB97C \uC138\uC6B0\uAC8C \uD55C \uC0AC\uC9C4, \uB3C4\uB2EC\uD588\uC744 \uB54C\uC758 \uBAA8\uC2B5\uC744 \uC6D0\uBCF8 \uADF8\uB300\uB85C \uBCF4\uAD00\uD569\uB2C8\uB2E4.") : React.createElement("div", {
    className: "wm-d-thumbs grid grid-cols-3 gap-2"
  }, images.map(img => React.createElement("button", {
    key: img.id,
    onClick: () => setViewer(img.id),
    className: "relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700"
  }, React.createElement("img", {
    src: img.thumbUrl || img.url,
    alt: img.name,
    loading: "lazy",
    className: "w-full h-full object-cover"
  }))))));
  const checkCard = React.createElement(React.Fragment, null, React.createElement("div", {
    className: "wm-d-check bg-white dark:bg-slate-800 rounded-xl p-4 space-y-2"
  }, React.createElement("div", {
    className: "flex items-center justify-between"
  }, React.createElement("h3", {
    className: "text-sm font-semibold text-slate-700 dark:text-slate-200"
  }, "\uCCB4\uD06C\uB9AC\uC2A4\uD2B8"), checklist.length > 0 && React.createElement("span", {
    className: "text-xs text-slate-400"
  }, doneCount, "/", checklist.length)), checklist.map(c => React.createElement("div", {
    key: c.id,
    className: "flex items-center gap-2 group"
  }, React.createElement("button", {
    onClick: () => toggleCheck(c.id),
    className: `w-5 h-5 rounded-md border flex items-center justify-center text-xs shrink-0
                        ${c.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`
  }, c.done ? '✓' : ''), React.createElement("span", {
    className: `flex-1 text-sm ${c.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`
  }, c.text), c.done && c.doneDate && React.createElement("span", {
    className: "text-[10px] text-slate-400"
  }, fmtDate(c.doneDate)), React.createElement("button", {
    onClick: () => delCheck(c.id),
    className: "text-slate-300 dark:text-slate-600 hover:text-red-400 text-xs px-1"
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
    className: "px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm text-slate-600 dark:text-slate-300"
  }, "\uFF0B"))));
  const schedCard = React.createElement(React.Fragment, null, React.createElement("div", {
    className: "wm-d-sched bg-white dark:bg-slate-800 rounded-xl p-4 space-y-2"
  }, React.createElement("div", {
    className: "flex items-center justify-between"
  }, React.createElement("h3", {
    className: "text-sm font-semibold text-slate-700 dark:text-slate-200"
  }, "\uD83D\uDCC5 \uC77C\uC815 \uC5F0\uB3D9 ", React.createElement("span", {
    className: "font-normal text-xs text-slate-400"
  }, "(\uBBFC\uC131 \uC2A4\uCF00\uC904)")), React.createElement("button", {
    onClick: () => setSchedOpen(!schedOpen),
    className: "text-xs font-medium text-blue-600 dark:text-blue-400"
  }, "\uC77C\uC815\uC73C\uB85C \uBCF4\uB0B4\uAE30")), schedOpen && React.createElement("div", {
    className: "flex flex-wrap gap-2 items-center bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2"
  }, React.createElement("input", {
    type: "date",
    value: schedDateV,
    onChange: e => setSchedDateV(e.target.value),
    className: `${inputCls} !w-auto flex-1`
  }), React.createElement("input", {
    type: "time",
    value: schedTime,
    onChange: e => setSchedTime(e.target.value),
    className: `${inputCls} !w-auto`,
    title: "\uBE44\uC6B0\uBA74 \uC885\uC77C"
  }), React.createElement("button", {
    onClick: sendSchedule,
    className: "px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
  }, "\uBCF4\uB0B4\uAE30")), linked.length === 0 ? React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "\uC544\uC9C1 \uC5F0\uB3D9\uB41C \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2E4\uD589\uD560 \uB0A0\uC744 \uC815\uD558\uBA74 \uC77C\uC815 \uC571\uC5D0 \uB098\uD0C0\uB0A9\uB2C8\uB2E4.") : linked.map(s => React.createElement("div", {
    key: s.id,
    className: "flex items-center gap-2 text-sm"
  }, React.createElement("span", {
    className: `w-2 h-2 rounded-full shrink-0 ${schedDone(s) ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`
  }), React.createElement("span", {
    className: "text-slate-600 dark:text-slate-300"
  }, fmtDate(schedDate(s))), React.createElement("span", {
    className: "flex-1 truncate text-slate-500 dark:text-slate-400"
  }, s.title), schedDone(s) && React.createElement("span", {
    className: "text-[10px] text-emerald-600 dark:text-emerald-400 font-medium"
  }, "\uC644\uB8CC")))));
  const logCard = React.createElement(React.Fragment, null, React.createElement("div", {
    className: "wm-d-log bg-white dark:bg-slate-800 rounded-xl p-4 space-y-3"
  }, React.createElement("h3", {
    className: "text-sm font-semibold text-slate-700 dark:text-slate-200"
  }, "\uC9C4\uD589 \uB85C\uADF8 ", React.createElement("span", {
    className: "font-normal text-xs text-slate-400"
  }, "(", log.length, ")")), React.createElement("div", {
    className: "space-y-1.5"
  }, React.createElement("div", {
    className: "flex gap-2"
  }, React.createElement("input", {
    type: "date",
    value: logDate,
    onChange: e => setLogDate(e.target.value),
    className: `${inputCls} !w-auto`
  }), React.createElement("button", {
    onClick: addLog,
    className: "px-3 rounded-lg bg-blue-600 text-white text-sm font-semibold ml-auto"
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
    className: "flex-1 pb-1"
  }, React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement("span", {
    className: "text-xs font-medium text-slate-400"
  }, fmtDate(l.date)), React.createElement("button", {
    onClick: () => delLog(l.id),
    className: "opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 text-xs"
  }, "\u2715")), React.createElement("p", {
    className: "text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap"
  }, l.text)))), log.length === 0 && React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "\uC9C4\uD589 \uAE30\uB85D\uC774 \uC5EC\uAE30\uC5D0 \uC313\uC785\uB2C8\uB2E4."))));
  const delBlock = React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: () => {
      if (confirm('이 과제를 이력까지 전부 삭제할까요?\n(완료 처리만 하려면 상태를 "완료"로 바꾸세요)')) onDelete(task.id);
    },
    className: "wm-d-del w-full py-2.5 rounded-xl border border-red-200 dark:border-red-900 text-red-500 text-sm"
  }, "\uACFC\uC81C \uC0AD\uC81C"), React.createElement("p", {
    className: "wm-d-created text-center text-[10px] text-slate-300 dark:text-slate-600 pb-4"
  }, "\uC0DD\uC131 ", new Date(task.createdAt).toLocaleDateString('ko-KR')));
  return React.createElement("div", {
    className: inline ? 'wm-detail-inline' : 'fixed inset-0 z-30 bg-black/40 flex justify-end',
    onClick: inline ? undefined : onClose
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: inline ? 'wm-detail-scroll bg-slate-50 dark:bg-slate-900' : 'w-full sm:max-w-lg h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto shadow-2xl'
  }, React.createElement("div", {
    className: "sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-2"
  }, React.createElement("button", {
    onClick: onClose,
    className: "text-slate-400 text-xl px-1"
  }, "\u2190"), editing ? React.createElement("input", {
    value: f.title,
    onChange: e => setF({
      ...f,
      title: e.target.value
    }),
    className: inputCls
  }) : React.createElement("h2", {
    className: "flex-1 font-bold text-slate-800 dark:text-slate-100 truncate"
  }, task.title), editing ? React.createElement("button", {
    onClick: saveEdit,
    className: "text-sm font-semibold text-blue-600 px-2"
  }, "\uC800\uC7A5") : React.createElement("button", {
    onClick: () => setEditing(true),
    className: "text-sm text-slate-400 px-2"
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
    className: "flex items-center gap-2 px-4 py-3 text-white/90",
    style: {
      paddingTop: 'calc(env(safe-area-inset-top) + 12px)'
    },
    onClick: e => e.stopPropagation()
  }, React.createElement("button", {
    onClick: () => setViewer(null),
    className: "text-xl px-1"
  }, "\u2190"), React.createElement("div", {
    className: "flex-1 min-w-0"
  }, React.createElement("p", {
    className: "text-sm truncate"
  }, viewing.name), React.createElement("p", {
    className: "text-[11px] text-white/50"
  }, viewing.width && viewing.height ? `${viewing.width}×${viewing.height} · ` : '', fmtBytes(viewing.size), viewing.createdAt ? ` · ${new Date(viewing.createdAt).toLocaleDateString('ko-KR')}` : '')), React.createElement("a", {
    href: viewing.url,
    download: viewing.name,
    target: "_blank",
    rel: "noopener",
    className: "px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-medium",
    title: "\uC6D0\uBCF8 \uD30C\uC77C \uB2E4\uC6B4\uB85C\uB4DC"
  }, "\u2B07 \uC6D0\uBCF8"), React.createElement("button", {
    onClick: () => delImage(viewing),
    className: "px-2 py-1.5 rounded-lg text-xs text-red-300 hover:bg-white/10",
    title: "\uC0AD\uC81C"
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
  const lastLog = (task.log || []).reduce((m, l) => l.date > m ? l.date : m, '');
  const dd = dday(task.dueDate, task.status);
  const cover = (task.images || [])[0];
  return React.createElement("button", {
    onClick: () => onSelect(task),
    className: `wm-card${active ? ' wm-card-active' : ''} w-full text-left bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm hover:shadow transition space-y-2`
  }, React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement("span", {
    className: `w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[task.status]}`
  }), React.createElement("span", {
    className: "flex-1 font-semibold text-sm text-slate-800 dark:text-slate-100 truncate"
  }, task.title), dd && React.createElement("span", {
    className: `text-xs shrink-0 ${dd.cls}`
  }, dd.text), cover && React.createElement("img", {
    src: cover.thumbUrl || cover.url,
    alt: "",
    loading: "lazy",
    className: "w-9 h-9 rounded-md object-cover shrink-0"
  })), React.createElement("div", {
    className: "flex items-center gap-2 text-xs text-slate-400"
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
    className: "text-[10px] text-slate-400"
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
  }))).sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1)).slice(0, 6);
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
    className: "flex items-center gap-1.5 text-xs text-slate-400"
  }, React.createElement("span", {
    className: `w-2 h-2 rounded-full ${STATUS_COLORS[st]}`
  }), st), React.createElement("div", {
    className: "text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1"
  }, cnt(st))))), React.createElement("div", {
    className: `${card} wm-ov-col`
  }, React.createElement("h3", {
    className: h3
  }, "\u23F0 \uB2E4\uAC00\uC624\uB294 \uAE30\uD55C"), due.length === 0 && React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "\uAE30\uD55C\uC744 \uC815\uD55C \uC9C4\uD589 \uC911 \uBAA9\uD45C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."), due.map(t => {
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
      className: "text-xs text-slate-400"
    }, fmtDate(t.dueDate)), dd && React.createElement("span", {
      className: `text-xs w-14 text-right ${dd.cls}`
    }, dd.text));
  })), React.createElement("div", {
    className: `${card} wm-ov-col`
  }, React.createElement("h3", {
    className: h3
  }, "\uD83D\uDCDD \uCD5C\uADFC \uC9C4\uD589 \uAE30\uB85D"), recent.length === 0 && React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "\uC9C4\uD589 \uAE30\uB85D\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4."), recent.map(l => React.createElement("button", {
    key: l.task.id + l.id,
    onClick: () => onSelect(l.task),
    className: "wm-ov-row !items-start"
  }, React.createElement("span", {
    className: "text-xs font-medium text-slate-400 shrink-0 w-20 pt-0.5"
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
    className: "text-xs text-slate-400"
  }, "\uC9C4\uD589 \uC911\uC778 \uBAA9\uD45C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."), React.createElement("div", {
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
    className: "text-xs text-slate-500 w-6 text-right"
  }, n))))), React.createElement("p", {
    className: "wm-ov-hint text-xs text-slate-400"
  }, "\uC67C\uCABD \uBAA9\uB85D\uC5D0\uC11C \uBAA9\uD45C\uB97C \uB204\uB974\uBA74 \uC5EC\uAE30\uC5D0 \uC0C1\uC138\uAC00 \uC5F4\uB9BD\uB2C8\uB2E4."));
}
function Main({
  user,
  initial
}) {
  const [tasks, setTasks] = useState(() => initial ? initial.tasks : []);
  const [schedules, setSchedules] = useState(() => initial ? initial.schedules : []);
  const [loaded, setLoaded] = useState(!!initial);
  const [tab, setTab] = useState('active');
  const [catFilter, setCatFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [dark, setDark] = useState(() => localStorage.getItem('wm-dark') === 'true' || !localStorage.getItem('wm-dark') && window.matchMedia('(prefers-color-scheme:dark)').matches);
  const [connected, setConnected] = useState(true);
  const [pending, setPending] = useState(0);
  const [notice, setNotice] = useState('');
  const tablet = useMQ(TABLET_MQ);
  const fold = useMQ(FOLD_MQ);
  const split = tablet || fold;
  const uid = user.uid;
  const tasksRef = () => firebase.database().ref(`long-tasks/${uid}/tasks`);
  useEffect(() => {
    if (user.cached) return;
    const tRef = tasksRef();
    const sRef = firebase.database().ref(`personal-schedules/${uid}`);
    const cRef = firebase.database().ref('.info/connected');
    const onTasks = tRef.on('value', s => {
      const t = Object.values(s.val() || {});
      setTasks(t);
      setLoaded(true);
      saveWmCacheSoon(user, {
        tasks: t
      });
    }, e => {
      showToast('불러오기 실패: ' + e.message, 'error');
      setLoaded(true);
    });
    const onSched = sRef.on('value', s => {
      const l = Object.entries(s.val() || {}).map(([id, v]) => ({
        ...v,
        id
      }));
      setSchedules(l);
      saveWmCacheSoon(user, {
        schedules: l
      });
    }, e => showToast('불러오기 실패: ' + e.message, 'error'));
    const onConn = cRef.on('value', s => setConnected(s.val() === true));
    return () => {
      tRef.off('value', onTasks);
      sRef.off('value', onSched);
      cRef.off('value', onConn);
    };
  }, []);
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
    }, 3000);
    return () => clearTimeout(t);
  }, [connected, pending]);
  function showToast(msg, type = 'success') {
    setToast({
      msg,
      type
    });
    setTimeout(() => setToast(null), 3000);
  }
  function track(p) {
    setPending(n => n + 1);
    const done = () => setPending(n => n - 1);
    p.then(done, done);
    return p;
  }
  function notReady() {
    if (!window.__wmCached) return false;
    showToast('최신 내용을 확인하는 중이에요. 잠시 뒤에 다시 해 주세요', 'error');
    return true;
  }
  function saveTask(idOrTask, patch) {
    if (notReady()) return;
    const id = patch ? idOrTask : idOrTask.id;
    const p = tasksRef().child(id).transaction(cur => {
      if (!patch) return idOrTask;
      if (cur == null) return;
      return {
        ...patch(cur),
        updatedAt: Date.now()
      };
    });
    track(p).then(r => {
      if (!r.committed) showToast('이미 지워진 목표라 저장하지 않았어요', 'error');
    }).catch(e => {
      if (e && e.message === 'set') return;
      showToast('저장 실패: ' + e.message, 'error');
    });
  }
  function deleteTask(id) {
    if (notReady()) return;
    const t = tasks.find(x => x.id === id);
    for (const img of t && t.images || []) {
      if (img.path) imgRef(img.path).delete().catch(() => {});
      if (img.thumbPath) imgRef(img.thumbPath).delete().catch(() => {});
    }
    track(tasksRef().child(id).remove()).catch(e => showToast('삭제 실패: ' + e.message, 'error'));
    setSelected(null);
  }
  function sendSchedule(task, dateStr, timeStr) {
    if (notReady()) return;
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
      return;
    }
    const rec = {
      title: task.title,
      start,
      end,
      allDay,
      repeat: 'none',
      done: false,
      location: '',
      memo: `[목표:${task.id}] 목표 관리자에서 보냄`,
      createdAt: Date.now()
    };
    const ref = firebase.database().ref(`personal-schedules/${uid}`).push();
    track(ref.set(rec)).then(() => showToast(`${fmtDate(dateStr)} 일정으로 보냈습니다 📅`)).catch(e => showToast('일정 전송 실패: ' + e.message, 'error'));
  }
  const backRef = useRef(null);
  backRef.current = {
    showForm,
    selected
  };
  useEffect(() => {
    history.pushState({
      wm: 1
    }, '');
    const onPop = () => {
      const s = backRef.current || {};
      if (s.showForm) setShowForm(false);else if (s.selected) setSelected(null);
      history.pushState({
        wm: 1
      }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
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
    return tasks.filter(t => act ? ACTIVE_STATUSES.includes(t.status) : !ACTIVE_STATUSES.includes(t.status)).filter(t => !catFilter || t.category === catFilter).sort((a, b) => order[a.status] - order[b.status] || (act ? prio[a.priority] - prio[b.priority] : (b.completedAt || b.updatedAt || 0) - (a.completedAt || a.updatedAt || 0)) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }, [tasks, tab, catFilter]);
  const activeCnt = tasks.filter(t => ACTIVE_STATUSES.includes(t.status)).length;
  const archiveCnt = tasks.length - activeCnt;
  return React.createElement("div", {
    className: "wm-app min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors"
  }, React.createElement("header", {
    className: "wm-header sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700"
  }, React.createElement("div", {
    className: "wm-head-top max-w-2xl mx-auto px-4 py-3 flex items-center gap-3"
  }, React.createElement("h1", {
    className: "wm-head-title font-bold text-slate-800 dark:text-slate-100"
  }, "\uD83D\uDCCB \uBAA9\uD45C \uAD00\uB9AC\uC790"), React.createElement("div", {
    className: "wm-head-tools ml-auto flex items-center gap-1"
  }, React.createElement("button", {
    onClick: () => setDark(!dark),
    className: "p-2 text-slate-400",
    title: "\uB2E4\uD06C \uBAA8\uB4DC"
  }, dark ? '☀️' : '🌙'), React.createElement("button", {
    onClick: () => {
      const blob = new Blob([JSON.stringify(tasks, null, 2)], {
        type: 'application/json'
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `과제백업_${today()}.json`;
      a.click();
    },
    className: "p-2 text-slate-400 text-sm",
    title: "JSON \uBC31\uC5C5"
  }, "\u2B07"), React.createElement("button", {
    onClick: () => firebase.auth().signOut(),
    className: "p-2 text-slate-400 text-sm",
    title: "\uB85C\uADF8\uC544\uC6C3"
  }, "\u21A9"))), React.createElement("div", {
    className: "wm-head-filters max-w-2xl mx-auto px-4 pb-2 space-y-2"
  }, React.createElement("div", {
    className: "flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1 w-fit"
  }, React.createElement("button", {
    onClick: () => setTab('active'),
    className: `px-4 py-1.5 rounded-md text-sm font-medium ${tab === 'active' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500'}`
  }, "\uC9C4\uD589 \uC911 ", activeCnt), React.createElement("button", {
    onClick: () => setTab('archive'),
    className: `px-4 py-1.5 rounded-md text-sm font-medium ${tab === 'archive' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500'}`
  }, "\uC644\uB8CC\xB7\uC774\uB825 ", archiveCnt)), React.createElement("div", {
    className: "wm-chips flex gap-1.5 overflow-x-auto pb-1"
  }, React.createElement("button", {
    onClick: () => setCatFilter(''),
    className: `px-2.5 py-1 rounded-full text-xs whitespace-nowrap border ${!catFilter ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent' : 'border-slate-200 dark:border-slate-600 text-slate-500'}`
  }, "\uC804\uCCB4"), CATEGORIES.map(c => React.createElement("button", {
    key: c,
    onClick: () => setCatFilter(catFilter === c ? '' : c),
    className: `px-2.5 py-1 rounded-full text-xs whitespace-nowrap border ${catFilter === c ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent' : 'border-slate-200 dark:border-slate-600 text-slate-500'}`
  }, c))))), (() => {
    const list = React.createElement("main", {
      className: "wm-list max-w-2xl mx-auto px-4 py-4 space-y-2.5 pb-24"
    }, !loaded && React.createElement("p", {
      className: "text-center text-sm text-slate-400 py-10"
    }, "\uBD88\uB7EC\uC624\uB294 \uC911\u2026"), loaded && visible.length === 0 && React.createElement("div", {
      className: "text-center py-16 space-y-2"
    }, React.createElement("div", {
      className: "text-4xl"
    }, tab === 'active' ? '🌱' : '📦'), React.createElement("p", {
      className: "text-sm text-slate-400"
    }, tab === 'active' ? '진행 중인 과제가 없습니다. 새 과제를 추가해 보세요.' : '완료된 과제가 여기에 쌓입니다.')), visible.map(t => React.createElement(TaskCard, {
      key: t.id,
      task: t,
      onSelect: setSelected,
      active: split && selected && selected.id === t.id
    })));
    if (!split) return list;
    return React.createElement("div", {
      className: "wm-split"
    }, list, React.createElement("section", {
      className: "wm-pane"
    }, selected ? React.createElement(TaskDetail, {
      key: selected.id,
      inline: true,
      twoCol: tablet,
      task: selected,
      uid: uid,
      schedules: schedules,
      onUpdate: saveTask,
      onDelete: deleteTask,
      onClose: () => setSelected(null),
      onSendSchedule: sendSchedule,
      onToast: showToast
    }) : React.createElement(Overview, {
      tasks: tasks,
      onSelect: setSelected
    })));
  })(), React.createElement("button", {
    onClick: () => setShowForm(true),
    className: "wm-fab fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-2xl shadow-lg flex items-center justify-center"
  }, "\uFF0B"), showForm && React.createElement(TaskForm, {
    onSave: saveTask,
    onClose: () => setShowForm(false)
  }), selected && !split && React.createElement(TaskDetail, {
    task: selected,
    uid: uid,
    schedules: schedules,
    onUpdate: saveTask,
    onDelete: deleteTask,
    onClose: () => setSelected(null),
    onSendSchedule: sendSchedule,
    onToast: showToast
  }), (notice || user.cached) && React.createElement("div", {
    className: "wm-notice fixed bottom-0 inset-x-0 z-40 px-3 py-0.5 text-center text-[11px] leading-4 bg-amber-100 text-amber-800 dark:bg-amber-900/90 dark:text-amber-100",
    style: {
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 2px)'
    }
  }, user.cached ? '최신 확인 중 — 잠시 뒤에 고칠 수 있어요' : notice), React.createElement(Toast, {
    toast: toast
  }));
}
const WM_CACHE = 'wm_cache_v1';
function readWmCache() {
  if (/[?&]nocache=1/.test(location.search)) return null;
  try {
    if (localStorage.getItem('wm_signed_in') !== '1') return null;
    const c = JSON.parse(localStorage.getItem(WM_CACHE) || 'null');
    return c && c.uid && Array.isArray(c.tasks) && Array.isArray(c.schedules) ? c : null;
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
  window.__wmCached = !!(user && user.cached);
  useEffect(() => {
    const dark = localStorage.getItem('wm-dark') === 'true' || !localStorage.getItem('wm-dark') && window.matchMedia('(prefers-color-scheme:dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  }, []);
  if (user === undefined) return React.createElement("div", {
    className: "min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900"
  }, React.createElement("p", {
    className: "text-sm text-slate-400"
  }, "\uD655\uC778 \uC911\u2026"));
  if (!user) return React.createElement(Login, null);
  return React.createElement(Main, {
    key: user.cached ? 'cached' : user.uid,
    user: user,
    initial: cached && cached.uid === user.uid ? cached : null
  });
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App, null));
