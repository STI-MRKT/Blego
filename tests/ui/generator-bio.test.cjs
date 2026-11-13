const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const { updateSettings } = require('../../electron/local/settings.cjs');
const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
const { generateProfile } = require('../../electron/features/generator/service.cjs');
const fixtureNames = new Set();
function pool(country, city, index = 0) {
  const p = resolvePreset(country, 'model');
  const hubPostals = {
    BR: '01310-100',
    US: '10001',
    FR: '75001',
    PL: '00-001',
    DE: '10115',
    ES: '28001',
    IT: '20121',
    GB: 'EC1A 1BB'
  };
  const smallPostals = {
    BR: '38540-000',
    US: '16820',
    FR: '64460',
    PL: '83-440',
    DE: '78267',
    ES: '10748',
    IT: '35031',
    GB: 'DE45 1DS'
  };
  let surnameIndex = index;
  while (fixtureNames.has(`${p.first[0]} ${p.last[surnameIndex]}`)) surnameIndex++;
  assert.ok(p.last[surnameIndex]);
  const name = `${p.first[0]} ${p.last[surnameIndex]}`;
  fixtureNames.add(name);
  return [
    {
      name,
      phone: `+${p.phonePrefix}${String(index + 1).padStart(p.phoneDigits, '0')}`,
      email: `synthetic-bio-${country}-${index}@example.invalid`,
      handle: `synthetic-bio-${country}-${index}`,
      city,
      postalCode: index === 0 ? hubPostals[country] : smallPostals[country]
    }
  ];
}
async function fixture(t, settings = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-bio-ui-')),
    data = path.join(root, 'data');
  const store = await openStore(data);
  store.set('tourSeen', true);
  updateSettings(store, settings);
  store.close();
  let app;
  async function launch() {
    app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${data}`
      ]
    });
    return app.firstWindow();
  }
  t.after(async () => {
    if (app) {
      await app
        .evaluate(({ ipcMain }) => {
          if (globalThis.bioOriginal)
            ipcMain._invokeHandlers.set('local:biography', globalThis.bioOriginal);
          if (globalThis.bioTransitionOriginal)
            ipcMain._invokeHandlers.set(
              globalThis.bioTransitionChannel,
              globalThis.bioTransitionOriginal
            );
          globalThis.bioRelease?.();
          globalThis.bioTransitionRelease?.();
          globalThis.bioSuggestionRelease?.();
        })
        .catch(() => {});
      await app.close().catch(() => {});
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
  return {
    data,
    launch,
    get app() {
      return app;
    },
    forget() {
      app = null;
    }
  };
}
async function waitForStored(page, predicate, arg) {
  const deadline = Date.now() + 10000;
  do {
    const profile = await page.evaluate(() => window.blego.lastCard());
    if (predicate(profile, arg)) return profile;
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (Date.now() < deadline);
  assert.fail('Expected persisted BIO/profile was not observed within 10 seconds');
}
async function saved(page, field, value) {
  return waitForStored(page, (p) => p?.biography?.[field] === value);
}

test(
  'BIO automatically fills, autosaves edits/copies, preserves concurrent typing, tabs, 360px and quit/restart',
  { timeout: 90000 },
  async (t) => {
    const f = await fixture(t, {
      country: 'GB',
      type: 'model',
      overrides: { common: { pool: pool('GB', 'London') } }
    });
    let page = await f.launch();
    await page.locator('[data-action="generate"]').click();
    await page.locator('.demo-card').waitFor();
    const profile = await page.evaluate(() => window.blego.lastCard());
    for (const value of Object.values(profile.biography)) assert.ok(value);
    await page.locator('[data-tab="bio"]').click();
    await page.locator('#bio-residence').waitFor();
    assert.equal(await page.locator('[data-action="bio-save"]').count(), 0);
    assert.equal(await page.locator('[data-action="bio-retry"]').isVisible(), false);
    for (const [field, value] of Object.entries(profile.biography))
      assert.equal(await page.locator(`#bio-${field}`).inputValue(), value);
    await page.locator('#bio-birthplace').fill('Manual birthplace');
    await page.locator('[data-tab="profile"]').click();
    await page.locator('[data-tab="bio"]').click();
    assert.equal(await page.locator('#bio-birthplace').inputValue(), 'Manual birthplace');
    await saved(page, 'birthplace', 'Manual birthplace');
    for (const field of Object.keys(profile.biography)) {
      const value = `Synthetic manual ${field} 00 🧠`;
      await page.locator(`#bio-${field}`).fill(value);
      await page.locator(`[data-action="bio-copy"][data-field="${field}"]`).click();
      assert.equal(await f.app.evaluate(({ clipboard }) => clipboard.readText()), value);
    }
    await saved(page, 'mainBio', 'Synthetic manual mainBio 00 🧠');
    // Delay a real IPC save while the user continues typing. No disabled inputs or lost draft.
    await f.app.evaluate(({ ipcMain }) => {
      globalThis.bioOriginal = ipcMain._invokeHandlers.get('local:biography');
      ipcMain._invokeHandlers.set('local:biography', async (event, arg) => {
        if (arg?.action === 'save' && !globalThis.bioDelayed) {
          globalThis.bioDelayed = true;
          await new Promise((resolve) => {
            globalThis.bioRelease = resolve;
          });
        }
        return globalThis.bioOriginal(event, arg);
      });
    });
    await page.locator('#bio-mainBio').fill('First pending edit');
    await page.waitForFunction(
      () => document.querySelector('.biography [role=status]').textContent === 'Сохраняем…'
    );
    assert.equal(await page.locator('#bio-mainBio').isEnabled(), true);
    await page.locator('#bio-mainBio').fill('Latest edit during save');
    await f.app.evaluate(() => globalThis.bioRelease());
    await saved(page, 'mainBio', 'Latest edit during save');
    assert.equal(await page.locator('#bio-mainBio').inputValue(), 'Latest edit during save');
    await f.app.evaluate(({ ipcMain }) =>
      ipcMain._invokeHandlers.set('local:biography', globalThis.bioOriginal)
    );
    // Each field can be regenerated; employer regeneration keeps its dependent position compatible.
    for (const field of Object.keys(profile.biography)) {
      await page.locator(`[data-action="bio-regenerate"][data-field="${field}"]`).click();
      await page.waitForFunction(
        (field) =>
          !document.querySelector(`[data-action="bio-regenerate"][data-field="${field}"]`).disabled,
        field
      );
    }
    await saved(page, 'residence', 'London, United Kingdom');
    await page.locator('#bio-mainBio').fill('My synthetic BIO 🧠');
    await page.locator('[data-view="news"]').click();
    await page.locator('[data-view="generator"]').click();
    assert.equal(await page.locator('#bio-mainBio').inputValue(), 'My synthetic BIO 🧠');
    await saved(page, 'mainBio', 'My synthetic BIO 🧠');
    assert.deepEqual((await page.evaluate(() => window.blego.lastCard())).fields, profile.fields);
    for (const width of [1280, 360]) {
      await f.app.evaluate(
        ({ BrowserWindow }, width) =>
          BrowserWindow.getAllWindows()[0].setBounds({ width, height: 900 }),
        width
      );
      await page.waitForFunction((width) => innerWidth === width, width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (process.env.BLEGO_CAPTURE) {
        await page.waitForFunction(() => !document.querySelector('.toast'));
        fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
        await page.screenshot({
          path: path.join(process.env.BLEGO_CAPTURE, `bio-${width === 1280 ? 'wide' : '360'}.png`)
        });
      }
    }
    // Explicit native Quit immediately after input, before the debounce fires.
    await page.locator('#bio-mainBio').fill('Last keystroke before native quit');
    const closed = f.app.waitForEvent('close');
    await f.app.evaluate(({ app }) => {
      setTimeout(() => app.quit(), 0);
    });
    await closed;
    f.forget();
    page = await f.launch();
    await page.locator('[data-tab="bio"]').click();
    assert.equal(
      await page.locator('#bio-mainBio').inputValue(),
      'Last keystroke before native quit'
    );
    assert.equal(await page.locator('#bio-residence').inputValue(), 'London, United Kingdom');
  }
);
test(
  'BIO failed autosave retains draft, blocks normal window close, retries and flushes last input on close',
  { timeout: 60000 },
  async (t) => {
    const f = await fixture(t, { country: 'GB', type: 'model' });
    let store = await openStore(f.data);
    await generateProfile({ requestId: 'seed', country: 'GB', type: 'model' }, { store });
    store.close();
    let page = await f.launch();
    await page.locator('[data-tab="bio"]').click();
    const before = await page.evaluate(() => window.blego.lastCard());
    await f.app.evaluate(({ ipcMain }) => {
      globalThis.bioOriginal = ipcMain._invokeHandlers.get('local:biography');
      ipcMain._invokeHandlers.set('local:biography', (event, arg) =>
        arg?.action === 'save'
          ? { ok: false, code: 'SQLITE_FULL' }
          : globalThis.bioOriginal(event, arg)
      );
    });
    await page.locator('#bio-mainBio').fill('Retain failed draft');
    await page.locator('[data-view="news"]').click();
    await page
      .getByText(
        'Не удалось сохранить BIO. Введённые данные сохранены на экране; повторите попытку.',
        { exact: true }
      )
      .waitFor({ timeout: 3000 });
    await page.locator('[data-view="generator"]').click();
    await page.locator('[data-action="bio-retry"]').waitFor();
    assert.deepEqual(await page.evaluate(() => window.blego.lastCard()), before);
    await f.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await page
      .getByText('BIO не сохранено. Закрытие отменено; повторите сохранение.', { exact: true })
      .waitFor();
    assert.equal(
      await f.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
      1
    );
    assert.equal(await page.locator('#bio-mainBio').inputValue(), 'Retain failed draft');
    assert.equal(await page.evaluate(() => document.body.inert), false);
    await f.app.evaluate(({ ipcMain }) =>
      ipcMain._invokeHandlers.set('local:biography', globalThis.bioOriginal)
    );
    await page.locator('[data-action="bio-retry"]').click();
    await saved(page, 'mainBio', 'Retain failed draft');
    await page.locator('#bio-mainBio').fill('Last keystroke before window close');
    const closed = page.waitForEvent('close');
    await f.app.evaluate(({ BrowserWindow }) => {
      setTimeout(() => BrowserWindow.getAllWindows()[0].close(), 0);
    });
    await closed;
    if (process.platform === 'darwin') await f.app.close();
    f.forget();
    page = await f.launch();
    await page.locator('[data-tab="bio"]').click();
    assert.equal(
      await page.locator('#bio-mainBio').inputValue(),
      'Last keystroke before window close'
    );
  }
);
test(
  'BIO real catalog fills all eight country hubs and leaves sparse towns empty through real generator IPC',
  { timeout: 90000 },
  async (t) => {
    const f = await fixture(t);
    const page = await f.launch();
    const hubs = {
      BR: 'São Paulo',
      US: 'New York',
      FR: 'Paris',
      PL: 'Warszawa',
      DE: 'Berlin',
      ES: 'Madrid',
      IT: 'Milano',
      GB: 'London'
    };
    const smallTowns = {
      BR: 'Abadia dos Dourados',
      US: 'Aaronsburg',
      FR: 'Aast',
      PL: 'Abisynia',
      DE: 'Aach',
      ES: 'Abadía',
      IT: 'Abano Terme',
      GB: 'Bakewell'
    };
    for (const [country, city] of Object.entries(hubs))
      for (const [index, town] of [city, smallTowns[country]].entries()) {
        await page.evaluate(
          async ({ country, rows }) =>
            window.blego.updateSettings({
              country,
              type: 'model',
              overrides: { common: { pool: rows } }
            }),
          { country, rows: pool(country, town, index) }
        );
        await page.locator('[data-input="locale"]').selectOption(country);
        await page.locator('[data-action="generate"]').click();
        await waitForStored(page, (p) => p?.country === country && p?.fields.city === town).catch(
          (error) => {
            error.message += ` (${country}/${town})`;
            throw error;
          }
        );
        await page.locator('.demo-card').waitFor();
        await page.waitForFunction(
          () => !document.querySelector('[data-action="generate"]').disabled
        );
        await page.locator('[data-tab="bio"]').click();
        await page.locator('#bio-residence').waitFor();
        for (const field of ['employer', 'position', 'university', 'school']) {
          const value = await page.locator(`#bio-${field}`).inputValue();
          if (index === 0) assert.ok(value, `${country}/${field}`);
          else assert.equal(value, '', `${country}/${field}`);
        }
      }
  }
);
test(
  'BIO replacement and clear freeze inputs while IPC is pending and retain the last saved history',
  { timeout: 60000 },
  async (t) => {
    const f = await fixture(t, { country: 'GB', type: 'model' });
    const seed = await openStore(f.data);
    await generateProfile(
      { requestId: 'transition-seed', country: 'GB', type: 'model' },
      { store: seed }
    );
    seed.close();
    const page = await f.launch();
    await page.locator('[data-tab="bio"]').click();
    for (const action of ['generate', 'clear-demo']) {
      const before = await page.evaluate(() => window.blego.lastCard());
      await page.locator('#bio-mainBio').fill(`saved before ${action}`);
      await f.app.evaluate(({ ipcMain }, action) => {
        const channel = action === 'generate' ? 'local:generate' : 'local:clearCard';
        globalThis.bioTransitionChannel = channel;
        globalThis.bioTransitionOriginal = ipcMain._invokeHandlers.get(channel);
        ipcMain._invokeHandlers.set(channel, async (event, arg) => {
          await new Promise((resolve) => {
            globalThis.bioTransitionRelease = resolve;
          });
          return globalThis.bioTransitionOriginal(event, arg);
        });
      }, action);
      await page.locator(`[data-action="${action}"]`).click();
      assert.equal(await page.locator('#bio-mainBio').isEnabled(), false);
      // Even a queued input event must not enter the frozen old-profile editor.
      await page.locator('#bio-mainBio').evaluate((el) => {
        el.value = 'late input';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await saved(page, 'mainBio', `saved before ${action}`);
      await f.app.evaluate(() => globalThis.bioTransitionRelease());
      await f.app.evaluate(({ ipcMain }) =>
        ipcMain._invokeHandlers.set(
          globalThis.bioTransitionChannel,
          globalThis.bioTransitionOriginal
        )
      );
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(path.join(f.data, 'local.sqlite'), { readOnly: true });
      const persisted = JSON.parse(
        db.prepare('SELECT profile FROM requests WHERE profile_id=?').get(before.id).profile
      );
      db.close();
      assert.equal(persisted.biography.mainBio, `saved before ${action}`);
      if (action === 'generate') {
        await page.locator('.demo-card').waitFor();
        await page.locator('[data-tab="bio"]').click();
      } else await page.waitForFunction(() => !document.querySelector('[data-tab="bio"]'));
    }
  }
);
test(
  'BIO native quit waits for an already requested regeneration and persists its result',
  { timeout: 45000 },
  async (t) => {
    const expected = 'Synthetic BIO requested before quit';
    const f = await fixture(t, {
      country: 'GB',
      type: 'model',
      overrides: { common: { bios: [expected] } }
    });
    const seed = await openStore(f.data);
    await generateProfile(
      { requestId: 'pending-suggestion', country: 'GB', type: 'model' },
      { store: seed }
    );
    seed.close();
    let page = await f.launch();
    await page.locator('[data-tab="bio"]').click();
    await page.locator('#bio-mainBio').fill('Before regeneration');
    await saved(page, 'mainBio', 'Before regeneration');
    await f.app.evaluate(({ ipcMain }) => {
      globalThis.bioOriginal = ipcMain._invokeHandlers.get('local:biography');
      ipcMain._invokeHandlers.set('local:biography', async (event, arg) => {
        if (arg?.action === 'suggest')
          await new Promise((resolve) => {
            globalThis.bioSuggestionRelease = resolve;
          });
        return globalThis.bioOriginal(event, arg);
      });
    });
    await page.locator('[data-action="bio-regenerate"][data-field="mainBio"]').click();
    await f.app.evaluate(({ app }) => app.quit());
    await page.waitForFunction(() => document.body.inert);
    assert.equal(
      await f.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
      1
    );
    const closed = f.app.waitForEvent('close');
    await f.app.evaluate(() => globalThis.bioSuggestionRelease());
    await closed;
    f.forget();
    page = await f.launch();
    await page.locator('[data-tab="bio"]').click();
    assert.equal(await page.locator('#bio-mainBio').inputValue(), expected);
  }
);
