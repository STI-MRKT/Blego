const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');

test(
  'TZ21 installed Decoder navigates, formats JSON, extracts embedded Base64, copies, clears and handles error',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz21-decoder-'));
    const store = await openStore(root);
    store.set('tourSeen', true);
    store.close();
    const app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        '--user-data-dir=' + root
      ]
    });
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });

    const page = await app.firstWindow();
    await page.locator('[data-view="decoder"]').click();
    await page
      .locator('#decoder-input')
      .fill(Buffer.from(JSON.stringify({ ok: true }), 'utf8').toString('base64'));
    await page.locator('[data-action="decoder-decode"]').click();
    await waitForAsync(
      page,
      async () => (await import('/js/state.js')).state.decoder.status === 'success'
    );
    assert.equal(await page.locator('#decoder-result').innerText(), '{\n  "ok": true\n}');
    assert.match(
      await page.locator('#decoder-result-panel').innerText(),
      /Уровней декодирования: 1/
    );
    await page.locator('[data-action="decoder-copy"]').click();
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), '{\n  "ok": true\n}');

    const embedded = Buffer.from(JSON.stringify([{ type: 'synthetic', value: 'safe' }])).toString(
      'base64'
    );
    await page
      .locator('#decoder-input')
      .fill('sample@example.test:DEMO_PASS:61500000123456:' + embedded);
    await page.locator('[data-action="decoder-decode"]').click();
    await waitForAsync(
      page,
      async () => (await import('/js/state.js')).state.decoder.status === 'success'
    );
    assert.match(await page.locator('#decoder-result').innerText(), /"type": "synthetic"/);
    assert.doesNotMatch(await page.locator('#decoder-result').innerText(), /DEMO_PASS/);

    await page.locator('#decoder-format').selectOption('base64');
    await page.locator('#decoder-input').fill('this is not valid base64!');
    await page.locator('[data-action="decoder-decode"]').click();
    await waitForAsync(
      page,
      async () => (await import('/js/state.js')).state.decoder.status === 'error'
    );
    assert.match(await page.locator('[role="alert"]').innerText(), /Некорректный Base64/);
    await page.locator('[data-action="decoder-clear"]').click();
    assert.equal(await page.locator('#decoder-input').inputValue(), '');
    assert.equal(await page.locator('[data-action="decoder-copy"]').isDisabled(), true);

    await page.setViewportSize({ width: 430, height: 780 });
    const dimensions = await page.locator('.decoder-grid').evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      columns: getComputedStyle(el).gridTemplateColumns.split(' ').length
    }));
    assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 2);
    assert.equal(dimensions.columns, 1);
  }
);
