const { test } = require('node:test');
const assert = require('node:assert/strict');

test('MetaPainter always exposes exported copy names in the simple view', async () => {
  const { state } = await import('../../src/js/state.js');
  const { photosHTML } = await import('../../src/js/ui/photos.js');
  const keys = [
    'photos',
    'photoTools',
    'metadataPlan',
    'metadataExport',
    'metadataProgress',
    'imagesBusy',
    'imagesReading',
    'imageScan'
  ];
  const prior = Object.fromEntries(keys.map((key) => [key, state[key]]));
  try {
    state.photos = [];
    state.photoTools = false;
    state.metadataPlan = null;
    state.imagesBusy = false;
    state.imagesReading = false;
    state.imageScan = null;
    state.metadataProgress = {};
    state.metadataExport = {
      files: [
        {
          fileId: 'synthetic-file-id',
          name: 'original.jpg',
          status: 'completed',
          outputName: 'original_meta_2026-11-18__test.jpg'
        }
      ]
    };
    const html = photosHTML();
    assert.ok(html.includes('data-exported-copy="synthetic-file-id"'));
    assert.ok(html.includes('original_meta_2026-11-18__test.jpg'));
    assert.ok(html.includes('Исходные фотографии не изменены'));
    assert.ok(html.includes('EXIF'));
    assert.ok(html.includes('Finder'));
    assert.ok(html.includes('Spotlight'));
  } finally {
    Object.assign(state, prior);
  }
});
