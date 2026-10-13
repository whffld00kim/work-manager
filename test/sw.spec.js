// 5. 서비스워커 — 목록이 index.html 과 맞는지, 설치·옛 캐시 정리·오프라인 열기
const { test, expect, installRoutes, startServer, ROOT } = require('./fixtures');
const base = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function swLists() {
  const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const pick = name => {
    const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
    return [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);
  };
  return { CACHE: src.match(/const CACHE = '([^']+)'/)[1], OWN: pick('OWN'), CDN: pick('CDN'), CDN_HOSTS: pick('CDN_HOSTS') };
}

test('sw.js 의 OWN·CDN 목록은 index.html·manifest 가 부르는 파일과 글자까지 같다', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const { CACHE, OWN, CDN, CDN_HOSTS } = swLists();
  expect(CACHE).toMatch(/^wm-cache-v\d+$/);
  const scripts = [...html.matchAll(/<script src="(https:[^"]+)"/g)].map(m => m[1]);
  expect([...CDN].sort()).toEqual([...scripts].sort());
  for (const u of CDN) expect(CDN_HOSTS).toContain(new URL(u).hostname);
  const ownFiles = new Set(['./', './index.html']);
  for (const m of html.matchAll(/<link rel="(?:manifest|apple-touch-icon)" href="([^"]+)"/g)) ownFiles.add('./' + m[1]);
  for (const ic of manifest.icons) ownFiles.add('./' + ic.src);
  expect([...OWN].sort()).toEqual([...ownFiles].sort());
  for (const f of OWN) if (f !== './') expect(fs.existsSync(path.join(ROOT, f))).toBe(true);
  expect(manifest.start_url).toBe('./index.html');
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
    const cachedOwn = await page.evaluate(async ([own, name]) => {
      const c = await caches.open(name);
      const out = {};
      for (const u of own) out[u] = !!(await c.match(new URL(u, location.href).href));
      return out;
    }, [OWN, CACHE]);
    for (const u of OWN) expect(cachedOwn[u], u).toBe(true);

    // 오프라인: 캐시된 index.html 로 열린다
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.state), { timeout: 15000 }).toBe('activated');
    await context.setOffline(true);
    await page.reload();
    await expect(page).toHaveTitle('목표 관리자');
    await context.setOffline(false);
  } finally {
    await context.close();
    srv.close();
  }
});
