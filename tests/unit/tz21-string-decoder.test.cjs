const { test } = require('node:test');
const assert = require('node:assert/strict');

async function decoder() {
  return import('../../shared/string-decoder.mjs');
}
const encode = (value) => Buffer.from(value, 'utf8').toString('base64');

test('TZ21 Base64 and Base64 URL-safe preserve Unicode and pretty-print JSON', async () => {
  const { decodeString } = await decoder();
  const source = JSON.stringify({ message: 'Привет', active: true, count: 3 });
  const first = decodeString(encode(source), 'base64');
  assert.equal(first.output, JSON.stringify(JSON.parse(source), null, 2));
  assert.equal(first.json, true);
  assert.equal(first.layers, 1);
  assert.equal(first.format, 'base64');
  const safe = encode('Русский текст + /')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  assert.equal(decodeString(safe, 'base64url').output, 'Русский текст + /');
});

test('TZ21 whitespace Base64, percent encoding and hex bytes decode strictly', async () => {
  const { decodeString } = await decoder();
  assert.equal(decodeString(' SGVs\n bG8= ', 'base64').output, 'Hello');
  assert.equal(
    decodeString('%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82+world', 'url').output,
    'Привет world'
  );
  assert.equal(decodeString('48 65 6c 6c 6f', 'hex').output, 'Hello');
  assert.equal(decodeString('0x48 0x65 0x6c 0x6c 0x6f', 'hex').output, 'Hello');
});

test('TZ21 auto identifies encoding and returns nested encoding depth', async () => {
  const { decodeString } = await decoder();
  assert.equal(decodeString('48656c6c6f', 'auto').output, 'Hello');
  assert.equal(decodeString('SGVsbG8=', 'auto').output, 'Hello');
  const inner = encode('{"result":"ok"}');
  const outer = encode(inner);
  const result = decodeString(outer, 'auto');
  assert.equal(result.output, '{\n  "result": "ok"\n}');
  assert.equal(result.layers, 2);
  assert.equal(result.json, true);
});

test('TZ21 embedded Base64 JSON is extracted from a compound string, even with concatenated rows', async () => {
  const { decodeString } = await decoder();
  const json = JSON.stringify([{ name: 'synthetic_cookie', value: 'EXAMPLE_ONLY' }]);
  const base64 = encode(json);
  const line = 'sample@example.test:DEMO_PASSWORD:61500000123456:' + base64;
  const joined = line + 'sample@example.test:DEMO_PASSWORD:61500000123456:' + base64;
  const result = decodeString(joined, 'auto');
  assert.equal(result.embedded, true);
  assert.equal(result.fragments, 2);
  assert.equal(result.layers, 1);
  assert.equal((result.output.match(/synthetic_cookie/g) || []).length, 2);
  assert.ok(!result.output.includes('DEMO_PASSWORD'));
});

test('TZ21 invalid Base64 / percent / hex / UTF-8 produce explicit errors, not corrupted data', async () => {
  const { decodeString } = await decoder();
  for (const [value, format, code] of [
    ['SGVsbG8$', 'base64', 'INVALID_BASE64'],
    ['SGVsbG8===', 'base64', 'INVALID_BASE64'],
    ['a', 'base64url', 'INVALID_BASE64'],
    ['%E0%A4%A', 'url', 'INVALID_URL'],
    ['4G', 'hex', 'INVALID_HEX'],
    ['ABC', 'hex', 'INVALID_HEX'],
    ['//8=', 'base64', 'INVALID_UTF8']
  ]) {
    assert.throws(() => decodeString(value, format), { code }, format);
  }
});

test('TZ21 empty, too large, plain text and unsafe format are handled without execution', async () => {
  const { decodeString, MAX_INPUT_LENGTH } = await decoder();
  assert.throws(() => decodeString(' \n ', 'auto'), { code: 'EMPTY_INPUT' });
  assert.throws(() => decodeString('sample text', 'auto'), { code: 'FORMAT_NOT_DETECTED' });
  assert.throws(() => decodeString('abc', 'unsafe'), { code: 'UNSUPPORTED_FORMAT' });
  assert.throws(() => decodeString('a'.repeat(MAX_INPUT_LENGTH + 1), 'base64'), {
    code: 'INPUT_TOO_LARGE'
  });
  const html = '<script>globalThis.malicious=true</script>';
  const result = decodeString(encode(html), 'base64');
  assert.equal(result.output, html);
});

test('TZ21 max nesting depth is finite and no partial garbage output leaks', async () => {
  const { decodeString } = await decoder();
  let nested = encode('{"ok":true}');
  for (let i = 0; i < 4; i++) nested = encode(nested);
  const result = decodeString(nested, 'auto');
  assert.equal(result.layers, 3);
  assert.ok(result.output.length > 0);
});
