// 세 화면에서 깨지지 않는지: 폴드7 접은 화면(360) · 펼친 화면(750, 목록|상세) · 탭 S7+ 가로(1280, 목록|상세 두 단)
const { test, expect, sampleTask, seedWith } = require('./fixtures');

const SCREENS = [
  { name: '폴드 접은 화면', width: 360, height: 800, split: false },
  { name: '폴드 펼친 화면', width: 750, height: 830, split: true },
  { name: '탭 가로', width: 1280, height: 800, split: true },
];

for (const s of SCREENS) {
  test(`${s.name} ${s.width}×${s.height}: 목록·상세·안내가 가로로 넘치지 않는다`, async ({ app, page }, testInfo) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await app.open(seedWith([
      sampleTask({ id: 'a', title: '첫 번째 연습 목표 — 제목이 꽤 길어서 한 줄을 넘칠 수도 있는 경우를 봅니다', dueDate: '2030-01-15' }),
      sampleTask({ id: 'b', title: '둘째', category: '건강', status: '대기', dueDate: null }),
      sampleTask({ id: 'c', title: '셋째', category: '투자', status: '보류', dueDate: '2029-12-31' }),
    ]));
    expect(await page.locator('.wm-split').count()).toBe(s.split ? 1 : 0);
    await page.locator('.wm-card').first().click();
    await expect(page.locator('.wm-d-log')).toBeVisible();
    await app.setOnline(false);
    await app.addLog('오프라인 기록');
    await expect(app.notice()).toBeVisible();
    const over = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(over.sw, '가로 스크롤이 생기면 안 된다').toBeLessThanOrEqual(over.iw);
    // 안내 줄이 새 과제 버튼(＋)을 가리지 않는다
    const fab = await page.locator('.wm-fab').boundingBox();
    const notice = await app.notice().boundingBox();
    expect(notice.y, '안내 줄은 ＋ 버튼 아래에 있어야 한다').toBeGreaterThanOrEqual(fab.y + fab.height - 4);
    await page.screenshot({ path: testInfo.outputPath(`${s.width}x${s.height}.png`), fullPage: false });
    await app.setOnline(true);
    await expect.poll(() => app.pending()).toBe(0);
    await expect(app.notice()).toHaveCount(0);
  });
}
