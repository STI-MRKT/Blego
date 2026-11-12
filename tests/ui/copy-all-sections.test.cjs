const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const { imageFixture } = require('../fixtures/images.cjs');
test(
  'unified copy: all sections, 51 import rows, selection/filter, formats, privacy, keyboard, image pixels and saved preferences',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-copy-ui-')),
      data = path.join(root, 'data');
    const store = await openStore(data);
    store.set('tourSeen', true);
    let stamp = '2025-01-01T00:00:00Z';
    const classifier =
      require('../../electron/features/classification/service.cjs').createClassificationService({
        allowTestRules: true,
        clock: () => new Date(stamp)
      });
    const archiveService =
      require('../../electron/features/archive/service.cjs').createArchiveService({
        store,
        classification: classifier
      });
    for (const name of ['old.txt', 'new.txt']) {
      const { parseInput } = await import('../../shared/importer.mjs');
      const parsed = await parseInput({
        bytes: Buffer.from('Synthetic ' + name),
        originalName: name
      });
      const operation = classifier.classifyDocument(parsed, {
        testOnly: true,
        version: 'TEST-ONLY-COPY-ORDER',
        classify: (r) => r.data.text
      });
      classifier.confirmClassification(operation.operationId, 'accept_complete');
      await archiveService.saveArchive(operation.operationId);
      stamp = '2025-02-01T00:00:00Z';
    }
    classifier.close();

    store.close();
    const app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${data}`
      ],
      env: {
        ...process.env,
        XDG_CONFIG_HOME: path.join(root, 'config'),
        XDG_CACHE_HOME: path.join(root, 'cache')
      }
    });
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const page = await app.firstWindow(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.locator('[data-action="generate"]').waitFor();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 1280, height: 900 })
    );
    const clip = () => app.evaluate(({ clipboard }) => clipboard.readText());
    async function preview(format = 'json') {
      await page.locator('[data-copy-control="format"]').selectOption(format);
      await page.locator('[data-copy-action="preview"]').click();
      await page.locator('[data-copy-action="commit"]').waitFor();
      await page.locator('[data-copy-action="commit"]').click();
      await page.waitForTimeout(100);
      return clip();
    }
    async function open(view) {
      await page.locator(`[data-view="${view}"]`).click();
      await page.locator('[data-copy-action="open"]').click();
      await page.locator('[data-copy-control="format"]').waitFor();
    }
    await page.locator('[data-action="generate"]').click();
    await page.locator('.demo-card').waitFor();
    await page.locator('[data-copy-action="open"]').click();
    await page.locator('[data-copy-control="format"]').waitFor();
    const profile = JSON.parse(await preview())[0];
    assert.ok(profile.phone && profile.email);
    await page.locator('[data-copy-action="sequence-copy"]').click();
    await page.waitForTimeout(100);
    assert.equal(await clip(), profile[Object.keys(profile)[0]]);
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.copyAction),
      'sequence-copy'
    );
    await page.locator('[data-copy-action="sequence-previous"]').click();
    await page.locator('[data-copy-control="order"]').fill('["name"]');
    const completeProfile = JSON.parse(await preview())[0];
    assert.ok(completeProfile.phone && completeProfile.email, 'full profile must keep contacts');
    await app.evaluate(async ({ clipboard }) => clipboard.writeText('shortcut sentinel'));
    await page.locator('[data-copy-action="open"]').focus();
    await page.keyboard.press('Control+Shift+C');
    await page.waitForTimeout(150);
    assert.ok((await clip()).includes(`phone: ${profile.phone}`));
    const pref = await page.evaluate(() => window.blego.copyPreferences());
    assert.ok(Object.keys(pref).some((k) => k.startsWith('generator-')));
    await page.locator('[data-view="import"]').click();
    await page.locator('#file-input').setInputFiles({
      name: 'synthetic.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'id,name,empty\n' +
          Array.from({ length: 51 }, (_, i) => `00${i},${i === 50 ? '=1+1' : 'row' + i},`).join(
            '\n'
          )
      )
    });
    await page.getByText('rules_pending — Classification rules are not configured').waitFor();
    await page.locator('[data-copy-action="open"]').click();
    await page.locator('[data-copy-control="format"]').waitFor();
    const all = JSON.parse(await preview());
    assert.equal(all.length, 51);
    assert.equal(all[50].id, '0050');
    assert.equal(all[50].empty, '');
    await page.locator('[data-copy-row]').first().check();
    await page.locator('[data-copy-action="next"]').click();
    await page.locator('[data-copy-row]').first().check();
    await page.locator('[data-copy-control="scope"]').selectOption('selected');
    assert.equal(JSON.parse(await preview()).length, 2);
    await page.locator('[data-copy-control="query"]').fill('=1+1');
    await page.locator('[data-copy-action="filter"]').click();
    await page.locator('[data-copy-control="scope"]').selectOption('filter');
    const tsv = await preview('tsv');
    assert.ok(tsv.includes("'=1+1"));
    assert.ok(tsv.includes("'0050"));
    // Native text editing shortcuts remain native; application shortcut is scoped outside editors.
    await page.locator('[data-copy-control="query"]').fill('local text');
    await page
      .locator('[data-copy-control="query"]')
      .press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
    assert.equal(
      await page
        .locator('[data-copy-control="query"]')
        .evaluate((el) => el.value.slice(el.selectionStart, el.selectionEnd)),
      'local text'
    );
    await open('checker');
    await page.locator('[data-copy-action="close"]').click();
    await page.locator('#checker-input').fill('001234567890123456789');
    await page.locator('[data-action="checker-run"]').click();
    await page.locator('#fb-note-status-0').waitFor();
    await page.locator('[data-copy-action="open"]').click();
    const fb = JSON.parse(await preview())[0];
    assert.equal(fb.id, '001234567890123456789');
    assert.equal(fb.banAssessment, 'unknown');
    // Synthetic model fixtures, not claims of a live provider/news request or classification.
    await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.network.proxy = {
        exitIp: '203.0.113.2',
        connection: 'ok',
        timings: { connectionMs: null, ipRequestMs: null, reputationMs: null, totalMs: null },
        assessment: { score: null, factors: [] },
        sources: [],
        password: 'DO-NOT-COPY'
      };
      state.news.topic = 'fashion';
      state.news.lastAttemptAt = new Date().toISOString();
      state.news.items = [
        {
          id: 'news-test',
          title: 'Synthetic article',
          source: 'Local fixture',
          link: 'https://example.com/?token=DO-NOT-COPY',
          description: 'Provided summary',
          topic: 'fashion'
        }
      ];
    });
    await open('network');
    const proxy = await preview();
    assert.ok(proxy.includes('203.0.113.2'));
    assert.ok(!proxy.includes('DO-NOT-COPY'));
    await open('news');
    const news = await preview();
    assert.ok(news.includes('Provided summary'));
    assert.ok(!news.includes('DO-NOT-COPY'));
    assert.ok(!news.includes('body'));
    await page.evaluate(() => {
      const node = document.querySelector('.news-title').firstChild;
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.send('local:news-updated', {
        topic: 'fashion',
        items: [
          {
            id: 'news-next',
            title: 'Updated fixture',
            source: 'Local fixture',
            link: 'https://example.com/new'
          }
        ]
      })
    );
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.getSelection().toString()), 'Synthetic article');
    assert.equal(await page.locator('.news-title').textContent(), 'Synthetic article');
    await page.evaluate(() => window.getSelection().removeAllRanges());

    await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.archiveView = {
        entry: {
          archiveId: 'synthetic-archive',
          originalName: 'Fixture.txt',
          status: 'completed',
          processedAt: '2026-01-01'
        },
        resultText: 'Synthetic confirmed fixture',
        unresolvedText: '',
        diagnostics: '[]'
      };
    });
    await open('history');
    await page.locator('[data-copy-control="personal"]').check();
    assert.ok((await preview()).includes('Synthetic confirmed fixture'));
    await page.locator('[data-action="archive-back"]').click();
    await page.locator('#archive-filter [name="order"]').selectOption('oldest');
    await page.locator('#archive-filter button').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return state.archives.items[0]?.originalName === 'old.txt';
    });
    await page.locator('[data-copy-action="open"]').click();
    await page.locator('[data-copy-control="scope"]').selectOption('filter');
    assert.deepEqual(
      JSON.parse(await preview()).map((r) => r.originalName),
      ['old.txt', 'new.txt']
    );

    const file = await imageFixture(root, 'png');
    await page.locator('[data-view="photos"]').click();
    await app.evaluate(({ dialog }, file) => {
      const original = dialog.showOpenDialog;
      dialog.showOpenDialog = async () => {
        dialog.showOpenDialog = original;
        return { canceled: false, filePaths: [file] };
      };
    }, file);
    await page.locator('[data-action="images-choose"]').click();
    await page.locator('#metadata-form').waitFor();
    await page.locator('[data-copy-action="open"]').click();
    const image = JSON.parse(await preview())[0];
    assert.equal(image.gps, undefined);
    await page.locator('[data-copy-control="personal"]').check();
    assert.ok(JSON.parse(await preview())[0].gps.includes('12.5'));
    await page.locator('[data-action="image-copy"]').click();
    await page
      .getByText('Image pixels copied; metadata is not transferred.', { exact: true })
      .waitFor();
    const bitmap = await app.evaluate(async ({ clipboard, nativeImage }) => {
      const entries = await clipboard.read();
      const blob = await entries
        .find((item) => item.types.includes('image/png'))
        .getType('image/png');
      const image = nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()));
      return {
        empty: image.isEmpty(),
        size: image.getSize(),
        png: image.toPNG().toString('base64')
      };
    });
    assert.equal(bitmap.empty, false);
    assert.deepEqual(bitmap.size, { width: 8, height: 12 });
    const metadata = await require('sharp')(Buffer.from(bitmap.png, 'base64')).metadata();
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.xmp, undefined);
    assert.deepEqual(errors, []);
  }
);
