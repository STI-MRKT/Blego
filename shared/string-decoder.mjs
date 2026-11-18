// Local-only, text-only decoding. No persistence, logging, networking, or evaluation.
// Browser and Node 24 share atob(), TextDecoder and JSON.parse().
export const MAX_INPUT_LENGTH = 2 * 1024 * 1024;
const MAX_OUTPUT_LENGTH = 4 * 1024 * 1024;
const MAX_LAYERS = 3;
const MAX_EMBEDDED = 8;
const UTF8 = new TextDecoder('utf-8', { fatal: true });
const formats = new Set(['auto', 'base64', 'base64url', 'url', 'hex']);

function invalid(code) {
  throw Object.assign(new Error(code), { code });
}

function withinLimit(text) {
  if (text.length > MAX_OUTPUT_LENGTH) invalid('OUTPUT_TOO_LARGE');
  return text;
}

function decodeUTF8(bytes) {
  try {
    return withinLimit(UTF8.decode(bytes));
  } catch (error) {
    if (error?.code === 'OUTPUT_TOO_LARGE') throw error;
    invalid('INVALID_UTF8');
  }
}

function base64Bytes(text, format) {
  let compact = text.replace(/\s/g, '');
  const valid =
    format === 'base64url'
      ? /^[A-Za-z0-9_-]*={0,2}$/.test(compact)
      : /^[A-Za-z0-9+/]*={0,2}$/.test(compact);
  if (
    !compact ||
    !valid ||
    compact.length % 4 === 1 ||
    (compact.includes('=') && compact.length % 4 !== 0)
  )
    invalid('INVALID_BASE64');
  if (format === 'base64url') compact = compact.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binary = atob(compact);
    if (binary.length > MAX_OUTPUT_LENGTH) invalid('OUTPUT_TOO_LARGE');
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch (error) {
    if (error?.code === 'OUTPUT_TOO_LARGE') throw error;
    invalid('INVALID_BASE64');
  }
}

function hexBytes(input) {
  const compact = input.replace(/0x/gi, '').replace(/[\s:]/g, '');
  if (!compact || compact.length % 2 !== 0 || /[^a-f\d]/i.test(compact)) invalid('INVALID_HEX');
  const bytes = new Uint8Array(compact.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(compact.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function decodeOne(input, format) {
  if (format === 'base64' || format === 'base64url') return decodeUTF8(base64Bytes(input, format));
  if (format === 'hex') return decodeUTF8(hexBytes(input));
  if (format === 'url') {
    try {
      return withinLimit(decodeURIComponent(input.replace(/\+/g, ' ')));
    } catch (error) {
      if (error?.code === 'OUTPUT_TOO_LARGE') throw error;
      invalid('INVALID_URL');
    }
  }
  invalid('UNSUPPORTED_FORMAT');
}

function isJSON(value) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function likelyAutoFormat(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes('%')) return 'url';
  if (
    /^(?:\s*(?:0x)?[a-f\d]{2}(?:(?:\s+|:)+|$))+$/i.test(trimmed) ||
    (/^[a-f\d]+$/i.test(trimmed) && trimmed.length >= 8 && trimmed.length % 2 === 0)
  )
    return 'hex';
  const compact = trimmed.replace(/\s/g, '');
  // Plain multi-word prose is not enough evidence for Base64 autodetection.
  if (/\s/.test(trimmed) && !/[=+/_-\d]/.test(compact)) return null;
  if (
    compact.length >= 8 &&
    compact.length % 4 !== 1 &&
    /^[A-Za-z0-9+/_-]*={0,2}$/.test(compact) &&
    /[A-Za-z]/.test(compact)
  )
    return /[-_]/.test(compact) ? 'base64url' : 'base64';
  return null;
}

function jsonEnd(bytes) {
  if (bytes[0] !== 0x5b && bytes[0] !== 0x7b) return -1;
  const stack = [];
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < bytes.length; i++) {
    const char = bytes[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === 0x5c) escaped = true;
      else if (char === 0x22) quoted = false;
      continue;
    }
    if (char === 0x22) quoted = true;
    else if (char === 0x7b || char === 0x5b) stack.push(char);
    else if (char === 0x7d || char === 0x5d) {
      const expected = char === 0x7d ? 0x7b : 0x5b;
      if (stack.pop() !== expected) return -1;
      if (stack.length === 0) return i + 1;
    }
  }
  return -1;
}

// A concatenated account export can contain Base64(JSON) immediately followed
// by another record, without a separator. Stop at the JSON root closing byte,
// not at the end of the maximal Base64-looking substring.
function embeddedJSON(input) {
  const found = [];
  const pattern = /(^|[:;|\s])([A-Za-z0-9+/_-]{40,}={0,2})/g;
  let match;
  while ((match = pattern.exec(input)) && found.length < MAX_EMBEDDED) {
    const token = match[2];
    if (!/^(?:W[wy3]|e[wy])/i.test(token)) continue;
    const format = /[-_]/.test(token) ? 'base64url' : 'base64';
    let compact = token;
    // Preserve valid trailing padding. For concatenated unpadded rows,
    // trim only incomplete trailing groups, never the JSON root bytes.
    if (!compact.includes('=')) compact = compact.slice(0, compact.length - (compact.length % 4));
    if (!compact || compact.length > MAX_INPUT_LENGTH) continue;
    let decoded;
    try {
      decoded = base64Bytes(compact, format);
    } catch {
      continue;
    }
    const end = jsonEnd(decoded);
    if (end < 0) continue;
    try {
      const text = decodeUTF8(decoded.subarray(0, end));
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') continue;
      found.push(JSON.stringify(parsed, null, 2));
    } catch {
      // A damaged embedded payload is not treated as an account field.
    }
  }
  return found;
}

export function decodeString(input, format = 'auto') {
  if (!formats.has(format)) invalid('UNSUPPORTED_FORMAT');
  if (typeof input !== 'string') invalid('INVALID_INPUT');
  if (input.length > MAX_INPUT_LENGTH) invalid('INPUT_TOO_LARGE');
  if (!input.trim()) invalid('EMPTY_INPUT');

  let current = input;
  let lastFormat = 'plain';
  let layers = 0;
  let embedded = false;
  let fragments = 0;
  const detected = [];

  for (let step = 0; step < MAX_LAYERS; step++) {
    const requested = step === 0 && format !== 'auto' ? format : likelyAutoFormat(current);
    if (!requested) {
      if (step === 0 && format === 'auto' && isJSON(current) === undefined) {
        const matches = embeddedJSON(current);
        if (matches.length) {
          current =
            matches.length === 1
              ? matches[0]
              : matches.map((text, index) => 'Фрагмент ' + (index + 1) + ':\n' + text).join('\n\n');
          embedded = true;
          fragments = matches.length;
          detected.push('base64 (встроенный JSON)');
          lastFormat = 'base64';
          layers = 1;
        }
      }
      break;
    }
    let next;
    try {
      next = decodeOne(current, requested);
    } catch (error) {
      if (step === 0 && format === 'auto') {
        const matches = embeddedJSON(current);
        if (matches.length) {
          current =
            matches.length === 1
              ? matches[0]
              : matches.map((text, index) => 'Фрагмент ' + (index + 1) + ':\n' + text).join('\n\n');
          embedded = true;
          fragments = matches.length;
          detected.push('base64 (встроенный JSON)');
          lastFormat = 'base64';
          layers = 1;
          break;
        }
      }
      if (step > 0) break;
      throw error;
    }
    if (next === current) break;
    current = next;
    detected.push(requested);
    lastFormat = requested;
    layers++;
    if (isJSON(current) !== undefined) break;
  }

  if (!layers && isJSON(current) === undefined) invalid('FORMAT_NOT_DETECTED');
  const parsed = isJSON(current);
  const json = parsed !== undefined && !(embedded && fragments > 1);
  const output = withinLimit(json ? JSON.stringify(parsed, null, 2) : current);
  return { output, format: lastFormat, layers, json, embedded, fragments, detected };
}

export const decoderErrorMessage = (code) =>
  ({
    EMPTY_INPUT: 'Вставьте строку для декодирования.',
    INVALID_INPUT: 'Неверный тип входных данных.',
    INPUT_TOO_LARGE: 'Строка превышает 2 МиБ. Разделите её на части.',
    OUTPUT_TOO_LARGE: 'Результат превышает допустимый размер 4 МиБ.',
    INVALID_BASE64: 'Некорректный Base64: проверьте алфавит и символы заполнения.',
    INVALID_URL: 'Некорректное URL-кодирование: проверьте последовательности %XX и UTF-8.',
    INVALID_HEX: 'Некорректный Hex: нужны пары шестнадцатеричных символов.',
    INVALID_UTF8: 'Декодированные байты не являются корректным текстом UTF-8.',
    UNSUPPORTED_FORMAT: 'Неизвестный формат кодирования.',
    FORMAT_NOT_DETECTED: 'Не удалось определить кодировку. Выберите формат вручную.'
  })[code] || 'Не удалось декодировать строку.';
