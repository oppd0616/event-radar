const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/oppd_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4181');
    await page.waitForFunction(() => document.querySelectorAll('#stats .stat').length === 4);
    const before = await page.locator('#rows tr').count();
    await page.route('**/api/refresh', route => route.fulfill({
      status: 502, contentType: 'application/json',
      body: JSON.stringify({ error: '测试连接失败', code: 'CLOUD_CONNECTION_FAILED' })
    }));
    await page.locator('#refresh').click();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('CLOUD_CONNECTION_FAILED'));
    assert.equal(await page.locator('#rows tr').count(), before);
    assert.equal(await page.locator('#refresh').isEnabled(), true);
    await page.unroute('**/api/refresh');
    const synced = page.waitForResponse(response => response.url().endsWith('/api/refresh') && response.request().method() === 'POST', { timeout: 260000 });
    await page.locator('#refresh').click();
    const response = await synced;
    const data = await response.json();
    assert.equal(response.status(), 200);
    assert.equal(data.busy, false);
    await page.waitForFunction(() => document.querySelector('#notice').textContent === '已读取最新数据。');
    assert.equal(await page.locator('#refresh').isEnabled(), true);
    assert.equal(await page.locator('#notice').getAttribute('class'), '');
    assert.ok((await page.locator('#range').innerText()).includes(data.recent.until));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ page: 'ok', failedSyncKeepsRows: true, retry: 'ok', until: data.recent.until,
      fresh: data.recent.freshCount, records: data.records.length, pageErrors: errors }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
