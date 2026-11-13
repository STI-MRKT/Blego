const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'Generator adjacent phone copies only national digits while address order and saved full profiles survive resize and restart',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-phone-ui-'));
    const store = await openStore(root);
    store.set('tourSeen', true);
    store.close();
    const launch = () =>
      _electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE || undefined,
        args: [
          ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
          ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
          `--user-data-dir=${root}`
        ]
      });
    let app = await launch(),
      page = await app.firstWindow();
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    async function clip(expected) {
      for (let i = 0; i < 80; i++) {
        if ((await app.evaluate(({ clipboard }) => clipboard.readText())) === expected) return;
        await page.waitForTimeout(25);
      }
      assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), expected);
    }
    let last;
    for (const [country, dial] of Object.entries({
      BR: '55',
      US: '1',
      FR: '33',
      PL: '48',
      DE: '49',
      ES: '34',
      IT: '39',
      GB: '44'
    })) {
      await page.locator('[data-input="locale"]').selectOption(country);
      await page.locator('[data-action="generate"]').click();
      await waitForAsync(page, async () => {
        const { state } = await import('/js/state.js');
        return !!state.demo && !state.demoBusy;
      });
      last = await page.evaluate(() => window.blego.lastCard());
      assert.equal(last.country, country);
      const number = last.fields.phone;
      assert.ok(number.startsWith('+' + dial));
      for (const width of [1280, 360]) {
        await app.evaluate(
          ({ BrowserWindow }, width) =>
            BrowserWindow.getAllWindows()[0].setBounds({ width, height: 720 }),
          width
        );
        const order = await page
          .locator('.demo-right .fields [data-field]')
          .evaluateAll((els) =>
            els
              .map((el) => el.dataset.field)
              .filter((k) => ['address', 'city', 'postalCode'].includes(k))
          );
        assert.deepEqual(order, ['address', 'city', 'postalCode']);
        const shown = await page.locator('.field-phone .field-value').innerText();
        assert.equal(shown.replace(/\D/g, ''), number.replace(/\D/g, ''));
        // A new country choice must not alter copying from the already displayed profile.
        await page.locator('[data-input="locale"]').selectOption(country === 'US' ? 'GB' : 'US');
        await page.getByRole('button', { name: 'Copy phone', exact: true }).click();
        await clip(number.replace(/\D/g, '').slice(dial.length));
        await page.getByText('Номер скопирован', { exact: true }).last().waitFor();
        for (const field of ['address', 'city', 'postalCode']) {
          await page.locator(`.demo-right [data-field="${field}"]`).click();
          await clip(String(last.fields[field]));
        }
        await page.locator('.ux-copy-set').click();
        await clip(
          last.fieldOrder
            .map(
              (k) =>
                `${k}: ${Array.isArray(last.fields[k]) ? last.fields[k].join(', ') : last.fields[k]}`
            )
            .join('\n')
        );
        assert.deepEqual(await page.evaluate(() => window.blego.lastCard()), last);
      }
    }
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.locator('.demo-card').waitFor();
    assert.deepEqual(await page.evaluate(() => window.blego.lastCard()), last);
  }
);
