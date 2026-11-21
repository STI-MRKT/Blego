'use strict';
// Scoped BLEGO TZ37 UI changes, applied only after restoring the TZ36 release source.
const fs=require('node:fs');

function once(text,needle,replacement,label){
  const count=typeof needle==='string'
    ? text.split(needle).length-1
    : [...text.matchAll(new RegExp(needle.source,needle.flags.replace('g','')+'g'))].length;
  if(count!==1)throw Error('TZ37_'+label+'_ANCHOR_'+count);
  return text.replace(needle,replacement);
}
function edit(path,fn){
  const before=fs.readFileSync(path,'utf8');
  const after=fn(before);
  if(after===before)throw Error('TZ37_UNCHANGED_'+path);
  fs.writeFileSync(path,after);
  console.log('TZ37 updated',path);
}

edit('src/js/ui/import.js',source=>{
  source=once(source,
    /<select class="input" id="classifier-sort" aria-label="Record order">[\s\S]*?<\/select><label class="fl"><input type="checkbox" id="classifier-warnings-only"[^>]*> Needs review<\/label>/,
    '','FILTER_SORT_CONTROLS');
  source=once(source,
    /<button class="btn btn-quiet" data-action="import-copy">Copy source text<\/button>\s*/,
    '','COPY_SOURCE_BUTTON');
  source=once(source,
    /<label class="archive-cookie-opt"><input type="checkbox" id="archive-include-cookies"[^>]*> Include cookie files<\/label>\s*/,
    '','INCLUDE_COOKIES_CHECKBOX');
  const tick=String.fromCharCode(96);
  const startKey='$'+'{!confirmed?'+tick+'<details class="classifier-inline-fields" id="classifier-options">';
  const start=source.indexOf(startKey);
  const endKey='</details>'+tick+":''}";
  const end=start<0?-1:source.indexOf(endKey,start);
  if(start<0||end<0||source.indexOf(startKey,start+1)>=0)throw Error('TZ37_CONFIGURE_FIELDS_ANCHOR');
  source=source.slice(0,start)+source.slice(end+endKey.length);
  for(const old of ['id="classifier-sort"','id="classifier-warnings-only"','data-action="import-copy"','id="archive-include-cookies"','id="classifier-options"'])
    if(source.includes(old))throw Error('TZ37_STALE_UI_'+old);
  return source.replace(/[ \t]+$/gm, '');
});

edit('src/js/ui/history.js',source=>once(
  source,'available ? "Copy full Cookie" : "—"',
  'available ? "" : "—"','COOKIE_CARD_TEXT'));

edit('src/js/main.js',source=>{
  source=once(source,
    /const includeCookies = document\.getElementById\('archive-include-cookies'\)\?\.checked !== false;/,
    'const includeCookies = true;','COOKIE_ARCHIVE_DEFAULT');
  const anchor="const geoCountry = document.getElementById('geo-country');";
  const opener=[
    "// Offer the native city and country pickers on the first pointer press.",
    "// If the platform does not support showPicker, preserve native controls.",
    "for (const pickerId of ['geo-country', 'geo-city']) {",
    "  const picker = document.getElementById(pickerId);",
    "  if (!picker) continue;",
    "  picker.addEventListener('pointerdown', (event) => {",
    "    if (!event.isPrimary || event.button !== 0 || typeof picker.showPicker !== 'function') return;",
    "    try { picker.showPicker(); event.preventDefault(); }",
    "    catch { /* Use the native fallback. */ }",
    "  });",
    "}"
  ].join('\n');
  return once(source,anchor,opener+'\n  '+anchor,'CITY_FIRST_CLICK');
});

edit('src/js/ui/photos.js',source=>{
  source=once(source,/<details id="gps-manual"[\s\S]*?<\/details>/,'','EXACT_COORDINATES_AND_ALTITUDE');
  source=once(source,
    /(<summary>(?:City catalog|Каталог городов)<\/summary>)<p class="sub">[^<]*<\/p>/,
    '$1','CITY_CATALOG_SUBTEXT');
  source=once(source,
    /<details(\s+\$\{state\.geoImportPreview\?)/,
    '<details class="geo-city-catalog"$1','CITY_CATALOG_CLASS');
  const actionMatch=/\$\{actionOptions\(\)\}(?=<\/select><\/label>\s*<div data-field-inputs="\$\{field\}")/;
  source=once(source,actionMatch,
    '$'+'{'+"field === 'gps' ? actionOptions().replace('<option value=\"set\">Edit</option>', '') : actionOptions()}",
    'DISABLE_MANUAL_GPS_ACTION');
  // Remove an altitude-specific explanation if this localized build includes one.
  source=source.replace(/<p class="sub">[^<]*(?:altitude|высота)[^<]*<\/p>/iu,'');
  return source;
});

// Migrate historical DOM assertions for deliberately removed configuration UI.
// The classifier's backend-learning regression tests remain untouched.
edit('tests/unit/tz15-generator-ux.test.cjs',source=>{
  source=once(source,
    "test('TZ15 classifier bottom panels removed, with field mapping and export still accessible'",
    "test('TZ37 classifier removes configuration panels while retaining archive and export'",
    'TZ15_TEST_TITLE');
  source=once(source,
    'assert.match(html, /id="classifier-options"/);',
    'assert.doesNotMatch(html, /id="classifier-options"/);',
    'TZ15_OPTIONS_HIDDEN');
  source=once(source,
    'assert.match(html, /data-classifier-map/);',
    'assert.doesNotMatch(html, /data-classifier-map/);',
    'TZ15_MAPPING_HIDDEN');
  return source;
});

edit('tests/unit/tz19-adaptive-ui.test.cjs',source=>{
  source=once(source,
    "test('TZ19 classifier exposes explicit pattern memory controls without storing source values in UI'",
    "test('TZ37 hides advanced pattern-memory controls but preserves safe backend layouts'",
    'TZ19_TEST_TITLE');
  const start=source.indexOf('    let html = importHTML();');
  const end=start<0?-1:source.indexOf('  } finally {',start);
  if(start<0 || end<0 || source.indexOf('    let html = importHTML();',start+1)!==-1)
    throw Error('TZ37_TZ19_TEST_BODY_MISSING');
  const updated=[
    '    let html = importHTML();',
    '    assert.doesNotMatch(html, /id="classifier-remember-layout"/);',
    '    assert.doesNotMatch(html, /data-action="classifier-forget-layouts"/);',
    '    assert.doesNotMatch(html, /id="classifier-options"/);',
    '    assert.match(html, /data-action="classifier-export"/);',
    '    assert.match(html, /data-action="classifier-copy-column"/);',
    '    state.classifierOptions.rememberLayout = true;',
    '    html = importHTML();',
    '    assert.doesNotMatch(html, /id="classifier-remember-layout"/);'
  ].join('\n');
  return source.slice(0,start)+updated+'\n'+source.slice(end);
});

const cssPath='src/css/tz24.css';
if(!fs.existsSync(cssPath))throw Error('TZ37_RESTORED_STYLES_MISSING');
fs.appendFileSync(cssPath,[
  '',
  '/* TZ37: scoped archive cookie and city catalog spacing. */',
  '.archive-page .archive-cookie-field{min-height:72px;padding:18px 22px;display:flex;align-items:center;justify-content:center;text-align:center;cursor:pointer;}',
  '.archive-page .archive-cookie-field .field-main{width:100%;min-width:0;display:flex;align-items:center;justify-content:center;}',
  '.archive-page .archive-cookie-field .field-label{font-size:12px;font-weight:650;letter-spacing:.10em;}',
  '.photo-quick-card .geo-city-catalog{width:100%;margin-top:12px;padding:0;border:1px solid var(--border);border-radius:12px;background:var(--panel-2);overflow:hidden;}',
  '.photo-quick-card .geo-city-catalog>summary{padding:14px 16px;min-height:44px;border-radius:11px;display:list-item;cursor:pointer;line-height:1.5;color:var(--text);font-weight:600;}',
  '.photo-quick-card .geo-city-catalog>summary:hover,.photo-quick-card .geo-city-catalog>summary:focus-visible{background:var(--accent-soft);color:var(--accent);}',
  '.photo-quick-card .geo-city-catalog[open]>summary{border-bottom:1px solid var(--border);border-radius:11px 11px 0 0;}',
  '.photo-quick-card .geo-city-catalog>.btn,.photo-quick-card .geo-city-catalog>p{margin:12px 16px;}',
  '.photo-quick-card #geo-city,.photo-quick-card #geo-country,.photo-quick-card #geo-city-query{min-height:42px;padding:10px 14px;border-radius:10px;}',
  '.photo-quick-card #geo-city:focus-visible,.photo-quick-card #geo-country:focus-visible,.photo-quick-card #geo-city-query:focus-visible{border-color:var(--accent);outline:2px solid var(--accent-soft);outline-offset:2px;}',
  '.photo-quick-card #geo-city option{background:var(--panel);color:var(--text);}',
  ''
].join('\n'));

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
if(pkg.version!=='1.4.19')throw Error('TZ37_EXPECTED_VERSION_1_4_19_GOT_'+pkg.version);
pkg.version='1.4.20';
lock.version='1.4.20';
if(lock.packages?.[''])lock.packages[''].version='1.4.20';
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
fs.writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');
console.log('TZ37: archive Cookies default on; classifier simplified; GEO picker compact');
