// 로그인 게이트·뒤로 가기 — 고친 곳은 아니지만 구독/정리 코드가 로그아웃·재로그인에서 깨지지 않는지
const { test, expect, seedWith, sampleTask } = require('./fixtures');

test('로그인 화면 → 로그인 → 목록, 로그아웃하면 다시 로그인 화면 (오류 없이)', async ({ app, page, server }) => {
  await page.addInitScript(s => { window.__fakeSeed = s; }, { ...seedWith(), user: null });
  await page.goto(server.url + 'index.html');
  await expect(page.getByPlaceholder('이메일')).toBeVisible();
  await page.getByPlaceholder('이메일').fill('tester@example.com');
  await page.getByPlaceholder('비밀번호').fill('pw');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.locator('.wm-card').filter({ hasText: '연습 목표' })).toBeVisible();
  await page.getByTitle('로그아웃').click();
  await expect(page.getByPlaceholder('이메일')).toBeVisible();
  expect(app.errors).toEqual([]);
});

test('비밀번호가 틀리면 안내가 뜬다', async ({ app, page, server }) => {
  await page.addInitScript(s => { window.__fakeSeed = s; }, { ...seedWith(), user: null, loginError: 'auth/invalid-credential' });
  await page.goto(server.url + 'index.html');
  await page.getByPlaceholder('이메일').fill('tester@example.com');
  await page.getByPlaceholder('비밀번호').fill('pw');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('이메일 또는 비밀번호가 맞지 않아요')).toBeVisible();
});

test('뒤로 가기는 열린 상세를 닫을 뿐 앱을 나가지 않는다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await page.goBack();
  await expect(page.locator('.wm-d-log')).toHaveCount(0);
  await expect(page.locator('.wm-card')).toHaveCount(1);
  await page.goBack();
  await expect(page.locator('.wm-card')).toHaveCount(1);   // 여전히 앱 안
});
