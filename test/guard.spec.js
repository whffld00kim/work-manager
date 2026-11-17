// 6. 실수로 잃지 않게 · 알림 · 날짜 (2026-11-17 점검 U6·U9·U10·B7·B8)
const { test, expect, TASKS, sampleTask, seedWith } = require('./fixtures');

const T1 = `${TASKS}/t1`;
const IMG = { id: 'i1', name: 'a.png', path: 'goal-images/test-uid/t1/i1_a.png', thumbPath: null, thumbUrl: null,
  url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  size: 68, type: 'image/png', width: 1, height: 1, createdAt: 1 };

test('로그아웃은 「정보」 창에서 한 번 묻는다 — 취소하면 그대로다', async ({ app, page }) => {
  await app.open();
  await page.getByRole('button', { name: '정보' }).click();
  await expect(page.locator('.wm-info .wm-ver')).toHaveText(/^\d{8}[a-z]?$/);      // 판 번호가 보인다
  app.acceptDialogs = false;
  await page.getByRole('button', { name: /로그아웃/ }).click();
  expect(app.dialogs.pop()).toContain('로그아웃할까요');
  await expect(page.locator('.wm-card')).toHaveCount(1);                           // 로그인된 채 그대로
  expect(await page.evaluate(() => window.__fake.auth.user())).not.toBeNull();
});

test('체크리스트 지우기는 묻고, 취소하면 남는다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  const row = page.locator('.wm-d-check .group').filter({ hasText: '첫 단계' });
  app.acceptDialogs = false;
  await row.getByRole('button', { name: '이 단계 지우기' }).click();
  expect(app.dialogs.pop()).toContain('첫 단계');
  await expect(row).toHaveCount(1);
  app.acceptDialogs = true;
  await row.getByRole('button', { name: '이 단계 지우기' }).click();
  await expect.poll(() => app.pending()).toBe(0);
  expect((await app.server(T1)).checklist.map(c => c.text)).toEqual(['둘째 단계']);
});

test('진행 기록 지우기 단추는 늘 보이고(투명하지 않다) 누르면 묻는다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  const del = page.locator('.wm-d-log .group').first().getByRole('button', { name: '이 기록 지우기' });
  await expect(del).toBeVisible();
  expect(Number(await del.evaluate(el => getComputedStyle(el).opacity))).toBe(1);
  const box = await del.boundingBox();
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(40);              // 누르는 자리
  await del.click();
  expect(app.dialogs.pop()).toContain('이 기록을 지울까요');
  await expect.poll(() => app.pending()).toBe(0);
  expect((await app.server(T1)).log ?? []).toEqual([]);
});

test('「새 목표」 창: 쓴 글이 있으면 바깥을 눌러도 닫히지 않고, 뒤로 가기는 묻는다', async ({ app, page }) => {
  await app.open();
  await page.locator('.wm-fab').click();
  await page.mouse.click(180, 40);                                                 // 빈 창 — 바깥을 누르면 닫힌다
  await expect(page.locator('.wm-form')).toHaveCount(0);
  await page.locator('.wm-fab').click();
  await page.getByPlaceholder('목표 제목').fill('쓰던 제목');
  await page.mouse.click(180, 40);
  await expect(page.getByPlaceholder('목표 제목')).toHaveValue('쓰던 제목');
  app.acceptDialogs = false;
  let n = app.dialogs.length;
  await page.goBack();
  await expect.poll(() => app.dialogs.length).toBe(n + 1);                         // 뒤로 가기의 확인 창은 조금 늦게 뜬다
  expect(app.dialogs[n]).toContain('쓰던 글');
  await expect(page.getByPlaceholder('목표 제목')).toHaveValue('쓰던 제목');
  app.acceptDialogs = true;
  await page.goBack();
  await expect(page.locator('.wm-form')).toHaveCount(0);
});

test('편집에는 「취소」가 있고, 쓰던 글이 있는 상세를 닫을 땐 묻는다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await page.getByRole('button', { name: '편집' }).click();
  await page.locator('.sticky input').fill('버릴 제목');
  await page.locator('.sticky').getByRole('button', { name: '취소' }).click();
  await expect(page.locator('.sticky h2')).toHaveText('연습 목표');
  expect(await app.pending()).toBe(0);
  // 쓰던 기록이 있는 채로 닫기
  await page.locator('.wm-d-log textarea').fill('쓰던 기록');
  app.acceptDialogs = false;
  await page.locator('.sticky').getByRole('button', { name: '닫기' }).click();
  expect(app.dialogs.pop()).toContain('쓰던 글');
  await expect(page.locator('.wm-d-log textarea')).toHaveValue('쓰던 기록');
  const n = app.dialogs.length;
  await page.goBack();                                                             // 뒤로 가기도 묻는다
  await expect.poll(() => app.dialogs.length).toBe(n + 1);
  await expect(page.locator('.wm-d-log textarea')).toHaveValue('쓰던 기록');
  app.acceptDialogs = true;
  await page.locator('.sticky').getByRole('button', { name: '닫기' }).click();
  await expect(page.locator('.wm-d-log')).toHaveCount(0);
});

test('두 칸 화면: 편집하다 다른 목표를 누르면 묻는다', async ({ app, page }) => {
  await page.setViewportSize({ width: 750, height: 830 });
  await app.open(seedWith([sampleTask(), sampleTask({ id: 't2', title: '다른 목표' })]));
  await app.openDetail();
  await page.getByRole('button', { name: '편집' }).click();
  await page.locator('.wm-detail-scroll .sticky input').fill('고치던 제목');
  app.acceptDialogs = false;
  await page.locator('.wm-card').filter({ hasText: '다른 목표' }).click();
  expect(app.dialogs.pop()).toContain('쓰던 글');
  await expect(page.locator('.wm-detail-scroll .sticky input')).toHaveValue('고치던 제목');
});

test('사진을 크게 본 채 뒤로 가기를 누르면 사진만 닫힌다', async ({ app, page }) => {
  await app.open(seedWith([sampleTask({ images: [IMG] })]));
  await app.openDetail();
  await page.locator('.wm-d-thumbs button').first().click();
  await expect(page.getByTitle('삭제')).toBeVisible();
  await page.goBack();
  await expect(page.getByTitle('삭제')).toHaveCount(0);
  await expect(page.locator('.wm-d-log')).toBeVisible();                           // 상세는 그대로
});

test('알림이 이어져도 뒤 알림이 제 시간만큼 떠 있다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await page.locator('.wm-d-sched').getByRole('button', { name: '일정으로 보내기' }).click();
  await page.locator('.wm-d-sched').getByRole('button', { name: '보내기', exact: true }).click();
  await expect(app.toast()).toContainText('일정으로 보냈어요');
  await page.waitForTimeout(2300);                                                 // 앞 알림(3초)이 끝나기 직전
  await page.locator('.wm-d-sched').getByRole('button', { name: '일정으로 보내기' }).click();
  await page.locator('.wm-d-sched input[type=date]').fill('');
  await page.locator('.wm-d-sched').getByRole('button', { name: '보내기', exact: true }).click();
  await expect(app.toast()).toContainText('날짜를 확인해 주세요');
  await page.waitForTimeout(1500);                                                 // 전엔 앞 알림의 타이머가 0.7초 뒤 이것을 지웠다
  await expect(app.toast()).toContainText('날짜를 확인해 주세요');
  await expect(page.locator('.wm-d-sched input[type=time]')).toBeVisible();        // 못 보냈으면 고르던 칸을 닫지 않는다
});

test('날짜 칸을 비우고 「기록」하면 오늘 날짜로 적힌다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await page.locator('.wm-d-log input[type=date]').fill('');
  await app.addLog('날짜를 비운 기록');
  await expect.poll(() => app.pending()).toBe(0);
  const today = await page.evaluate(() => new Date().toLocaleDateString('sv-SE'));
  expect((await app.server(T1)).log.find(l => l.text === '날짜를 비운 기록').date).toBe(today);
});

test('켜 둔 채 날짜가 바뀌면 날짜 칸·D-day 가 따라 바뀌고, 그날 날짜로 적힌다', async ({ app, page }) => {
  const base = new Date(); base.setHours(23, 58, 0, 0);
  await page.clock.install({ time: base });
  const due = new Date(base.getTime() + 5 * 86400000).toLocaleDateString('sv-SE');
  await page.setViewportSize({ width: 1280, height: 800 });                        // 두 칸 화면 — 목록과 상세가 같이 보인다
  await app.open(seedWith([sampleTask({ dueDate: due })]));
  await app.openDetail();
  const card = page.locator('.wm-card').first();
  await expect(card).toContainText('D-5');
  const d0 = await page.locator('.wm-d-log input[type=date]').inputValue();
  await page.clock.fastForward(5 * 60 * 1000);                                     // 자정을 넘긴다
  const d1 = await page.evaluate(() => new Date().toLocaleDateString('sv-SE'));
  expect(d1).not.toBe(d0);
  await expect(page.locator('.wm-d-log input[type=date]')).toHaveValue(d1);
  await expect(card).toContainText('D-4');
  await app.addLog('자정 뒤 기록');
  await expect.poll(() => app.pending()).toBe(0);
  expect((await app.server(T1)).log.find(l => l.text === '자정 뒤 기록').date).toBe(d1);
});

test('화면 글: 「과제」가 남아 있지 않고 앱 이름은 「목표 관리」다', async ({ app, page }) => {
  await app.open(seedWith([]));
  await expect(page).toHaveTitle('목표 관리');
  await expect(page.locator('.wm-head-title')).toContainText('목표 관리');
  await expect(page.locator('.wm-head-title')).not.toContainText('관리자');
  await expect(page.locator('body')).not.toContainText('과제');
  await page.locator('.wm-fab').click();
  await expect(page.locator('.wm-form')).toContainText('새 목표');
  await expect(page.locator('body')).not.toContainText('과제');
});
