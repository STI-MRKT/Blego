const { test } = require('node:test');
const assert = require('node:assert/strict');
const { copyText } = require('../../electron/local/ipc.cjs');

test('over_10_mib_does_not_replace_clipboard, exact 10 MiB succeeds', async () => {
  let value = 'keep previous';
  const clipboard = {
    writeText: async (text) => {
      value = text;
    },
    readText: async () => value
  };
  const tooLarge = await copyText('é'.repeat(5 * 1024 * 1024 + 1), clipboard);
  assert.deepEqual(tooLarge, { ok: false, code: 'COPY_TOO_LARGE' });
  assert.equal(value, 'keep previous');
  const boundary = 'é'.repeat(5 * 1024 * 1024);
  assert.equal((await copyText(boundary, clipboard)).ok, true);
  assert.equal(value, boundary);
});

test('copy_denied_has_no_success, read-back mismatch has no success', async () => {
  const denied = await copyText('x', {
    writeText: async () => {
      throw Error('denied');
    },
    readText: async () => ''
  });
  assert.deepEqual(denied, { ok: false, code: 'CLIPBOARD_FAILED' });
  const raced = await copyText('x', {
    writeText: async () => {},
    readText: async () => 'other application'
  });
  assert.deepEqual(raced, { ok: false, code: 'CLIPBOARD_FAILED' });
});
