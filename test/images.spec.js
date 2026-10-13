// 2. 사진 — 올리는 중 다른 수정, 썸네일 실패, 지울 때 Storage 정리
const { test, expect, TASKS, UID, PNG_1x1 } = require('./fixtures');

const T1 = `${TASKS}/t1`;
const file = (name = 'photo.png') => ({ name, mimeType: 'image/png', buffer: PNG_1x1 });

test('사진을 올리는 동안 남긴 기록이 업로드가 끝나도 사라지지 않는다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await page.evaluate(() => window.__fake.storage.hold(true));            // 느린 연결: 업로드가 멈춰 있다
  await page.locator('.wm-d-img input[type=file]').setInputFiles(file());
  await expect(page.locator('.wm-d-img').getByText(/올리는 중/)).toBeVisible();
  await app.addLog('업로드 중 기록');
  await expect.poll(() => app.pending()).toBe(0);
  await page.evaluate(() => window.__fake.storage.hold(false));           // 업로드 완료
  await expect(app.toast()).toContainText('이미지 1장');
  await expect.poll(() => app.pending()).toBe(0);
  const saved = await app.server(T1);
  expect(saved.images).toHaveLength(1);
  expect((saved.log || []).map(l => l.text)).toContain('업로드 중 기록');
});

test('썸네일 만들기·올리기에 실패해도 원본 사진은 기록에 남는다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await page.evaluate(() => window.__fake.storage.failPattern('_thumb\\.jpg$'));
  await page.locator('.wm-d-img input[type=file]').setInputFiles(file());
  await expect(app.toast()).toContainText('이미지 1장');
  await expect.poll(() => app.pending()).toBe(0);
  const saved = await app.server(T1);
  expect(saved.images).toHaveLength(1);
  const img = saved.images[0];
  expect(img.path).toBe(`goal-images/${UID}/t1/${img.id}_photo.png`);
  expect(img.thumbUrl ?? null).toBeNull();
  expect(img.thumbPath ?? null).toBeNull();
  expect(img.url).toBeTruthy();
  await expect(page.locator('.wm-d-thumbs img')).toHaveCount(1);
  // 원본만 올라갔고 메타데이터와 실제 파일이 맞는다
  const files = Object.keys(await app.storageFiles());
  expect(files).toEqual([img.path]);
});

test('정상 업로드: 원본·썸네일이 Storage 에 올라가고 메타데이터 경로가 실제 파일과 맞는다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await page.locator('.wm-d-img input[type=file]').setInputFiles(file('내 사진.png'));
  await expect(app.toast()).toContainText('이미지 1장');
  await expect.poll(() => app.pending()).toBe(0);
  const img = (await app.server(T1)).images[0];
  expect(img.name).toBe('내 사진.png');
  expect(img.path).toBe(`goal-images/${UID}/t1/${img.id}_내 사진.png`);
  expect(img.thumbPath).toBe(`goal-images/${UID}/t1/${img.id}_thumb.jpg`);
  expect(img.width).toBe(1); expect(img.height).toBe(1);
  expect(img.size).toBe(PNG_1x1.length);
  const files = await app.storageFiles();
  expect(Object.keys(files).sort()).toEqual([img.path, img.thumbPath].sort());
  expect(files[img.path].contentType).toBe('image/png');
  expect(files[img.thumbPath].contentType).toBe('image/jpeg');
});

test('사진 하나만 지우면 원본·썸네일 파일과 메타데이터가 함께 지워진다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await page.locator('.wm-d-img input[type=file]').setInputFiles(file());
  await expect(app.toast()).toContainText('이미지 1장');
  await expect.poll(() => app.pending()).toBe(0);
  await page.locator('.wm-d-thumbs button').first().click();
  await page.getByTitle('삭제').click();                                  // confirm 은 fixture 가 확인
  await expect.poll(() => app.pending()).toBe(0);
  expect((await app.server(T1)).images ?? []).toEqual([]);
  expect(Object.keys(await app.storageFiles())).toEqual([]);
});

test('목표를 지우면 Storage 의 사진도 함께 지워진다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  await page.locator('.wm-d-img input[type=file]').setInputFiles([file('a.png'), file('b.png')]);
  await expect(app.toast()).toContainText('이미지 2장');
  await expect.poll(() => app.pending()).toBe(0);
  expect(Object.keys(await app.storageFiles())).toHaveLength(4);
  await page.locator('.wm-d-del').click();
  await expect.poll(() => app.pending()).toBe(0);
  expect(await app.server(T1)).toBeNull();
  await expect.poll(() => app.storageFiles().then(f => Object.keys(f).length)).toBe(0);
});

test('30MB 이상은 올리지 않고 안내한다', async ({ app, page }) => {
  await app.open();
  await app.openDetail();
  const big = Buffer.alloc(30 * 1024 * 1024);
  await page.locator('.wm-d-img input[type=file]').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: big });
  await expect(app.toast()).toContainText('30MB');
  expect(Object.keys(await app.storageFiles())).toEqual([]);
});
