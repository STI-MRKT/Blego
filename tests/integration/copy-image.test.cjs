const { test } = require('node:test');
const assert = require('node:assert/strict');
test('image clipboard rejects denial and pixel readback mismatch', async () => {
  const { copyImage } = require('../../electron/local/ipc.cjs');
  const expected = {
    isEmpty: () => false,
    toBitmap: () => Buffer.from([1, 2]),
    toPNG: () => Buffer.from([1, 2]),
    getSize: () => ({ width: 1, height: 1 })
  };
  const api = {
    ClipboardItem: class {
      constructor(data) {
        this.types = Object.keys(data);
        this.getType = async (key) => data[key];
      }
    },
    nativeImage: { createFromBuffer: () => expected }
  };
  const entry = new api.ClipboardItem({ 'image/png': new Blob([Buffer.from([1, 2])]) });
  assert.deepEqual(
    await copyImage(
      expected,
      {
        write: async () => {
          throw Error('denied');
        }
      },
      api
    ),
    { ok: false, code: 'CLIPBOARD_FAILED' }
  );
  assert.deepEqual(
    await copyImage(expected, { write: async () => {}, read: async () => [] }, api),
    { ok: false, code: 'CLIPBOARD_FAILED' }
  );
  assert.deepEqual(
    await copyImage(expected, { write: async () => {}, read: async () => [entry] }, api),
    { ok: true }
  );
  api.nativeImage.createFromBuffer = () => ({ ...expected, toBitmap: () => Buffer.from([3, 4]) });
  assert.deepEqual(
    await copyImage(expected, { write: async () => {}, read: async () => [entry] }, api),
    { ok: false, code: 'CLIPBOARD_FAILED' }
  );
});
