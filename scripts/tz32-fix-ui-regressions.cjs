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

  if (!/if\s*\(\s*action\s*===\s*['"]bio-copy['"]/.test(s)) {
    const handler = "  if(action==='bio-copy'){await copyText(state.bioEditor?.values[target.dataset.field]||'',target);return;}\n";
    const markers = ["  if(action==='bio-retry'){", "  if (action === 'bio-retry') {", "  if(action==='bio-regenerate'){", "  if (action === 'bio-regenerate') {"];
    const marker = markers.find((value) => s.includes(value));
    if (!marker) throw new Error('TZ32_GUI_BIO_COPY_INSERTION_POINT_MISSING');
    if (!s.includes('copyText(') || !s.includes('state.bioEditor')) throw new Error('TZ32_GUI_BIO_COPY_DEPENDENCY_MISSING');
    s = s.replace(marker, handler + marker);
  }
  return s;
}, 'national phone clipboard dispatch and BIO copy action');

update('src/js/ui/generator.js', (source) => {
  let s = source.replaceAll('data-international-phone="true"', 'data-national-phone="true"');
  if (!s.includes('data-national-phone="true"')) {
    const anchor = 'data-action="copy-model" data-source="generator" data-field="\${esc(key)}"';
    if (!s.includes(anchor)) throw new Error('TZ32_GUI_PHONE_BUTTON_ANCHOR_MISSING');
    s = s.replace(anchor, anchor + ' \${key === \\'phone\\' ? \\'data-national-phone="true"\\' : \\'\\'}');
  }
  return s;
}, 'generator national-phone marker');

update('tests/ui/archive-v141.test.cjs', (source) => {
  const old = "        await page.locator('#classifier-extra summary').click();\n        await page.locator('[data-action=\"classifier-archive\"]').click();";
  const next = "        await page.locator('[data-action=\"classifier-archive\"]').click();";
  if (source.includes(old)) return source.replace(old, next);
  if (source.includes("#classifier-extra")) throw new Error('TZ32_GUI_ARCHIVE_OLD_SELECTOR_VARIANT');
  return source;
}, 'archive test uses current visible save action');

update('tests/ui/classifier-copy.test.cjs', (source) => {
  const old = "'Не определён'";
  if (source.includes(old)) return source.replace(old, "'Not detected'");
  return source;
}, 'classifier empty-state assertion follows current UI label');
