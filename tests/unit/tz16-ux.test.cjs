const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('TZ16 Friends cards match FP language without import or details UI', async () => {
  const { state } = await import('../../src/js/state.js');
  const { friendsHTML } = await import('../../src/js/ui/friends.js');
  const previous = {
    friendsRows: state.friendsRows,
    friendsQuery: state.friendsQuery,
    friendsGeo: state.friendsGeo,
    friendsPlatform: state.friendsPlatform
  };
  try {
    state.friendsRows = [
      {
        id: 'synthetic_1',
        name: 'Sample Creator',
        geo: 'US',
        platform: 'Instagram',
        hue: 180,
        handle: 'sample.creator',
        niche: 'Technology',
        source: 'synthetic test source',
        notes: 'Only synthetic text',
        url: 'https://www.instagram.com/sample.creator/'
      }
    ];
    state.friendsQuery = '';
    state.friendsGeo = '';
    state.friendsPlatform = '';
    const html = friendsHTML();
    assert.match(html, /class="friend-card fp-friend-card"/);
    assert.match(html, /class="avatar xl"/);
    assert.match(html, /friend-tags/);
    assert.match(html, /friend-actions/);
    assert.doesNotMatch(html, /data-action="friends-import"/);
    assert.doesNotMatch(html, /data-friends-preview/);
    assert.doesNotMatch(html, /<summary>Подробнее<\/summary>/);
    assert.match(html, /data-action="friends-open"/);
    assert.match(html, /data-friend-copy="url"/);
  } finally {
    Object.assign(state, previous);
  }
});

test('TZ16 metadata operations permit explicit paired EXIF Make/Model without rewriting photos', async () => {
  const { readMetadataData } = await import('../../src/js/ui/photos.js');
  const { validateOperations } = await import('../../shared/metadata-operations.mjs');
  const { writeArgs } = require('../../electron/features/images/write-policy.cjs');
  const data = new Map([
    ['action-make', 'set'],
    ['value-make', 'Canon'],
    ['action-model', 'set'],
    ['value-model', 'EOS R5']
  ]);
  const ops = readMetadataData(data).filter((op) => ['make', 'model'].includes(op.field));
  assert.deepEqual(
    ops.map(({ origin, ...op }) => op),
    [
      { field: 'make', action: 'set', value: 'Canon' },
      { field: 'model', action: 'set', value: 'EOS R5' }
    ]
  );
  const safe = validateOperations(ops.map(({ origin, ...op }) => op));
  const args = writeArgs(safe, 'jpeg');
  assert.ok(args.includes('-EXIF:Make=Canon'));
  assert.ok(args.includes('-EXIF:Model=EOS R5'));
  assert.ok(args.includes('-XMP-tiff:Make=Canon'));
  assert.ok(args.includes('-XMP-tiff:Model=EOS R5'));
});

test('TZ16 News navigation icon and copy/photo layouts are distinct and responsive', async () => {
  const { I } = await import('../../src/js/icons.js');
  const { state } = await import('../../src/js/state.js');
  const { appHTML } = await import('../../src/js/ui/shell.js');
  const prior = state.view;
  try {
    state.view = 'news';
    const html = appHTML();
    assert.ok(I.newspaper.includes('<svg'));
    assert.ok(html.includes(I.newspaper));
    assert.notEqual(I.newspaper, I.globe);
  } finally {
    state.view = prior;
  }
  const css = fs.readFileSync(path.join(__dirname, '../../src/css/ux.css'), 'utf8');
  assert.match(css, /\.photo-workspace\.has-selection/);
  assert.match(css, /\.photo-device-card/);
  assert.match(css, /\.fp-friend-card/);
  assert.match(css, /\.copy-feedback/);
  assert.match(css, /@media\s*\(max-width:610px\)/);
});
