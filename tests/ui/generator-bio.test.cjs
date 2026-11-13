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
const {
  createBiographyWorkspace
} = require('../../electron/features/generator/biography-workspace.cjs');
const london = { country: 'GB', city: 'London', postalCode: 'EC1A 1BB', type: 'model' };
function seedBio(store) {
  return createBiographyWorkspace({ store }).generate({ requestId: 'bio-seed', parameters: london })
    .record;
}
async function generateBio(page, country = 'GB', city = 'London', type = 'model') {
  await page.locator('[data-tab="bio"]').click();
  await page.locator('#bio-country').selectOption(country);
  await page.locator('#bio-city').fill(city);
  await page.locator('#bio-type').selectOption(type);
  await page.locator('[data-action="bio-generate"]').click();
  await page.waitForFunction(
    () => !document.querySelector('[data-action="bio-generate"]').disabled
  );
  await page.locator('#bio-residence').waitFor();
  return page.evaluate(async () => (await window.blego.biography({ action: 'read' })).record);
}
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
          globalThis.bioCityRelease?.();
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
    const profile = await page.evaluate(
      async () => (await window.blego.biography({ action: 'read' })).record
    );
    if (predicate(profile, arg)) return profile;
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (Date.now() < deadline);
  assert.fail('Expected persisted BIO/profile was not observed within 10 seconds');
}
async function saved(page, field, value) {
  return waitForStored(page, (p) => p?.values?.[field] === value);
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
    const biography = await generateBio(page);
    for (const value of Object.values(biography.values)) assert.ok(value);
    await page.locator('[data-tab="bio"]').click();
    await page.locator('#bio-residence').waitFor();
    assert.equal(await page.locator('[data-action="bio-save"]').count(), 0);
    assert.equal(await page.locator('[data-action="bio-retry"]').isVisible(), false);
    for (const [field, value] of Object.entries(biography.values))
      assert.equal(await page.locator(`#bio-${field}`).inputValue(), value);
    await page.locator('#bio-birthplace').fill('Manual birthplace');
    await page.locator('[data-tab="profile"]').click();
    await page.locator('[data-tab="bio"]').click();
    assert.equal(await page.locator('#bio-birthplace').inputValue(), 'Manual birthplace');
    await saved(page, 'birthplace', 'Manual birthplace');
    for (const field of Object.keys(biography.values)) {
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
    for (const field of Object.keys(biography.values)) {
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
    seedBio(store);
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
  'BIO real catalog fills eight country hubs and bundled localities, leaving sparse towns empty through real generator IPC',
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
    const { organizationOptions } = require('../../electron/features/generator/biography.cjs');
    for (const [country, city] of Object.entries(hubs)) {
      const bundled = require(`../../resources/generator/countries/${country}.json`).places.find(
        (place) => {
          const options = organizationOptions({
            country,
            type: 'model',
            namingStrategy: 'person_name',
            fields: { city: place.city, postalCode: place.postal }
          });
          return ['company', 'university', 'school'].every((kind) =>
            options.some((row) => row.kind === kind)
          );
        }
      );
      assert.ok(bundled, `${country}: bundled locality reference coverage`);
      const scenarios = [
        { town: city, filled: true },
        { town: smallTowns[country], filled: false }
      ];
      if (bundled.city !== city)
        scenarios.push({ town: bundled.city, postal: bundled.postal, filled: true });
      for (const scenario of scenarios) {
        const { town } = scenario;
        await generateBio(page, country, town);
        for (const field of ['employer', 'position', 'university', 'school']) {
          const value = await page.locator(`#bio-${field}`).inputValue();
          if (scenario.filled) assert.ok(value, `${country}/${town}/${field}`);
          else assert.equal(value, '', `${country}/${field}`);
        }
      }
    }
  }
);
test(
  'Standalone BIO replacement and clear freeze inputs while IPC is pending and retain saved history',
  { timeout: 60000 },
  async (t) => {
    const f = await fixture(t, { country: 'GB', type: 'model' });
    const seed = await openStore(f.data);
    await generateProfile(
      { requestId: 'transition-seed', country: 'GB', type: 'model' },
      { store: seed }
    );
    seedBio(seed);
    seed.close();
    const page = await f.launch();
    await page.locator('[data-tab="bio"]').click();
    for (const action of ['bio-generate', 'bio-clear']) {
      const before = await page.evaluate(
        async () => (await window.blego.biography({ action: 'read' })).record
      );
      await page.locator('#bio-mainBio').fill(`saved before ${action}`);
      await f.app.evaluate(({ ipcMain }, action) => {
        const channel = 'local:biography';
        globalThis.bioTransitionChannel = channel;
        globalThis.bioTransitionOriginal = ipcMain._invokeHandlers.get(channel);
        ipcMain._invokeHandlers.set(channel, async (event, arg) => {
          if (arg.action !== (action === 'bio-generate' ? 'generate' : 'clear'))
            return globalThis.bioTransitionOriginal(event, arg);
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
        db.prepare('SELECT value FROM kv WHERE key=?').get('bio:record:' + before.id).value
      );
      db.close();
      assert.equal(persisted.values.mainBio, `saved before ${action}`);
      await page.waitForFunction(
        () => !document.querySelector('[data-action="bio-generate"]').disabled
      );
      if (action === 'bio-clear') {
        assert.equal(await page.locator('#bio-mainBio').count(), 0);
        assert.equal(await page.locator('[data-tab="bio"]').count(), 1);
      }
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
    seedBio(seed);
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
test(
  'TZ7 independent generators: empty start, both directions, individual copies, clear, parameter drafts and restart',
  { timeout: 90000 },
  async (t) => {
    const f = await fixture(t, { country: 'GB', type: 'model' });
    let page = await f.launch();
    assert.equal(await page.locator('[data-tab="profile"]').innerText(), 'ФП');
    assert.equal(await page.locator('[data-tab="bio"]').isVisible(), true);
    assert.equal(await page.evaluate(() => window.blego.lastCard()), null);
    const bio = await generateBio(page, 'GB', 'London', 'tech');
    assert.ok(bio.values.employer);
    assert.ok(bio.values.school);
    assert.equal(await page.evaluate(() => window.blego.lastCard()), null);
    await page.locator('#bio-mainBio').fill('Independent BIO before FP');
    await page.locator('[data-tab="profile"]').click();
    await page.locator('[data-action="generate"]').click();
    await page.locator('.demo-card').waitFor();
    const fp = await page.evaluate(() => window.blego.lastCard());
    assert.equal(fp.biography, undefined);
    await saved(page, 'mainBio', 'Independent BIO before FP');
    await page.locator('[data-action="copy-model"][data-field="phone"]').click();
    const { nationalPhoneForCopy } = await import('../../src/js/utils/phone.mjs');
    assert.equal(
      await f.app.evaluate(({ clipboard }) => clipboard.readText()),
      nationalPhoneForCopy(fp.fields.phone, fp.country)
    );
    await page.locator('[data-action="copy-model"][data-card="true"]').click();
    assert.ok(
      (await f.app.evaluate(({ clipboard }) => clipboard.readText())).includes(fp.fields.phone)
    );
    await page.locator('[data-tab="bio"]').click();
    assert.equal(await page.locator('#bio-mainBio').inputValue(), 'Independent BIO before FP');
    const next = await generateBio(page, 'IT', 'Milano', 'model');
    assert.deepEqual(await page.evaluate(() => window.blego.lastCard()), fp);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Control+Alt+Shift+C');
    assert.equal(await page.locator('[data-copy-control="source"]').inputValue(), 'biography');
    await page.locator('[data-tab="profile"]').click();
    assert.equal(await page.locator('[data-copy-control="source"]').count(), 0);
    await page.locator('[data-action="clear-demo"]').click();
    await page.waitForFunction(async () => !(await window.blego.lastCard()));
    assert.deepEqual(
      await page.evaluate(async () => (await window.blego.biography({ action: 'read' })).record),
      next
    );
    await page.locator('[data-action="generate"]').click();
    await page.locator('.demo-card').waitFor();
    const secondFp = await page.evaluate(() => window.blego.lastCard());
    await page.locator('[data-tab="bio"]').click();
    await page.locator('[data-action="bio-clear"]').click();
    await page.waitForFunction(() => !document.querySelector('#bio-mainBio'));
    assert.deepEqual(await page.evaluate(() => window.blego.lastCard()), secondFp);
    await generateBio(page, 'GB', 'London', 'crypto');
    await page.locator('#bio-country').selectOption('DE');
    await page.locator('#bio-city').fill('Aachen');
    await page.locator('#bio-type').selectOption('tech');
    await page.locator('#bio-mainBio').fill('Independent final saved BIO');
    const closed = f.app.waitForEvent('close');
    await f.app.evaluate(({ app }) => {
      setTimeout(() => app.quit(), 0);
    });
    await closed;
    f.forget();
    page = await f.launch();
    await page.locator('.demo-card').waitFor();
    assert.deepEqual(await page.evaluate(() => window.blego.lastCard()), secondFp);
    await page.locator('[data-tab="bio"]').click();
    assert.equal(await page.locator('#bio-country').inputValue(), 'DE');
    assert.equal(await page.locator('#bio-city').inputValue(), 'Aachen');
    assert.equal(await page.locator('#bio-type').inputValue(), 'tech');
    assert.equal(await page.locator('#bio-mainBio').inputValue(), 'Independent final saved BIO');
    // Regeneration uses the saved result's London geography, not next-generation Aachen controls.
    await page.locator('[data-action="bio-regenerate"][data-field="residence"]').click();
    await saved(page, 'residence', 'London, United Kingdom');
    for (const width of [360, 390, 427, 480, 504, 576, 768, 980, 1280]) {
      await f.app.evaluate(
        ({ BrowserWindow }, width) =>
          BrowserWindow.getAllWindows()[0].setBounds({ width, height: 900 }),
        width
      );
      await page.waitForFunction((width) => innerWidth === width, width);
      for (const tab of ['profile', 'bio']) {
        await page.locator(`[data-tab="${tab}"]`).click();
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${tab} ${width}`
        );
        assert.equal(await page.locator('[data-tab="bio"]').isVisible(), true);
        assert.equal(await page.locator('[data-tab="profile"]').isVisible(), true);
      }
    }
  }
);
test(
  'TZ7 legacy BIO opens repeatedly without duplicates; editing keeps original FP and old archive-compatible JSON',
  { timeout: 45000 },
  async (t) => {
    const f = await fixture(t, { country: 'GB', type: 'model', disabledFields: ['city'] });
    const store = await openStore(f.data);
    const fp = await generateProfile(
      { requestId: 'old-fp', country: 'GB', type: 'model' },
      { store }
    );
    fp.biography = {
      residence: 'Legacy city',
      birthplace: '',
      employer: 'Manual employer',
      position: 'Manual role',
      university: 'Manual university',
      school: '',
      mainBio: 'Old attached BIO'
    };
    fp.biographyRevision = 3;
    const json = JSON.stringify(fp);
    store.set('lastCard', fp);
    store.db.prepare('UPDATE requests SET profile=? WHERE profile_id=?').run(json, fp.id);
    store.close();
    const page = await f.launch();
    await page.locator('[data-tab="bio"]').click();
    assert.equal(await page.locator('#bio-mainBio').inputValue(), 'Old attached BIO');
    assert.equal(await page.locator('#bio-city').inputValue(), '');
    const readCounts = () => {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(path.join(f.data, 'local.sqlite'), { readOnly: true });
      const count = db.prepare("SELECT COUNT(*) n FROM kv WHERE key GLOB 'bio:record:*'").get().n;
      const original = db
        .prepare('SELECT profile FROM requests WHERE profile_id=?')
        .get(fp.id).profile;
      db.close();
      return { count, original };
    };
    for (let i = 0; i < 3; i++) {
      await page.locator('summary').filter({ hasText: 'Сохранённые BIO' }).click();
      await page.locator('[data-action="bio-history"]').click();
      await page.locator('[data-action="bio-open"]').click();
      await page.waitForFunction(
        () => !document.querySelector('[data-action="bio-generate"]').disabled
      );
    }
    assert.deepEqual(readCounts(), { count: 0, original: json });
    await page.locator('#bio-mainBio').fill('New independent legacy edit');
    await saved(page, 'mainBio', 'New independent legacy edit');
    assert.deepEqual(readCounts(), { count: 1, original: json });
    assert.deepEqual(await page.evaluate(() => window.blego.lastCard()), fp);
    await page.locator('[data-action="bio-clear"]').click();
    await page.waitForFunction(() => !document.querySelector('#bio-mainBio'));
    await page.locator('summary').filter({ hasText: 'Сохранённые BIO' }).click();
    await page.locator('[data-action="bio-history"]').click();
    assert.equal(await page.locator('#bio-history-record option').count(), 1);
    await page.locator('[data-action="bio-open"]').click();
    await page.locator('#bio-mainBio').waitFor();
    assert.equal(await page.locator('#bio-mainBio').inputValue(), 'New independent legacy edit');
    assert.deepEqual(readCounts(), { count: 1, original: json });
  }
);
test(
  'cross-country BIO history never offers stale city/postal suggestions while loading',
  { timeout: 30000 },
  async (t) => {
    const f = await fixture(t);
    const page = await f.launch();
    const gb = await generateBio(page, 'GB', 'London', 'model');
    await generateBio(page, 'DE', 'Berlin', 'tech');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('#bio-cities option')].some((o) => o.value === 'Berlin')
    );
    await f.app.evaluate(({ ipcMain }) => {
      globalThis.bioOriginal = ipcMain._invokeHandlers.get('local:biography');
      ipcMain._invokeHandlers.set('local:biography', async (event, arg) => {
        if (arg.action === 'cities' && arg.country === 'GB')
          await new Promise((resolve) => {
            globalThis.bioCityRelease = resolve;
          });
        return globalThis.bioOriginal(event, arg);
      });
    });
    await page.locator('summary').filter({ hasText: 'Сохранённые BIO' }).click();
    await page.locator('[data-action="bio-history"]').click();
    await page.locator('#bio-history-record').selectOption(gb.id);
    await page.locator('[data-action="bio-open"]').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#bio-country').value === 'GB' &&
        !document.querySelector('[data-action="bio-generate"]').disabled
    );
    assert.equal(await page.locator('#bio-cities option').count(), 0);
    await f.app.evaluate(() => globalThis.bioCityRelease());
    await page.waitForFunction(() =>
      [...document.querySelectorAll('#bio-cities option')].some((o) => o.value === 'London')
    );
  }
);
test(
  'native quit waits for standalone BIO generation and parameter saves without losing either generator',
  { timeout: 45000 },
  async (t) => {
    const f = await fixture(t, { country: 'GB', type: 'model' });
    let page = await f.launch();
    await page.locator('[data-action="generate"]').click();
    await page.locator('.demo-card').waitFor();
    const fp = await page.evaluate(() => window.blego.lastCard());
    await page.locator('[data-tab="bio"]').click();
    await page.locator('#bio-country').selectOption('GB');
    await page.locator('#bio-city').fill('London');
    await page.locator('#bio-type').selectOption('tech');
    await f.app.evaluate(({ ipcMain }) => {
      globalThis.bioOriginal = ipcMain._invokeHandlers.get('local:biography');
      ipcMain._invokeHandlers.set('local:biography', async (event, arg) => {
        if (arg.action === 'generate')
          await new Promise((resolve) => {
            globalThis.bioRelease = resolve;
          });
        return globalThis.bioOriginal(event, arg);
      });
    });
    await page.locator('[data-action="bio-generate"]').click();
    await page.waitForFunction(
      () => document.querySelector('[data-action="bio-generate"]').disabled
    );
    // Observe actual IPC arrival before asking native Quit.
    for (let i = 0; !(await f.app.evaluate(() => Boolean(globalThis.bioRelease))); i++) {
      assert.ok(i < 100);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await f.app.evaluate(({ app }) => app.quit());
    await page.waitForFunction(() => document.body.inert);
    assert.equal(
      await f.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
      1
    );
    const closed = f.app.waitForEvent('close');
    await f.app.evaluate(() => globalThis.bioRelease());
    await closed;
    f.forget();
    page = await f.launch();
    await page.locator('[data-tab="bio"]').click();
    await page.locator('#bio-mainBio').waitFor();
    assert.equal(await page.locator('#bio-residence').inputValue(), 'London, United Kingdom');
    assert.equal(await page.locator('#bio-type').inputValue(), 'tech');
    assert.deepEqual(await page.evaluate(() => window.blego.lastCard()), fp);
    const history = await page.evaluate(() => window.blego.biography({ action: 'history' }));
    assert.equal(history.total, 1);
  }
);
