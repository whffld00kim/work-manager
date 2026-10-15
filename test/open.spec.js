// 열기 (2026-10-15) — 기기 사본으로 먼저 열기 · 구글 로그인 버튼
const { test, expect, seedWith } = require('./fixtures');

test('한 번 연 기기는 로그인 확인이 늦어도 지난번 목록을 바로 보이고, 그동안은 고치지 않는다', async ({ app, page }) => {
  await app.open();
  await page.waitForFunction(() => !!localStorage.getItem('wm_cache_v1'));
  await page.addInitScript(s => { window.__fakeSeed = s; }, { ...seedWith(), authDelay: 3000 });
  await page.reload();
  await expect(page.locator('.wm-card').filter({ hasText: '연습 목표' })).toBeVisible({ timeout: 1500 });
  await expect(page.getByText('최신 확인 중')).toBeVisible();
  await expect(page.getByText('최신 확인 중')).toHaveCount(0, { timeout: 6000 });   // 확인이 끝나면 사라진다
  await expect(page.locator('.wm-card').filter({ hasText: '연습 목표' })).toBeVisible();
  expect(app.errors).toEqual([]);
});

test('사본이 있어도 로그인이 풀려 있으면 사본을 지우고 로그인 화면 · 구글 버튼이 있다', async ({ app, page }) => {
  await app.open();
  await page.waitForFunction(() => !!localStorage.getItem('wm_cache_v1'));
  await page.addInitScript(s => { window.__fakeSeed = s; }, { ...seedWith(), user: null });
  await page.reload();
  await expect(page.getByPlaceholder('이메일')).toBeVisible();
  await expect(page.getByRole('button', { name: '구글 계정으로 로그인' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('wm_cache_v1'))).toBeNull();
});
