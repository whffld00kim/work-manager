// 열기 — 기기 사본으로 먼저 열기(2026-10-15) · 그 틈에 누른 것(2026-11-17 점검 B1·B2·B3)
// 사본으로 열면 화면은 바로 뜨지만, 로그인 확인 → 서버 첫 값이 올 때까지는 이 기기에 서버 값이 없다.
// 그때 누른 것은 저장하지 않되 쓴 글·열린 창을 그대로 두어야 한다 (전엔 「이미 지워진 목표」로 버리고 입력 칸을 비웠다)
const { test, expect, TASKS, seedWith, sampleTask, cacheOf } = require('./fixtures');

const T1 = `${TASKS}/t1`;
const logOf = async app => ((await app.server(T1)).log || []).map(l => l.text);

test('한 번 연 기기는 로그인 확인이 늦어도 지난번 목록을 바로 보이고, 그동안은 고치지 않는다', async ({ app, page }) => {
  await app.openCached({ ...seedWith(), authDelay: 3000 });
  await expect(page.locator('.wm-card').filter({ hasText: '연습 목표' })).toBeVisible({ timeout: 1500 });
  await expect(page.getByText('최신 확인 중')).toBeVisible();
  await expect(page.getByText('최신 확인 중')).toHaveCount(0, { timeout: 6000 });   // 확인이 끝나고 서버 값이 오면 사라진다
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

test('로그인 확인 전에 누르면 쓴 글이 남고, 확인이 끝나도 열어 둔 창·쓰던 글이 그대로다', async ({ app, page }) => {
  await app.openCached({ ...seedWith(), authDelay: 2500 });
  await app.openDetail();
  await app.addLog('확인 전에 쓴 기록');
  await expect(app.toast()).toContainText('확인하는 중');
  await expect(page.locator('.wm-d-log textarea')).toHaveValue('확인 전에 쓴 기록');       // 입력 칸을 비우지 않는다
  await page.getByPlaceholder('하위 단계 추가').fill('확인 전에 쓴 단계');
  await page.getByRole('button', { name: '단계 추가' }).click();
  await expect(page.getByPlaceholder('하위 단계 추가')).toHaveValue('확인 전에 쓴 단계');
  await page.getByRole('button', { name: '편집' }).click();
  await page.locator('.sticky input').fill('확인 전에 고친 제목');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.locator('.sticky input')).toHaveValue('확인 전에 고친 제목');           // 편집이 닫히지 않는다
  expect(await logOf(app)).toEqual(['첫 기록']);                                           // 서버엔 아무것도 안 갔다
  // 로그인 확인 + 서버 값 도착 — 화면을 새로 띄우지 않으므로 상세 창·쓰던 글이 남아 있다
  await expect(app.notice()).toHaveCount(0, { timeout: 6000 });
  await expect(page.locator('.wm-d-log textarea')).toHaveValue('확인 전에 쓴 기록');
  await expect(page.locator('.sticky input')).toHaveValue('확인 전에 고친 제목');
  // 이제는 저장된다
  await page.getByRole('button', { name: '저장' }).click();
  await page.locator('.wm-d-log').getByRole('button', { name: '기록', exact: true }).click();
  await page.getByRole('button', { name: '단계 추가' }).click();
  await expect.poll(() => app.pending()).toBe(0);
  const saved = await app.server(T1);
  expect(saved.title).toBe('확인 전에 고친 제목');
  expect(saved.log.map(l => l.text)).toEqual(['첫 기록', '확인 전에 쓴 기록']);
  expect(saved.checklist.map(c => c.text)).toContain('확인 전에 쓴 단계');
  expect(app.errors).toEqual([]);
});

test('로그인 확인 전에 「새 목표 → 추가」를 눌러도 창과 쓴 글이 남는다', async ({ app, page }) => {
  await app.openCached({ ...seedWith(), authDelay: 2500 });
  await page.locator('.wm-fab').click();
  await page.getByPlaceholder('목표 제목').fill('확인 전에 쓴 새 목표');
  await page.getByPlaceholder('첫 진행 기록 (선택)').fill('첫 기록도 남아야 한다');
  await page.locator('.wm-form').getByRole('button', { name: '추가' }).click();
  await expect(app.toast()).toContainText('확인하는 중');
  await expect(page.getByPlaceholder('목표 제목')).toHaveValue('확인 전에 쓴 새 목표');
  await expect(app.notice()).toHaveCount(0, { timeout: 6000 });          // 확인이 끝나도 창이 닫히지 않는다
  await expect(page.getByPlaceholder('목표 제목')).toHaveValue('확인 전에 쓴 새 목표');
  await expect(page.getByPlaceholder('첫 진행 기록 (선택)')).toHaveValue('첫 기록도 남아야 한다');
  await page.locator('.wm-form').getByRole('button', { name: '추가' }).click();
  await expect(page.locator('.wm-form')).toHaveCount(0);
  await expect.poll(() => app.pending()).toBe(0);
  expect(Object.values(await app.server(TASKS)).map(t => t.title)).toContain('확인 전에 쓴 새 목표');
});

test('서버 값이 오기 전(로그인 확인 직후)에 누른 것을 「지워진 목표」로 버리지 않는다', async ({ app, page }) => {
  await app.openCached({ ...seedWith(), holdFirstValue: true });          // 느린 망: 로그인은 확인됐는데 서버 값이 아직 안 왔다
  await expect(app.notice()).toContainText('최신 확인 중');
  await app.openDetail();
  await app.addLog('서버 값이 오기 전에 쓴 기록');
  await expect(app.toast()).toContainText('확인하는 중');
  await expect(app.toast()).not.toContainText('지워진');
  await expect(page.locator('.wm-d-log textarea')).toHaveValue('서버 값이 오기 전에 쓴 기록');
  await page.locator('.wm-d-check .group').filter({ hasText: '첫 단계' }).locator('button').first().click();
  await page.locator('.wm-d-info button', { hasText: '보류' }).click();
  await expect(app.toast()).not.toContainText('지워진');
  expect(await app.pending()).toBe(0);
  expect(await app.server(T1)).toMatchObject({ status: '진행', log: [{ text: '첫 기록' }] });
  expect((await app.server(T1)).checklist[0].done).toBe(false);
  // 서버 값이 오면 같은 조작이 저장된다
  await app.releaseFirstValue();
  await expect(app.notice()).toHaveCount(0);
  await page.locator('.wm-d-log').getByRole('button', { name: '기록', exact: true }).click();
  await page.locator('.wm-d-check .group').filter({ hasText: '첫 단계' }).locator('button').first().click();
  await expect.poll(() => app.pending()).toBe(0);
  const saved = await app.server(T1);
  expect(saved.log.map(l => l.text)).toEqual(['첫 기록', '서버 값이 오기 전에 쓴 기록']);
  expect(saved.checklist[0].done).toBe(true);
  await expect(page.locator('.wm-d-log textarea')).toHaveValue('');
  expect(app.errors).toEqual([]);
});

test('붙어 있는 줄 아는데 연결이 안 되는 채로 열면 — 3초는 「확인 중」, 그 뒤 「연결되면 고칠 수 있어요」', async ({ app, page }) => {
  await app.openCached({ ...seedWith(), startOffline: true });
  await expect(app.notice()).toContainText('최신 확인 중');
  await app.openDetail();
  await app.addLog('붙는 중에 쓴 기록');
  await expect(app.toast()).toContainText('확인하는 중');
  await expect(page.locator('.wm-d-log textarea')).toHaveValue('붙는 중에 쓴 기록');
  await expect(app.notice()).toHaveText('연결 안 됨 — 연결되면 고칠 수 있어요', { timeout: 6000 });
  await page.locator('.wm-d-log').getByRole('button', { name: '기록', exact: true }).click();
  await expect(app.toast()).toContainText('연결되면 고칠 수 있어요');
  await expect(page.locator('.wm-d-log textarea')).toHaveValue('붙는 중에 쓴 기록');
  expect(await app.pending()).toBe(0);
});

test('끊긴 채로(비행기 모드) 열면 곧바로 「연결되면 고칠 수 있어요」 — 쓴 글이 남고, 연결되면 저장된다', async ({ app, page }) => {
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false }); });   // 기기가 끊긴 줄 안다
  await app.openCached({ ...seedWith(), startOffline: true });
  await expect(app.notice()).toHaveText('연결 안 됨 — 연결되면 고칠 수 있어요', { timeout: 1500 });       // 3초를 기다리지 않는다
  await app.openDetail();
  await app.addLog('끊긴 채로 쓴 기록');
  await expect(app.toast()).toContainText('연결되면 고칠 수 있어요');
  await expect(app.toast()).not.toContainText('지워진');
  await expect(page.locator('.wm-d-log textarea')).toHaveValue('끊긴 채로 쓴 기록');
  // 새 목표도 창과 글을 남긴다 (전엔 저장 대기에 들어가 목록에 보이지 않았다)
  await page.locator('.sticky').getByRole('button', { name: '닫기' }).click();      // 쓰던 글이 있어 묻는다 — fixture 가 확인
  await page.locator('.wm-fab').click();
  await page.getByPlaceholder('목표 제목').fill('끊긴 채로 쓴 새 목표');
  await page.locator('.wm-form').getByRole('button', { name: '추가' }).click();
  await expect(page.getByPlaceholder('목표 제목')).toHaveValue('끊긴 채로 쓴 새 목표');
  expect(await app.pending()).toBe(0);
  // 연결
  await app.setOnline(true);
  await expect(app.notice()).toHaveCount(0);
  await page.locator('.wm-form').getByRole('button', { name: '추가' }).click();
  await expect(page.locator('.wm-card').filter({ hasText: '끊긴 채로 쓴 새 목표' })).toBeVisible();
  await expect.poll(() => app.pending()).toBe(0);
  expect(Object.values(await app.server(TASKS)).map(t => t.title)).toContain('끊긴 채로 쓴 새 목표');
  expect(app.errors).toEqual([]);
});

const IMG = { id: 'i1', name: 'a.png', path: 'goal-images/test-uid/t1/i1_a.png', thumbPath: 'goal-images/test-uid/t1/i1_thumb.jpg',
  url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  thumbUrl: null, size: 68, type: 'image/png', width: 1, height: 1, createdAt: 1 };
const withImage = extra => ({ ...seedWith([sampleTask({ images: [IMG] })]), storageFiles: { [IMG.path]: { size: 68 }, [IMG.thumbPath]: { size: 10 } }, ...extra });

test('아직 고칠 수 없는 때에는 사진 파일도 지우지 않는다 (파일만 지워져 깨진 사진 칸이 남던 것)', async ({ app, page }) => {
  await app.openCached(withImage({ holdFirstValue: true }));
  await app.openDetail();
  await page.locator('.wm-d-thumbs button').first().click();
  await page.getByTitle('삭제').click();
  await expect(app.toast()).toContainText('확인하는 중');
  expect((await app.storageLog()).filter(l => l.op === 'delete')).toEqual([]);
  expect(Object.keys(await app.storageFiles()).sort()).toEqual([IMG.path, IMG.thumbPath].sort());
  expect((await app.server(T1)).images).toHaveLength(1);
});

test('기록 고치기가 거절되면 사진 파일을 지우지 않는다 — 사진 삭제·목표 삭제 둘 다', async ({ app, page }) => {
  await app.open(withImage());
  await app.openDetail();
  await app.deny(true);
  await page.locator('.wm-d-thumbs button').first().click();
  await page.getByTitle('삭제').click();
  await expect(app.toast()).toContainText('저장 실패');
  await expect.poll(() => app.pending()).toBe(0);
  expect((await app.storageLog()).filter(l => l.op === 'delete')).toEqual([]);
  expect((await app.server(T1)).images).toHaveLength(1);
  await page.locator('.wm-d-del').click();
  await expect(app.toast()).toContainText('삭제 실패');
  await expect.poll(() => app.pending()).toBe(0);
  expect((await app.storageLog()).filter(l => l.op === 'delete')).toEqual([]);
  expect(await app.server(T1)).not.toBeNull();
  expect(Object.keys(await app.storageFiles())).toHaveLength(2);
});

test('기기 사본에는 이 앱이 쓰는 [목표:id] 일정만 담는다 — 옛 사본의 다른 일정도 열자마자 걷어 낸다', async ({ app, page }) => {
  const sch = {
    a: { title: '목표 일정', start: 1, end: 2, allDay: true, repeat: 'none', memo: '[목표:t1] 목표 관리에서 보냄' },
    b: { title: '개인 일정', start: 1, end: 2, allDay: true, repeat: 'none', memo: '병원' },
    c: { title: '메모 없는 일정', start: 1, end: 2, allDay: true, repeat: 'none' },
  };
  const seed = { ...seedWith([sampleTask()], sch), authDelay: 1500 };
  await app.openCached(seed, cacheOf(seed));                               // 옛 판이 남긴 사본: 일정 셋이 통째로 들어 있다
  const titles = () => page.evaluate(() => JSON.parse(localStorage.getItem('wm_cache_v1')).schedules.map(s => s.title));
  expect(await titles()).toEqual(['목표 일정']);                           // 로그인 확인 전인데도 이미 걸러졌다
  await expect(app.notice()).toHaveCount(0, { timeout: 5000 });
  await page.waitForTimeout(1200);                                         // 서버 값으로 사본을 다시 쓴 뒤에도
  expect(await titles()).toEqual(['목표 일정']);
  await app.openDetail();
  await expect(page.locator('.wm-d-sched').getByText('목표 일정')).toBeVisible();
});
