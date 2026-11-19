'use strict';
const fs = require('node:fs');

function update(path, transform, label) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (before !== after) {
    fs.writeFileSync(path, after);
    console.log('TZ32 GUI fix:', label);
  } else {
    console.log('TZ32 GUI fix already present:', label);
  }
}

update('src/js/main.js', (source) => {
  let s = source;
  const oldPhone = "internationalPhone: target.dataset.internationalPhone === 'true'";
  const newPhone = "nationalPhone: target.dataset.nationalPhone === 'true'";
  if (s.includes(oldPhone)) s = s.replace(oldPhone, newPhone);
  if (!s.includes(newPhone)) throw new Error('TZ32_GUI_PHONE_HANDLER_MISSING');

  const bioHandler = "if(action==='bio-copy'){const field=target.dataset.field;const value=document.getElementById('bio-'+field)?.value??state.bioEditor?.values[field]??'';await copyText(value,target);return;}";
  const bioPattern = /if\s*\(\s*action\s*===\s*['"]bio-copy['"]\s*\)\s*\{[^}]*\}/;
  if (bioPattern.test(s)) s = s.replace(bioPattern, bioHandler);
  else {
    const markers = ["  if(action==='bio-retry'){", "  if (action === 'bio-retry') {", "  if(action==='bio-regenerate'){", "  if (action === 'bio-regenerate') {"];
    const marker = markers.find((value) => s.includes(value));
    if (!marker) throw new Error('TZ32_GUI_BIO_COPY_INSERTION_POINT_MISSING');
    s = s.replace(marker, '  ' + bioHandler + '\n' + marker);
  }

  const archivePattern = /if\s*\(\s*action\s*===\s*['"]classifier-archive['"]\s*\|\|\s*action\s*===\s*['"]classifier-archive-record['"]\s*\)/;
  const archiveHandler = [
    "  if (action === 'classifier-archive' || action === 'classifier-archive-record') {",
    "    const operationId = state.importData?.operationId, epoch = state.importEpoch;",
    "    if (!operationId || !state.importData) return;",
    "    target.disabled = true;",
    "    try {",
    "      await window.blego.confirmClassification({ operationId, decision: state.importData.status === 'preview_partial' ? 'accept_partial' : 'accept_complete' });",
    "      if (state.importEpoch !== epoch) return;",
    "      await window.blego.saveArchive(action === 'classifier-archive-record' ? { operationId, recordId: target.dataset.row } : operationId);",
    "      if (state.importEpoch !== epoch) return;",
    "      if (action === 'classifier-archive') state.importSaved = true;",
    "      state.archiveView = null; state.archiveQuery = {};",
    "      state.archives = await window.blego.listArchives();",
    "      await importPage(state.importData.offset);",
    "      toast('Сохранено');",
    "    } catch (error) {",
    "      toast(error.message || 'Не удалось сохранить архив', 'err');",
    "      if (target.isConnected) target.disabled = false;",
    "    }",
    "    return;",
    "  }"
  ].join('\n');
  const archiveMatch = archivePattern.exec(s);
  const facebookPattern = /if\s*\(\s*action\s*===\s*['"]classifier-facebook-link['"]\s*\)/;
  const facebookMatch = facebookPattern.exec(s);
  if (!facebookMatch) throw new Error('TZ32_GUI_ARCHIVE_HANDLER_INSERTION_POINT_MISSING');
  if (archiveMatch) {
    const blockStart = s.lastIndexOf('\n', archiveMatch.index) + 1;
    const blockEnd = s.lastIndexOf('\n', facebookMatch.index) + 1;
    if (blockEnd <= blockStart) throw new Error('TZ32_GUI_ARCHIVE_HANDLER_BOUNDARY_INVALID');
    s = s.slice(0, blockStart) + archiveHandler + '\n' + s.slice(blockEnd);
  } else {
    const blockStart = s.lastIndexOf('\n', facebookMatch.index) + 1;
    s = s.slice(0, blockStart) + archiveHandler + '\n' + s.slice(blockStart);
  }
  return s;
}, 'phone dispatch, direct BIO copy and classifier archive handlers');

update('src/js/utils/copy-actions.js', (source) => {
  let s = source;
  if (!s.includes("import { formattedPhoneForCopy } from './phone.mjs';")) {
    const anchor = "import { state } from '../state.js';";
    if (!s.includes(anchor)) throw new Error('TZ32_GUI_PHONE_IMPORT_ANCHOR_MISSING');
    s = s.replace(anchor, anchor + "\nimport { formattedPhoneForCopy } from './phone.mjs';");
  }

  const start = s.indexOf('export async function copyModelValue(');
  if (start < 0) throw new Error('TZ32_GUI_COPY_MODEL_FUNCTION_MISSING');
  const body = s.indexOf(') {', start);
  if (body < 0) throw new Error('TZ32_GUI_COPY_MODEL_SIGNATURE_MISSING');
  let signature = s.slice(start, body + 3);
  if (!signature.includes('nationalPhone')) {
    const next = signature.replace(
      /\{\s*card\s*=\s*false\s*,\s*personal\s*=\s*false(?:\s*,\s*[A-Za-z_$][\w$]*\s*=\s*false)?\s*\}\s*=\s*\{\}/,
      '{ card = false, personal = false, nationalPhone = false } = {}'
    );
    if (next === signature) throw new Error('TZ32_GUI_PHONE_SIGNATURE_PATCH_FAILED');
    s = s.slice(0, start) + next + s.slice(body + 3);
  }

  if (!s.includes('const profileCountry = id ===')) {
    const anchor = '  const generation = loading, context=copyContext();';
    if (!s.includes(anchor)) throw new Error('TZ32_GUI_PHONE_COUNTRY_ANCHOR_MISSING');
    s = s.replace(anchor, anchor + "\n  const profileCountry = id === 'generator' ? state.demo?.country : null;");
  }

  if (!/if\s*\(\s*nationalPhone\s*&&/.test(s)) {
    const markers = [
      "  if(card && id === 'generator' && state.demo?.fields?.phone) {",
      "  if (card && id === 'generator' && state.demo?.fields?.phone) {"
    ];
    const marker = markers.find((value) => s.includes(value));
    if (!marker) throw new Error('TZ32_GUI_PHONE_COPY_INSERTION_POINT_MISSING');
    const handler = "  if (nationalPhone && !card && id === 'generator' && key === 'phone') return copyText(formattedPhoneForCopy(result.text, profileCountry), button, 'Номер скопирован');\n";
    s = s.replace(marker, handler + marker);
  }
  return s;
}, 'national-format phone clipboard serializer');

update('src/js/ui/generator.js', (source) => {
  let s = source.replaceAll('data-international-phone="true"', 'data-national-phone="true"');
  if (!s.includes('data-national-phone="true"')) {
    const marker = String.fromCharCode(36) + '{esc(key)}';
    const anchor = 'data-action="copy-model" data-source="generator" data-field="' + marker + '"';
    if (!s.includes(anchor)) throw new Error('TZ32_GUI_PHONE_BUTTON_ANCHOR_MISSING');
    const addition = String.fromCharCode(36) + "{key === 'phone' ? 'data-national-phone=\"true\"' : ''}";
    s = s.replace(anchor, anchor + ' ' + addition);
  }
  return s;
}, 'generator national-phone marker');

update('tests/ui/archive-v141.test.cjs', (source) => {
  const oldSelector = "        await page.locator('#classifier-extra summary').click();\n        await page.locator('[data-action=\"classifier-archive\"]').click();";
  if (source.includes(oldSelector)) source = source.replace(oldSelector, "        await page.locator('[data-action=\"classifier-archive\"]').click();");
  if (source.includes("#classifier-extra")) throw new Error('TZ32_GUI_ARCHIVE_OLD_SELECTOR_REMAINS');
  const oldToast = "      await page\n        .locator('#toasts .toast:not([data-before-archive-save])')\n        .getByText('Сохранено', { exact: true })\n        .waitFor();";
  const newWait = "      await page.waitForFunction(async () => { const { state } = await import('/js/state.js'); return state.importSaved === true; });";
  if (source.includes(oldToast)) source = source.replace(oldToast, newWait);
  return source;
}, 'archive GUI test uses state transition instead of toast wording');

update('tests/ui/classifier-copy.test.cjs', (source) => {
  let s = source.replaceAll("'Не определён'", "'Not detected'");
  const old = "    await page.getByText('Сохранено в архиве', { exact: true }).waitFor();";
  const next = "    await page.waitForFunction(async () => { const { state } = await import('/js/state.js'); return state.importSaved === true; });";
  if (s.includes(old)) s = s.replace(old, next);
  return s;
}, 'classifier GUI assertions use current empty label and archive state');
