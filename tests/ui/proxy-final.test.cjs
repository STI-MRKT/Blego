const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
test(
  'proxy UI keeps original gauge, plaintext input, explicit reputation and honest blocked result',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-proxy-ui-'));
    const app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${root}`
      ]
    });
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const page = await app.firstWindow();
    await page.locator('[data-view="network"]').click();
    assert.equal(await page.locator('.gauge').isVisible(), true);
    assert.equal(await page.locator('#proxy-input').getAttribute('type'), 'text');
    assert.equal(await page.locator('#proxy-reputation').isChecked(), false);
    await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.settings = await window.blego.updateSettings({ proxyEnabled: true });
    });
    await page.locator('[data-view="generator"]').click();
    await page.locator('[data-view="network"]').click();
    await page.locator('#proxy-input').fill('http://user:synthetic-password@127.0.0.1:80');
    await page.locator('[data-action="proxy-check"]').click();
    await page.getByText('Ошибка подключения', { exact: true }).waitFor();
    assert.match(await page.locator('.proxy-result').innerText(), /REQUEST_BLOCKED/);
    assert.doesNotMatch(await page.locator('.proxy-result').innerText(), /synthetic-password/);
    assert.equal(
      await page
        .locator('.risk-score')
        .allTextContents()
        .then((x) => x.every((v) => v === 'Нет данных')),
      true
    );
  }
);
