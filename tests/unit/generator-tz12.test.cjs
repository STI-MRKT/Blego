const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  BASE,
  countries,
  types,
  normalize,
  snapshot,
  report
} = require('../../scripts/tz12-dictionary-report.cjs');
const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
const { nameAt } = require('../../electron/features/generator/naming.cjs');
const before = snapshot(BASE),
  after = snapshot();
test('TZ12 adds >=200 actual unique names, BIOs and address records, retaining every old entry', () => {
  const result = report(before, after);
  for (const pool of ['names', 'bios', 'addresses']) {
    assert.ok(result[pool].added >= 200, JSON.stringify(result[pool]));
    assert.equal(result[pool].removed, 0);
  }
  for (const country of countries) {
    assert.deepEqual(after.data[country].first, before.data[country].first);
    assert.deepEqual(after.data[country].places, before.data[country].places);
    assert.deepEqual(after.data[country].streets, before.data[country].streets);
    assert.equal(result.countries[country].last.added, 16);
    assert.deepEqual(
      after.data[country].last.slice(0, before.data[country].last.length),
      before.data[country].last
    );
    const model = resolvePreset(country, 'model');
    assert.equal(model.namingStrategy, 'person_name');
    assert.equal(model.nameGender, 'female');
    assert.ok(
      nameAt(model, model.first.length * model.last.length - 1).endsWith(' ' + model.last.at(-1))
    );
    const crypto = resolvePreset(country, 'crypto');
    assert.equal(crypto.namingStrategy, 'brand_name');
    assert.equal(crypto.nameGender, null);
    assert.equal(crypto.brandNames.length, 400);
  }
  assert.equal(result.tech.added, 96);
});
test('TZ12 localized BIOs are distinct complete texts, with no near-copy sentence variants', () => {
  const grams = (text) =>
    new Set([...normalize(text)].slice(0, -2).map((_, i) => normalize(text).slice(i, i + 3)));
  for (const type of types)
    for (const language of Object.keys(after.bios.bios[type])) {
      const old = [...before.typeData[type].bios[language], ...before.bios.bios[type][language]];
      const values = [...after.typeData[type].bios[language], ...after.bios.bios[type][language]];
      const additions = values.filter((text) => !new Set(old.map(normalize)).has(normalize(text)));
      assert.equal(additions.length, 10, `${type}:${language}`);
      assert.equal(new Set(values.map(normalize)).size, values.length);
      const indexed = values.map((text) => ({ text, grams: grams(text) }));
      for (const text of additions) {
        assert.ok(text.length >= 45 && text.length <= 4000);
        assert.ok(!/[\p{Cc}\p{Cf}]/u.test(text));
        const a = grams(text);
        for (const other of indexed) {
          if (other.text === text) continue;
          const similarity =
            (2 * [...a].filter((g) => other.grams.has(g)).length) / (a.size + other.grams.size);
          assert.ok(similarity < 0.9, `${type}:${language} near-copy ${text} / ${other.text}`);
        }
      }
    }
});
test('TZ12 synthetic addresses preserve exact source city/postal pairs and national line formats', () => {
  const patterns = {
    BR: /^\d{5}-\d{3}$/,
    US: /^\d{5}$/,
    FR: /^\d{5}$/,
    PL: /^\d{2}-\d{3}$/,
    DE: /^\d{5}$/,
    ES: /^\d{5}$/,
    IT: /^\d{5}$/,
    GB: /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/
  };
  for (const country of countries) {
    const p = resolvePreset(country, 'model');
    assert.equal(p.addresses.length, 25 + 160);
    assert.deepEqual(p.addresses.slice(0, 25), after.addresses[country]);
    assert.equal(new Set(p.addresses.map((row) => normalize(JSON.stringify(row)))).size, 25 + 160);
    for (const row of p.addresses) {
      assert.ok(patterns[country].test(row.postal), `${country}:${row.postal}`);
      assert.ok(
        before.data[country].places.some(
          (old) => old.city === row.city && old.postal === row.postal
        )
      );
      assert.ok(!/[\p{Cc}\p{Cf}]/u.test(row.address));
      if (p.addresses.indexOf(row) < 25)
        assert.ok((['US', 'GB', 'FR'].includes(country) ? /^\d+ / : / \d+$/).test(row.address));
      else assert.ok(/ [0-9]+$/.test(row.address));
    }
    assert.deepEqual(resolvePreset(country, 'model', {}, after.data[country]).addresses, []);
  }
});
