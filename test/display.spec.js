// 4. 계산·표시 — D-day, 정렬, 상태별 개수, 완료 시각, 날짜 문자열
const { test, expect, TASKS, sampleTask, seedWith } = require('./fixtures');

const T1 = `${TASKS}/t1`;
// 브라우저(Asia/Seoul) 기준 오늘 ± n일 → 'YYYY-MM-DD'
function seoulDate(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

test('D-day 는 기기 날짜 기준이고 완료·중단엔 안 보인다', async ({ app, page }) => {
  await app.open(seedWith([
    sampleTask({ id: 'a', title: '사흘 뒤', dueDate: seoulDate(3) }),
    sampleTask({ id: 'b', title: '오늘', dueDate: seoulDate(0) }),
    sampleTask({ id: 'c', title: '이틀 지남', dueDate: seoulDate(-2) }),
    sampleTask({ id: 'd', title: '완료된 것', dueDate: seoulDate(-2), status: '완료', completedAt: Date.now() }),
    sampleTask({ id: 'e', title: '기한 없음', dueDate: null }),
  ]));
  const card = t => page.locator('.wm-card').filter({ hasText: t });
  await expect(card('사흘 뒤')).toContainText('D-3');
  await expect(card('오늘')).toContainText('D-Day');
  await expect(card('이틀 지남')).toContainText('D+2');
  await expect(card('기한 없음')).not.toContainText('D');
  await page.getByRole('button', { name: /완료·이력/ }).click();
  await expect(card('완료된 것')).toBeVisible();
  await expect(card('완료된 것')).not.toContainText('D+');
});

test('탭의 개수와 목록 정렬: 상태 → 우선순위 → 기한', async ({ app, page }) => {
  await app.open(seedWith([
    sampleTask({ id: 'a', title: '대기 높음', status: '대기', priority: '높음', dueDate: null }),
    sampleTask({ id: 'b', title: '진행 낮음 기한 빠름', status: '진행', priority: '낮음', dueDate: '2030-01-01' }),
    sampleTask({ id: 'c', title: '진행 낮음 기한 늦음', status: '진행', priority: '낮음', dueDate: '2031-01-01' }),
    sampleTask({ id: 'd', title: '진행 높음', status: '진행', priority: '높음', dueDate: null }),
    sampleTask({ id: 'e', title: '보류', status: '보류', priority: '높음', dueDate: null }),
    sampleTask({ id: 'f', title: '완료 옛것', status: '완료', completedAt: 1000, dueDate: null }),
    sampleTask({ id: 'g', title: '완료 새것', status: '완료', completedAt: 2000, dueDate: null }),
    sampleTask({ id: 'h', title: '중단', status: '중단', updatedAt: 3000, dueDate: null }),
  ]));
  await expect(page.getByRole('button', { name: '진행 중 5' })).toBeVisible();
  await expect(page.getByRole('button', { name: '완료·이력 3' })).toBeVisible();
  const titles = () => page.locator('.wm-card .font-semibold').allTextContents();
  expect(await titles()).toEqual(['진행 높음', '진행 낮음 기한 빠름', '진행 낮음 기한 늦음', '대기 높음', '보류']);
  await page.getByRole('button', { name: '완료·이력 3' }).click();
  expect(await titles()).toEqual(['완료 새것', '완료 옛것', '중단']);
});

test('완료로 바꾸면 완료 시각이 기록되고, 완료를 다시 눌러도 처음 시각이 유지된다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  const status = s => page.locator('.wm-d-info button', { hasText: s });
  await status('완료').click();
  await expect.poll(() => app.pending()).toBe(0);
  const c1 = (await app.server(T1)).completedAt;
  expect(c1).toBeGreaterThan(Date.now() - 60000);
  await expect(page.locator('.wm-d-info').getByText(/✓ .* 완료/)).toBeVisible();
  await page.waitForTimeout(30);
  await status('완료').click();
  await expect.poll(() => app.pending()).toBe(0);
  expect((await app.server(T1)).completedAt).toBe(c1);
  await status('진행').click();
  await expect.poll(() => app.pending()).toBe(0);
  expect((await app.server(T1)).completedAt ?? null).toBeNull();
});

test('제목을 고치는 중에 상태 버튼을 눌러도 입력하던 제목이 지워지지 않는다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await page.getByRole('button', { name: '편집' }).click();
  const title = page.locator('.sticky input').first();
  await title.fill('고치는 중인 제목');
  await page.locator('.wm-d-info button', { hasText: '보류' }).click();
  await expect.poll(() => app.pending()).toBe(0);
  await expect(title).toHaveValue('고치는 중인 제목');
  await page.getByRole('button', { name: '저장' }).click();
  await expect.poll(() => app.pending()).toBe(0);
  const saved = await app.server(T1);
  expect(saved.title).toBe('고치는 중인 제목');
  expect(saved.status).toBe('보류');
});

test('기록 날짜는 기기 날짜 문자열 그대로 저장되고(UTC 로 밀리지 않음) 체크 완료 날짜도 같다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await expect(page.locator('.wm-d-log input[type=date]')).toHaveValue(seoulDate(0));
  await page.locator('.wm-d-log input[type=date]').fill('2026-10-05');
  await app.addLog('날짜 고정 기록');
  await page.locator('.wm-d-check .group').filter({ hasText: '첫 단계' }).locator('button').first().click();
  await expect.poll(() => app.pending()).toBe(0);
  const saved = await app.server(T1);
  expect(saved.log.find(l => l.text === '날짜 고정 기록').date).toBe('2026-10-05');
  expect(saved.checklist[0].doneDate).toBe(seoulDate(0));
  await expect(page.locator('.wm-d-log').getByText('2026.10.05')).toBeVisible();
  await expect(page.locator('.wm-d-check').getByText(seoulDate(0).replaceAll('-', '.'))).toBeVisible();
});

test('사용자 글은 HTML 로 해석되지 않는다', async ({ app, page }) => {
  const evil = '<img src=x onerror="window.__xss=1"><b>굵게</b>';
  await app.open(seedWith([sampleTask({ title: evil, log: [{ id: 'l0', date: '2026-10-01', text: evil }], checklist: [{ id: 'c1', text: evil, done: false, doneDate: null }] })]));
  await expect(page.locator('.wm-card')).toContainText('<b>굵게</b>');
  await page.locator('.wm-card').first().click();
  await expect(page.locator('.wm-d-log')).toContainText('<img src=x');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator('b').count()).toBe(0);
});
