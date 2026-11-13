const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
const fs = require('node:fs');
const normalized = (x) => x.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
test('authored pools supplement each person category by 256 new female country-specific variants and TECH by 250 brands', () => {
  const data = JSON.parse(
    fs.readFileSync('resources/generator/supplements/names-v14.json', 'utf8')
  );
  assert.ok(data.id && data.version);
  const required = [
    'Future Hub',
    'AI Vision',
    'Digital Minds',
    'Neural World',
    'Future Intelligence',
    'AI Central',
    'Tech Horizon',
    'Smart Future',
    'NextGen AI',
    'Cyber Vision',
    'Digital Evolution',
    'AI Universe',
    'Future Logic',
    'Tech Pulse',
    'Neural Network',
    'AI Innovations',
    'Quantum Future',
    'Digital Frontier',
    'Machine Mind',
    'Tech Revolution',
    'AI Discovery',
    'Future Labs',
    'Cyber Intelligence',
    'Smart Algorithms',
    'The AI Zone'
  ];
  const tech = resolvePreset('US', 'tech');
  assert.equal(tech.brandNames.length, 275);
  for (const name of required) assert.ok(tech.brandNames.includes(name));
  assert.equal(new Set(tech.brandNames.map(normalized)).size, 275);
  assert.ok(tech.brandNames.every((n) => !/[0-9]/.test(n) && n.split(' ').length <= 3));
  for (const type of ['model', 'crypto']) {
    const names = Object.values(data.personNames[type]).flat();
    assert.equal(names.length, 256);
    assert.equal(new Set(names.map(normalized)).size, 256);
    for (const [country, extras] of Object.entries(data.personNames[type])) {
      const original = JSON.parse(
        fs.readFileSync(`resources/generator/countries/${country}.json`, 'utf8')
      );
      const p = resolvePreset(country, type);
      assert.equal(p.namingStrategy, 'person_name');
      assert.equal(p.nameGender, 'female');
      assert.deepEqual(p.first, original.first);
      assert.deepEqual(p.last, original.last);
      assert.deepEqual(p.personNames, extras);
      for (const name of extras) {
        assert.ok(original.first.some((f) => name.startsWith(f + ' ')));
        assert.ok(
          !original.first.some(
            (f) => name.startsWith(f + ' ') && original.last.includes(name.slice(f.length + 1))
          ),
          `${country} ${name} already possible`
        );
      }
    }
  }
});

test('every localized category gains 50 distinct BIOs while original texts and explicit overrides remain intact', () => {
  for (const country of ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB']) {
    for (const type of ['model', 'tech', 'crypto']) {
      const p = resolvePreset(country, type);
      const old = JSON.parse(fs.readFileSync(`resources/generator/types/${type}.json`, 'utf8'))
        .bios[p.language];
      assert.equal(p.bios.length, old.length + 50, `${country}:${type}`);
      assert.equal(new Set(p.bios.map(normalized)).size, p.bios.length);
      assert.deepEqual(p.bios.slice(0, old.length), old);
      assert.ok(p.bioDatasetId);
      assert.deepEqual(
        resolvePreset(country, type, {
          overrides: { types: { [type]: { bios: ['Explicit local biography.'] } } }
        }).bios,
        ['Explicit local biography.']
      );
    }
  }
});
