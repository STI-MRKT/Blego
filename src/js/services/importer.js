import { t } from '../i18n.js';

const CANONICAL = [
  ['project', ['project', 'проект', 'name', 'title']],
  ['owner', ['owner', 'владелец', 'owner_name', 'user']],
  ['email', ['email', 'e-mail', 'почта', 'mail']],
  ['note', ['note', 'заметка', 'comment', 'description']],
  ['status', ['status', 'статус', 'state']]
];

function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find((row) => row.trim().length) || '';
  const counts = [
    [';', (line.match(/;/g) || []).length],
    [',', (line.match(/,/g) || []).length],
    ['\t', (line.match(/\t/g) || []).length]
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] ? counts[0][0] : ',';
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      value = '';
      rows.push(row);
      row = [];
    } else if (char !== '\r') {
      value += char;
    }
  }
  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ''));
}

function mapHeader(header) {
  const value = String(header).trim().toLowerCase();
  const match = CANONICAL.find(([, aliases]) => aliases.includes(value));
  return match ? match[0] : null;
}

function buildRows(headers, rawRows) {
  const mapping = headers.map(mapHeader);
  const columns = [];
  mapping.forEach((key) => {
    if (key && !columns.includes(key)) columns.push(key);
  });
  if (!columns.length) return { error: 'columns' };
  const rows = rawRows.map((raw) => {
    const data = {};
    columns.forEach((column) => {
      const index = mapping.indexOf(column);
      data[column] = String(raw[index] ?? '').trim();
    });
    const issues = [];
    if (!data.project) issues.push('no-project');
    if (!data.owner) issues.push('no-owner');
    if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(data.email)) issues.push('bad-email');
    const level = !data.project && !data.owner ? 'error' : issues.length ? 'warn' : 'ok';
    return { data, issues, level };
  });
  return { columns, rows };
}

export function parseFile(text, extension) {
  if (extension === 'json') {
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      void error;
      return { error: 'json' };
    }
    if (!Array.isArray(data) || !data.length) return { error: 'json-shape' };
    const headers = [];
    data.slice(0, 50).forEach((entry) => {
      if (entry && typeof entry === 'object') {
        Object.keys(entry).forEach((key) => {
          if (!headers.includes(key)) headers.push(key);
        });
      }
    });
    const raw = data.map((entry) => headers.map((key) => (entry && typeof entry === 'object' ? entry[key] : '')));
    const built = buildRows(headers, raw);
    if (built.error) return built;
    return { ...built, delimiter: '·' };
  }
  const delimiter = extension === 'tsv' ? '\t' : detectDelimiter(text);
  const table = parseDelimited(text, delimiter);
  if (table.length < 2) return { error: 'empty' };
  const headers = table[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  const built = buildRows(headers, table.slice(1));
  if (built.error) return built;
  return { ...built, delimiter };
}

export function importErrorMessage(code) {
  switch (code) {
    case 'json':
      return t('JSON не читается. Проверьте синтаксис: массив объектов с полями.', 'JSON is not valid. Expect an array of objects with fields.');
    case 'json-shape':
      return t('Ожидается непустой массив объектов.', 'Expected a non-empty array of objects.');
    case 'empty':
      return t('В файле нет строк данных или не найдены заголовки.', 'The file has no data rows or headers were not found.');
    case 'columns':
      return t('Не удалось распознать колонки. Нужны хотя бы project, owner или email.', 'Couldn’t recognize columns. Need at least project, owner or email.');
    case 'ext':
      return t('Поддерживаются только CSV, TSV и JSON.', 'Only CSV, TSV and JSON are supported.');
    case 'size':
      return t('Файл больше 5 МБ. Для макета это лишнее.', 'The file is over 5 MB — unnecessary for a prototype.');
    default:
      return t('Неизвестная ошибка разбора.', 'Unknown parsing error.');
  }
}

export function issueText(code) {
  switch (code) {
    case 'no-project':
      return t('не указан проект', 'missing project');
    case 'no-owner':
      return t('не указан владелец', 'missing owner');
    case 'bad-email':
      return t('неверный email', 'invalid email');
    default:
      return code;
  }
}
