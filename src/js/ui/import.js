import { state } from '../state.js';
import { t } from '../i18n.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { cellHTML } from './cell.js';
import { issueText } from '../services/importer.js';

export function importHTML() {
  if (state.importStep === 'saved') {
    const saved = state.importSaved;
    return `<div class="page">
      <div class="page-head"><div><div class="eyebrow">${t('Импорт', 'Import')}</div><h1>${t('Данные сохранены в историю', 'Saved to history')}</h1></div></div>
      <div class="card pad" style="text-align:center;padding:44px 24px">
        <div class="orb" style="color:var(--ok);font-size:0">${I.check}</div>
        <h3 style="font-size:16px;font-weight:640;margin-top:16px">${t('Файл разобран', 'File parsed')}</h3>
        <p class="sub" style="margin:7px auto 0">${esc(saved.name)} · <b>${saved.rowCount}</b> ${t('записей', 'records')} · ${saved.problems ? t('с предупреждениями', 'with warnings') : t('без ошибок', 'no errors')}</p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:20px">
          <button class="btn" data-action="import-reset">${t('Загрузить ещё', 'Upload another')}</button>
          <button class="btn btn-primary" data-action="set-view" data-view="history">${t('Открыть историю', 'Open history')}${I.arrow}</button>
        </div>
      </div>
    </div>`;
  }
  if (state.importStep === 'error') {
    return `<div class="page">
      <div class="page-head"><div><div class="eyebrow">${t('Импорт', 'Import')}</div><h1>${t('Не удалось прочитать файл', 'Couldn’t read the file')}</h1></div></div>
      <div class="card pad">
        <div class="banner err">${I.alert}<div><b>${esc(state.importName || t('Файл', 'File'))}</b><br>${esc(state.importError)}</div></div>
        <div style="display:flex;gap:8px">
          <button class="btn" data-action="import-reset">${t('Выбрать другой файл', 'Choose another file')}</button>
        </div>
        <p class="sub" style="margin-top:14px">${t('Поддерживаются CSV, TSV и JSON. Первая строка CSV/TSV должна содержать заголовки.', 'CSV, TSV and JSON are supported. The first CSV/TSV row must contain headers.')}</p>
      </div>
    </div>`;
  }
  if (state.importStep === 'loading') {
    return `<div class="page">
      <div class="page-head"><div><div class="eyebrow">${t('Импорт', 'Import')}</div><h1>${t('Разбираем файл', 'Parsing file')}</h1><p class="sub">${t('Проверяем строки, колонки и пустые поля.', 'Checking rows, columns and empty fields.')}</p></div></div>
      <div class="card pad">
        <div class="file-pill"><span class="fi">${I.file}</span><span>${esc(state.importName)}</span></div>
        <div class="progress"><i></i></div>
        <p class="sub" style="margin-top:12px">${t('Обычно занимает меньше секунды.', 'Usually takes less than a second.')}</p>
      </div>
    </div>`;
  }
  if (state.importStep === 'preview' && state.importData) {
    const data = state.importData;
    const errors = data.rows.filter((row) => row.level === 'error').length;
    const warnings = data.rows.filter((row) => row.level === 'warn').length;
    const valid = data.rows.length - errors - warnings;
    const shown = data.rows.slice(0, 8);
    const issues = data.rows
      .map((row, index) => ({ row, index }))
      .filter((entry) => entry.row.issues.length)
      .slice(0, 4);
    return `<div class="page">
      <div class="page-head">
        <div><div class="eyebrow">${t('Импорт', 'Import')}</div><h1>${t('Предпросмотр', 'Preview')}</h1><p class="sub">${esc(state.importName)}</p></div>
        <div class="head-actions">
          <button class="btn btn-quiet" data-action="import-reset">${t('Отменить', 'Discard')}</button>
          <button class="btn btn-primary" data-action="import-save">${t('Сохранить в историю', 'Save to history')}</button>
        </div>
      </div>
      <div class="summary">
        <span class="s-chip"><b>${data.rows.length}</b> ${t('строк', 'rows')}</span>
        <span class="s-chip" style="color:var(--ok)"><span class="dot ok"></span><b>${valid}</b> ${t('в порядке', 'valid')}</span>
        <span class="s-chip" style="color:var(--warn)"><span class="dot warn"></span><b>${warnings}</b> ${t('предупр.', 'warnings')}</span>
        <span class="s-chip" style="color:var(--err)"><span class="dot err"></span><b>${errors}</b> ${t('ошибок', 'errors')}</span>
        <span class="s-chip">${t('Разделитель', 'Delimiter')} <b class="mono">${data.delimiter === '\t' ? 'TAB' : esc(data.delimiter)}</b></span>
      </div>
      ${warnings || errors ? `<div class="banner warn">${I.alert}<div>${t('Файл разобран частично. Проблемные строки будут сохранены с пометкой — их можно исправить в исходнике и загрузить снова.', 'The file was partially parsed. Problem rows will be saved with a flag — fix them in the source and upload again.')}</div></div>` : ''}
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th style="width:34px">#</th>${data.columns.map((column) => `<th>${esc(column)}</th>`).join('')}<th style="width:92px">${t('Проверка', 'Check')}</th></tr></thead>
          <tbody>
            ${shown.map((row, index) => `<tr class="${row.level === 'error' ? 'bad' : row.level === 'warn' ? 'warn' : ''}">
              <td class="num">${index + 1}</td>
              ${data.columns.map((column) => cellHTML(row.data[column], { strong: column === 'owner' || column === 'project' })).join('')}
              <td>${row.level === 'ok' ? `<span class="pill ok">${t('ОК', 'OK')}</span>` : row.level === 'warn' ? `<span class="pill warn">${t('Внимание', 'Warning')}</span>` : `<span class="pill err">${t('Ошибка', 'Error')}</span>`}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-top:10px">
        <div class="faint" style="font-size:11px">${t('Показаны первые', 'Showing first')} ${shown.length} ${t('из', 'of')} ${data.rows.length}</div>
        ${issues.length ? `<div class="issues">${issues.map((entry) => `<div class="issue"><span class="dot ${entry.row.level === 'error' ? 'err' : 'warn'}"></span><b>${t('Строка', 'Row')} ${entry.index + 2}</b> ${esc(entry.row.issues.map(issueText).join(', '))}</div>`).join('')}</div>` : ''}
      </div>
    </div>`;
  }
  return `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">${t('Импорт', 'Import')}</div><h1>${t('Импорт данных', 'Data import')}</h1>
        <p class="sub">${t('Загрузите собственный CSV, TSV или JSON: экспорт из CRM или менеджера проектов. Без паролей, ключей и 2FA.', 'Upload your own CSV, TSV or JSON — a CRM or project manager export. No passwords, keys or 2FA.')}</p></div>
    </div>
    <label class="drop" id="drop" for="file-input">
      <div class="di">${I.upload}</div>
      <h3>${t('Перетащите файл сюда', 'Drop your file here')}</h3>
      <p>${t('или', 'or')} <span class="link">${t('выберите на диске', 'browse your computer')}</span></p>
      <div class="hint">${t('CSV · TSV · JSON до 5 МБ. Поля: project, owner, email, note, status.', 'CSV · TSV · JSON up to 5 MB. Fields: project, owner, email, note, status.')}</div>
      <input type="file" id="file-input" accept=".csv,.tsv,.json,text/csv,application/json" hidden>
    </label>
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
      <button class="btn btn-quiet" data-action="import-sample">${t('Загрузить пример файла', 'Load a sample file')}${I.arrow}</button>
      <span class="faint" style="font-size:10.5px">${t('Покажет частичный разбор с предупреждениями', 'Shows a partial parse with warnings')}</span>
    </div>
    <div class="card pad" style="margin-top:16px">
      <div class="mini-head"><span class="t">${t('Что произойдёт с данными', 'What happens to the data')}</span></div>
      <div class="kv" style="grid-template-columns:1fr 1fr 1fr;margin-top:4px">
        <div><div class="k">${t('Разбор', 'Parsing')}</div><div class="v muted" style="font-size:12px;line-height:1.45">${t('Заголовки, разделители, пустые строки', 'Headers, delimiters, empty rows')}</div></div>
        <div><div class="k">${t('Проверка', 'Validation')}</div><div class="v muted" style="font-size:12px;line-height:1.45">${t('Email, обязательные поля, дубликаты', 'Email, required fields, duplicates')}</div></div>
        <div><div class="k">${t('Хранение', 'Storage')}</div><div class="v muted" style="font-size:12px;line-height:1.45">${t('Только в памяти этой сессии', 'In this session’s memory only')}</div></div>
      </div>
    </div>
  </div>`;
}
