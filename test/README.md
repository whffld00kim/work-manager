# 시험 (Playwright)

앱 동작을 브라우저에서 실제로 돌려 본다. 배포와는 무관하고, 실제 Firebase 에는 닿지 않는다(바깥으로 나가는 요청은 끊는다).

```
npm install
npm run test:setup   # 처음 한 번: Chromium 내려받기
npm test             # app.js·app.css 가 원본보다 낡았으면 먼저 다시 만든다(global-setup.js)
```

- `fake-firebase.js` — `vendor/firebase-*.js` 네 개를 통째로 바꿔치기하는 가짜 SDK.
  실제처럼 오프라인이면 쓰기가 멈추고(연결되면 순서대로 보냄), transaction 은 서버 값이 바뀌었으면 다시 돌고,
  다른 기기의 쓰기(`__fake.db.serverSet`)·거부(`__fake.db.deny`)·업로드 보류/실패(`__fake.storage.hold/failPattern`)를 흉내 낼 수 있다.
  **이 기기가 서버 값을 아직 못 받은 때**도 흉내 낸다(`seed.holdFirstValue`·`seed.startOffline`) — 그때 transaction 은 「값 없음」으로 먼저 불린다.
- React 와 꾸밈 규칙(`app.css`)은 앱과 함께 배포하는 파일 그대로 쓴다. 그래서 네트워크 없이 돈다.
- 데이터는 연습용(`fixtures.js` 의 `sampleTask`)만. 실제 uid·이메일·목표 내용은 넣지 않는다.

| 파일 | 보는 것 |
| --- | --- |
| `sync.spec.js` | 두 기기·오프라인·저장 거부·빠른 연속 수정 때 기록이 안 사라지는지, 저장 대기 안내 |
| `open.spec.js` | 기기 사본으로 먼저 열기 — 로그인 확인 전·서버 값 오기 전·끊긴 채 열었을 때 누른 것이 쓴 글을 지우지 않는지, 사진 파일을 먼저 지우지 않는지, 사본에 목표 일정만 담는지 |
| `images.spec.js` | 올리는 중 다른 수정, 썸네일 실패, 사진·목표 삭제 때 Storage 정리, 메타데이터와 파일 일치 |
| `schedule.spec.js` | 일정 레코드 모양·시각·종일 계산, 빈 날짜, 전송 실패, 다른 기기가 보낸 일정 |
| `display.spec.js` | D-day·정렬·개수·완료 시각·날짜 문자열, 사용자 글이 HTML 로 해석되지 않는지 |
| `guard.spec.js` | 지우기·로그아웃·닫기 전에 묻는지, 뒤로 가기, 알림 시간, 날짜가 바뀔 때, 화면 글 |
| `sw.spec.js` | sw.js 목록 = index.html, 판 번호가 서로 같은지, 바깥에서 받는 것이 없는지, vendor 가 공식 배포본인지, 설치·옛 캐시 정리·오프라인 열기 |
| `layout.spec.js` | 폭 360·750·1280 세 화면에서 안 깨지는지 (스크린샷은 test-results/) |
| `auth.spec.js` | 로그인·로그아웃, 뒤로 가기 |
