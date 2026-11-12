const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

test('every country uses an explicitly female, normalized and traceable name dataset', () => {
  const knownMale = ['Lucas', 'Michael', 'Louis', 'Jakub', 'Lukas', 'Mateo', 'Marco', 'Harry'];
  const countries = ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'];
  for (let i = 0; i < countries.length; i++) {
    const p = resolvePreset(countries[i], 'model');
    assert.equal(p.nameGender, 'female');
    assert.ok(!p.first.includes(knownMale[i]), `${countries[i]} retains male name ${knownMale[i]}`);
    assert.equal(
      new Set(p.first.map((x) => x.normalize('NFKC').toLowerCase())).size,
      p.first.length
    );
    assert.ok(p.first.every((x) => x && !/[\p{Cc}\p{Cf}\d]/u.test(x)));
    assert.ok(p.datasetId && p.datasetVersion && p.provenance.names.license === 'MIT');
    const country = JSON.parse(
      fs.readFileSync(path.join('resources/generator/countries', `${countries[i]}.json`))
    );
    const checksum = country.checksum;
    delete country.checksum;
    assert.equal(checksum, createHash('sha256').update(JSON.stringify(country)).digest('hex'));
  }
  const pl = resolvePreset('PL', 'tech');
  assert.ok(pl.last.includes('Kowalska'));
  assert.ok(!pl.last.includes('Kowalski'));
  assert.ok(pl.last.includes('Wiśniewska'));
});
