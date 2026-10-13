# 시험 (Playwright)

앱 동작을 브라우저에서 실제로 돌려 본다. 배포(GitHub Pages)와는 무관하고, 실제 Firebase 에는 닿지 않는다.

```
npm install
npm run test:setup   # 처음 한 번: Chromium 내려받기
npm test
```

- `fake-firebase.js` — www.gstatic.com 의 Firebase 스크립트(app·auth·database·storage)를 통째로 바꿔치기하는 가짜 SDK.
  실제처럼 오프라인이면 쓰기가 멈추고(연결되면 순서대로 보냄), transaction 은 서버 값이 바뀌었으면 다시 돌고,
  다른 기기의 쓰기(`__fake.db.serverSet`)·거부(`__fake.db.deny`)·업로드 보류/실패(`__fake.storage.hold/failPattern`)를 흉내 낼 수 있다.
- React·Babel 은 index.html 과 같은 버전의 npm 사본, Tailwind 는 npm 의 tailwindcss 로 미리 컴파일한 CSS 를 쓴다 (`global-setup.js`).
  그래서 네트워크 없이 돈다.
- 데이터는 연습용(`fixtures.js` 의 `sampleTask`)만. 실제 uid·이메일·목표 내용은 넣지 않는다.

| 파일 | 보는 것 |
| --- | --- |
| `sync.spec.js` | 두 기기·오프라인·저장 거부·빠른 연속 수정 때 기록이 안 사라지는지, 저장 대기 안내 |
| `images.spec.js` | 올리는 중 다른 수정, 썸네일 실패, 사진·목표 삭제 때 Storage 정리, 메타데이터와 파일 일치 |
| `schedule.spec.js` | 일정 레코드 모양·시각·종일 계산, 빈 날짜, 전송 실패, 다른 기기가 보낸 일정 |
| `display.spec.js` | D-day·정렬·개수·완료 시각·날짜 문자열, 사용자 글이 HTML 로 해석되지 않는지 |
| `sw.spec.js` | sw.js 목록이 index.html 과 같은지, 설치·옛 캐시 정리·오프라인 열기 |
| `layout.spec.js` | 폭 360·750·1280 세 화면에서 안 깨지는지 (스크린샷은 test-results/) |
| `auth.spec.js` | 로그인·로그아웃, 뒤로 가기 |
