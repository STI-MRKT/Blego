// Explicit TXT label<TAB>payload framing. Payloads are literal source slices;
// punctuation, quotation marks and surrounding spaces are never field syntax.
export function tabLabelRecords(text, headerFor) {
  if (!text.includes('\t')) return null;
  const lines = [];
  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (!match[0]) continue;
    lines.push({
      text: match[1],
      start: match.index,
      end: match.index + match[1].length,
      line: lines.length + 1
    });
  }
  const cleanLabel = (label) =>
    label
      .trim()
      .replace(/\s*[:=]$/, '')
      .trim();
  const labelShape = (label) => /^[\p{L}\p{N}_ ()-]{1,64}$/u.test(cleanLabel(label));
  const cellsOf = (line) => line.text.split('\t');
  const firstPair = (line) => {
    const tab = line.text.indexOf('\t');
    return tab >= 0 && labelShape(line.text.slice(0, tab))
      ? { label: cleanLabel(line.text.slice(0, tab)), tab }
      : null;
  };
  const candidates = lines.filter((line) => headerFor(firstPair(line)?.label || ''));
  if (!candidates.length) return null;
  const first = cellsOf(candidates[0]);
  // Preserve ordinary header tables, including two-column tables. A two-cell
  // line of labels needs subsequent vertical label evidence to be a block.
  if (
    first.every((cell) => headerFor(cleanLabel(cell))) &&
    (first.length > 2 ||
      !candidates
        .slice(1)
        .some((line) => !cellsOf(line).every((cell) => headerFor(cleanLabel(cell)))))
  )
    return null;
  const rows = [],
    diagnostics = [],
    columns = [],
    columnSet = new Set();
  let entries = [],
    seenRoles = new Set(),
    start = 0,
    end = 0,
    startLine = 1,
    endLine = 1;
  const problem = (code) => Object.assign(Error(code), { code });
  const prose = (value) =>
    /^(?:#|\/\/|--|Instructions?|Comments?|Notes?|Description|Инструкция|Комментарий|Примечание)(?:[:.\s]|$)/iu.test(
      value.trim()
    );
  function flush() {
    if (!entries.length) return;
    if (!seenRoles.size && entries.every((entry) => prose(entry.rawText))) {
      entries = [];
      return;
    }
    if (rows.length >= 100000) throw problem('TOO_MANY_RECORDS');
    const id = String(rows.length + 1);
    rows.push({
      id,
      location: { startLine, endLine },
      range: { start, end },
      sourceRecord: text.slice(start, end),
      sourceEntries: entries,
      data: Object.fromEntries(entries.map((entry) => [entry.column, entry.value])),
      raw: entries.map((entry) => entry.rawText)
    });
    entries = [];
    seenRoles = new Set();
  }
  function add(label, from, to, labelStart, line, lastLine = line) {
    const role = label ? headerFor(label) : null;
    if (
      (role === 'login' && seenRoles.has('login')) ||
      (role === 'accountId' && seenRoles.has('accountId') && !seenRoles.has('login'))
    )
      flush();
    if (!entries.length) {
      start = labelStart;
      startLine = line;
    }
    if (entries.length >= 512) throw problem('TOO_MANY_FIELDS');
    const base = label || `column_${entries.length + 1}`;
    let column = base,
      duplicate = 1;
    while (entries.some((entry) => entry.column === column)) column = `${base}[${++duplicate}]`;
    if (!columnSet.has(column)) {
      columns.push(column);
      columnSet.add(column);
    }
    const value = text.slice(from, to);
    entries.push({
      column,
      header: label,
      value,
      rawText: value,
      range: { start: from, end: to },
      labelled: true
    });
    if (role) seenRoles.add(role);
    end = to;
    endLine = lastLine;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.text.trim()) {
      flush();
      continue;
    }
    const pair = firstPair(line);
    if (!pair) {
      add(null, line.start, line.end, line.start, line.line);
      continue;
    }
    const cells = cellsOf(line);
    const horizontal =
      cells.length >= 4 &&
      cells.length % 2 === 0 &&
      cells.filter((_, index) => index % 2 === 0).every(labelShape) &&
      cells.filter((_, index) => index % 2 === 0).filter((label) => headerFor(cleanLabel(label)))
        .length >= 2;
    if (horizontal) {
      let offset = line.start;
      for (let j = 0; j < cells.length; j += 2) {
        const valueStart = offset + cells[j].length + 1;
        add(cleanLabel(cells[j]), valueStart, valueStart + cells[j + 1].length, offset, line.line);
        offset = valueStart + cells[j + 1].length + 1;
      }
      continue;
    }
    const valueStart = line.start + pair.tab + 1;
    let valueEnd = line.end,
      lastLine = line.line;
    // Pretty-printed Cookie JSON is one literal field. A following explicit
    // label still provides a recovery boundary for malformed JSON.
    if (
      headerFor(pair.label) === 'cookies' &&
      /^[\s]*[\[{]/u.test(text.slice(valueStart, valueEnd))
    ) {
      let depth = 0,
        quoted = false,
        escaped = false;
      const scan = (fragment) => {
        for (const char of fragment) {
          if (quoted) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') quoted = false;
          } else if (char === '"') quoted = true;
          else if (char === '[' || char === '{') {
            if (++depth > 64) throw problem('JSON_TOO_DEEP');
          } else if (char === ']' || char === '}') depth--;
        }
      };
      scan(text.slice(valueStart, valueEnd));
      while (
        depth > 0 &&
        i + 1 < lines.length &&
        !headerFor(firstPair(lines[i + 1])?.label || '')
      ) {
        const next = lines[++i];
        scan(text.slice(valueEnd, next.end));
        valueEnd = next.end;
        lastLine = next.line;
      }
    }
    add(pair.label, valueStart, valueEnd, line.start, line.line, lastLine);
  }
  flush();
  return {
    records: rows,
    diagnostics,
    columns,
    delimiter: '\t',
    headerless: false,
    structured: true
  };
}
