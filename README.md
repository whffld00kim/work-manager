# 목표 관리

**https://minsung-goals.web.app** (2026-10-15부터 Firebase Hosting 전용 주소, 프로젝트 minsung-buboo2. 옛 github.io 주소는 2026-11-17 판부터 새 주소로 바로 넘긴다)

- 화면 코드 원본은 **`src/app.jsx`**, 꾸밈 규칙 원본은 `src/tw.css`(테일윈드 3.4.17 고정) — 고친 뒤 `npm run build` 로 `app.js`·`app.css` 를 다시 만든다
- 판을 올릴 때 같이 고칠 곳: `src/app.jsx` 의 `APP_VER` · `index.html` 의 `app.js?v=`·`app.css?v=` · `sw.js` 의 `CACHE`·`OWN` (`test/sw.spec.js` 가 서로 같은지 본다). 판 번호는 앱의 「정보」 창에 보인다
- 라이브러리(React 18.3.1 · Firebase 10.7.1 compat)는 `vendor/` 에 공식 배포본 그대로 두고 앱과 함께 배포한다 — 바깥 배포망에서 받는 것이 없다
- 시험: `npm test` (Playwright, 가짜 Firebase — 실제 서버에 닿지 않는다)
- 배포: PowerShell 에서 `firebase deploy --only hosting --project minsung-buboo2` (새 주소). `git push` 는 소스 보관과 옛 주소(새 주소로 넘기는 판) 갱신용
- 기기 사본 `wm_cache_v1` 로 먼저 그리고 로그인 확인 뒤 구독한다. **서버 값을 받기 전에는 고치지 않는다** — 그때 누른 것은 쓴 글을 그대로 둔 채 안내만 한다
- 데이터: RTDB `long-tasks/{uid}/tasks` · 「일정으로 보내기」는 `personal-schedules/{uid}`(민성 스케줄과 같은 경로, 메모에 `[목표:id]`) · 사진은 Storage 전용 버킷. 보안 규칙 파일(database·storage)은 같은 Firebase 프로젝트를 쓰는 다른 저장소에 있다
