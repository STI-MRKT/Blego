const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = path.resolve(process.argv[2] || 'release/tz12-visual');
const candidateLabel = process.argv[3] || 'candidate';
const read = (label) =>
  JSON.parse(fs.readFileSync(path.join(directory, `${label}-metrics.json`), 'utf8'));
const original = read('original'),
  incoming = read('incoming'),
  candidate = read(candidateLabel);
const comparisons = [];
for (const width of [360, 390, 480, 576, 768, 980, 1280]) {
  const find = (rows, view) => rows.find((row) => row.width === width && row.view === view);
  for (const view of ['news', 'profile', 'bio'])
    assert.equal(find(candidate, view).overflow, false, `${view} ${width} overflow`);
  const before = find(original, 'news'),
    after = find(candidate, 'news');
  assert.equal(after.cards.length, 15);
  assert.deepEqual(after.cards, before.cards, `Original News card bounds at ${width}`);
  if (width === 1280) assert.equal(new Set(after.cards.map((card) => card.x)).size, 3);
  assert.deepEqual(
    find(candidate, 'profile').controls,
    find(incoming, 'profile').controls,
    `FP control bounds at ${width}`
  );
  comparisons.push({
    width,
    newsCards: 15,
    newsOriginalBoundsEqual: true,
    fpControlBoundsEqual: true,
    noOverflow: true
  });
}
const result = {
  status: 'PASS',
  candidateLabel,
  method:
    'Identical synthetic fixtures, own version renderer/CSS, same-host screenshots; compares all 15 News bounds and FP closed-control bounds at seven viewports. Does not assert cross-platform pixel identity.',
  comparisons
};
fs.writeFileSync(path.join(directory, 'comparison.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
