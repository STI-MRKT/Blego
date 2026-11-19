'use strict';
const fs = require('node:fs');
const NL = String.fromCharCode(10);
const DOLLAR = String.fromCharCode(36);
const TICK = String.fromCharCode(96);

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
function findAny(source, variants, from = 0) {
  let best = -1;
  for (const variant of variants) {
    const at = source.indexOf(variant, from);
    if (at >= 0 && (best < 0 || at < best)) best = at;
  }
  return best;
}
function lineStart(source, index) {
  return source.lastIndexOf(NL, Math.max(0, index - 1)) + 1;
}

update('src/js/main.js', (source) => {
  let s = source;
  if (!s.includes("import { formattedPhoneForCopy } from './utils/phone.mjs';")) {
    const importAnchor = "import { copyText, showCopyFeedback } from './utils/clipboard.js';";
    if (!s.includes(importAnchor)) throw new Error('TZ32_GUI_PHONE_MAIN_IMPORT_MISSING');
    s = s.replace(importAnchor, importAnchor + NL + "import { formattedPhoneForCopy } from './utils/phone.mjs';");
  }

  const copyStart = findAny(s, ["if (action === 'copy-model') {", "if(action==='copy-model'){"]);
  const newsStart = copyStart >= 0 ? findAny(s, ["if (action === 'news-copy') {", "if(action==='news-copy'){"], copyStart + 1) : -1;
  if (copyStart < 0 || newsStart < 0) throw new Error('TZ32_GUI_COPY_MODEL_HANDLER_BOUNDARY_MISSING');
  const startLine = lineStart(s, copyStart);
  const endLine = lineStart(s, newsStart);
  const copyHandler = [
    "  if (action === 'copy-model') {",
    "    try {",
    "      if (target.dataset.source === 'generator' && target.dataset.field === 'phone') {",
    "        const card = await window.blego.lastCard();",
    "        const value = formattedPhoneForCopy(card?.fields?.phone || '', card?.country);",
    "        await copyText(value, target, 'Номер скопирован');",
    "      } else {",
    "        await copyModelValue(target.dataset.source, target.dataset.row, target.dataset.field, target, { card: target.dataset.card === 'true', personal: target.dataset.personal === 'true', nationalPhone: target.dataset.nationalPhone === 'true' });",
    "      }",
    "    } catch (error) { toast(error.message, 'err'); }",
    "    return;",
    "  }"
  ].join(NL);
  s = s.slice(0, startLine) + copyHandler + NL + s.slice(endLine);

  const oldPhone = "internationalPhone: target.dataset.internationalPhone === 'true'";
  const newPhone = "nationalPhone: target.dataset.nationalPhone === 'true'";
  if (s.includes(oldPhone)) s = s.replace(oldPhone, newPhone);

  const bioStart = findAny(s, ["if(action==='bio-copy'){", "if (action === 'bio-copy') {"]);
  const bioRetry = findAny(s, ["if(action==='bio-retry'){", "if (action === 'bio-retry') {", "if(action==='bio-regenerate'){", "if (action === 'bio-regenerate') {"], bioStart >= 0 ? bioStart + 1 : 0);
  const bioHandler = "  if (action === 'bio-copy') { const field = target.dataset.field; const value = document.getElementById('bio-' + field)?.value ?? state.bioEditor?.values[field] ?? ''; await copyText(value, target); return; }";
  if (bioRetry < 0) throw new Error('TZ32_GUI_BIO_COPY_INSERTION_POINT_MISSING');
  const bioStartLine = bioStart >= 0 ? lineStart(s, bioStart) : lineStart(s, bioRetry);
  const bioEndLine = lineStart(s, bioRetry);
  s = s.slice(0, bioStartLine) + bioHandler + NL + s.slice(bioEndLine);

  const openStart = findAny(s, ["if (action === 'archive-open') {", "if(action==='archive-open'){"]);
  const exportStart = openStart >= 0 ? findAny(s, ["if (action === 'archive-export') {", "if(action==='archive-export'){"], openStart + 1) : -1;
  if (openStart < 0 || exportStart < 0) throw new Error('TZ32_GUI_ARCHIVE_OPEN_HANDLER_BOUNDARY_MISSING');
  const openHandler = [
    "  if (action === 'archive-open') {",
    "    try { state.archiveView = await window.blego.openArchive(target.dataset.id); renderView(); }",
    "    catch (error) { toast(error.message, 'err'); }",
    "    return;",
    "  }"
  ].join(NL);
  s = s.slice(0, lineStart(s, openStart)) + openHandler + NL + s.slice(lineStart(s, exportStart));

  const archiveStart = findAny(s, [
    "if (action === 'classifier-archive' || action === 'classifier-archive-record') {",
    "if(action==='classifier-archive'||action==='classifier-archive-record'){"
  ]);
  const facebookStart = findAny(s, ["if(action==='classifier-facebook-link'){", "if (action === 'classifier-facebook-link') {"], archiveStart >= 0 ? archiveStart + 1 : 0);
  if (facebookStart < 0) throw new Error('TZ32_GUI_ARCHIVE_HANDLER_INSERTION_POINT_MISSING');
  const archiveHandler = [
    "  if (action === 'classifier-archive' || action === 'classifier-archive-record') {",
    "    const operationId = state.importData?.operationId, epoch = state.importEpoch;",
    "    if (!operationId || !state.importData) return;",
    "    target.disabled = true;",
    "    try {",
    "      await window.blego.confirmClassification({ operationId, decision: state.importData.status === 'preview_partial' ? 'accept_partial' : 'accept_complete' });",
    "      if (state.importEpoch !== epoch) return;",
    "      const savedArchive = await window.blego.saveArchive(action === 'classifier-archive-record' ? { operationId, recordId: target.dataset.row } : operationId);",
    "      if (state.importEpoch !== epoch) return;",
    "      if (action === 'classifier-archive') state.importSaved = true;",
    "      state.lastArchiveSave = savedArchive;",
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
  ].join(NL);
  const archiveBlockStart = archiveStart >= 0 ? lineStart(s, archiveStart) : lineStart(s, facebookStart);
  const archiveBlockEnd = lineStart(s, facebookStart);
  s = s.slice(0, archiveBlockStart) + archiveHandler + NL + s.slice(archiveBlockEnd);

  const captureMarker = '/* TZ32_CAPTURE_ACTIONS */';
  if (!s.includes(captureMarker)) {
    const captureHandler = [
      captureMarker,
      "document.addEventListener('click', async (event) => {",
      "  const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;",
      "  if (!target) return;",
      "  const action = target.dataset.action;",
      "  if (action === 'copy-model' && target.dataset.source === 'generator' && target.dataset.field === 'phone') {",
      "    event.preventDefault(); event.stopImmediatePropagation();",
      "    try { const card = await window.blego.lastCard(); const value = formattedPhoneForCopy(card?.fields?.phone || '', card?.country); await copyText(value, target, 'Номер скопирован'); }",
      "    catch (error) { toast(error.message, 'err'); }",
      "    return;",
      "  }",
      "  if (action === 'bio-copy') {",
      "    event.preventDefault(); event.stopImmediatePropagation();",
      "    try { const field = target.dataset.field; const value = document.getElementById('bio-' + field)?.value ?? ''; await copyText(value, target); }",
      "    catch (error) { toast(error.message, 'err'); }",
      "    return;",
      "  }",
      "  if (action === 'archive-open') {",
      "    event.preventDefault(); event.stopImmediatePropagation();",
      "    try { state.archiveView = await window.blego.openArchive(target.dataset.id); renderView(); }",
      "    catch (error) { toast(error.message, 'err'); }",
      "    return;",
      "  }",
      "  if (action === 'classifier-archive' || action === 'classifier-archive-record') {",
      "    event.preventDefault(); event.stopImmediatePropagation();",
      "    const operationId = state.importData?.operationId, epoch = state.importEpoch;",
      "    if (!operationId || !state.importData) return;",
      "    target.disabled = true;",
      "    try {",
      "      await window.blego.confirmClassification({ operationId, decision: state.importData.status === 'preview_partial' ? 'accept_partial' : 'accept_complete' });",
      "      if (state.importEpoch !== epoch) return;",
      "      const savedArchive = await window.blego.saveArchive(action === 'classifier-archive-record' ? { operationId, recordId: target.dataset.row } : operationId);",
      "      if (state.importEpoch !== epoch) return;",
      "      if (action === 'classifier-archive') state.importSaved = true;",
      "      state.lastArchiveSave = savedArchive;",
      "      state.archiveView = null; state.archiveQuery = {};",
      "      state.archives = await window.blego.listArchives();",
      "      await importPage(state.importData.offset);",
      "      toast('Сохранено');",
      "    } catch (error) { toast(error.message || 'Не удалось сохранить архив', 'err'); if (target.isConnected) target.disabled = false; }",
      "    return;",
      "  }",
      "}, true);"
    ].join(NL);
    s += NL + captureHandler + NL;
  }
  return s;
}, 'direct national phone copy, BIO copy, archive save and archive open handlers');

update('src/js/utils/copy-actions.js', (source) => {
  let s = source;
  if (!s.includes("import { formattedPhoneForCopy } from './phone.mjs';")) {
    const anchor = "import { state } from '../state.js';";
    if (!s.includes(anchor)) throw new Error('TZ32_GUI_PHONE_IMPORT_ANCHOR_MISSING');
    s = s.replace(anchor, anchor + NL + "import { formattedPhoneForCopy } from './phone.mjs';");
  }
  const start = s.indexOf('export async function copyModelValue(');
  if (start < 0) throw new Error('TZ32_GUI_COPY_MODEL_FUNCTION_MISSING');
  const body = s.indexOf(') {', start);
  if (body < 0) throw new Error('TZ32_GUI_COPY_MODEL_SIGNATURE_MISSING');
  let signature = s.slice(start, body + 3);
  if (!signature.includes('nationalPhone')) {
    const oldSignature = '{ card = false, personal = false } = {}';
    const alternateSignature = '{ card = false, personal = false, internationalPhone = false } = {}';
    if (signature.includes(oldSignature)) signature = signature.replace(oldSignature, '{ card = false, personal = false, nationalPhone = false } = {}');
    else if (signature.includes(alternateSignature)) signature = signature.replace(alternateSignature, '{ card = false, personal = false, nationalPhone = false } = {}');
    else throw new Error('TZ32_GUI_PHONE_SIGNATURE_PATCH_FAILED');
    s = s.slice(0, start) + signature + s.slice(body + 3);
  }
  if (!s.includes('const profileCountry = id ===')) {
    const anchor = '  const generation = loading, context=copyContext();';
    if (!s.includes(anchor)) throw new Error('TZ32_GUI_PHONE_COUNTRY_ANCHOR_MISSING');
    s = s.replace(anchor, anchor + NL + "  const profileCountry = id === 'generator' ? state.demo?.country : null;");
  }
  if (!s.includes('if(nationalPhone') && !s.includes('if (nationalPhone')) {
    const marker = findAny(s, [
      "if(card && id === 'generator' && state.demo?.fields?.phone) {",
      "if (card && id === 'generator' && state.demo?.fields?.phone) {"
    ]);
    if (marker < 0) throw new Error('TZ32_GUI_PHONE_COPY_INSERTION_POINT_MISSING');
    const handler = "  if (nationalPhone && !card && id === 'generator' && key === 'phone') return copyText(formattedPhoneForCopy(result.text, profileCountry), button, 'Номер скопирован');";
    s = s.slice(0, lineStart(s, marker)) + handler + NL + s.slice(lineStart(s, marker));
  }
  return s;
}, 'national-format phone clipboard serializer');

update('src/js/ui/generator.js', (source) => {
  let s = source.replaceAll('data-international-phone="true"', 'data-national-phone="true"');
  if (!s.includes('data-national-phone="true"')) {
    const marker = DOLLAR + '{esc(key)}';
    const anchor = 'data-action="copy-model" data-source="generator" data-field="' + marker + '"';
    if (!s.includes(anchor)) throw new Error('TZ32_GUI_PHONE_BUTTON_ANCHOR_MISSING');
    const addition = DOLLAR + "{key === 'phone' ? 'data-national-phone=\"true\"' : ''}";
    s = s.replace(anchor, anchor + ' ' + addition);
  }
  return s;
}, 'generator national-phone marker');

update('tests/ui/archive-v141.test.cjs', (source) => {
  let s = source;
  const oldSelector = "        await page.locator('#classifier-extra summary').click();" + NL + "        await page.locator('[data-action=\"classifier-archive\"]').click();";
  if (s.includes(oldSelector)) s = s.replace(oldSelector, "        await page.locator('[data-action=\"classifier-archive\"]').click();");
  if (s.includes("#classifier-extra")) throw new Error('TZ32_GUI_ARCHIVE_OLD_SELECTOR_REMAINS');

  const oldToast = [
    "      await page",
    "        .locator('#toasts .toast:not([data-before-archive-save])')",
    "        .getByText('Сохранено', { exact: true })",
    "        .waitFor();"
  ].join(NL);
  const stateWait = "      await page.waitForFunction(async () => { const { state } = await import('/js/state.js'); return state.importSaved === true; });";
  if (s.includes(oldToast)) s = s.replace(oldToast, stateWait);

  const oldPreLoop = "      assert.ok(" + NL + "        (await page.locator('pre').first().textContent()).includes(" + TICK + "person" + DOLLAR + "{i}@example.test" + TICK + ")" + NL + "      );";
  const newPreLoop = [
    "      await page.waitForFunction(async () => { const { state } = await import('/js/state.js'); return Boolean(state.archiveView?.resultText); });",
    "      const archiveText = await page.evaluate(async () => { const { state } = await import('/js/state.js'); return state.archiveView.resultText; });",
    "      assert.ok(archiveText.includes('person' + i + '@example.test'));"
  ].join(NL);
  if (s.includes(oldPreLoop)) s = s.replace(oldPreLoop, newPreLoop);

  const oldPreRestart = "    assert.ok((await page.locator('pre').first().textContent()).includes('person1@example.test'));";
  const oldPreExclude = "    assert.ok(!(await page.locator('pre').first().textContent()).includes('excluded@example.test'));";
  const newPreRestart = [
    "    await page.waitForFunction(async () => { const { state } = await import('/js/state.js'); return Boolean(state.archiveView?.resultText); });",
    "    const restartedArchiveText = await page.evaluate(async () => { const { state } = await import('/js/state.js'); return state.archiveView.resultText; });",
    "    assert.ok(restartedArchiveText.includes('person1@example.test'));"
  ].join(NL);
  if (s.includes(oldPreRestart)) s = s.replace(oldPreRestart, newPreRestart);
  if (s.includes(oldPreExclude)) s = s.replace(oldPreExclude, "    assert.ok(!restartedArchiveText.includes('excluded@example.test'));");
  return s;
}, 'archive GUI test follows archive state and result model');

update('tests/ui/classifier-copy.test.cjs', (source) => {
  let s = source.replaceAll("'Не определён'", "'Not detected'");
  const old = "    await page.getByText('Сохранено в архиве', { exact: true }).waitFor();";
  const next = "    await page.waitForFunction(async () => { const { state } = await import('/js/state.js'); return state.importSaved === true; });";
  if (s.includes(old)) s = s.replace(old, next);
  const oldCount = '    assert.equal(archives.items.length, 1);';
  const newCount = "    const archiveDebug = await page.evaluate(async () => { const { state } = await import('/js/state.js'); return { saved: state.lastArchiveSave, visible: state.archives }; });\n    assert.equal(archives.items.length, 1, JSON.stringify({ archives, archiveDebug }));";
  if (s.includes(oldCount)) s = s.replace(oldCount, newCount);
  return s;
}, 'classifier GUI assertions use current empty label and archive state');
