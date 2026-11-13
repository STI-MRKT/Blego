const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const { imageFixture } = require('../fixtures/images.cjs');
const { formatA, cookie } = require('../fixtures/classifier-v14.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
const widths = [360, 390, 427, 480, 504, 576, 768, 980, 1280];
test(
  'native window resizes across all nine sections without overflow, lost forms or inaccessible navigation',
  { timeout: 180000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-responsive-'));
    const store = await openStore(root);
    store.set('tourSeen', true);
    store.close();
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
    await page.locator('[data-action="generate"]').waitFor();
    const env = await app.evaluate(({ BrowserWindow, screen }) => ({
      os: process.platform,
      arch: process.arch,
      workArea: screen.getPrimaryDisplay().workArea,
      minimum: BrowserWindow.getAllWindows()[0].getMinimumSize()
    }));
    assert.ok(env.minimum[0] <= 360, JSON.stringify(env));
    const evidence = { ...env, widths: [] };
    async function resize(width) {
      const bounds = await app.evaluate(({ BrowserWindow }, width) => {
        const w = BrowserWindow.getAllWindows()[0];
        w.setBounds({ x: 0, y: 0, width, height: 720 });
        return w.getBounds();
      }, width);
      await page.waitForFunction((w) => Math.abs(window.outerWidth - w) < 2, width);
      assert.equal(bounds.width, width);
      return bounds;
    }
    await page.locator('[data-action="generate"]').click();
    await page.locator('.demo-card').waitFor();
    const original = await page.evaluate(() => window.blego.lastCard());
    await page.locator('[data-view="import"]').click();
    await page.locator('#file-input').setInputFiles({
      name: 'synthetic.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(formatA())
    });
    await page.locator('[data-classifier-status]').waitFor();
    await page.locator('#classifier-extra summary').click();
    await page.locator('[data-action="classifier-archive"]').click();
    await page.getByRole('button', { name: 'Сохранено в архиве', exact: true }).waitFor();
    await page.locator('[data-view="photos"]').click();
    const photo = await imageFixture(root, 'jpeg');
    await page.locator('#photo-input').setInputFiles(photo);
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return state.photos.length === 1 && !state.imagesBusy;
    });
    await page.locator('#geo-country').fill('FR');
    await page.locator('#geo-country').press('Tab');
    await page.locator('#geo-city').selectOption('osm:relation:71525');
    await page.locator('[data-action="geo-generate"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.geoBusy && Object.keys(state.imageWorkspace.overrides).length === 1;
    });
    const geo = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.imageWorkspace.overrides;
    });

    for (const width of widths) {
      const bounds = await resize(width),
        sections = [];
      for (const view of [
        'generator',
        'import',
        'news',
        'network',
        'photos',
        'friends',
        'checker',
        'settings',
        'history'
      ]) {
        await page.locator(`[data-view="${view}"]`).click();
        await page.waitForTimeout(120);
        if (width === 360)
          await page.locator('.content details').evaluateAll((elements) =>
            elements.forEach((el) => {
              el.open = true;
            })
          );
        const layout = await page.evaluate(() => {
          const content = document.querySelector('.content'),
            c = content.getBoundingClientRect();
          const clipped = [
            ...content.querySelectorAll('button,input:not([type=hidden]),select,textarea')
          ]
            .filter((el) => el.getClientRects().length && !el.closest('.table-wrap'))
            .map((el) => ({ el, r: el.getBoundingClientRect() }))
            .filter(({ r }) => r.left < c.left - 1 || r.right > c.right + 1)
            .map(({ el, r }) => ({
              tag: el.tagName,
              text: (el.textContent || el.id).slice(0, 100),
              left: r.left,
              right: r.right
            }));
          const icons = [...document.querySelectorAll('.nav-item svg')].map((el) => {
            const r = el.getBoundingClientRect(),
              p = el.closest('.sidebar').getBoundingClientRect();
            return r.width >= 15 && r.left >= p.left && r.right <= p.right;
          });
          return {
            width: innerWidth,
            document: document.scrollingElement.scrollWidth,
            scroll: content.scrollWidth,
            client: content.clientWidth,
            clipped,
            icons
          };
        });
        assert.ok(
          layout.document <= layout.width + 1,
          `${width}/${view}: document overflow ${JSON.stringify(layout)}`
        );
        assert.ok(
          layout.scroll <= layout.client + 1,
          `${width}/${view}: content overflow ${JSON.stringify(layout)}`
        );
        assert.deepEqual(layout.clipped, [], `${width}/${view}: clipped controls`);
        assert.ok(layout.icons.every(Boolean), `${width}/${view}: clipped icons`);
        assert.equal(
          await page.locator(`[data-view="${view}"]`).getAttribute('aria-current'),
          'page'
        );
        sections.push(view);
      }
      evidence.widths.push({ requested: width, bounds, sections });
    }
    await resize(360);
    await page.locator('[data-view="import"]').click();
    await page.locator('[data-action="import-cookie-copy"]').first().click();
    for (let i = 0; i < 80; i++) {
      if (
        (await app.evaluate(({ clipboard }) => clipboard.readText())) ===
        cookie('00010001').replace('},', '},\n')
      )
        break;
      await page.waitForTimeout(25);
    }
    assert.equal(
      await app.evaluate(({ clipboard }) => clipboard.readText()),
      cookie('00010001').replace('},', '},\n')
    );
    await page.locator('[data-view="photos"]').click();
    await page.locator('[name="action-captureDate"]').selectOption('set');
    await page.locator('[name="date-local"]').fill('2025-03-04T12:30');
    for (const w of [1280, 390, 360]) await resize(w);
    assert.equal(await page.locator('[name="date-local"]').inputValue(), '2025-03-04T12:30');
    assert.deepEqual(
      await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        return state.imageWorkspace.overrides;
      }),
      geo
    );
    await app.evaluate(({ dialog }, root) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] });
    }, root);
    await page.getByRole('button', { name: 'Preview changes', exact: true }).click();
    await page.locator('[data-metadata-plan]').waitFor();
    await page.getByRole('button', { name: 'Save copies', exact: true }).click();
    await resize(480);
    await resize(360);
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return (
        !state.imagesBusy && state.metadataExport?.files.every((f) => f.status === 'completed')
      );
    });

    const toggle = page.locator('[data-action="menu-toggle"]');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await page.locator('.credit').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await page.locator('[data-view="checker"]').click();
    const input = page.locator('textarea').first();
    await input.fill('https://www.facebook.com/100000000000001');
    for (const w of [1280, 390, 768, 360]) await resize(w);
    assert.equal(await input.inputValue(), 'https://www.facebook.com/100000000000001');
    await page.locator('[data-view="generator"]').click();
    assert.deepEqual(await page.evaluate(() => window.blego.lastCard()), original);
    await page.locator('.demo-left [data-field="name"]').click();
    for (let i = 0; i < 80; i++) {
      if ((await app.evaluate(({ clipboard }) => clipboard.readText())) === original.fields.name)
        break;
      await page.waitForTimeout(25);
    }
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), original.fields.name);
    await page.locator('[data-action="generate"]').click();
    await page.locator('.demo-card').waitFor();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.demoBusy;
    });
    assert.notEqual((await page.evaluate(() => window.blego.lastCard())).id, original.id);
    if (process.env.BLEGO_CAPTURE) {
      fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
      for (const w of [360, 480, 980, 1280]) {
        await resize(w);
        await page.evaluate(() => document.querySelector('.toasts')?.replaceChildren());
        await page.waitForTimeout(650);
        await page.screenshot({
          path: path.join(process.env.BLEGO_CAPTURE, `responsive-${w}.png`)
        });
      }
      fs.writeFileSync(
        path.join(process.env.BLEGO_CAPTURE, 'responsive-native.json'),
        JSON.stringify(evidence, null, 2)
      );
    }
  }
);
