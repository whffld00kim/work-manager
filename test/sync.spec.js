// 1. 기록 유실 — 기기 둘, 오프라인, 저장 실패, 빠른 연속 수정
const { test, expect, TASKS, sampleTask, seedWith } = require('./fixtures');

const T1 = `${TASKS}/t1`;

test('두 기기: 다른 기기가 먼저 고친 기록이 이 기기의 저장으로 사라지지 않는다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  // 다른 기기(폰)가 같은 목표에 기록을 하나 더 남겼다
  const other = sampleTask({ log: [{ id: 'l0', date: '2026-10-01', text: '첫 기록' }, { id: 'l1', date: '2026-10-02', text: '다른 기기 기록' }], updatedAt: 1759363200000 });
  await app.serverSet(T1, other);
  // 이 기기(태블릿, 옛 화면)에서도 기록을 남긴다
  await app.addLog('이 기기 기록');
  await expect.poll(() => app.pending()).toBe(0);
  const saved = await app.server(T1);
  const texts = (saved.log || []).map(l => l.text);
  expect(texts).toContain('다른 기기 기록');
  expect(texts).toContain('이 기기 기록');
  expect(texts).toHaveLength(3);
  // 화면에도 셋 다 보인다
  await expect(page.locator('.wm-d-log').getByText('다른 기기 기록')).toBeVisible();
  await expect(page.locator('.wm-d-log').getByText('이 기기 기록')).toBeVisible();
});

test('오프라인에서 고친 뒤 다시 연결되면, 그사이 다른 기기가 고친 것과 합쳐진다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await app.setOnline(false);
  const other = sampleTask({ log: [{ id: 'l0', date: '2026-10-01', text: '첫 기록' }, { id: 'l1', date: '2026-10-02', text: '다른 기기 기록' }], updatedAt: 1759363200000 });
  await app.serverSet(T1, other);                        // 연결이 끊긴 사이 다른 기기가 저장
  await app.addLog('오프라인 기록');
  await expect(page.locator('.wm-d-log').getByText('오프라인 기록')).toBeVisible();   // 화면엔 바로 보이고
  expect(await app.pending()).toBeGreaterThan(0);                                       // 서버엔 아직 안 갔다
  await app.setOnline(true);
  await expect.poll(() => app.pending()).toBe(0);
  const texts = ((await app.server(T1)).log || []).map(l => l.text);
  expect(texts).toEqual(expect.arrayContaining(['첫 기록', '다른 기기 기록', '오프라인 기록']));
  expect(texts).toHaveLength(3);
  await expect(page.locator('.wm-d-log').getByText('다른 기기 기록')).toBeVisible();
});

test('저장이 거부되면 화면도 서버 값으로 되돌아간다 (성공한 척하지 않는다)', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await app.deny(true);
  await app.addLog('거부될 기록');
  await expect(app.toast()).toContainText('저장 실패');
  await expect(page.locator('.wm-d-log').getByText('거부될 기록')).toHaveCount(0);
  expect(((await app.server(T1)).log || []).map(l => l.text)).toEqual(['첫 기록']);
});

test('다른 기기에서 지운 목표는 이 기기 화면에서도 닫히고, 되살아나지 않는다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await app.serverSet(T1, null);
  await expect(page.locator('.wm-d-log')).toHaveCount(0);
  await expect(page.locator('.wm-card')).toHaveCount(0);
  expect(await app.server(T1)).toBeNull();
});

test('연결이 끊긴 채 고치면 "저장 대기" 안내가 보이고, 연결되면 사라진다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await app.setOnline(false);
  await app.addLog('대기 중 기록');
  await expect(app.notice()).toBeVisible();
  await expect(app.notice()).toContainText('연결');
  await app.setOnline(true);
  await expect.poll(() => app.pending()).toBe(0);
  await expect(app.notice()).toHaveCount(0);
  expect(((await app.server(T1)).log || []).map(l => l.text)).toContain('대기 중 기록');
});

test('같은 목표를 빠르게 연달아 고쳐도 둘 다 남는다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  const row = t => page.locator('.wm-d-check .group').filter({ hasText: t }).locator('button').first();
  await row('첫 단계').click();
  await row('둘째 단계').click();
  await app.addLog('연달아 기록');
  await expect.poll(() => app.pending()).toBe(0);
  const saved = await app.server(T1);
  expect(saved.checklist.map(c => c.done)).toEqual([true, true]);
  expect(saved.log.map(l => l.text)).toEqual(['첫 기록', '연달아 기록']);
});

test('오프라인에서 고친 직후 목표를 지워도 에러 토스트 없이 지워진다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await app.setOnline(false);
  await app.addLog('곧 지울 기록');
  await page.locator('.wm-d-del').click();          // confirm 은 fixture 가 확인
  await expect(page.locator('.wm-card')).toHaveCount(0);
  await app.setOnline(true);
  await expect.poll(() => app.pending()).toBe(0);
  expect(await app.server(T1)).toBeNull();
  await expect(app.toast().filter({ hasText: '저장 실패' })).toHaveCount(0);
});

test('새 목표는 서버에 그대로 저장되고 목록에 나타난다', async ({ app, page }) => {
  await app.open(seedWith([]));
  await page.locator('.wm-fab').click();
  await page.getByPlaceholder('과제 제목').fill('새 연습 목표');
  await page.getByPlaceholder('첫 진행 기록 (선택)').fill('시작');
  await page.locator('.wm-form').getByRole('button', { name: '추가' }).click();
  await expect(page.locator('.wm-card').filter({ hasText: '새 연습 목표' })).toBeVisible();
  await expect.poll(() => app.pending()).toBe(0);
  const all = await app.server(TASKS);
  const t = Object.values(all)[0];
  expect(t.title).toBe('새 연습 목표');
  expect(t.status).toBe('진행');
  expect(t.log[0].text).toBe('시작');
  expect(t.id).toBe(Object.keys(all)[0]);
  expect(t.createdAt).toBe(t.updatedAt);
});
