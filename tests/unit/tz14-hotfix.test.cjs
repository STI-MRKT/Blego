const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
const { defaults, getSettings } = require('../../electron/local/settings.cjs');
const { EXTRA } = require('../../electron/features/generator/pool-expansion.cjs');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../resources/generator');
const countries = ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'];
const types = ['model', 'tech', 'crypto'];

test('TZ14 BIO editor has no institution chooser, disclaimer or saved-history panel', async () => {
  const { state } = await import('../../src/js/state.js');
  const { biographyHTML } = await import('../../src/js/ui/biography.js');
  const { generatorHTML } = await import('../../src/js/ui/generator.js');
  state.generatorTab = 'bio';
  state.bio = { id: 'synthetic' };
  state.bioEditor = {
    values: Object.fromEntries(
      [
        'residence',
        'birthplace',
        'employer',
        'employerCity',
        'position',
        'university',
        'universityCity',
        'school',
        'schoolCity',
        'mainBio'
      ].map((name) => [name, 'Synthetic value'])
    ),
    institutions: [],
    dirty: false
  };
  state.bioHistory = { items: [], total: 0, offset: 0, limit: 50 };
  const markup = biographyHTML();
  assert.ok(markup.includes('id="bio-mainBio"'));
  assert.ok(markup.includes('rows="2"'));
  assert.ok(!markup.includes('data-bio-institution='));
  assert.ok(!markup.includes('Сохранённые BIO'));
  assert.ok(!markup.includes('Синтетический пример:'));
  assert.ok(generatorHTML().includes('generator-mode-tabs'));
});

test('TZ14 archive retains search and record actions, removes Filter and sorting', async () => {
  const { state } = await import('../../src/js/state.js');
  const { historyHTML } = await import('../../src/js/ui/history.js');
  state.archiveView = null;
  state.archives = { items: [], offset: 0, total: 0 };
  const html = historyHTML();
  assert.ok(html.includes('id="archive-filter"'));
  assert.ok(html.includes('name="search"'));
  assert.ok(!html.includes('>Filter</button>'));
  assert.ok(!html.includes('Filters and sorting'));
  assert.ok(!html.includes('0 archives'));
});

test('TZ14 Settings removes advanced panel and keeps finite repeats on, contacts unique', async () => {
  const { state } = await import('../../src/js/state.js');
  const { settingsHTML } = await import('../../src/js/ui/settings.js');
  state.settings = { ...defaults };
  const html = settingsHTML();
  assert.ok(html.includes('settings-form'));
  assert.ok(!html.includes('ux-settings-advanced'));
  assert.ok(!html.includes('Field order'));
  assert.ok(!html.includes('name="bulkMode"'));
  const saved = getSettings({ get: () => ({ bulkMode: false, bulkConsent: false }) });
  assert.equal(saved.bulkMode, true);
  assert.equal(saved.bulkConsent, true);
  const p = resolvePreset('US', 'tech', saved);
  for (const key of ['bio', 'status', 'postalCode', 'address', 'number'])
    assert.ok(p.allowRepeats.includes(key), key);
  for (const key of ['phone', 'email', 'handle']) assert.ok(!p.allowRepeats.includes(key), key);
});

test('TZ14 bundled country first/last and synthetic address pools each expand by 160', () => {
  for (const country of countries) {
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'countries', country + '.json')));
    const p = resolvePreset(country, 'model', {});
    assert.equal(p.first.length, raw.first.length + EXTRA, country + ':first');
    assert.equal(p.last.length, raw.last.length + EXTRA, country + ':last');
    assert.equal(
      p.addresses.length,
      require('../../resources/generator/supplements/addresses-tz12.json').records[country].length +
        EXTRA,
      country + ':addresses'
    );
    for (const field of ['first', 'last', 'addresses']) {
      const values = p[field].map((x) => (typeof x === 'string' ? x : JSON.stringify(x)));
      assert.equal(
        new Set(values.map((x) => x.toLowerCase())).size,
        values.length,
        country + ':' + field
      );
    }
  }
});

test('TZ14 every localized type has 160 additional BIOs and statuses', () => {
  const supplement = require('../../resources/generator/supplements/bios-v14.json');
  for (const country of countries) {
    const lang = JSON.parse(
      fs.readFileSync(path.join(root, 'countries', country + '.json'))
    ).language;
    for (const type of types) {
      const raw = require('../../resources/generator/types/' + type + '.json');
      const p = resolvePreset(country, type, {});
      const bioBase = raw.bios[lang].length + supplement.bios[type][lang].length;
      const statusBase = raw.statuses[lang].length;
      assert.equal(p.bios.length, bioBase + EXTRA, country + ':' + type + ':bio');
      assert.equal(p.statuses.length, statusBase + EXTRA, country + ':' + type + ':status');
      assert.equal(new Set(p.bios).size, p.bios.length);
      assert.equal(new Set(p.statuses).size, p.statuses.length);
    }
  }
});

test('TZ14 Crypto uses 400 crypto-themed brands, Tech gains 160 new brands', () => {
  const tech = resolvePreset('US', 'tech');
  const crypto = resolvePreset('GB', 'crypto');
  const old = require('../../resources/generator/supplements/names-v14.json').brandNames;
  assert.equal(tech.brandNames.length, old.length + EXTRA);
  assert.equal(crypto.brandNames.length, 400);
  assert.equal(tech.namingStrategy, 'brand_name');
  assert.equal(crypto.namingStrategy, 'brand_name');
  assert.equal(crypto.nameGender, null);
  assert.equal(new Set(crypto.brandNames).size, crypto.brandNames.length);
  assert.ok(crypto.brandNames.some((x) => x.includes('Ledger')));
  assert.ok(crypto.brandNames.every((x) => !old.includes(x)));
});
