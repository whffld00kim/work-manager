// 공통 시험 도구.
//  - 저장소 루트를 정적 서버로 띄운다 (SW 는 http 에서만 돌므로)
//  - Firebase 네 스크립트(vendor/firebase-*.js)만 fake-firebase.js 로 바꿔치기한다. React·꾸밈 규칙(app.css)은 앱과 함께 배포하는 진짜 파일 그대로다
//    (2026-11-17 전엔 바깥 배포망 주소를 가로채 바꿔 끼웠다). 그래서 네트워크 없이 돌고, 실제 Firebase 에는 닿지 않는다
//  - 연습용 데이터(seed)만 쓴다. 실제 uid·이메일·목표 내용은 넣지 않는다
const base = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UID = 'test-uid';
const TASKS = `long-tasks/${UID}/tasks`;
const SCHED = `personal-schedules/${UID}`;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css', '.png': 'image/png' };

function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

// 주의: SW 스크립트(sw.js) 자체의 요청과 SW 가 받아 가는 요청은 route 로 막히지 않는다. 앱 시험에서 SW 를 끄는 것은 설정의 serviceWorkers: 'block'
async function installRoutes(context) {
  const fake = fs.readFileSync(path.join(__dirname, 'fake-firebase.js'), 'utf8');
  // 바깥으로 나가는 요청은 없어야 한다 — 있으면 끊는다 (시험이 실제 서버에 닿지 않게). 뒤에 건 route 가 먼저 불리므로 이 줄을 먼저 건다
  await context.route(u => !['127.0.0.1', 'localhost'].includes(u.hostname) && /^https?:$/.test(u.protocol), route => route.abort());
  await context.route('**/vendor/firebase-*.js', route => {
    const body = route.request().url().includes('firebase-app-compat.js') ? fake : '/* fake: covered by firebase-app-compat.js */';
    route.fulfill({ status: 200, contentType: 'text/javascript', body });
  });
}

// 연습용 목표 하나. 날짜는 고정 (오늘 날짜에 기대지 않게)
function sampleTask(over = {}) {
  return {
    id: 't1', title: '연습 목표', category: '기타', status: '진행', priority: '보통', dueDate: '2030-01-15',
    checklist: [{ id: 'c1', text: '첫 단계', done: false, doneDate: null }, { id: 'c2', text: '둘째 단계', done: false, doneDate: null }],
    log: [{ id: 'l0', date: '2026-10-01', text: '첫 기록' }],
    images: [],
    createdAt: 1759276800000, updatedAt: 1759276800000, completedAt: null,
    ...over,
  };
}
function seedWith(tasks = [sampleTask()], schedules = {}) {
  const t = {};
  for (const x of tasks) t[x.id] = x;
  return { uid: UID, db: { 'long-tasks': { [UID]: { tasks: t } }, 'personal-schedules': { [UID]: schedules } } };
}
// 기기 사본(wm_cache_v1) — 앱이 저장하는 모양 그대로. 한 번 연 기기를 흉내 낼 때 쓴다
function cacheOf(seed) {
  const t = seed.db['long-tasks'][seed.uid].tasks, s = seed.db['personal-schedules'][seed.uid] || {};
  return { uid: seed.uid, email: 'tester@example.com', at: 1, tasks: Object.values(t), schedules: Object.entries(s).map(([id, v]) => ({ ...v, id })) };
}

const test = base.test.extend({
  server: [async ({}, use) => {
    const s = await startServer();
    await use(s);
    s.srv.close();
  }, { scope: 'worker' }],

  // app.open(seed) → 화면이 목록까지 그려진 page. app.openDetail() 로 연습 목표 상세를 연다
  app: async ({ context, page, server }, use) => {
    await installRoutes(context);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const app = {
      errors,
      dialogs: [],            // 뜬 확인 창의 글
      acceptDialogs: true,    // false 로 바꾸면 confirm() 에 「취소」로 답한다
      async open(seed = seedWith()) {
        await page.addInitScript(s => { window.__fakeSeed = s; }, seed);
        await page.goto(server.url + 'index.html');
        await base.expect(page.locator('.wm-list')).toBeVisible();
        await base.expect(page.locator('.wm-list').getByText('불러오는 중…')).toHaveCount(0);
        return page;
      },
      // 한 번 연 기기처럼(기기 사본이 있는 채로) 연다. 서버 값·로그인 확인이 늦는 상황은 seed 의 authDelay·holdFirstValue·startOffline 으로
      async openCached(seed = seedWith(), cache = cacheOf(seed)) {
        await page.addInitScript(([s, c]) => {
          window.__fakeSeed = s;
          if (!sessionStorage.getItem('__seeded')) { localStorage.setItem('wm_signed_in', '1'); localStorage.setItem('wm_cache_v1', JSON.stringify(c)); sessionStorage.setItem('__seeded', '1'); }
        }, [seed, cache]);
        await page.goto(server.url + 'index.html');
        await base.expect(page.locator('.wm-card').first()).toBeVisible();
        return page;
      },
      async openDetail(title = '연습 목표') {
        await page.locator('.wm-card').filter({ hasText: title }).first().click();
        await base.expect(page.locator('.wm-d-log')).toBeVisible();
      },
      async addLog(text) {
        await page.locator('.wm-d-log textarea').fill(text);
        await page.locator('.wm-d-log').getByRole('button', { name: '기록', exact: true }).click();
      },
      // 서버 쪽 값 / 가짜 손잡이
      server: (p) => page.evaluate(p => window.__fake.db.serverGet(p), p),
      serverSet: (p, v) => page.evaluate(([p, v]) => window.__fake.db.serverSet(p, v), [p, v]),
      setOnline: (on) => page.evaluate(on => window.__fake.db.setOnline(on), on),
      deny: (v) => page.evaluate(v => window.__fake.db.deny(v), v),
      pending: () => page.evaluate(() => window.__fake.db.pending()),
      releaseFirstValue: () => page.evaluate(() => window.__fake.db.releaseFirstValue()),
      storageFiles: () => page.evaluate(() => window.__fake.storage.files()),
      storageLog: () => page.evaluate(() => window.__fake.storage.log()),
      toast: () => page.locator('.wm-toast'),
      notice: () => page.locator('.wm-notice'),
    };
    page.on('dialog', d => { app.dialogs.push(d.message()); return (app.acceptDialogs ? d.accept() : d.dismiss()).catch(() => {}); });
    await use(app);
  },
});

// 1×1 PNG — 썸네일 생성(Image 디코드)까지 실제로 돌게 하려고 진짜 PNG 를 쓴다
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

module.exports = { test, expect: base.expect, UID, TASKS, SCHED, sampleTask, seedWith, cacheOf, installRoutes, startServer, ROOT, PNG_1x1 };
