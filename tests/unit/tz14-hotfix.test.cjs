const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('TZ14 all 24 presets expand safe pools without rewriting verified cities', () => {
  const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
  const institutes = require('../../resources/generator/institutions.json');
  assert.equal(institutes.length, 55);
  for (const country of ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB']) {
    const original = require('../../resources/generator/countries/' + country + '.json');
    for (const type of ['model', 'tech', 'crypto']) {
      const p = resolvePreset(country, type);
      assert.equal(p.first.length, original.first.length + 150, country + ':first');
      assert.equal(p.last.length, original.last.length + 150, country + ':last');
      assert.equal(p.streets.length, original.streets.length + 150, country + ':streets');
      assert.deepEqual(p.places, original.places);
      assert.equal(p.addresses.length, 175);
      assert.equal(p.bios.length, 240);
      assert.equal(p.statuses.length, 170);
      assert.equal(p.categoryPool.length, 150);
      assert.equal(p.positionPool.length, 150);
      const unique = (list, key) =>
        assert.equal(new Set(list.map(key)).size, list.length, country + ':' + type);
      unique(p.first, (v) => v.normalize('NFKC').toLowerCase());
      unique(p.last, (v) => v.normalize('NFKC').toLowerCase());
      unique(p.addresses, (v) => JSON.stringify(v));
      unique(p.bios, (v) => v.normalize('NFKC').toLowerCase());
      unique(p.statuses, (v) => v.normalize('NFKC').toLowerCase());
      for (const row of p.addresses)
        assert.ok(original.places.some((x) => x.city === row.city && x.postal === row.postal));
      if (type === 'tech') assert.equal(p.brandNames.length, 371);
      if (type === 'crypto') {
        assert.equal(p.namingStrategy, 'brand_name');
        assert.equal(p.brandNames.length, 1000);
        unique(p.brandNames, (v) => v.toLowerCase());
      }
    }
  }
});

test('TZ14 phones show/copy fixed mask, retain leading zero and preserve stored E164', async () => {
  const { formatPhoneDisplay, formattedPhoneForCopy } =
    await import('../../src/js/utils/phone.mjs');
  for (const [country, stored, displayed] of [
    ['US', '+13025780387', '302-578-0387'],
    ['BR', '+5511900000000', '190-000-0000'],
    ['FR', '+33600000000', '060-000-0000'],
    ['PL', '+48500000000', '050-000-0000']
  ]) {
    assert.equal(formatPhoneDisplay(stored, country), displayed);
    assert.equal(formattedPhoneForCopy(stored, country), displayed);
    assert.match(displayed, /^\d{3}-\d{3}-\d{4}$/);
    assert.ok(stored.startsWith('+'));
  }
});

test('TZ14 settings force always-on finite repeats without discarding existing settings', async (t) => {
  const { openStore } = require('../../electron/local/store.cjs');
  const { getSettings, updateSettings } = require('../../electron/local/settings.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz14-settings-'));
  const store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  updateSettings(store, { country: 'GB', newsEnabled: false, bulkMode: false, bulkConsent: false });
  const saved = getSettings(store);
  assert.equal(saved.country, 'GB');
  assert.equal(saved.newsEnabled, false);
  assert.equal(saved.bulkMode, true);
  assert.equal(saved.bulkConsent, true);
  const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
  const preset = resolvePreset('GB', 'model', saved);
  for (const field of ['bio', 'status', 'postalCode', 'address', 'number'])
    assert.ok(preset.allowRepeats.includes(field));
  for (const field of ['phone', 'email', 'handle'])
    assert.ok(!preset.allowRepeats.includes(field));
});

test('TZ14 BIO view has compact text area but no institution pickers or history', async () => {
  const { state } = await import('../../src/js/state.js');
  const { biographyHTML } = await import('../../src/js/ui/biography.js');
  state.bio = { parameters: { country: 'GB', city: 'London', type: 'model' }, record: { id: 'test' } };
  state.bioEditor = {
    values: { residence: 'London', university: 'University', school: 'School', mainBio: 'Test BIO' },
    institutions: [], saving: false, dirty: false
  };
  const html = biographyHTML();
  assert.ok(html.includes('rows="2"'));
  assert.ok(html.includes('Копировать Университет'));
  assert.ok(html.includes('Копировать Средняя школа'));
  assert.ok(!html.includes('data-bio-institution'));
  assert.ok(!html.includes('Выберите учебное заведение'));
  assert.ok(!html.includes('Сохранённые BIO'));
  assert.ok(!html.includes('Синтетический пример'));
});

test('TZ14 archive retains search and actions without filters, sorting or count badge', async () => {
  const { state } = await import('../../src/js/state.js');
  const { historyHTML } = await import('../../src/js/ui/history.js');
  state.archives = { items: [], total: 0 };
  const html = historyHTML();
  assert.ok(html.includes('id="archive-filter"'));
  assert.ok(html.includes('name="search"'));
  assert.ok(!html.includes('Filters and sorting'));
  assert.ok(!html.includes('0 archives'));
  assert.ok(!html.includes('type="submit">Filter'));
  assert.ok(!html.includes('name="order"'));
});

test('TZ14 changed CSS stays scoped to generator/BIO and Friends and preserves News copy', async () => {
  const css = fs.readFileSync(path.join(__dirname, '../../src/css/ux.css'), 'utf8');
  assert.match(css, /\.ux-generator \.generator-tabs\s*\{margin-bottom:18px\}/);
  assert.match(css, /\.friends-copy-actions\s*\{margin-bottom:18px/);
  assert.match(css, /\.friend-card>details>summary/);
  const { state } = await import('../../src/js/state.js');
  const { newsBlockHTML } = await import('../../src/js/ui/news.js');
  state.settings.newsEnabled = true;
  state.news = { topic: 'tech', items: [{ topic: 'tech', title: 'Synthetic', link: 'https://example.test' }] };
  const html = newsBlockHTML();
  assert.ok(html.includes('Скопировать заголовок'));
  assert.ok(html.includes('Скопировать ссылку'));
});
