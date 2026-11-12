const { test } = require('node:test');
const assert = require('node:assert/strict');
test('saved checkbox drafts preserve selected date namespaces without promoting unchecked fields', async () => {
  const { readMetadataData } = await import('../../src/js/ui/photos.js');
  for (const action of ['set', 'remove'])
    for (const selected of [[], ['exif'], ['xmp'], ['exif', 'xmp']]) {
      const draft = new Map([
        ['action-captureDate', action],
        ['date-local', '2024-02-29T12:34:56'],
        ['date-offset-mode', 'keep'],
        ...['exif', 'xmp'].map((k) => ['date-scope-' + k, selected.includes(k)])
      ]);
      assert.deepEqual(
        readMetadataData(draft).find((op) => op.field === 'captureDate').scope,
        selected
      );
      const form = new FormData();
      for (const [key, value] of draft)
        if (value !== false) form.set(key, value === true ? 'on' : value);
      assert.deepEqual(
        readMetadataData(form).find((op) => op.field === 'captureDate').scope,
        selected
      );
    }
});
