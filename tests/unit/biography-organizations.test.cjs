const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  organizationOptions,
  generateBiography,
  suggestBiographyField
} = require('../../electron/features/generator/biography.cjs');
const countries = ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'];
function row(country, kind, city = 'Source City', region = 'Region A', extra = {}) {
  return {
    id: `${country}-${kind}-${city}`,
    country,
    kind,
    name: `${kind} fixture`,
    city,
    region,
    sector: kind === 'company' ? 'financial technology' : kind,
    url: 'https://example.org/reference',
    source: {
      name: 'fixture',
      id: 'fixture',
      url: 'https://example.org/reference',
      license: 'test fixture only'
    },
    checkedAt: '2026-11-13',
    ...(kind === 'company'
      ? { roles: { tech: ['Software Developer'], crypto: ['Blockchain Developer'] } }
      : {}),
    ...extra
  };
}
function profile(country, city = 'Source City', type = 'crypto') {
  return {
    country,
    type,
    namingStrategy: 'person_name',
    fields: { city, bio: 'Synthetic thematic example' }
  };
}
test('all eight countries: same-city organizations fill BIO and role matches the selected company', () => {
  for (const country of countries) {
    const catalog = ['company', 'university', 'school'].map((kind) => row(country, kind));
    const p = profile(country),
      bio = generateBiography(p, { catalog, bios: ['thematic'] });
    for (const value of Object.values(bio)) assert.ok(value);
    assert.equal(bio.employer, 'company fixture — Source City');
    assert.equal(bio.position, 'Blockchain Developer');
    assert.equal(bio.mainBio, p.fields.bio);
    assert.equal(bio.birthplace, bio.residence);
  }
});
test('unknown small towns stay empty; no country fallback or cross-country/region/category leakage', () => {
  for (const country of countries) {
    const catalog = [row(country, 'company'), row(country, 'university'), row(country, 'school')];
    const bio = generateBiography(profile(country, 'Small unlisted town'), {
      catalog,
      bios: ['thematic']
    });
    for (const key of ['employer', 'position', 'university', 'school']) assert.equal(bio[key], '');
    assert.ok(bio.residence && bio.mainBio);
    assert.equal(
      generateBiography(profile(country, 'Source City', 'model'), { catalog, bios: ['fashion'] })
        .employer,
      ''
    );
  }
});
test('regional fallback has actual city, schools remain local, aliases work, ambiguous region fails closed', () => {
  const p = profile('IT', 'Milano');
  const catalog = [
    row('IT', 'university', 'Milan', 'Lombardia', { aliases: ['Milano'] }),
    row('IT', 'company', 'Monza', 'Lombardia'),
    row('IT', 'school', 'Monza', 'Lombardia'),
    row('IT', 'company', 'Rome', 'Lazio')
  ];
  const bio = generateBiography(p, { catalog, bios: ['text'] });
  assert.equal(bio.employer, 'company fixture — Monza');
  assert.equal(bio.university, 'university fixture — Milan');
  assert.equal(bio.school, '');
  const ambiguous = [...catalog, row('IT', 'school', 'Milano', 'Other region')];
  assert.equal(generateBiography(p, { catalog: ambiguous, bios: ['text'] }).employer, '');
});
test('brands receive thematic/location data without invented personal employment or education', () => {
  const p = { ...profile('US'), namingStrategy: 'brand_name' };
  const catalog = ['company', 'university', 'school'].map((kind) => row('US', kind));
  const bio = generateBiography(p, { catalog, bios: ['text'] });
  assert.ok(bio.residence && bio.mainBio);
  for (const field of ['birthplace', 'employer', 'position', 'university', 'school'])
    assert.equal(bio[field], '');
  assert.deepEqual(organizationOptions(p, catalog), []);
});
test('individual suggestions preserve unrelated fields and position uses the current employer only', () => {
  const p = profile('GB');
  const catalog = [row('GB', 'company')];
  const options = {
    catalog,
    bios: ['new thematic text'],
    values: { employer: 'company fixture — Source City' }
  };
  assert.deepEqual(suggestBiographyField(p, 'position', options), {
    position: 'Blockchain Developer'
  });
  assert.deepEqual(
    suggestBiographyField(p, 'position', {
      ...options,
      values: { employer: 'Unverified manual employer' }
    }),
    { position: '' }
  );
  assert.deepEqual(suggestBiographyField(p, 'mainBio', options), { mainBio: 'new thematic text' });
  assert.throws(() => suggestBiographyField(p, 'arbitrary', options), /INVALID_BIO/);
});
test('bundled catalog is extendable factual data with eight-country coverage and compatible roles', () => {
  const rows = require('../../resources/generator/institutions.json');
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  for (const row of rows) {
    for (const key of [
      'id',
      'country',
      'kind',
      'name',
      'city',
      'region',
      'sector',
      'url',
      'checkedAt'
    ])
      assert.ok(typeof row[key] === 'string' && row[key].trim(), `${row.name}: ${key}`);
    assert.equal(new URL(row.url).protocol, 'https:');
    for (const key of ['name', 'id', 'url', 'license'])
      assert.ok(row.source[key], `${row.name}: source.${key}`);
    assert.match(row.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    if (row.kind === 'company')
      for (const type of ['model', 'tech', 'crypto']) assert.ok(Array.isArray(row.roles[type]));
  }
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
  for (const [country, city] of Object.entries(hubs))
    for (const type of ['model', 'tech', 'crypto']) {
      const p = profile(country, city, type),
        bio = generateBiography(p);
      for (const value of Object.values(bio))
        assert.ok(value, `${country}/${type} should have reference coverage`);
      const chosen = organizationOptions(p).find(
        (row) => `${row.name} — ${row.city}` === bio.employer
      );
      assert.ok(chosen.roles[type].includes(bio.position));
      const empty = generateBiography(profile(country, 'Small unlisted town', type));
      assert.equal(empty.employer, '');
      assert.equal(empty.school, '');
      assert.equal(empty.university, '');
    }
});
