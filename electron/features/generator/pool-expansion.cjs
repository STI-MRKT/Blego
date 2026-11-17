// Authored, deterministic synthetic expansions for TZ14.
// No real identity, confirmed institution or verified postal location is invented.
const EXTRA = 160;
const TECH_ROOTS = [
  'Circuit', 'Vector', 'Cloud', 'Pixel', 'Syntax', 'Data', 'Signal', 'Compute',
  'Kernel', 'Interface', 'Quantum', 'Algorithm', 'Spectrum', 'Platform',
  'Neural', 'Open Source', 'Robotics', 'Digital', 'Protocol', 'Vertex'
];
const CRYPTO_ROOTS = [
  'Ledger', 'Consensus', 'Onchain', 'Blockchain', 'Digital Asset', 'Token',
  'Wallet', 'Custody', 'Decentralized', 'Cryptography', 'Settlement',
  'Smart Contract', 'Rollup', 'Validation', 'Block', 'Web3', 'Network',
  'Protocol', 'Chain', 'Distributed Ledger'
];
const TECH_ENDINGS = ['Studio', 'Journal', 'Research', 'Notes', 'Lab', 'Review', 'Works', 'Insights'];
const CRYPTO_ENDINGS = [
  'Studio', 'Journal', 'Research', 'Notes', 'Lab', 'Review',
  'Works', 'Insights', 'Observatory', 'Digest'
];
const dedupKey = (s) => s.normalize('NFKC').trim().toLocaleLowerCase();
const cleanText = (value) => String(value || '').trim();

function combinations(root, endings, base = []) {
  const used = new Set(base.map(dedupKey));
  const result = [];
  for (const a of root) for (const b of endings) {
    const value = a + ' ' + b;
    if (!used.has(dedupKey(value))) {
      result.push(value);
      used.add(dedupKey(value));
    }
  }
  return result;
}

// Compound synthetic names preserve the original language-local name vocabulary.
// They are not asserted to be actual people or culturally verified combinations.
function compounds(values, count = EXTRA) {
  const used = new Set(values.map(dedupKey));
  const result = [];
  for (let i = 0; i < values.length && result.length < count; i++) {
    for (let j = 1; j < values.length && result.length < count; j++) {
      const left = values[i];
      const right = values[(i + j) % values.length];
      if (left === right) continue;
      const pair = left + '-' + right;
      if (!used.has(dedupKey(pair))) {
        result.push(pair);
        used.add(dedupKey(pair));
      }
    }
  }
  if (result.length !== count) throw Error('TZ14_NAME_POOL_TOO_SMALL');
  return result;
}

function combinationsOfPhrases(values, count = EXTRA, join = ' ') {
  const base = [...new Set(values.map(cleanText).filter(Boolean))];
  if (base.length < 10) throw Error('TZ14_TEMPLATE_POOL_TOO_SMALL');
  const seen = new Set(base.map(dedupKey));
  const out = [];
  for (let i = 0; i < base.length && out.length < count; i++) {
    for (let j = 1; j < base.length && out.length < count; j++) {
      const first = base[i], second = base[(i + j) % base.length];
      if (first === second) continue;
      const phrase = first + join + second;
      if (phrase.length > 500 || seen.has(dedupKey(phrase))) continue;
      seen.add(dedupKey(phrase));
      out.push(phrase);
    }
  }
  if (out.length !== count) throw Error('TZ14_TEXT_POOL_TOO_SMALL');
  return out;
}

function syntheticAddresses(country, places, streets, count = EXTRA) {
  const result = [];
  const seen = new Set();
  for (let i = 0; result.length < count; i++) {
    const place = places[(i * 19) % places.length];
    const street = streets[i % streets.length];
    // Deterministic *fictitious* street/number examples with sourced city+postal pairs.
    const address = street + ' ' + (100 + i);
    const key = dedupKey(address) + ':' + dedupKey(place.city) + ':' + place.postal;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ city: place.city, postal: place.postal, address });
  }
  return result;
}
function expandBundledCountry(country) {
  return {
    ...country,
    first: [...country.first, ...compounds(country.first)],
    last: [...country.last, ...compounds(country.last)]
  };
}
function expandTypeTexts(type, language, bios, statuses) {
  // Append short, localized two-sentence BIOs and two-topic statuses.
  // Existing language-specific strings are kept unchanged, never translated.
  return {
    bios: [...bios, ...combinationsOfPhrases(bios, EXTRA, ' ')],
    statuses: [...statuses, ...combinationsOfPhrases(statuses, EXTRA, ' / ')]
  };
}
function brandNamesFor(type, priorTechNames) {
  if (type === 'crypto') return combinations(CRYPTO_ROOTS, CRYPTO_ENDINGS);
  if (type === 'tech')
    return [...priorTechNames, ...combinations(TECH_ROOTS, TECH_ENDINGS, priorTechNames)];
  return [];
}
module.exports = {
  EXTRA,
  expandBundledCountry,
  expandTypeTexts,
  syntheticAddresses,
  brandNamesFor
};
