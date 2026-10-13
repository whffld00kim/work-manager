// npm test 가 이 설정으로 돈다. 브라우저 안에서는 Firebase SDK 대신 test/fake-firebase.js 가 쓰인다 (fixtures.js).
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.js/,
  globalSetup: require.resolve('./global-setup.js'),
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  outputDir: '../test-results',
  use: {
    browserName: 'chromium',
    viewport: { width: 360, height: 800 },   // 기본은 폴드7 접은 화면. 넓은 화면은 시험에서 따로 지정
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    serviceWorkers: 'block',                 // 앱 동작 시험은 SW 없이. SW 시험(sw.spec.js)은 따로 allow
  },
});
