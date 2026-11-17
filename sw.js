// work-manager — 저장된 사본으로 먼저 열고, 뒤에서 새 파일을 받아 캐시를 바꿔 둔다 (2026-09-29, 투자 트래커와 같은 방식).
// ⚠ index.html·app.js·app.css·vendor 를 고치면 CACHE 를 올린다. 새 판이 자리를 잡으면 화면이 스스로 새로 고친다(index.html 맨 아래, 2026-11-17).
// ⚠ index.html 이 부르는 파일을 바꾸면 OWN 목록도 같이 고친다 — test/sw.spec.js 가 글자까지 같은지 본다.
// 2026-11-17: 라이브러리(React·Firebase)와 꾸밈 규칙(app.css)을 앱과 함께 배포한다 — 바깥 배포망에서 받는 것이 없다.
//   전엔 바깥 응답을 내용을 볼 수 없는 채(opaque)로 저장했다: 오류 응답도 「성공」으로 저장되고, 브라우저가 저장 공간을 40MB 넘게 셌다.
const CACHE = 'wm-cache-v19';   // v19: 2026-11-17 점검 수정 — 쓴 글 지키기·옛 주소 넘기기·라이브러리와 꾸밈 규칙을 앱과 함께 배포·화면 손질

// 이 앱의 파일 — index.html 이 부르는 것 + manifest 의 아이콘
const OWN = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/app-any-192.png",
  "./icons/app-any-512.png",
  "./icons/app-maskable-192.png",
  "./icons/app-maskable-512.png",
  "./vendor/react.production.min.js",
  "./vendor/react-dom.production.min.js",
  "./vendor/firebase-app-compat.js",
  "./vendor/firebase-auth-compat.js",
  "./vendor/firebase-database-compat.js",
  "./vendor/firebase-storage-compat.js",
  "./app.css?v=20261117",
  "./app.js?v=20261117"
];

// 옛 주소(github.io)에서는 물러난다 — 거기선 index.html 맨 앞 스크립트가 새 주소로 넘긴다 (2026-11-17)
const RETIRED = /(^|\.)github\.io$/.test(self.location.hostname);

self.addEventListener('install', e => {
  if (!RETIRED) {
    // 브라우저 HTTP 캐시를 거치지 않고 새로 받는다. 하나라도 못 받으면 설치하지 않는다(옛 판이 그대로 남는다)
    e.waitUntil(caches.open(CACHE).then(cache => Promise.all(OWN.map(u => cache.add(new Request(u, { cache: 'reload' }))))));
  }
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  if (RETIRED) {
    e.waitUntil((async () => {
      // 이 앱의 캐시만 지운다 (웹앱들이 github.io 한 주소를 나눠 써서 캐시 저장소가 하나다)
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith('wm-cache-')).map(k => caches.delete(k)));
      await self.clients.claim();
      const wins = await self.clients.matchAll({ type: 'window' });
      await self.registration.unregister();
      // 열려 있는 창을 한 번 다시 부른다 — 옛 판 화면에는 스스로 새로 고치는 코드가 없어, 이게 없으면 다음에 열 때에야 넘어간다.
      // 창마다 한 번뿐이다(주소에 moved= 가 붙어 있으면 그만둔다) — 다시 받은 index.html 이 아직 옛 판이어도(배포가 퍼지는 사이) 끝없이 새로 고치지 않는다
      wins.forEach(c => {
        try {
          const u = new URL(c.url);
          if (u.searchParams.has('moved')) return;
          u.searchParams.set('moved', '1');
          c.navigate(u.href).catch(() => {});
        } catch (err) {}
      });
    })());
    return;
  }
  e.waitUntil(
    caches.keys()
      // 이 앱의 옛 캐시만 지운다 — 접두사를 안 가리면 같은 주소를 나눠 쓰는 다른 앱의 캐시까지 지운다
      .then(keys => Promise.all(keys.filter(k => k.startsWith('wm-cache-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (RETIRED) return;   // 옛 주소: 아무것도 저장하지 않고 그대로 통신에 맡긴다
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  // 이 앱의 파일만 다룬다. 로그인(identitytoolkit)·DB(firebaseio)·Storage 응답은 손대지 않는다 —
  // 저장되면 지난 응답이 되살아나 로그인이 이상하게 풀리거나 옛 데이터가 보인다
  if (url.origin !== self.location.origin || !req.url.startsWith(self.registration.scope)) return;

  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req);
    const fresh = fetch(req.url, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    if (cached) { e.waitUntil(fresh.catch(() => {})); return cached; }
    return fresh.catch(() => req.destination === 'document' ? cache.match('./index.html') : Response.error());
  }));
});
