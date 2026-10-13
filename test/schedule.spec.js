// 3. 일정으로 보내기 — 날짜·시각, 종일, 중복, 실패
const { test, expect, SCHED, UID, seedWith, sampleTask } = require('./fixtures');

async function openSend(page) {
  await page.locator('.wm-d-sched').getByRole('button', { name: '일정으로 보내기' }).click();
}

test('시각을 넣으면 기기 시간대 기준 1시간 일정, 레코드 모양은 민성 스케줄 형식 그대로', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await openSend(page);
  await page.locator('.wm-d-sched input[type=date]').fill('2030-02-03');
  await page.locator('.wm-d-sched input[type=time]').fill('14:30');
  await page.locator('.wm-d-sched').getByRole('button', { name: '보내기', exact: true }).click();
  await expect(app.toast()).toContainText('2030.02.03 일정으로 보냈습니다');
  await expect.poll(() => app.pending()).toBe(0);
  const all = await app.server(SCHED);
  const recs = Object.values(all);
  expect(recs).toHaveLength(1);
  const r = recs[0];
  const expectStart = await page.evaluate(() => new Date('2030-02-03T14:30:00').getTime());
  expect(r).toEqual({
    title: '연습 목표', start: expectStart, end: expectStart + 3600000, allDay: false, repeat: 'none',
    done: false, location: '', memo: '[목표:t1] 목표 관리자에서 보냄', createdAt: expect.any(Number),
  });
  // 연동 목록에 바로 나타난다
  await expect(page.locator('.wm-d-sched').getByText('2030.02.03')).toBeVisible();
});

test('시각을 비우면 종일 일정: 그날 0시 ~ 23:59:59 (기기 시간대)', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await openSend(page);
  await page.locator('.wm-d-sched input[type=date]').fill('2030-02-03');
  await page.locator('.wm-d-sched').getByRole('button', { name: '보내기', exact: true }).click();
  await expect.poll(() => app.pending()).toBe(0);
  const r = Object.values(await app.server(SCHED))[0];
  const [s, e] = await page.evaluate(() => [new Date('2030-02-03T00:00:00').getTime(), new Date('2030-02-03T23:59:59').getTime()]);
  expect(r.allDay).toBe(true);
  expect(r.start).toBe(s);
  expect(r.end).toBe(e);
});

test('날짜를 비우고 보내면 보내지 않고 안내한다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await openSend(page);
  await page.locator('.wm-d-sched input[type=date]').fill('');
  await page.locator('.wm-d-sched').getByRole('button', { name: '보내기', exact: true }).click();
  await expect(app.toast()).toContainText('날짜');
  expect(await app.server(SCHED)).toBeNull();
  await expect(page.locator('.wm-d-sched').getByText('NaN')).toHaveCount(0);
});

test('일정 전송이 거부되면 연동 목록에 남지 않는다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await app.deny(true);
  await openSend(page);
  await page.locator('.wm-d-sched input[type=date]').fill('2030-02-03');
  await page.locator('.wm-d-sched').getByRole('button', { name: '보내기', exact: true }).click();
  await expect(app.toast()).toContainText('일정 전송 실패');
  await expect(page.locator('.wm-d-sched').getByText('2030.02.03')).toHaveCount(0);
  expect(await app.server(SCHED)).toBeNull();
});

test('다른 기기에서 보낸 일정과 일정 앱에서 완료한 표시가 이 기기에도 나타난다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await expect(page.locator('.wm-d-sched').getByText('아직 연동된 일정이 없습니다')).toBeVisible();
  const start = await page.evaluate(() => new Date('2030-03-04T09:00:00').getTime());
  await app.serverSet(`${SCHED}/-OtherDevice1`, {
    title: '연습 목표', start, end: start + 3600000, allDay: false, repeat: 'none', done: false, location: '',
    memo: '[목표:t1] 목표 관리자에서 보냄', createdAt: start,
  });
  await expect(page.locator('.wm-d-sched').getByText('2030.03.04')).toBeVisible();
  await app.serverSet(`${SCHED}/-OtherDevice1/done`, true);          // 일정 앱에서 완료 표시
  await expect(page.locator('.wm-d-sched').getByText('완료')).toBeVisible();
});

test('연동 목록은 이 목표의 태그가 있는 일정만, 최근 날짜부터', async ({ app, page }) => {
  const start = (d) => Date.UTC(2030, 0, d, 3);   // 한국 시간 낮
  await app.open(seedWith([sampleTask()], {
    a: { title: 'A', start: start(5), end: start(5) + 1, allDay: false, repeat: 'none', done: false, location: '', memo: '[목표:t1] 목표 관리자에서 보냄', createdAt: 1 },
    b: { title: 'B', start: start(9), end: start(9) + 1, allDay: false, repeat: 'none', done: true, location: '', memo: '[목표:t1] 목표 관리자에서 보냄', createdAt: 1 },
    c: { title: 'C', start: start(7), end: start(7) + 1, allDay: false, repeat: 'none', done: false, location: '', memo: '[목표:other] 다른 목표', createdAt: 1 },
    d: { title: 'D', start: start(1), end: start(1) + 1, allDay: false, repeat: 'none', done: false, location: '', createdAt: 1 },
  }));
  await app.openDetail();
  const rows = page.locator('.wm-d-sched .flex.items-center.gap-2.text-sm');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('2030.01.09');
  await expect(rows.nth(0)).toContainText('완료');
  await expect(rows.nth(1)).toContainText('2030.01.05');
});
