/* 목표 관리 화면 (React). ⚠ 이 파일이 원본이다 — 고친 뒤 `npm run build`로 ../app.js · ../app.css 를 다시 만든다.
   2026-10-15 까지는 index.html 안의 <script type="text/babel">을 폰 브라우저가 열 때마다 변환했다. 꾸밈 규칙(테일윈드)도 2026-11-17 부터 미리 만든다 */
const { useState, useEffect, useMemo, useRef } = React;

// 판 번호 — index.html 의 app.js?v= · app.css?v= 와 sw.js 의 OWN 에 같은 값이 있어야 한다(test/sw.spec.js 가 본다). 「정보」 창에 보인다
const APP_VER = '20261117';

// ═══ 상수 ═══
const CATEGORIES = ['투자','가족','집·이사','자기계발','건강','앱개발','기타'];
const STATUSES   = ['대기','진행','보류','완료','중단'];
const ACTIVE_STATUSES = ['진행','대기','보류'];
const PRIORITIES = ['높음','보통','낮음'];

const CAT_COLORS = {
  '투자':'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  '가족':'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  '집·이사':'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  '자기계발':'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
  '건강':'bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300',
  '앱개발':'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  '기타':'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};
const STATUS_COLORS = {
  '진행':'bg-blue-500', '대기':'bg-slate-400', '보류':'bg-amber-400',
  '완료':'bg-emerald-500', '중단':'bg-slate-500',
};
const PRIO_DOT = { '높음':'bg-red-500', '보통':'bg-amber-400', '낮음':'bg-slate-300 dark:bg-slate-600' };

// 흐린 글씨 — 밝은·어두운 화면 모두 4.5:1 을 넘는 조합 (2026-11-17 점검: slate-400 은 흰 바탕에서 2.56:1 이었다)
const DIM = 'text-slate-500 dark:text-slate-400';

const AUTH_ERRORS = {
  'auth/invalid-email':'이메일 형식이 올바르지 않아요',
  'auth/invalid-credential':'이메일 또는 비밀번호가 맞지 않아요',
  'auth/wrong-password':'이메일 또는 비밀번호가 맞지 않아요',
  'auth/user-not-found':'등록되지 않은 계정이에요',
  'auth/too-many-requests':'시도가 너무 많아요. 잠시 후 다시 해주세요',
  'auth/network-request-failed':'네트워크에 연결할 수 없어요',
  'auth/unauthorized-domain':'이 주소가 Firebase 승인 도메인에 없어요',
};

// 오류를 화면에 보일 한 줄로 — 라이브러리의 영어 원문과 경로(계정 번호가 섞인다)는 내보내지 않는다 (2026-11-17)
function errText(e) {
  const s = String((e && (e.code || e.message)) || e || '').toLowerCase();
  if (s.includes('permission') || s.includes('unauthorized') || s.includes('unauthenticated')) return '권한이 없어요. 로그아웃했다가 다시 로그인해 주세요';
  if (s.includes('disconnect') || s.includes('network') || s.includes('retry-limit') || s.includes('unavailable')) return '연결이 끊겼어요. 잠시 뒤 다시 눌러 주세요';
  if (s.includes('maxretry')) return '다른 기기와 겹쳤어요. 다시 눌러 주세요';
  if (s.includes('quota')) return '저장 공간이 모자라요';
  return '잠시 뒤 다시 해 주세요';
}

// ═══ 이미지 저장소 (Firebase Storage) ═══
// 목표별 이미지 원본은 RTDB가 아니라 Storage 전용 버킷에 둔다 (2026-09-19).
// RTDB(task.images)에는 이름·경로·URL·크기 같은 메타데이터만 남긴다.
// 규칙 파일은 다른 저장소에 있다(같은 Firebase 프로젝트의 storage.rules) — 본인 uid 경로만, 이미지만, 30MB 미만.
const IMG_BUCKET = 'gs://minsung-buboo2-goal-images';
const imgRef = (path) => firebase.app().storage(IMG_BUCKET).ref(path);
const IMG_MAX = 30 * 1024 * 1024;

function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
function safeName(name) { return (name || 'image').replace(/[\/\\#?%*:"<>|]/g, '_'); }

// 원본은 그대로 올리고, 목록용 썸네일(긴 변 480px JPEG)은 브라우저에서 만들어 따로 올린다.
// 원본이 5MB짜리 사진이라도 목록을 열 때 매번 그걸 내려받지 않게 하려는 것.
function makeThumb(file, max = 480) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const w = im.naturalWidth, h = im.naturalHeight;
      const s = Math.min(1, max / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => resolve({ blob: b, width: w, height: h }), 'image/jpeg', 0.8);
    };
    im.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    im.src = url;
  });
}

// ═══ 유틸 ═══
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(d) { return d ? d.replaceAll('-', '.') : '─'; }
function dday(targetDate, status) {
  if (!targetDate || status === '완료' || status === '중단') return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const t = new Date(targetDate + 'T00:00:00');
  const n = Math.floor((t - now) / 86400000);
  if (n === 0) return { text:'D-Day', cls:'text-amber-700 dark:text-amber-400 font-bold' };
  if (n > 0)  return { text:`D-${n}`, cls: n <= 7 ? 'text-orange-700 dark:text-orange-400 font-semibold' : 'text-sky-700 dark:text-sky-400' };
  return { text:`D+${Math.abs(n)}`, cls:'text-red-600 dark:text-red-400 font-semibold' };
}
function schedDate(s) {
  const d = new Date(s.start);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function schedDone(s) {
  if (s.done) return true;
  return Array.isArray(s.doneDates) && s.doneDates.includes(schedDate(s));
}
// 이 앱이 쓰는 일정은 메모에 [목표:id] 가 붙은 것뿐이다 — 나머지 개인 일정은 화면 상태에도 기기 사본에도 담지 않는다 (2026-11-17)
function isGoalSchedule(s) { return !!s && typeof s.memo === 'string' && s.memo.includes('[목표:'); }
function goalSchedules(val) {
  return Object.entries(val || {}).filter(([, v]) => isGoalSchedule(v)).map(([id, v]) => ({ ...v, id }));
}

// ═══ 화면 판정 — CSS의 @media와 같은 조건 (조건을 바꾸면 둘 다) ═══
// 태블릿 가로(2026-09-28): 목록|상세 두 칸 + 상세 안 두 단 · 폴드7 펼침/태블릿 세로(2026-10-09): 목록|상세 두 칸, 상세 안은 폰처럼 한 줄
// 높이 500 미만(폰 가로)은 태블릿에서 뺀다 (2026-10-21)
const TABLET_MQ = '(min-width: 900px) and (orientation: landscape) and (min-height: 500px)';
const FOLD_MQ = '(min-width: 600px) and (max-width: 899px) and (min-height: 500px), (min-width: 600px) and (orientation: portrait)';
function useMQ(query) {
  const [on, setOn] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const f = () => setOn(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', f) : mq.addListener(f);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', f) : mq.removeListener(f); };
  }, [query]);
  return on;
}

// ═══ 알림 — ＋ 단추(화면 아래 24px, 높이 56px)를 가리지 않게 그 위에 띄운다 ═══
function Toast({ toast }) {
  if (!toast) return null;
  const color = toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800 dark:bg-slate-200 dark:text-slate-900';
  return (
    <div className={`wm-toast fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-max max-w-[92vw] px-4 py-2.5 rounded-xl text-white text-sm text-center shadow-lg ${color}`}>
      {toast.msg}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400";

// ═══ 로그인 화면 ═══
function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // 새 판이 깔려 화면이 스스로 새로 고칠 때(index.html) — 로그인하는 중이면 미룬다
  const st = useRef({}); st.current = { email, pw, busy };
  const popup = useRef(false);
  useEffect(()=>{
    window.__appBusy = () => !!(popup.current || st.current.busy || st.current.email || st.current.pw);
    return () => { delete window.__appBusy; };
  }, []);
  function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    firebase.auth().signInWithEmailAndPassword(email.trim(), pw)
      .catch(ex => { setErr(AUTH_ERRORS[ex.code] || '로그인에 실패했어요'); setBusy(false); });
  }
  // 구글 로그인 (2026-10-15 — 다른 앱들처럼). 계정에 구글이 이미 연결돼 같은 uid로 들어온다.
  // 연결 안 된 구글 계정은 프로젝트가 새 계정을 막아 두어 admin-restricted-operation 으로 거절된다
  async function google() {
    setErr('');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    popup.current = true;
    try { await firebase.auth().signInWithPopup(provider); }
    catch (ex) {
      if (ex.code === 'auth/popup-blocked' || ex.code === 'auth/operation-not-supported-in-this-environment') {
        try { await firebase.auth().signInWithRedirect(provider); return; } catch (e2) { ex = e2; }
      }
      if (ex.code === 'auth/popup-closed-by-user' || ex.code === 'auth/cancelled-popup-request') return;
      setErr(ex.code === 'auth/admin-restricted-operation' ? '이 구글 계정은 등록되어 있지 않아요. 이메일·비밀번호로 로그인해 주세요' : (AUTH_ERRORS[ex.code] || '로그인에 실패했어요'));
    } finally { popup.current = false; }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow p-6 space-y-4">
        <div className="text-center space-y-1">
          <div className="text-3xl" aria-hidden="true">📋</div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">목표 관리</h1>
          <p className={`text-xs ${DIM}`}>민성 스케줄과 같은 계정으로 로그인해 주세요 (일정 연동)</p>
        </div>
        <input type="email" required placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)} className={inputCls} />
        <input type="password" required placeholder="비밀번호" value={pw} onChange={e=>setPw(e.target.value)} className={inputCls} />
        {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
        <button disabled={busy} className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">
          {busy ? '로그인 중…' : '로그인'}
        </button>
        <button type="button" onClick={google} className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold">
          구글 계정으로 로그인
        </button>
      </form>
    </div>
  );
}

// ═══ 새 목표 창 ═══
// dirtyRef: 쓴 글이 있는지 Main 에 알린다 — 뒤로 가기·새 판 새로 고침이 쓰던 글을 날리지 않게
function TaskForm({ onSave, onClose, dirtyRef }) {
  const [f, setF] = useState({ title:'', category:CATEGORIES[0], status:'진행', priority:'보통', dueDate:'', firstLog:'' });
  const dirty = !!(f.title.trim() || f.firstLog.trim());
  useEffect(()=>{ dirtyRef.current = dirty; }, [dirty]);
  useEffect(()=> () => { dirtyRef.current = false; }, []);
  function submit(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    const now = Date.now();
    const task = {
      id: genId(), title: f.title.trim(), category: f.category, status: f.status,
      priority: f.priority, dueDate: f.dueDate || null,
      checklist: [], log: f.firstLog.trim() ? [{ id: genId(), date: today(), text: f.firstLog.trim() }] : [],
      createdAt: now, updatedAt: now, completedAt: null,
    };
    if (onSave(task) === false) return;      // 아직 고칠 수 없는 때 — 창과 쓴 글을 그대로 둔다
    onClose();
  }
  return (
    // 바깥(어두운 곳)을 눌러도 쓴 글이 있으면 닫지 않는다. 높이는 덮개 기준(max-h-full) — 자판이 뜨면 덮개가 줄어든다(viewport interactive-widget)
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={()=>{ if (!dirty) onClose(); }}>
      <form onSubmit={submit} onClick={e=>e.stopPropagation()}
        className="wm-form w-full sm:max-w-md bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-full overflow-y-auto">
        <h2 className="font-bold text-slate-800 dark:text-slate-100">새 목표</h2>
        <input autoFocus required placeholder="목표 제목" value={f.title} onChange={e=>setF({...f, title:e.target.value})} className={inputCls} />
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="분류" value={f.category} onChange={e=>setF({...f, category:e.target.value})} className={inputCls}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select aria-label="우선순위" value={f.priority} onChange={e=>setF({...f, priority:e.target.value})} className={inputCls}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="상태" value={f.status} onChange={e=>setF({...f, status:e.target.value})} className={inputCls}>
            {ACTIVE_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <input type="date" aria-label="목표 기한 (선택)" value={f.dueDate} onChange={e=>setF({...f, dueDate:e.target.value})} className={inputCls} title="목표 기한 (선택)" />
        </div>
        <textarea placeholder="첫 진행 기록 (선택)" value={f.firstLog} onChange={e=>setF({...f, firstLog:e.target.value})} rows="2" className={inputCls} />
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200">취소</button>
          <button className="flex-1 h-11 rounded-lg bg-blue-600 text-white text-sm font-semibold">추가</button>
        </div>
      </form>
    </div>
  );
}

// ═══ 정보 창 — 판 번호 · 백업 · 로그아웃 (2026-11-17, 전엔 맨 위에 그림만 있는 단추였다) ═══
function InfoSheet({ user, tasks, onClose }) {
  function backup() {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `목표백업_${today()}.json`; a.click();
  }
  function logout() {
    if (!confirm('로그아웃할까요?\n이 기기에 받아 둔 사본도 지워져요.')) return;
    firebase.auth().signOut();
  }
  const row = 'flex items-center justify-between gap-3';
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} className="wm-info w-full sm:max-w-sm bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-full overflow-y-auto">
        <h2 className="font-bold text-slate-800 dark:text-slate-100">정보</h2>
        <dl className="text-sm space-y-2 text-slate-600 dark:text-slate-300">
          <div className={row}><dt>판</dt><dd className="wm-ver font-medium text-slate-800 dark:text-slate-100">{APP_VER}</dd></div>
          <div className={row}><dt className="shrink-0">계정</dt><dd className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">{user.email || '─'}</dd></div>
          <div className={row}><dt>목표</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{tasks.length}개</dd></div>
        </dl>
        <button onClick={backup} className="w-full h-11 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200">⬇ 백업 파일 받기</button>
        <p className={`text-xs ${DIM}`}>백업 파일에는 사진을 여는 주소가 들어 있어요. 남에게 주면 사진도 보여요.</p>
        <button onClick={logout} className="w-full h-11 rounded-lg border border-red-300 dark:border-red-800 text-sm text-red-600 dark:text-red-400">↩ 로그아웃</button>
        <button onClick={onClose} className="w-full h-11 rounded-lg bg-blue-600 text-white text-sm font-semibold">닫기</button>
      </div>
    </div>
  );
}

// ═══ 목표 상세 ═══
// inline: 오른쪽 칸 안에 열림(덮는 창 ✗) · twoCol: 상세 안을 두 단으로(태블릿 가로만, 폴드는 한 줄)
// day: 오늘 날짜(Main 이 자정·다시 보일 때 고친다) · canWrite(): 지금 고칠 수 있는가(아니면 알림을 띄우고 false)
// bridge: Main 이 이 화면에 묻는 것 — canLeave()(쓰던 글이 있으면 묻는다) · isBusy() · back(크게 본 사진 닫기)
function TaskDetail({ task, uid, day, schedules, onUpdate, onDelete, onClose, onSendSchedule, onToast, canWrite, bridge, inline, twoCol }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(task);
  const [newLog, setNewLog] = useState('');
  const [logDate, setLogDate] = useState(null);         // null = 손대지 않음 → 누르는 순간의 오늘로 적는다 (2026-11-17, 켜 둔 채 자정을 넘기면 어제로 적혔다)
  const [newCheck, setNewCheck] = useState('');
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedDateV, setSchedDateV] = useState(null);   // null = 손대지 않음 → 오늘
  const [schedTime, setSchedTime] = useState('');
  const [uploading, setUploading] = useState(null);     // { done, total, pct }
  const [viewer, setViewer] = useState(null);           // 크게 보는 이미지 id
  const [titleOpen, setTitleOpen] = useState(false);    // 긴 제목 펼치기
  const fileInput = useRef(null);
  const alive = useRef(true);
  useEffect(()=> () => { alive.current = false; }, []);
  // 편집 중엔 입력하던 값을 지우지 않는다 — 상태 버튼을 누르거나 다른 기기가 고쳐 task 가 바뀌어도 (2026-10-13)
  useEffect(()=>{ if (!editing) setF(task); }, [task]);
  // 고치기는 모두 patch 함수로 — cur 는 저장 시점의 최신 목표 (Main.saveTask 참고). 이 화면의 task 를 통째로 쓰지 않는다.
  // 돌려주는 값: false = 아직 고칠 수 없어 하지 않음(쓴 글을 그대로 둔다) · Promise<boolean> = 서버가 받았는지
  const patch = fn => onUpdate(task.id, fn);

  // ── 쓰던 글이 있는가 — 닫기·뒤로 가기·다른 목표 고르기 전에 묻는다 (2026-11-17) ──
  const dirty = (editing && ((f.title||'') !== (task.title||'') || f.category !== task.category || f.priority !== task.priority || (f.dueDate||'') !== (task.dueDate||'')))
    || !!newLog.trim() || !!newCheck.trim();
  const now = useRef({}); now.current = { dirty, uploading, viewer };
  const canLeave = () => !now.current.dirty || confirm('쓰던 글이 있어요. 버리고 나갈까요?');
  useEffect(()=>{
    bridge.current = { canLeave, isBusy: () => !!(now.current.dirty || now.current.uploading), back: viewer ? () => setViewer(null) : null };
  });
  useEffect(()=> () => { bridge.current = null; }, []);
  const requestClose = () => { if (canLeave()) onClose(); };

  // ── 이미지 첨부 ──
  const images = task.images || [];
  async function addImages(fileList) {
    const files = Array.from(fileList || []).filter(x => x.type.startsWith('image/'));
    const clear = () => { if (fileInput.current) fileInput.current.value = ''; };
    if (!files.length) return;
    if (!canWrite()) { clear(); return; }
    const tooBig = files.find(x => x.size >= IMG_MAX);
    if (tooBig) { onToast(`${tooBig.name}은(는) 30MB를 넘어 올릴 수 없어요`, 'error'); clear(); return; }
    setUploading({ done: 0, total: files.length, pct: 0 });
    const added = [];
    let failed = null;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const id = genId();
        const name = safeName(file.name);
        const base = `goal-images/${uid}/${task.id}/${id}`;
        // 원본: Content-Disposition을 attachment로 박아 두면 다운로드 URL을 그냥 열어도 파일로 내려온다.
        const meta = {
          contentType: file.type,
          cacheControl: 'private, max-age=31536000, immutable',
          contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
          customMetadata: { taskId: task.id, originalName: name },
        };
        const ref = imgRef(`${base}_${name}`);
        await new Promise((res, rej) => {
          ref.put(file, meta).on('state_changed',
            s => { if (alive.current) setUploading({ done: i, total: files.length, pct: Math.round(s.bytesTransferred / s.totalBytes * 100) }); },
            rej, res);
        });
        const url = await ref.getDownloadURL();
        let thumbUrl = null, thumbPath = null, width = null, height = null;
        const th = await makeThumb(file);
        if (th) {
          width = th.width; height = th.height;
          if (th.blob) {
            // 썸네일은 덤이다 — 실패해도 원본은 이미 올라갔으니 기록은 남긴다 (목록·카드는 원본을 보여준다)
            try {
              const tref = imgRef(`${base}_thumb.jpg`);
              await tref.put(th.blob, { contentType: 'image/jpeg', cacheControl: 'private, max-age=31536000, immutable' });
              thumbPath = tref.fullPath;
              thumbUrl = await tref.getDownloadURL();
            } catch (e) { /* 썸네일 없이 진행 */ }
          }
        }
        added.push({ id, name, path: ref.fullPath, url, thumbPath, thumbUrl,
          size: file.size, type: file.type, width, height, createdAt: Date.now() });
      }
    } catch (e) { failed = e; }
    // 올리는 동안 이 화면의 task 는 옛것일 수 있다(그사이 남긴 기록 등) — 최신 목표에 사진만 덧붙인다. 일부만 올라갔어도 그만큼은 기록한다
    if (added.length) {
      const list = added.slice();
      Promise.resolve(patch(cur => ({ ...cur, images: [...(cur.images||[]), ...list] }))).then(ok => {
        if (ok) { if (!failed) onToast(`이미지 ${list.length}장을 저장했어요 🖼️`); return; }
        // 기록하지 못했으면(그사이 지워진 목표 등) 올린 파일을 남기지 않는다
        for (const a of list) { imgRef(a.path).delete().catch(()=>{}); if (a.thumbPath) imgRef(a.thumbPath).delete().catch(()=>{}); }
      });
    }
    if (failed) onToast('이미지 업로드 실패 — ' + errText(failed), 'error');
    if (alive.current) setUploading(null);
    clear();
  }
  function delImage(img) {
    if (!canWrite()) return;
    if (!confirm(`「${img.name}」을(를) 원본까지 지울까요?`)) return;
    // 기록을 먼저 고치고, 서버가 받은 뒤에 파일을 지운다 — 거꾸로 하면 기록 고치기가 막히거나 거절됐을 때 사진 없는 기록이 남는다 (2026-11-17)
    const p = patch(cur => ({ ...cur, images: (cur.images||[]).filter(x => x.id !== img.id) }));
    if (p === false) return;
    setViewer(null);
    p.then(ok => {
      if (!ok) return;
      imgRef(img.path).delete().catch(()=>{});
      if (img.thumbPath) imgRef(img.thumbPath).delete().catch(()=>{});
    });
  }
  const viewing = viewer ? images.find(x => x.id === viewer) : null;

  const linked = useMemo(() =>
    schedules.filter(s => (s.memo || '').includes(`[목표:${task.id}]`)).sort((a,b)=>b.start-a.start),
    [schedules, task.id]);

  function saveEdit() {
    const { title, category, priority, dueDate } = f;
    const p = patch(cur => ({ ...cur, title: (title||'').trim()||cur.title, category, priority, dueDate: dueDate||null }));
    if (p === false) return;                 // 아직 고칠 수 없는 때 — 편집을 닫지 않는다
    setEditing(false);
    // 저장이 안 됐으면 고치던 값을 되돌려 놓는다
    p.then(ok => { if (!ok && alive.current) { setF(v => ({ ...v, title, category, priority, dueDate })); setEditing(true); } });
  }
  function cancelEdit() { setF(task); setEditing(false); }
  function setStatus(st) {
    // 완료를 다시 눌러도 처음 완료한 시각을 지킨다
    patch(cur => ({ ...cur, status: st, completedAt: st==='완료' ? (cur.completedAt || Date.now()) : null }));
  }
  function addLog() {
    const text = newLog.trim();
    if (!text) return;
    const entry = { id:genId(), date: logDate || today(), text };   // 날짜 칸을 손대지 않았거나 비웠으면 누르는 순간의 오늘
    const p = patch(cur => ({ ...cur, log: [...(cur.log||[]), entry] }));
    if (p === false) return;                 // 쓴 글을 그대로 둔다
    setNewLog('');
    p.then(ok => { if (!ok && alive.current) setNewLog(v => v || text); });   // 저장이 안 됐으면 쓴 글을 되돌려 놓는다
  }
  function delLog(id) {
    if (!canWrite()) return;
    if (!confirm('이 기록을 지울까요?')) return;
    patch(cur => ({ ...cur, log: (cur.log||[]).filter(l=>l.id!==id) }));
  }
  function addCheck() {
    const text = newCheck.trim();
    if (!text) return;
    const entry = { id:genId(), text, done:false, doneDate:null };
    const p = patch(cur => ({ ...cur, checklist: [...(cur.checklist||[]), entry] }));
    if (p === false) return;
    setNewCheck('');
    p.then(ok => { if (!ok && alive.current) setNewCheck(v => v || text); });
  }
  function toggleCheck(id) {
    const cur0 = (task.checklist||[]).find(c=>c.id===id);
    const done = !(cur0 && cur0.done), doneDate = done ? today() : null;   // 누른 시점의 뜻(켬/끔)을 저장한다
    patch(cur => ({ ...cur, checklist: (cur.checklist||[]).map(c => c.id===id ? { ...c, done, doneDate } : c) }));
  }
  function delCheck(c) {
    if (!canWrite()) return;
    if (!confirm(`「${c.text}」 단계를 지울까요?`)) return;
    patch(cur => ({ ...cur, checklist: (cur.checklist||[]).filter(x=>x.id!==c.id) }));
  }
  function sendSchedule() {
    const ok = onSendSchedule(task, schedDateV === null ? today() : schedDateV, schedTime);
    if (ok === false) return;                // 못 보냈으면(날짜 빔·아직 고칠 수 없음) 고른 날짜·시각을 그대로 둔다
    setSchedOpen(false); setSchedTime('');
  }

  const checklist = task.checklist || [];
  const log = [...(task.log||[])].sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (b.id>a.id?1:-1));
  const doneCount = checklist.filter(c=>c.done).length;
  const dd = dday(task.dueDate, task.status);
  const h3 = 'text-sm font-semibold text-slate-700 dark:text-slate-200';
  const linkBtn = 'h-10 -my-2 -mr-2 px-2 text-xs font-medium text-blue-600 dark:text-blue-400';

  // 카드 조각 — 폰은 한 줄로 쌓고, 태블릿(inline)은 두 단으로 나눠 담는다 (2026-09-28)
  const infoCard = (
    <div className="wm-d-info bg-white dark:bg-slate-800 rounded-xl p-4 space-y-3">
      {editing ? (
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="분류" value={f.category} onChange={e=>setF({...f, category:e.target.value})} className={inputCls}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select aria-label="우선순위" value={f.priority} onChange={e=>setF({...f, priority:e.target.value})} className={inputCls}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
          <input type="date" aria-label="목표 기한" value={f.dueDate||''} onChange={e=>setF({...f, dueDate:e.target.value})} className={`${inputCls} col-span-2`} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${CAT_COLORS[task.category]||CAT_COLORS['기타']}`}>{task.category}</span>
          <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <span className={`w-2 h-2 rounded-full ${PRIO_DOT[task.priority]}`}></span>{task.priority}
          </span>
          <span className={`text-xs ${DIM}`}>기한 {fmtDate(task.dueDate)}</span>
          {dd && <span className={`text-xs ${dd.cls}`}>{dd.text}</span>}
        </div>
      )}
      {/* 상태 버튼 */}
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map(st => (
          <button key={st} onClick={()=>setStatus(st)}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs font-medium border transition
              ${task.status===st
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
            {st}
          </button>
        ))}
      </div>
      {task.completedAt && <p className="text-xs text-emerald-700 dark:text-emerald-400">✓ {new Date(task.completedAt).toLocaleDateString('ko-KR')} 완료</p>}
    </div>
  );
  const imgCard = (
    // 이미지 — 목표를 떠올리게 하는 사진. 원본은 Storage, 여기엔 썸네일
    <div className="wm-d-img bg-white dark:bg-slate-800 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className={h3}>🖼️ 이미지 {images.length > 0 && <span className={`font-normal text-xs ${DIM}`}>({images.length})</span>}</h3>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e=>addImages(e.target.files)} />
        <button onClick={()=>fileInput.current && fileInput.current.click()} disabled={!!uploading} className={`${linkBtn} disabled:opacity-50`}>
          {uploading ? `올리는 중 ${uploading.done + 1}/${uploading.total} · ${uploading.pct}%` : '＋ 첨부'}
        </button>
      </div>
      {uploading && (
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: uploading.pct + '%' }}></div>
        </div>
      )}
      {images.length === 0 && !uploading
        ? <p className={`text-xs ${DIM}`}>이 목표를 세우게 한 사진, 도달했을 때의 모습을 원본 그대로 보관해요.</p>
        : (
          <div className="wm-d-thumbs grid grid-cols-3 gap-2">
            {images.map(img => (
              <button key={img.id} onClick={()=>setViewer(img.id)} aria-label={`${img.name} 크게 보기`}
                className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700">
                <img src={img.thumbUrl || img.url} alt={img.name} loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
    </div>
  );
  const checkCard = (
    // 체크리스트 — 누르는 자리는 40px, 보이는 네모는 24px
    <div className="wm-d-check bg-white dark:bg-slate-800 rounded-xl p-4 space-y-1">
      <div className="flex items-center justify-between">
        <h3 className={h3}>체크리스트</h3>
        {checklist.length > 0 && <span className={`text-xs ${DIM}`}>{doneCount}/{checklist.length}</span>}
      </div>
      {checklist.map(c => (
        <div key={c.id} className="flex items-center gap-1 group">
          <button onClick={()=>toggleCheck(c.id)} aria-label={c.done ? '끝냄 표시 풀기' : '끝냄 표시'} className="w-10 h-10 -ml-2 shrink-0 flex items-center justify-center">
            <span className={`w-6 h-6 rounded-md border flex items-center justify-center text-sm
              ${c.done ? 'bg-emerald-700 border-emerald-700 text-white' : 'border-slate-400 dark:border-slate-500'}`}>{c.done ? '✓' : ''}</span>
          </button>
          <span className={`flex-1 min-w-0 text-sm [overflow-wrap:anywhere] ${c.done ? `line-through ${DIM}` : 'text-slate-700 dark:text-slate-200'}`}>{c.text}</span>
          {c.done && c.doneDate && <span className={`text-[10px] shrink-0 ${DIM}`}>{fmtDate(c.doneDate)}</span>}
          <button onClick={()=>delCheck(c)} aria-label="이 단계 지우기" className={`w-10 h-10 -mr-2 shrink-0 flex items-center justify-center text-sm hover:text-red-500 ${DIM}`}>✕</button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <input placeholder="하위 단계 추가" value={newCheck} onChange={e=>setNewCheck(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addCheck(); } }} className={inputCls} />
        <button onClick={addCheck} aria-label="단계 추가" className="w-11 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200">＋</button>
      </div>
    </div>
  );
  const schedCard = (
    // 일정으로 보내기 + 연동된 일정
    <div className="wm-d-sched bg-white dark:bg-slate-800 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className={h3}>📅 일정 연동 <span className={`font-normal text-xs ${DIM}`}>(민성 스케줄)</span></h3>
        <button onClick={()=>setSchedOpen(!schedOpen)} className={linkBtn}>일정으로 보내기</button>
      </div>
      {schedOpen && (
        <div className="flex flex-wrap gap-2 items-center bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
          <input type="date" aria-label="보낼 날짜" value={schedDateV === null ? day : schedDateV} onChange={e=>setSchedDateV(e.target.value)} className={`${inputCls} !w-auto flex-1`} />
          <input type="time" aria-label="시각 (비우면 종일)" value={schedTime} onChange={e=>setSchedTime(e.target.value)} className={`${inputCls} !w-auto`} title="비우면 종일" />
          <button onClick={sendSchedule} className="h-[42px] px-4 rounded-lg bg-blue-600 text-white text-xs font-semibold">보내기</button>
        </div>
      )}
      {linked.length === 0
        ? <p className={`text-xs ${DIM}`}>아직 연동된 일정이 없어요. 실행할 날을 정하면 일정 앱에 나타나요.</p>
        : linked.map(s => (
          <div key={s.id} className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full shrink-0 ${schedDone(s) ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
            <span className="text-slate-600 dark:text-slate-300">{fmtDate(schedDate(s))}</span>
            <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{s.title}</span>
            {schedDone(s) && <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">완료</span>}
          </div>
        ))}
    </div>
  );
  const logCard = (
    // 진행 로그
    <div className="wm-d-log bg-white dark:bg-slate-800 rounded-xl p-4 space-y-3">
      <h3 className={h3}>진행 로그 <span className={`font-normal text-xs ${DIM}`}>({log.length})</span></h3>
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input type="date" aria-label="기록 날짜" value={logDate === null ? day : logDate} onChange={e=>setLogDate(e.target.value)} className={`${inputCls} !w-auto`} />
          <button onClick={addLog} className="px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold ml-auto">기록</button>
        </div>
        <textarea placeholder="오늘 진행한 내용…" value={newLog} onChange={e=>setNewLog(e.target.value)} rows="2" className={inputCls} />
      </div>
      <div className="space-y-3 pt-1">
        {log.map(l => (
          <div key={l.id} className="flex gap-3 group">
            <div className="flex flex-col items-center">
              <span className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>
              <span className="flex-1 w-px bg-slate-200 dark:bg-slate-700"></span>
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${DIM}`}>{fmtDate(l.date)}</span>
                {/* 지우기 — 늘 보인다(전엔 마우스를 올려야 보여 폰에선 투명한 채 눌렸다) */}
                <button onClick={()=>delLog(l.id)} aria-label="이 기록 지우기" className={`ml-auto w-10 h-10 -my-3 -mr-2 shrink-0 flex items-center justify-center text-sm hover:text-red-500 ${DIM}`}>✕</button>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap [overflow-wrap:anywhere]">{l.text}</p>
            </div>
          </div>
        ))}
        {log.length === 0 && <p className={`text-xs ${DIM}`}>진행 기록이 여기에 쌓여요.</p>}
      </div>
    </div>
  );
  const delBlock = (<>
    <button onClick={()=>{ if (!canWrite()) return; if (confirm('이 목표를 이력까지 전부 지울까요?\n(끝낸 목표라면 상태를 「완료」로 바꾸면 돼요)')) onDelete(task.id); }}
      className="wm-d-del w-full h-11 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">목표 삭제</button>
    <p className={`wm-d-created text-center text-[10px] pb-4 ${DIM}`}>
      생성 {new Date(task.createdAt).toLocaleDateString('ko-KR')}
    </p>
  </>);

  return (
    <div className={inline ? 'wm-detail-inline' : 'fixed inset-0 z-30 bg-black/40 flex justify-end'} onClick={inline ? undefined : requestClose}>
      <div onClick={e=>e.stopPropagation()}
        className={inline ? 'wm-detail-scroll bg-slate-50 dark:bg-slate-900' : 'w-full sm:max-w-lg h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto shadow-2xl'}>
        {/* 머리줄 — z-10: 아래 이미지 썸네일(relative)이 스크롤하며 제목 위로 올라오던 것 (2026-10-09 폴드 캡처).
            제목은 두 줄까지 보이고, 누르면 다 펼친다 (2026-11-17 — 전엔 한 줄에서 잘려 전체를 볼 곳이 없었다) */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-2 py-1.5 flex items-center gap-1">
          <button onClick={requestClose} aria-label="닫기" className={`w-10 h-10 shrink-0 flex items-center justify-center text-xl ${DIM}`}>←</button>
          {editing ? (
            <input aria-label="목표 제목" value={f.title} onChange={e=>setF({...f, title:e.target.value})} className={inputCls} />
          ) : (
            <h2 onClick={()=>setTitleOpen(o=>!o)} className={`flex-1 min-w-0 py-1.5 font-bold text-slate-800 dark:text-slate-100 [overflow-wrap:anywhere] ${titleOpen ? '' : 'line-clamp-2'}`}>{task.title}</h2>
          )}
          {editing ? (<>
            <button onClick={cancelEdit} className={`h-10 px-2 shrink-0 text-sm ${DIM}`}>취소</button>
            <button onClick={saveEdit} className="h-10 px-2 shrink-0 text-sm font-semibold text-blue-600 dark:text-blue-400">저장</button>
          </>) : (
            <button onClick={()=>setEditing(true)} className={`h-10 px-2 shrink-0 text-sm ${DIM}`}>편집</button>
          )}
        </div>

        <div className="wm-d-body p-4 space-y-5">
          {inline && twoCol ? (<>
            {infoCard}
            <div className="wm-d-col">{imgCard}{checkCard}<div className="wm-d-spacer"></div>{delBlock}</div>
            <div className="wm-d-col">{schedCard}{logCard}</div>
          </>) : (<>{infoCard}{imgCard}{checkCard}{schedCard}{logCard}{delBlock}</>)}
        </div>
      </div>

      {/* 이미지 크게 보기 — 원본을 그대로 보여주고, 다운로드는 원본 파일로 */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={e=>{ e.stopPropagation(); setViewer(null); }}>
          <div className="flex items-center gap-2 px-2 py-2 text-white/90" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setViewer(null)} aria-label="닫기" className="w-10 h-10 shrink-0 flex items-center justify-center text-xl">←</button>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{viewing.name}</p>
              <p className="text-[11px] text-white/70">
                {viewing.width && viewing.height ? `${viewing.width}×${viewing.height} · ` : ''}{fmtBytes(viewing.size)}
                {viewing.createdAt ? ` · ${new Date(viewing.createdAt).toLocaleDateString('ko-KR')}` : ''}
              </p>
            </div>
            <a href={viewing.url} download={viewing.name} target="_blank" rel="noopener"
              className="h-10 px-3 shrink-0 flex items-center rounded-lg bg-white/15 hover:bg-white/25 text-xs font-medium" title="원본 파일 다운로드">⬇ 원본</a>
            <button onClick={()=>delImage(viewing)} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-sm text-red-300 hover:bg-white/10" title="삭제" aria-label="이 사진 지우기">🗑</button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-2" onClick={e=>e.stopPropagation()}>
            <img src={viewing.url} alt={viewing.name} className="max-w-full max-h-full object-contain" />
          </div>
          {images.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto px-4 py-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }} onClick={e=>e.stopPropagation()}>
              {images.map(img => (
                <button key={img.id} onClick={()=>setViewer(img.id)} aria-label={`${img.name} 보기`}
                  className={`w-14 h-14 shrink-0 rounded-md overflow-hidden border-2 ${img.id===viewing.id ? 'border-white' : 'border-transparent opacity-60'}`}>
                  <img src={img.thumbUrl || img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══ 목표 카드 — 제목은 세 줄까지(폴드 펼친 화면의 목록 칸은 300px 이라 긴 제목이 세 줄이 된다) ═══
function TaskCard({ task, onSelect, active }) {
  const checklist = task.checklist || [];
  const doneCount = checklist.filter(c=>c.done).length;
  const pct = checklist.length ? Math.round(doneCount / checklist.length * 100) : null;
  const lastLog = (task.log||[]).reduce((m,l)=> (l.date||'') > m ? l.date : m, '');
  const dd = dday(task.dueDate, task.status);
  const cover = (task.images || [])[0];
  return (
    <button onClick={()=>onSelect(task)}
      className={`wm-card${active ? ' wm-card-active' : ''} w-full text-left bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm hover:shadow transition space-y-2`}>
      <div className="flex items-start gap-2">
        <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${STATUS_COLORS[task.status]||'bg-slate-400'}`}></span>
        <span className="flex-1 min-w-0 font-semibold text-sm text-slate-800 dark:text-slate-100 line-clamp-3 [overflow-wrap:anywhere]">{task.title}</span>
        {dd && <span className={`text-xs shrink-0 mt-0.5 ${dd.cls}`}>{dd.text}</span>}
        {cover && <img src={cover.thumbUrl || cover.url} alt="" loading="lazy" className="w-9 h-9 rounded-md object-cover shrink-0" />}
      </div>
      <div className={`flex items-center gap-2 text-xs ${DIM}`}>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CAT_COLORS[task.category]||CAT_COLORS['기타']}`}>{task.category}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${PRIO_DOT[task.priority]}`}></span>
        <span>{task.status}</span>
        {lastLog && <span className="ml-auto">최근 기록 {fmtDate(lastLog)}</span>}
      </div>
      {pct !== null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: pct + '%' }}></div>
          </div>
          <span className={`text-[10px] ${DIM}`}>{doneCount}/{checklist.length}</span>
        </div>
      )}
    </button>
  );
}

// ═══ 태블릿 오른쪽 칸 — 목표를 고르기 전에 보이는 한눈에 보기 (2026-09-28) ═══
function Overview({ tasks, onSelect }) {
  const cnt = st => tasks.filter(t => t.status === st).length;
  const active = tasks.filter(t => ACTIVE_STATUSES.includes(t.status));
  const due = active.filter(t => t.dueDate).sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
  const recent = tasks.flatMap(t => (t.log||[]).map(l => ({ ...l, task: t })))
    .sort((a,b) => (b.date||'').localeCompare(a.date||'') || (b.id > a.id ? 1 : -1)).slice(0, 6);
  const byCat = CATEGORIES.map(c => [c, active.filter(t => t.category === c).length]).filter(x => x[1] > 0);
  const maxCat = Math.max(1, ...byCat.map(x => x[1]));
  const card = 'bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm';
  const h3 = 'text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3';
  return (
    <div className="wm-overview">
      <div className="wm-ov-tiles">
        {STATUSES.map(st => (
          <div key={st} className={`${card} !p-4`}>
            <div className={`flex items-center gap-1.5 text-xs ${DIM}`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[st]}`}></span>{st}
            </div>
            <div className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{cnt(st)}</div>
          </div>
        ))}
      </div>
      <div className={`${card} wm-ov-col`}>
        <h3 className={h3}>⏰ 다가오는 기한</h3>
        {due.length === 0 && <p className={`text-xs ${DIM}`}>기한을 정한 진행 중 목표가 없어요.</p>}
        {due.map(t => { const dd = dday(t.dueDate, t.status); return (
          <button key={t.id} onClick={()=>onSelect(t)} className="wm-ov-row">
            <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[t.status]}`}></span>
            <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{t.title}</span>
            <span className={`text-xs ${DIM}`}>{fmtDate(t.dueDate)}</span>
            {dd && <span className={`text-xs w-14 text-right ${dd.cls}`}>{dd.text}</span>}
          </button>
        ); })}
      </div>
      <div className={`${card} wm-ov-col`}>
        <h3 className={h3}>📝 최근 진행 기록</h3>
        {recent.length === 0 && <p className={`text-xs ${DIM}`}>진행 기록이 아직 없어요.</p>}
        {recent.map(l => (
          <button key={l.task.id + l.id} onClick={()=>onSelect(l.task)} className="wm-ov-row !items-start">
            <span className={`text-xs font-medium shrink-0 w-20 pt-0.5 ${DIM}`}>{fmtDate(l.date)}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs text-blue-600 dark:text-blue-400 truncate">{l.task.title}</span>
              <span className="block text-sm text-slate-700 dark:text-slate-200 truncate">{l.text}</span>
            </span>
          </button>
        ))}
      </div>
      <div className={`${card} wm-ov-cats`}>
        <h3 className={h3}>분류별 진행 중 목표</h3>
        {byCat.length === 0 && <p className={`text-xs ${DIM}`}>진행 중인 목표가 없어요.</p>}
        <div className="wm-ov-catlist">
          {byCat.map(([c, n]) => (
            <div key={c} className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium w-20 text-center ${CAT_COLORS[c]}`}>{c}</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: (n / maxCat * 100) + '%' }}></div>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-300 w-6 text-right">{n}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="wm-ov-hint text-xs text-slate-600 dark:text-slate-400">왼쪽 목록에서 목표를 누르면 여기에 상세가 열려요.</p>
    </div>
  );
}

// 기기가 스스로 끊겨 있다고 아는가(비행기 모드 등). 붙어 있는데 통신이 안 되는 때는 모른다 — 그건 연결 상태(.info/connected)로 본다
function deviceOffline() { try { return navigator.onLine === false; } catch { return false; } }
const OFFLINE_NOTICE = '연결 안 됨 — 연결되면 고칠 수 있어요';

// ═══ 메인 앱 ═══
// user.cached = 로그인 확인 전(기기 사본으로 연 화면). 확인이 끝나도 이 화면을 새로 띄우지 않는다 — 열어 둔 창·쓰던 글이 그대로 남는다 (2026-11-17)
function Main({ user, initial }) {
  const authed = !user.cached;
  const [tasks, setTasks] = useState(()=> initial ? initial.tasks : []);
  const [schedules, setSchedules] = useState(()=> initial ? initial.schedules : []);
  const [loaded, setLoaded] = useState(!!initial);
  // 서버 값을 한 번이라도 받았는가. 그 전엔 고치지 않는다 — 라이브러리는 이 기기에 서버 값이 없으면 「값 없음」으로 먼저 물어 와서,
  // 멀쩡한 목표를 「지워진 목표」로 읽고 저장을 버렸다(사본으로 연 직후·끊긴 채 열었을 때, 2026-11-17 점검 B1)
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);        // 서버에서 목표를 읽지 못했다(권한 등) — 기다려도 고칠 수 없다
  const [tab, setTab] = useState('active');           // active | archive
  const [catFilter, setCatFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [toast, setToast] = useState(null);
  const [dark, setDark] = useState(()=> localStorage.getItem('wm-dark')==='true' ||
    (!localStorage.getItem('wm-dark') && window.matchMedia('(prefers-color-scheme:dark)').matches));
  const [connected, setConnected] = useState(true);   // RTDB 연결 상태 (.info/connected)
  const [pending, setPending] = useState(0);          // 서버 응답을 기다리는 쓰기 수
  const [notice, setNotice] = useState('');           // 맨 아래 안내 한 줄 (아래 useEffect)
  const [day, setDay] = useState(today());            // 오늘 날짜 — 자정을 넘기거나 앱이 다시 보이면 고친다 (D-day·날짜 칸)

  const tablet = useMQ(TABLET_MQ);          // 태블릿 가로: 두 칸 + 상세 두 단
  const fold   = useMQ(FOLD_MQ);            // 폴드7 펼침·태블릿 세로: 두 칸, 상세는 한 줄 (2026-10-09)
  const split  = tablet || fold;            // 목록|상세 두 칸으로 그릴지
  const uid = user.uid;
  const tasksRef = () => firebase.database().ref(`long-tasks/${uid}/tasks`);

  // 늦게 불리는 함수(업로드가 끝난 뒤 등)도 지금 값을 보게 — 상태를 ref 에도 둔다
  const live = useRef({}); live.current = { ready, failed, authed, connected, pending, notice, showForm, showInfo, selected };
  const formDirty = useRef(false);          // 새 목표 창에 쓴 글이 있는가 (TaskForm 이 알린다)
  const bridge = useRef(null);              // 열려 있는 상세 화면 (TaskDetail 이 채운다)

  // ── 구독 (2026-10-13) ──
  // 그전엔 once('value')로 한 번만 읽어서, 태블릿을 오래 켜 둔 채 폰에서 고치면 태블릿은 옛 화면인 줄 모르고
  // 목표를 통째로 덮어썼다. on('value')면 다른 기기의 변경이 곧바로 내려오고, 이 기기의 쓰기도 SDK가
  // 서버 응답 전에 먼저 반영해 준다(오프라인 포함). 저장이 거부되면 SDK가 서버 값으로 되돌려 주므로
  // 화면과 서버가 어긋난 채 남지 않는다. 그래서 saveTask·deleteTask·sendSchedule 은 로컬 상태를 손대지 않는다.
  // 로그인 확인이 끝난 뒤에 건다(그 전엔 기기 사본만 보인다).
  useEffect(()=>{
    if (!authed) return;
    const tRef = tasksRef();
    const sRef = firebase.database().ref(`personal-schedules/${uid}`);
    const cRef = firebase.database().ref('.info/connected');
    const onTasks = tRef.on('value',
      s => { const t = Object.values(s.val() || {}); setTasks(t); setLoaded(true); setReady(true); setFailed(false); saveWmCacheSoon(user, { tasks: t }); },
      e => { showToast('불러오기 실패 — ' + errText(e), 'error'); setLoaded(true); setFailed(true); });
    const onSched = sRef.on('value',
      s => { const l = goalSchedules(s.val()); setSchedules(l); saveWmCacheSoon(user, { schedules: l }); },
      e => showToast('불러오기 실패 — ' + errText(e), 'error'));
    const onConn = cRef.on('value', s => setConnected(s.val() === true));
    return () => { tRef.off('value', onTasks); sRef.off('value', onSched); cRef.off('value', onConn); };
  }, [authed]);

  useEffect(()=>{
    localStorage.setItem('wm-dark', dark);
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(()=>{
    if (!selected) return;
    const fresh = tasks.find(t=>t.id===selected.id);
    if (!fresh) { if (loaded) setSelected(null); }   // 다른 기기에서 지운 목표 — 상세를 닫는다 (열어 두면 고칠 때 되살아난다)
    else if (fresh !== selected) setSelected(fresh);
  }, [tasks]);

  // ── 맨 아래 안내 한 줄 ──
  // 고칠 수 없는 때(로그인 확인 전 · 서버 값 받기 전)는 곧바로 알린다.
  // 연결이 끊긴 채 고친 것은 연결될 때까지 서버에 못 가고, 그 전에 앱을 닫으면 사라진다 (웹 SDK는 디스크에 남기지 않는다) — 그것도 알린다.
  // 폭 360(폴드 접은 화면)에서 한 줄에 들어가는 길이로 (두 줄이 되면 ＋ 버튼을 가린다)
  const noticeShown = useRef(false);
  useEffect(()=>{
    const CHECKING = '최신 확인 중 — 잠시 뒤에 고칠 수 있어요';
    if (!ready) {
      if (failed) { setNotice('불러오지 못했어요 — 앱을 다시 열어 주세요'); return; }
      if (!authed || connected) { setNotice(CHECKING); return; }
      // 로그인은 확인됐는데 연결이 안 됨. 기기가 끊겨 있다고 아는 때(비행기 모드)는 곧바로 알리고,
      // 그 밖엔 붙는 중일 수 있어 3초는 「확인 중」으로 둔다
      if (deviceOffline()) { setNotice(OFFLINE_NOTICE); return; }
      setNotice(n => n || CHECKING);
      const t = setTimeout(()=> setNotice(OFFLINE_NOTICE), 3000);
      return () => clearTimeout(t);
    }
    const text = !connected
      ? (pending ? `연결 안 됨 · 저장 대기 ${pending}건 — 연결될 때까지 앱을 닫지 마세요`
                 : '연결 안 됨 — 다른 기기에서 고친 내용이 안 보일 수 있어요')
      : (pending ? `저장 중… ${pending}건` : '');
    if (!text) { noticeShown.current = false; setNotice(''); return; }
    if (noticeShown.current || (!connected && pending)) { noticeShown.current = true; setNotice(text); return; }
    // 「저장 중」은 0.5초 뒤(금방 끝나는 저장엔 안 뜨게 — 전엔 3초라 그 안에 앱을 닫으면 아무 표시도 못 봤다),
    // 「연결 안 됨」은 3초 뒤(앱 전환 뒤 다시 붙는 동안엔 안 뜨게)
    const t = setTimeout(()=>{ noticeShown.current = true; setNotice(text); }, connected ? 500 : 3000);
    return () => clearTimeout(t);
  }, [connected, pending, ready, authed, failed]);

  // 알림은 한 번에 하나 — 새 알림이 오면 앞 알림의 타이머를 지운다(전엔 앞 타이머가 뒤 알림을 일찍 지웠다)
  const toastT = useRef(0);
  function showToast(msg, type='success') {
    clearTimeout(toastT.current);
    setToast({ msg, type });
    toastT.current = setTimeout(()=>setToast(null), type === 'error' ? 4000 : 3000);
  }
  // 서버 응답을 기다리는 쓰기를 센다 (위 안내용)
  function track(p) {
    setPending(n => n + 1);
    const done = () => setPending(n => n - 1);
    p.then(done, done);
    return p;
  }

  // ── 저장 (RTDB) ──
  // 목표를 통째로 set 하지 않고 transaction 으로 "지금 서버에 있는 값"에 고친 부분만 얹는다 (2026-10-13).
  // 두 기기가 같은 목표를 고치거나, 연결이 끊긴 사이 다른 기기가 먼저 저장했어도 서로 덮어쓰지 않는다 —
  // 서버 값이 그사이 바뀌어 있으면 SDK가 patch 를 그 값으로 다시 돌려 둘을 합친다. 데이터 모양은 그대로다.
  //   saveTask(task)           새 목표 (통째로)
  //   saveTask(id, cur => …)   고치기. cur 는 저장 시점의 최신 목표. 함수는 부작용 없이 새 값만 돌려준다 (여러 번 불릴 수 있다)
  // 돌려주는 값: false = 아직 고칠 수 없어 하지 않음(부른 쪽은 쓴 글·열린 창을 그대로 둔다) · Promise<boolean> = 서버가 받았는지

  // 아직 고칠 수 없는 때인가 — 그렇다면 알리고 true
  function notReady() {
    const s = live.current;
    if (s.ready) return false;
    // 맨 아래 안내 줄과 같은 말을 한다 — 붙는 중(몇 초)에는 「확인하는 중」, 끊긴 것이 분명하면 「연결되면」
    const offline = s.authed && !s.connected && (deviceOffline() || s.notice === OFFLINE_NOTICE);
    showToast(s.failed ? '서버에서 불러오지 못해 고칠 수 없어요. 앱을 다시 열어 주세요'
      : offline ? '아직 연결되지 않았어요. 연결되면 고칠 수 있어요'
      : '최신 내용을 확인하는 중이에요. 잠시 뒤에 다시 눌러 주세요', 'error');
    return true;
  }
  const canWrite = () => !notReady();
  function saveTask(idOrTask, patch) {
    if (notReady()) return false;
    const id = patch ? idOrTask : idOrTask.id;
    const p = tasksRef().child(id).transaction(cur => {
      if (!patch) return idOrTask;
      if (cur == null) return;                     // 이미 지워진 목표 — 되살리지 않고 중단. 서버 값을 받은 뒤라 「값 없음」은 정말 없다는 뜻이다
      return { ...patch(cur), updatedAt: Date.now() };
    });
    return track(p).then(
      r => { if (!r.committed) showToast('이미 지워진 목표라 저장하지 않았어요', 'error'); return !!r.committed; },
      e => {
        if (e && e.message === 'set') return false;    // 저장을 기다리는 사이 이 목표를 지웠을 때 SDK가 transaction 을 이렇게 취소한다
        showToast('저장 실패 — ' + errText(e), 'error');
        return false;
      });
  }
  function deleteTask(id) {
    if (notReady()) return false;
    const t = tasks.find(x => x.id === id);
    const files = ((t && t.images) || []).flatMap(img => [img.path, img.thumbPath]).filter(Boolean);
    // 목표 기록을 먼저 지우고, 서버가 받은 뒤에 사진 파일을 지운다 — 거꾸로 하면 삭제가 거절됐을 때 사진 없는 목표가 남는다 (2026-11-17)
    track(tasksRef().child(id).remove()).then(
      () => { for (const p of files) imgRef(p).delete().catch(()=>{}); },
      e => showToast('삭제 실패 — ' + errText(e), 'error'));
    setSelected(null);
    return true;
  }
  function sendSchedule(task, dateStr, timeStr) {
    if (notReady()) return false;
    let start, end, allDay;
    if (timeStr) {
      start = new Date(`${dateStr}T${timeStr}:00`).getTime();
      end = start + 3600000; allDay = false;
    } else {
      start = new Date(`${dateStr}T00:00:00`).getTime();
      end = new Date(`${dateStr}T23:59:59`).getTime(); allDay = true;
    }
    // 날짜 칸을 비우고 보내면 start 가 NaN 이 되어 set 이 예외를 던지고 아무 반응이 없었다
    if (!dateStr || isNaN(start)) { showToast('날짜를 확인해 주세요', 'error'); return false; }
    const rec = {
      title: task.title, start, end, allDay, repeat: 'none',
      done: false, location: '', memo: `[목표:${task.id}] 목표 관리에서 보냄`,
      createdAt: Date.now(),
    };
    const ref = firebase.database().ref(`personal-schedules/${uid}`).push();
    track(ref.set(rec))
      .then(()=> showToast(`${fmtDate(dateStr)} 일정으로 보냈어요 📅`))
      .catch(e => showToast('일정 전송 실패 — ' + errText(e), 'error'));
    return true;
  }

  // ── 뒤로 가기: 열린 것부터 하나씩 닫는다 (앱 종료 방지) — 크게 본 사진 → 정보 → 새 목표 창 → 상세 ──
  useEffect(()=>{
    history.pushState({ wm: 1 }, '');
    const onPop = () => {
      const s = live.current, b = bridge.current;
      if (b && b.back) b.back();
      else if (s.showInfo) setShowInfo(false);
      else if (s.showForm) { if (!formDirty.current || confirm('쓰던 글이 있어요. 버리고 닫을까요?')) setShowForm(false); }
      else if (s.selected) { if (!b || b.canLeave()) setSelected(null); }
      history.pushState({ wm: 1 }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ── 앱이 다시 보일 때 · 날짜가 바뀔 때 ──
  useEffect(()=>{
    const refreshDay = () => setDay(today());
    // 폰이 앱을 재웠다 깨우면 연결이 죽었는데도 붙어 있는 줄 아는 때가 있다 — 30초 넘게 가려졌다 돌아오면 연결을 새로 건다.
    // 보내는 중인 저장이 있으면 건드리지 않는다(끊으면 그 저장이 실패로 끝난다)
    const kick = () => {
      const s = live.current;
      if (!s.authed || s.pending) return;
      try { const db = firebase.database(); db.goOffline(); db.goOnline(); } catch {}
    };
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      refreshDay();
      if (hiddenAt && Date.now() - hiddenAt > 30000) kick();
      hiddenAt = 0;
    };
    const onShow = e => { refreshDay(); if (e.persisted) kick(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onShow);
    const iv = setInterval(refreshDay, 30000);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pageshow', onShow); clearInterval(iv); };
  }, []);

  // 새 판이 깔려 화면이 스스로 새로 고칠 때(index.html) — 쓰던 글·열린 창·보내는 중인 저장이 있으면 미룬다
  useEffect(()=>{
    window.__appBusy = () => {
      const s = live.current, b = bridge.current;
      return !!(s.showForm || s.showInfo || s.pending || (b && b.isBusy()));
    };
    return () => { delete window.__appBusy; };
  }, []);

  // 다른 목표를 고르기 전에 — 열려 있는 상세에 쓰던 글이 있으면 묻는다 (두 칸 화면)
  function selectTask(t) {
    const s = live.current, b = bridge.current;
    if (s.selected && s.selected.id !== t.id && b && !b.canLeave()) return;
    setSelected(t);
  }

  // ── 목록 계산 ──
  const visible = useMemo(()=>{
    const act = tab === 'active';
    const order = { '진행':0, '대기':1, '보류':2, '완료':0, '중단':1 };
    const prio = { '높음':0, '보통':1, '낮음':2 };
    const ord = (m, k) => (k in m ? m[k] : 9);
    return tasks
      .filter(t => act ? ACTIVE_STATUSES.includes(t.status) : !ACTIVE_STATUSES.includes(t.status))
      .filter(t => !catFilter || t.category === catFilter)
      .sort((a,b) =>
        (ord(order, a.status)-ord(order, b.status)) ||
        (act ? (ord(prio, a.priority)-ord(prio, b.priority)) : (b.completedAt||b.updatedAt||0)-(a.completedAt||a.updatedAt||0)) ||
        (a.dueDate||'9999').localeCompare(b.dueDate||'9999'));
  }, [tasks, tab, catFilter]);

  const activeCnt  = tasks.filter(t=>ACTIVE_STATUSES.includes(t.status)).length;
  const archiveCnt = tasks.length - activeCnt;
  const tabCls = on => `min-h-[36px] px-4 rounded-md text-sm font-medium ${on ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`;
  const chipCls = on => `min-h-[36px] px-3 rounded-full text-xs whitespace-nowrap border ${on ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`;
  const detailProps = { uid, day, schedules, onUpdate: saveTask, onDelete: deleteTask, onClose: ()=>setSelected(null), onSendSchedule: sendSchedule, onToast: showToast, canWrite, bridge };

  return (
    <div className="wm-app min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors" data-day={day}>
      {/* 머리줄 */}
      <header className="wm-header sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="wm-head-top max-w-2xl mx-auto px-4 py-2 flex items-center gap-3">
          <h1 className="wm-head-title font-bold text-slate-800 dark:text-slate-100">📋 목표 관리</h1>
          <div className="wm-head-tools ml-auto flex items-center gap-1">
            <button onClick={()=>setDark(!dark)} aria-label={dark ? '밝은 화면으로' : '어두운 화면으로'} title={dark ? '밝은 화면으로' : '어두운 화면으로'} className="w-10 h-10 flex items-center justify-center">{dark ? '☀️' : '🌙'}</button>
            <button onClick={()=>setShowInfo(true)} className="wm-info-btn h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300">정보</button>
          </div>
        </div>
        {/* 탭 + 분류 필터 */}
        <div className="wm-head-filters max-w-2xl mx-auto px-4 pb-2 space-y-2">
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1 w-fit">
            <button onClick={()=>setTab('active')} className={tabCls(tab==='active')}>진행 중 {activeCnt}</button>
            <button onClick={()=>setTab('archive')} className={tabCls(tab==='archive')}>완료·이력 {archiveCnt}</button>
          </div>
          <div className="wm-chips flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={()=>setCatFilter('')} className={chipCls(!catFilter)}>전체</button>
            {CATEGORIES.map(c => (
              <button key={c} onClick={()=>setCatFilter(catFilter===c?'':c)} className={chipCls(catFilter===c)}>{c}</button>
            ))}
          </div>
        </div>
      </header>

      {/* 목록 */}
      {(() => {
        const list = (
          <main className="wm-list max-w-2xl mx-auto px-4 py-4 space-y-2.5 pb-24">
            {!loaded && <p className="text-center text-sm text-slate-600 dark:text-slate-400 py-10">불러오는 중…</p>}
            {loaded && visible.length === 0 && (
              <div className="text-center py-16 space-y-2">
                <div className="text-4xl" aria-hidden="true">{tab==='active' ? '🌱' : '📦'}</div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {tab==='active' ? '진행 중인 목표가 없어요. 새 목표를 추가해 보세요.' : '끝낸 목표가 여기에 쌓여요.'}
                </p>
              </div>
            )}
            {visible.map(t => <TaskCard key={t.id} task={t} onSelect={selectTask} active={split && selected && selected.id === t.id} />)}
          </main>
        );
        if (!split) return list;
        // 태블릿 가로·폴드 펼침: 왼쪽 목록 | 오른쪽 상세 (고르기 전엔 한눈에 보기)
        return (
          <div className="wm-split">
            {list}
            <section className="wm-pane">
              {selected
                ? <TaskDetail key={selected.id} inline twoCol={tablet} task={selected} {...detailProps} />
                : <Overview tasks={tasks} onSelect={selectTask} />}
            </section>
          </div>
        );
      })()}

      {/* 새 목표 단추 */}
      <button onClick={()=>setShowForm(true)} aria-label="새 목표"
        className="wm-fab fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-2xl shadow-lg flex items-center justify-center">＋</button>

      {showForm && <TaskForm onSave={saveTask} onClose={()=>setShowForm(false)} dirtyRef={formDirty} />}
      {selected && !split && <TaskDetail task={selected} {...detailProps} />}
      {showInfo && <InfoSheet user={user} tasks={tasks} onClose={()=>setShowInfo(false)} />}
      {/* 맨 아래 안내 한 줄. 상세 창(z-30)·새 목표 창(z-40) 위, ＋ 버튼(bottom 20~24px) 아래 */}
      {notice && (
        <div className="wm-notice fixed bottom-0 inset-x-0 z-40 px-3 py-0.5 text-center text-[11px] leading-4 bg-amber-100 text-amber-900 dark:bg-amber-900/90 dark:text-amber-100"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2px)' }}>{notice}</div>
      )}
      <Toast toast={toast} />
    </div>
  );
}

// ═══ 루트: 인증 게이트 ═══
// ═══ 기기 사본으로 먼저 열기 (2026-10-15 — 도겸 수면·재무현황·담보비율과 같은 방식) ═══
// 전엔 로그인 확인 → 구독 응답을 다 기다린 뒤에야 목록이 떴다. 이제 지난번에 받은 목표·일정(wm_cache_v1)으로 바로 그리고,
// 로그인 확인이 끝나면 같은 화면에서 구독을 건다. 서버 값을 받을 때까지는 고치지 않는다(Main.notReady). 계정 하나분 — 로그아웃·다른 계정이면 지운다.
// ?nocache=1 은 사본 없이 열기(비교용)
const WM_CACHE = 'wm_cache_v1';
function readWmCache() {
  if (/[?&]nocache=1/.test(location.search)) return null;
  try {
    if (localStorage.getItem('wm_signed_in') !== '1') return null;
    const c = JSON.parse(localStorage.getItem(WM_CACHE) || 'null');
    if (!(c && c.uid && Array.isArray(c.tasks) && Array.isArray(c.schedules))) return null;
    // 2026-11-17 전의 판은 개인 일정을 통째로 담아 두었다 — 이 앱이 쓰는 [목표:id] 일정만 남기고 그 자리에서 고쳐 쓴다
    const mine = c.schedules.filter(isGoalSchedule);
    if (mine.length !== c.schedules.length) { c.schedules = mine; try { localStorage.setItem(WM_CACHE, JSON.stringify(c)); } catch {} }
    return c;
  } catch { return null; }
}
const wmCacheData = { tasks: null, schedules: null };
let wmCacheT = 0;
function saveWmCacheSoon(user, part) {
  Object.assign(wmCacheData, part);
  if (!wmCacheData.tasks || !wmCacheData.schedules) return;   // 둘 다 한 번 받은 뒤에만
  clearTimeout(wmCacheT);
  wmCacheT = setTimeout(() => {
    try { localStorage.setItem(WM_CACHE, JSON.stringify({ uid: user.uid, email: user.email || '', at: Date.now(), tasks: wmCacheData.tasks, schedules: wmCacheData.schedules })); } catch {}
  }, 800);
}
function dropWmCache() {
  clearTimeout(wmCacheT);
  wmCacheData.tasks = null; wmCacheData.schedules = null;
  try { localStorage.removeItem(WM_CACHE); localStorage.removeItem('wm_signed_in'); } catch {}
}

function App() {
  const cached = useMemo(()=> readWmCache(), []);
  const [user, setUser] = useState(()=> cached ? { uid: cached.uid, email: cached.email, cached: true } : undefined);
  useEffect(()=> firebase.auth().onAuthStateChanged(u => {
    if (!u) dropWmCache();
    else {
      if (cached && cached.uid !== u.uid) dropWmCache();
      try { localStorage.setItem('wm_signed_in', '1'); } catch {}
    }
    setUser(u);
  }), []);
  useEffect(()=>{
    const dark = localStorage.getItem('wm-dark')==='true' ||
      (!localStorage.getItem('wm-dark') && window.matchMedia('(prefers-color-scheme:dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }, []);
  if (user === undefined) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
      <p className="text-sm text-slate-600 dark:text-slate-400">확인 중…</p>
    </div>
  );
  if (!user) return <Login />;
  // key 는 계정마다 — 로그인 확인이 끝나도(같은 계정) 화면을 새로 띄우지 않는다. 다른 계정이면 새로 띄운다
  return <Main key={user.uid} user={user} initial={cached && cached.uid === user.uid ? cached : null} />;
}

// 옛 주소(github.io)에서 새 주소로 넘어가는 중이면 앱을 띄우지 않는다 (index.html 맨 앞 스크립트)
if (!window.__goalsMoved) ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
