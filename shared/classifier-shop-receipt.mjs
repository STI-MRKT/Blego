// Narrow offline decoder for localized Accs Shop-like order receipts.
// Text labels may be localized; account rows remain positional TSV records.
// Never persists source credentials. Each row and Cookie remain record-local.
import { cookieInfo } from './classifier-recognition.mjs';

const FIELDS = new Map([
  [1, 'password'],
  [2, 'email'],
  [3, 'emailPassword'],
  [4, 'twoFactorUrl'],
  [5, 'fullName'],
  [6, 'birthDate'],
  [7, 'profileUrl'],
  [9, 'userAgent'],
  [10, 'cookies']
]);

const EMAIL = /^[^\s@;|]+@[^\s@;|]+\.[^\s@;|]+$/u;
const PROFILE = /^https:\/\/check\.fb\.tools\/(\d{13,20})\/?$/i;
const MFA = /^https:\/\/2fa\.fb\.tools\/[A-Z0-9]{8,128}\/?$/i;
const ROW_MARKERS = new Set(['-', '–', '—', '−', '•', '·']);

const LABELS = {
  product: [
    'Product title', 'Product name',
    'Название товара', 'Наименование товара', 'Товар',
    'Назва товару', 'Назва продукту', 'Найменування товару',
    'Produkttitel', 'Produktname', 'Produktbezeichnung',
    'Tytuł produktu', 'Nazwa produktu',
    'Název produktu', 'Název zboží',
    '商品标题', '产品标题', '商品名称', '商品標題', '產品標題', '商品名稱',
    'उत्पाद शीर्षक', 'उत्पाद का शीर्षक', 'उत्पाद का नाम'
  ],
  order: [
    'Order number', 'Order no', 'Order ID',
    'Номер заказа', 'Номер замовлення',
    'Bestellnummer', 'Auftragsnummer',
    'Numer zamówienia',
    'Číslo objednávky', 'Číslo zakázky',
    '订单号', '订单编号', '訂單號', '訂單編號',
    'ऑर्डर नंबर', 'आदेश संख्या', 'ऑर्डर संख्या'
  ],
  quantity: [
    'Product quantity', 'Quantity',
    'Количество товара', 'Количество',
    'Кількість товару', 'Кількість',
    'Produktmenge', 'Menge',
    'Ilość produktu', 'Ilość',
    'Množství produktu', 'Množství',
    '商品数量', '产品数量', '数量', '商品數量', '產品數量',
    'उत्पाद मात्रा', 'मात्रा'
  ],
  section: [
    'Your product', 'Your order',
    'Ваш товар', 'Ваш заказ', 'Ваш продукт',
    'Ваше замовлення',
    'Ihr Produkt', 'Ihre Bestellung',
    'Twój produkt', 'Twoje zamówienie',
    'Váš produkt', 'Vaše objednávka',
    '您的商品', '您的产品', '您的订单',
    '您的商品', '您的產品', '您的訂單',
    'आपका उत्पाद', 'आपका ऑर्डर', 'आपका सामान'
  ]
};

function normalizeLabel(value) {
  let normalized = String(value)
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u200b-\u200f\u2060\ufeff]/gu, '')
    .trim();

  // Fold Latin diacritics (German, Polish and Czech) without stripping
  // Devanagari vowel signs or other non-Latin combining marks.
  if (/\p{Script=Latin}/u.test(normalized) && !/\p{Script=Devanagari}/u.test(normalized)) {
    normalized = normalized.normalize('NFD').replace(/\p{M}/gu, '');
  }
  return normalized.replace(/[\p{P}\p{Z}\p{S}\s]+/gu, '');
}

const LABEL_MAP = Object.fromEntries(
  Object.entries(LABELS).map(([field, labels]) => [
    field,
    new Set(labels.map(normalizeLabel))
  ])
);

const DIGIT_ZEROES = [
  0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66,
  0xbe6, 0xc66, 0xce6, 0xd66, 0xe50, 0xed0, 0xf20,
  0x1040, 0x17e0, 0x1810, 0xff10
];

function digitsToAscii(value) {
  return Array.from(String(value), (character) => {
    const code = character.codePointAt(0);
    for (const zero of DIGIT_ZEROES) {
      if (code >= zero && code <= zero + 9) return String(code - zero);
    }
    return character;
  }).join('');
}

function labelledValues(prefix) {
  const found = {};
  for (const line of prefix.split(/\r\n|\r|\n/)) {
    const separator = line.search(/[:：]/u);
    if (separator < 0) continue;
    const label = normalizeLabel(line.slice(0, separator));
    const value = line.slice(separator + 1).trim();
    if (!value) continue;
    for (const field of ['product', 'order', 'quantity']) {
      if (!found[field] && LABEL_MAP[field].has(label)) found[field] = value;
    }
  }
  return found;
}

function sectionMarker(text) {
  let position = 0;
  while (position < text.length && position <= 12000) {
    let end = text.indexOf('\n', position);
    if (end < 0) end = text.length;
    let line = text.slice(position, end).replace(/\r$/u, '').trim();
    line = line.replace(/^[=\-–—_*#\s]+|[=\-–—_*#\s]+$/gu, '');
    if (LABEL_MAP.section.has(normalizeLabel(line))) {
      const after = end < text.length ? end + 1 : end;
      return { index: position, end: after };
    }
    position = end < text.length ? end + 1 : text.length;
  }
  return null;
}

function quantityValue(value) {
  const normalized = digitsToAscii(value).normalize('NFKC').trim();
  const match = /^(\d{1,6})(?:\s*(?:pcs?\.?|pieces?|шт\.?|штук(?:а|и)?|ед\.?|stück(?:e)?|stk\.?|szt(?:uk|y)?\.?|ks|kus(?:ů|u)?|个|件|件数|पीस|नग|इकाई))?$/iu.exec(normalized);
  return match ? Number(match[1]) : null;
}

function accountRow(line) {
  const cells = line.split('\t');
  return cells.length === 11 &&
    ROW_MARKERS.has(cells[0].trim()) &&
    EMAIL.test(cells[2].trim()) &&
    MFA.test(cells[4].trim()) &&
    PROFILE.test(cells[7].trim()) &&
    /^Mozilla\/\d/.test(cells[9].trim()) &&
    cells[10].trim().startsWith('[');
}

export function shopReceiptRecords(text) {
  if (typeof text !== 'string' || !text || text.length > 64 * 1024 * 1024) return null;

  const marker = sectionMarker(text);
  if (!marker || marker.index > 12000) return null;

  const prefix = text.slice(0, marker.index);
  const labels = labelledValues(prefix);
  const product = labels.product || '';
  const order = digitsToAscii(labels.order || '').replace(/^[#№\s]+/u, '').trim();
  const quantity = quantityValue(labels.quantity || '');

  if (!/(?:facebook|фейсбук|脸书|臉書|फेसबुक)/iu.test(product) ||
      !/^\d{1,12}$/u.test(order) ||
      quantity === null || quantity < 1) return null;

  const start = marker.end;
  let position = start;
  let lineNumber = text.slice(0, start).split(/\r\n|\r|\n/).length;
  const records = [], diagnostics = [];
  const columns = [...FIELDS.keys()].map((index) => 'column_' + (index + 1));

  while (position < text.length) {
    if (text[position] === '\r') {
      position++;
      if (text[position] === '\n') position++;
      lineNumber++;
      continue;
    }
    if (text[position] === '\n') {
      position++;
      lineNumber++;
      continue;
    }

    let end = position;
    while (end < text.length && text[end] !== '\r' && text[end] !== '\n') end++;
    const line = text.slice(position, end);
    const cells = line.split('\t');

    if (accountRow(line)) {
      if (records.length >= 100000) throw Error('TOO_MANY_RECORDS');
      const starts = [];
      let offset = position;
      for (const cell of cells) {
        starts.push(offset);
        offset += cell.length + 1;
      }

      const sourceEntries = [...FIELDS].flatMap(([index, header]) => {
        const rawText = cells[index];
        if (rawText.trim() === '-' || !rawText.trim()) return [];
        const trimmed = rawText.trim();
        const value = header === 'birthDate' ? digitsToAscii(trimmed) : trimmed;
        return [{
          column: 'column_' + (index + 1),
          header,
          value,
          rawText,
          range: { start: starts[index], end: starts[index] + rawText.length },
          labelled: true
        }];
      });

      const id = String(records.length + 1);
      const cookie = cookieInfo(cells[10].trim());
      const owners = cookie?.owners || [];
      const profile = PROFILE.exec(cells[7].trim())?.[1] || '';

      if (owners.length && (owners.length !== 1 || owners[0] !== profile)) {
        diagnostics.push({
          code: 'IDENTITY_CONFLICT',
          recordId: id,
          location: { startLine: lineNumber, endLine: lineNumber },
          level: 'warning'
        });
      }

      records.push({
        id,
        location: { startLine: lineNumber, endLine: lineNumber },
        range: { start: position, end },
        sourceRecord: line,
        sourceEntries,
        data: Object.fromEntries(sourceEntries.map((entry) => [entry.column, entry.value])),
        raw: sourceEntries.map((entry) => entry.rawText)
      });
    } else if (line.trim() && /^\s*[-–—−•·]\s*\t/u.test(line)) {
      // A damaged account-looking row must be reviewed, not silently dropped.
      return null;
    }

    position = end;
    if (text[position] === '\r') position++;
    if (text[position] === '\n') position++;
    lineNumber++;
  }

  if (!records.length || records.length !== quantity) return null;
  return {
    records,
    diagnostics,
    columns,
    headerless: false,
    structured: true,
    delimiter: '\t',
    receiptLanguage: detectReceiptLanguage(prefix)
  };
}

function detectReceiptLanguage(prefix) {
  const sample = prefix.toLocaleLowerCase();
  if (/(?:номер заказа|название товара|наименование товара|количество товара)/u.test(sample)) return 'ru';
  if (/(?:номер замовлення|назва товару|найменування товару|кількість товару)/u.test(sample)) return 'uk';
  if (/(?:bestellnummer|auftragsnummer|produkttitel|produktname|produktbezeichnung|produktmenge|ihre bestellung)/u.test(sample)) return 'de';
  if (/(?:numer zamówienia|tytuł produktu|nazwa produktu|ilość produktu|twoje zamówienie)/u.test(sample)) return 'pl';
  if (/(?:číslo objednávky|číslo zakázky|název produktu|název zboží|množství produktu|vaše objednávka)/u.test(sample)) return 'cs';
  if (/(?:订单号|订单编号|商品标题|产品标题|商品数量|您的订单|您的商品)/u.test(sample)) return 'zh';
  if (/(?:ऑर्डर नंबर|आदेश संख्या|उत्पाद शीर्षक|उत्पाद का शीर्षक|उत्पाद मात्रा)/u.test(sample)) return 'hi';
  return 'en';
}
