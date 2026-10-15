# 목표 관리

**https://minsung-goals.web.app** (2026-10-15부터 Firebase Hosting 전용 주소, minsung-buboo2. 옛 github.io 주소엔 이동 띠만)

- 화면 코드 원본은 **`src/app.jsx`** — 고친 뒤 `npm run build`로 `app.js`를 다시 만들고 `index.html`의 `app.js?v=`·`sw.js`의 `CACHE`·`OWN`을 같이 올린다 (브라우저 바벨 제거)
- 배포: `git push`(소스 보관) + PowerShell에서 `firebase deploy --only hosting --project minsung-buboo2`
- 기기 사본 `wm_cache_v1`로 먼저 그리고 로그인 확인 뒤 구독. 그 사이엔 쓰지 않는다. 구글 로그인 버튼(계정에 google.com 연결됨)

