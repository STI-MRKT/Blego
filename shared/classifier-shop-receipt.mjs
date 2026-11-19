// Narrow offline decoder for explicit Accs Shop-like English order receipts.
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

export function shopReceiptRecords(text) {
  const marker = /^=== Your product ===\s*$/im.exec(text);
  if (!marker || marker.index > 12000) return null;
  const prefix = text.slice(0, marker.index);
  if (!/^Product title:\s*Facebook\b/im.test(prefix) ||
      !/^Order number:\s*#?\d{1,12}\s*$/im.test(prefix) ||
      !/^Product quantity:\s*\d{1,6}\s*pcs\.\s*$/im.test(prefix)) return null;

  const start = marker.index + marker[0].length;
  let position = start, lineNumber = text.slice(0, start).split(/\r\n|\r|\n/).length;
  const records = [], diagnostics = [];
  const columns = [...FIELDS.keys()].map((index) => 'column_' + (index + 1));
  while (position < text.length) {
    if (text[position] === '\r') { position++; if (text[position] === '\n') position++; lineNumber++; continue; }
    if (text[position] === '\n') { position++; lineNumber++; continue; }
    let end = position;
    while (end < text.length && text[end] !== '\r' && text[end] !== '\n') end++;
    const line = text.slice(position, end);
    const cells = line.split('\t');
    if (cells.length === 11 && cells[0].trim() === '-' &&
        EMAIL.test(cells[2].trim()) && MFA.test(cells[4].trim()) &&
        PROFILE.test(cells[7].trim()) &&
        /^Mozilla\/\d/.test(cells[9].trim()) &&
        cells[10].trim().startsWith('[')) {
      if (records.length >= 100000) throw Error('TOO_MANY_RECORDS');
      const starts = [];
      let offset = position;
      for (const cell of cells) { starts.push(offset); offset += cell.length + 1; }
      const sourceEntries = [...FIELDS].flatMap(([index, header]) => {
        const rawText = cells[index];
        if (rawText.trim() === '-' || !rawText.trim()) return [];
        return [{
          column: 'column_' + (index + 1), header, value: rawText.trim(),
          rawText, range: { start: starts[index], end: starts[index] + rawText.length },
          labelled: true
        }];
      });
      const id = String(records.length + 1);
      const cookie = cookieInfo(cells[10].trim());
      const owners = cookie?.owners || [];
      const profile = PROFILE.exec(cells[7].trim())?.[1] || '';
      if (owners.length && (owners.length !== 1 || owners[0] !== profile))
        diagnostics.push({
          code: 'IDENTITY_CONFLICT', recordId: id,
          location: { startLine: lineNumber, endLine: lineNumber }, level: 'warning'
        });
      records.push({
        id, location: { startLine: lineNumber, endLine: lineNumber },
        range: { start: position, end }, sourceRecord: line,
        sourceEntries,
        data: Object.fromEntries(sourceEntries.map((entry) => [entry.column, entry.value])),
        raw: sourceEntries.map((entry) => entry.rawText)
      });
    } else if (line.trim() && /^\s*-\s*\t/.test(line)) {
      // A damaged account-looking row must be reviewed, not silently dropped.
      return null;
    }
    position = end;
    if (text[position] === '\r') position++;
    if (text[position] === '\n') position++;
    lineNumber++;
  }
  if (!records.length) return null;
  return {
    records, diagnostics, columns,
    headerless: false, structured: true, delimiter: '\t'
  };
}
