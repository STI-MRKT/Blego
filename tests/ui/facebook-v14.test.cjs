const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'Facebook filter/sort keep individual copies and retry one target without losing other results',
  { timeout: 60000 },
  async (t) => {
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-fb-v14-'));
    const app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${data}`
      ]
    });
    t.after(async () => {
      await app.close();
      fs.rmSync(data, { recursive: true, force: true });
    });
    const page = await app.firstWindow();
    await app.evaluate(({ ipcMain }) => {
      globalThis.v14Calls = [];
      ipcMain.removeHandler('local:facebookCheck');
      ipcMain.handle('local:facebookCheck', async (_e, request) => {
        globalThis.v14Calls.push(request.targets);
        return {
          ok: true,
          value: {
            results: request.targets.map((x, i) => ({
              ...x,
              status: i ? 'LOGIN_REQUIRED' : 'NETWORK_ERROR',
              availability: i ? 'login_required' : 'network_error',
              reasonCode: i ? 'LOGIN_REQUIRED' : 'FB_DNS_ERROR',
              checkedAt: '2026-11-13T06:00:00Z',
              source: 'public_request',
              durationMs: 12,
              banAssessment: 'unknown'
            }))
          }
        };
      });
    });
    await page.locator('[data-view="checker"]').click();
    await page.locator('#checker-input').fill('123\n456');
    await page.locator('[data-action="checker-run"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.checker.checking && state.checker.rows?.every((r) => r.check);
    });
    assert.equal(await page.locator('#checker-status-filter').count(), 1);
    await page.locator('#checker-status-filter').selectOption('LOGIN_REQUIRED');
    assert.equal(await page.locator('.checker-row').count(), 1);
    await page.getByRole('button', { name: 'Copy Facebook ID', exact: true }).click();
    await page.waitForTimeout(100);
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), '456');
    await page.locator('[data-action="checker-retry-one"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.checker.checking;
    });
    const calls = await app.evaluate(() => globalThis.v14Calls);
    assert.equal(calls[1].length, 1);
    assert.equal(calls[1][0].canonicalUrl, 'https://www.facebook.com/profile.php?id=456');
    await page.locator('#checker-status-filter').selectOption('');
    await page.locator('#checker-sort').selectOption('id-desc');
    assert.equal(await page.locator('.checker-row').count(), 2);
    await page.locator('.checker-row details summary').first().click();
    assert.ok((await page.locator('.checker-row').first().innerText()).includes('DNS'));
    assert.ok((await page.locator('.checker-row').first().innerText()).includes('09:00'));
    await page.locator('[data-view="import"]').click();
    await page.locator('#file-input').setInputFiles({
      name: 'synthetic.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'id:123::name:Локальное Имя::password:FAKE_NOT_FOR_FACEBOOK::AVA https://example.test/avatar.jpg'
      )
    });
    await page.locator('[data-action="classifier-details"][data-row="1"]').click();
    await page.locator('[data-action="classifier-facebook-link"]').click();
    await page.locator('[data-view="checker"]').click();
    await page.locator('#checker-input').fill('123');
    await page.locator('[data-action="checker-run"]').click();
    await page
      .getByText('Из импортированного файла; не проверено Facebook', { exact: true })
      .waitFor();
    assert.ok((await page.locator('.checker-row').innerText()).includes('Локальное Имя'));
    const actualRequests = JSON.stringify(await app.evaluate(() => globalThis.v14Calls));
    assert.ok(!actualRequests.includes('FAKE_NOT_FOR_FACEBOOK'));
    assert.ok(!actualRequests.includes('Локальное Имя'));
  }
);
