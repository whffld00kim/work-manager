// 5. 서비스워커·배포 파일 — 목록이 index.html 과 맞는지, 판 번호가 서로 같은지, 바깥에서 받는 것이 없는지, 설치·옛 캐시 정리·오프라인 열기
const { test, expect, installRoutes, startServer, ROOT } = require('./fixtures');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function swLists() {
  const src = read('sw.js');
  const m = src.match(/const OWN = \[([\s\S]*?)\];/);
  return { src, CACHE: src.match(/const CACHE = '([^']+)'/)[1], OWN: [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) };
}
// 주석을 뺀 코드 (// 로 시작하는 줄과 줄 끝 주석)
const codeOf = src => src.split('\n').map(l => l.replace(/\s\/\/ .*$/, '')).filter(l => !l.trim().startsWith('//')).join('\n');

test('sw.js 의 OWN 목록은 index.html·manifest 가 부르는 파일과 글자까지 같다', async () => {
  const html = read('index.html');
  const manifest = JSON.parse(read('manifest.json'));
  const { CACHE, OWN } = swLists();
  expect(CACHE).toMatch(/^wm-cache-v\d+$/);
  const ownFiles = new Set(['./', './index.html']);
  for (const m of html.matchAll(/<link rel="(?:manifest|apple-touch-icon)" href="([^"]+)"/g)) ownFiles.add('./' + m[1]);
  for (const ic of manifest.icons) ownFiles.add('./' + ic.src);
  for (const m of html.matchAll(/<script src="\.\/([^"]+)"/g)) ownFiles.add('./' + m[1]);          // vendor 라이브러리 · app.js
  for (const m of html.matchAll(/<link rel="stylesheet" href="\.\/([^"]+)"/g)) ownFiles.add('./' + m[1]);   // app.css
  expect([...OWN].sort()).toEqual([...ownFiles].sort());
  for (const f of OWN) if (f !== './') expect(fs.existsSync(path.join(ROOT, f.split('?')[0])), f).toBe(true);   // ?v= 는 물음표 앞이 파일
  expect(manifest.start_url).toBe('./index.html');
});

test('바깥에서 받는 스크립트·꾸밈 파일이 없고, 서비스워커는 이 앱의 파일만 저장한다', async () => {
  const html = read('index.html');
  expect([...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="(https?:[^"]+)"/g)].map(m => m[1])).toEqual([]);
  const code = codeOf(swLists().src);
  expect(code).not.toMatch(/opaque|no-cors|CDN/);          // 내용을 볼 수 없는 응답을 저장하지 않는다
  expect(code).toMatch(/url\.origin !== self\.location\.origin/);
});

test('판 번호가 한 곳도 어긋나지 않는다 — APP_VER · app.js?v= · app.css?v= · sw.js OWN', async () => {
  const ver = read('src/app.jsx').match(/const APP_VER = '([^']+)'/)[1];
  const html = read('index.html');
  expect(html.match(/<script src="\.\/app\.js\?v=([^"]+)"/)[1]).toBe(ver);
  expect(html.match(/href="\.\/app\.css\?v=([^"]+)"/)[1]).toBe(ver);
  const { OWN } = swLists();
  expect(OWN).toContain(`./app.js?v=${ver}`);
  expect(OWN).toContain(`./app.css?v=${ver}`);
  expect(read('app.js')).toContain(`const APP_VER = '${ver}'`);   // 빌드한 파일도 같은 판
});

test('vendor 의 라이브러리는 공식 배포본 그대로다', async () => {
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
  // React: 설치된 npm 꾸러미(18.3.1)의 파일과 같다
  expect(require(path.join(ROOT, 'node_modules/react/package.json')).version).toBe('18.3.1');
  expect(sha('vendor/react.production.min.js')).toBe(sha('node_modules/react/umd/react.production.min.js'));
  expect(sha('vendor/react-dom.production.min.js')).toBe(sha('node_modules/react-dom/umd/react-dom.production.min.js'));
  // Firebase 10.7.1 compat: npm 꾸러미·unpkg·jsdelivr·gstatic 네 곳이 같음을 확인하고 적어 둔 값 (2026-11-17)
  expect(sha('vendor/firebase-app-compat.js')).toBe('af2a25c7827b5ac0eecc4e293b2644958037a4cc085ed5f5038aada31f3a4cf0');
  expect(sha('vendor/firebase-auth-compat.js')).toBe('4e599f83d2eb9a581815a274178bf002aa517c305b85bf2489aeb5f42d26bcfb');
  expect(sha('vendor/firebase-database-compat.js')).toBe('450f18b1fe54ac2beba49d0ee8dfea7f1d158f28753e20b0fa9bc443b09e120f');
  expect(sha('vendor/firebase-storage-compat.js')).toBe('eb4dd1d0f588c295f7fe4e8f09e695616f57984c43396b032973f48020457a9b');
});

test('app.js·app.css 는 원본으로 다시 만든 것과 같다 (빌드를 빠뜨리지 않았다)', async () => {
  const Babel = require('@babel/standalone');
  const out = Babel.transform(read('src/app.jsx'), { presets: ['react'], comments: false, compact: false }).code;
  expect(read('app.js').replace(/\r\n/g, '\n')).toContain(out.replace(/\r\n/g, '\n'));
  expect(read('app.css')).toMatch(/tailwindcss v3\.4\.17/);      // 판 고정
  for (const cls of ['line-clamp-2', 'wm-toast']) expect(read('src/app.jsx')).toContain(cls);
  expect(read('app.css')).toContain('line-clamp-2');
});

test('새 SW 가 설치되면 앱 파일이 캐시되고, 이 앱의 옛 캐시만 지우며, 오프라인에서도 열린다', async ({ browser }) => {
  const { srv, url } = await startServer();
  const context = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 360, height: 800 } });
  try {
    await installRoutes(context);
    const page = await context.newPage();
    // 문서가 열리자마자(SW 등록 전) 옛 캐시 둘을 만들어 둔다: 이 앱의 옛 버전 + 같은 주소를 쓰는 다른 앱의 캐시
    await page.addInitScript(() => {
      window.__fakeSeed = { uid: 'test-uid', db: {} };
      window.__oldCaches = Promise.all([caches.open('wm-cache-v1'), caches.open('other-app-cache-v3')]);
    });
    const swPromise = context.waitForEvent('serviceworker');
    await page.goto(url + 'index.html');
    await swPromise;
    const { CACHE, OWN } = swLists();
    await expect.poll(() => page.evaluate(() => caches.keys()), { timeout: 15000 }).toContain(CACHE);
    await expect.poll(() => page.evaluate(() => caches.keys()), { timeout: 15000 }).not.toContain('wm-cache-v1');
    expect(await page.evaluate(() => caches.keys())).toContain('other-app-cache-v3');
    const cached = await page.evaluate(async ([own, name]) => {
      const c = await caches.open(name);
      const out = {};
      for (const u of own) { const r = await c.match(new URL(u, location.href).href); out[u] = r ? r.type : null; }
      return out;
    }, [OWN, CACHE]);
    for (const u of OWN) expect(cached[u], u).toBe('basic');     // 모두 이 주소의 응답 — 내용을 볼 수 없는(opaque) 것이 없다

    // 오프라인: 캐시된 파일만으로 열린다
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.state), { timeout: 15000 }).toBe('activated');
    await context.setOffline(true);
    await page.reload();
    await expect(page).toHaveTitle('목표 관리');
    await context.setOffline(false);
  } finally {
    await context.close();
    srv.close();
  }
});
