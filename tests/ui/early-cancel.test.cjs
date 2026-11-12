const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'early Cancel prevents proxy/news startup and late topic snapshots after settings await',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-early-cancel-'));
    fs.writeFileSync(path.join(root, 'blego-state.json'), JSON.stringify({ tourSeen: true }));
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
    await app.evaluate(({ ipcMain }) => {
      globalThis.cancelFixture = { proxy: 0, news: 0, pending: false };
      ipcMain.removeHandler('local:settingsUpdate');
      ipcMain.handle('local:settingsUpdate', async (_e, patch) => {
        globalThis.cancelFixture.pending = true;
        await new Promise((resolve) => (globalThis.releaseSettings = resolve));
        globalThis.cancelFixture.pending = false;
        return { ok: true, value: { ...patch, newsEnabled: true, proxyEnabled: true } };
      });
      ipcMain.removeHandler('local:proxyCheck');
      ipcMain.handle('local:proxyCheck', () => {
        globalThis.cancelFixture.proxy++;
        return { ok: true, value: { connection: 'ok', ip: '8.8.8.8' } };
      });
      ipcMain.removeHandler('local:newsRefresh');
      ipcMain.handle('local:newsRefresh', (_e, { topic }) => {
        globalThis.cancelFixture.news++;
        return {
          ok: true,
          value: { topic, items: [], sourceStates: {}, lastAttemptAt: new Date().toISOString() }
        };
      });
    });
    const waitPending = async () => {
      for (let i = 0; i < 100; i++) {
        if (await app.evaluate(() => globalThis.cancelFixture.pending)) return;
        await page.waitForTimeout(10);
      }
      throw Error('No delayed settings');
    };
    await page.locator('#proxy-input').fill('http://8.8.8.8:8080');
    await page.locator('[data-action="proxy-check"]').click();
    await waitPending();
    await page.locator('[data-action="proxy-cancel"]').click();
    await app.evaluate(() => globalThis.releaseSettings());
    await page.waitForTimeout(150);
    assert.equal(
      await app.evaluate(() => globalThis.cancelFixture.proxy),
      0,
      'no proxy request starts after early Cancel'
    );
    await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.settings.newsEnabled = false;
    });
    await page.locator('[data-view="news"]').click();
    await waitPending();
    await page.locator('[data-action="news-cancel"]').click();
    await app.evaluate(() => globalThis.releaseSettings());
    await page.waitForTimeout(150);
    assert.equal(
      await app.evaluate(() => globalThis.cancelFixture.news),
      0,
      'no news request starts after early Cancel'
    );
    await waitForAsync(page, async () => !(await import('/js/state.js')).state.news.loading);
    await page.locator('#news-topic').selectOption('tech');
    await waitPending();
    await page.locator('[data-action="news-cancel"]').click();
    await app.evaluate(() => globalThis.releaseSettings());
    await page.waitForTimeout(150);
    assert.equal(
      await app.evaluate(() => globalThis.cancelFixture.news),
      0,
      'cancelled topic snapshot cannot restart refresh'
    );
    await waitForAsync(page, async () => !(await import('/js/state.js')).state.news.loading);
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('local:settingsUpdate');
      ipcMain.handle('local:settingsUpdate', (_e, patch) => ({
        ok: true,
        value: { ...patch, newsEnabled: true }
      }));
      ipcMain.removeHandler('local:newsSnapshot');
      ipcMain.handle(
        'local:newsSnapshot',
        (_e, topic) =>
          new Promise((resolve) => {
            globalThis.cancelFixture.pending = true;
            globalThis.releaseSnapshot = () => {
              globalThis.cancelFixture.pending = false;
              resolve({ ok: true, value: { topic, items: [], sourceStates: {} } });
            };
          })
      );
    });
    await page.locator('#news-topic').selectOption('ai');
    await waitPending();
    await page.locator('[data-action="news-cancel"]').click();
    await app.evaluate(() => globalThis.releaseSnapshot());
    await page.waitForTimeout(150);
    assert.equal(
      await app.evaluate(() => globalThis.cancelFixture.news),
      0,
      'late snapshot cannot restart cancelled topic'
    );
    await waitForAsync(page, async () => !(await import('/js/state.js')).state.news.loading);
  }
);
