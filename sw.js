/* ── 업무현황 관리 Service Worker ── */
const CACHE = 'wm-cache-v9'; /* v9: HTML fetch에 cache:'no-cache' — 배포 후 10분간 옛 화면이 뜨던 문제 (2026-09-03). v8: 일정 메모 태그 [과제:id] → [목표:id] (2026-09-03, 기존 일정 1건도 DB에서 바꿈). v7: 이름을 「목표 관리자」/앱 이름 「목표 관리」로. v6: React CDN 18.3.1 고정. v5: 과제 관리자로 전면 개편 — RTDB(long-tasks) + 민성 스케줄 연동 */
const SHELL = ['./index.html', './manifest.json', './icon.svg', './icon-maskable.svg'];

// Install: cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML (auto-update), cache-first for assets
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip cross-origin requests (Firebase, CDNs)
  if (url.origin !== self.location.origin) return;

  const isHTML = req.destination === 'document' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // Network-first: always try fresh HTML so GitHub Pages updates apply immediately
    // ⚠ cache:'no-cache' 가 필요하다 (2026-09-03). 없으면 브라우저 HTTP 캐시(GitHub Pages
    //   max-age=600)가 배포 후 10분 동안 옛 index.html을 돌려줘서 "네트워크 우선"이 무의미해진다.
    //   실제로 개명 배포 직후 앱을 켰더니 옛 제목이 그대로 떴다.
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => caches.match(req))
    );
  } else {
    // Cache-first for other local assets
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return resp;
        }).catch(() => cached);
      })
    );
  }
});
