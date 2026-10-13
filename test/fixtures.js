// 공통 시험 도구.
//  - 저장소 루트를 정적 서버로 띄운다 (SW 는 http 에서만 돌므로)
//  - CDN 스크립트를 바꿔치기한다: Firebase 네 개 → fake-firebase.js, React·Babel → 같은 버전 npm 사본,
//    Tailwind → 미리 컴파일한 CSS (global-setup.js). 그래서 네트워크 없이 돌고, 실제 Firebase 에는 닿지 않는다
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

const CDN_FILES = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'node_modules/react/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'node_modules/react-dom/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.24.7/babel.min.js': 'node_modules/@babel/standalone/babel.min.js',
};

function tailwindStub() {
  const css = fs.readFileSync(path.join(__dirname, '.cache', 'tailwind.css'), 'utf8');
  return `window.tailwind = window.tailwind || { config: {} };
(function(){ var s = document.createElement('style'); s.setAttribute('data-fake-tailwind',''); s.textContent = ${JSON.stringify(css)}; document.head.appendChild(s); })();`;
}

// 주의: SW 스크립트(sw.js) 자체의 요청은 route 로 막히지 않는다. 앱 시험에서 SW 를 끄는 것은 설정의 serviceWorkers: 'block'
async function installRoutes(context) {
  const fake = fs.readFileSync(path.join(__dirname, 'fake-firebase.js'), 'utf8');
  await context.route('https://www.gstatic.com/firebasejs/**', route => {
    const body = route.request().url().endsWith('firebase-app-compat.js') ? fake : '/* fake: covered by firebase-app-compat.js */';
    route.fulfill({ status: 200, contentType: 'text/javascript', body });
  });
  await context.route('https://unpkg.com/**', route => {
    const f = CDN_FILES[route.request().url()];
    if (!f) return route.fulfill({ status: 404, body: 'not in test vendor list' });
    route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, f)) });
  });
  await context.route('https://cdn.tailwindcss.com/**', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: tailwindStub() }));
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

const test = base.test.extend({
  server: [async ({}, use) => {
    const s = await startServer();
    await use(s);
    s.srv.close();
  }, { scope: 'worker' }],

  // app.open(seed) → 화면이 목록까지 그려진 page. app.detail() 로 연습 목표 상세를 연다
  app: async ({ context, page, server }, use) => {
    await installRoutes(context);
    page.on('dialog', d => d.accept());   // confirm() 은 모두 '확인'
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const app = {
      errors,
      async open(seed = seedWith()) {
        await page.addInitScript(s => { window.__fakeSeed = s; }, seed);
        await page.goto(server.url + 'index.html');
        await base.expect(page.locator('.wm-list')).toBeVisible();
        await base.expect(page.locator('.wm-list').getByText('불러오는 중…')).toHaveCount(0);
        return page;
      },
      async openDetail(title = '연습 목표') {
        await page.locator('.wm-card').filter({ hasText: title }).first().click();
        await base.expect(page.locator('.wm-d-log')).toBeVisible();
      },
      async addLog(text) {
        await page.locator('.wm-d-log textarea').fill(text);
        await page.locator('.wm-d-log').getByRole('button', { name: '기록' }).click();
      },
      // 서버 쪽 값 / 가짜 손잡이
      server: (p) => page.evaluate(p => window.__fake.db.serverGet(p), p),
      serverSet: (p, v) => page.evaluate(([p, v]) => window.__fake.db.serverSet(p, v), [p, v]),
      setOnline: (on) => page.evaluate(on => window.__fake.db.setOnline(on), on),
      deny: (v) => page.evaluate(v => window.__fake.db.deny(v), v),
      pending: () => page.evaluate(() => window.__fake.db.pending()),
      storageFiles: () => page.evaluate(() => window.__fake.storage.files()),
      storageLog: () => page.evaluate(() => window.__fake.storage.log()),
      toast: () => page.locator('div.fixed.bottom-6.z-50'),
      notice: () => page.locator('.wm-notice'),
    };
    await use(app);
  },
});

// 1×1 PNG — 썸네일 생성(Image 디코드)까지 실제로 돌게 하려고 진짜 PNG 를 쓴다
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

module.exports = { test, expect: base.expect, UID, TASKS, SCHED, sampleTask, seedWith, installRoutes, startServer, ROOT, PNG_1x1 };
