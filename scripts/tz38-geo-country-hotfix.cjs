'use strict';
// TZ38: native, single-click country selection without re-entrant showPicker.
const fs = require('node:fs');
function rewrite(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (before === after) throw Error('TZ38_UNCHANGED_' + path);
  fs.writeFileSync(path, after);
  console.log('TZ38 updated', path);
}
rewrite('src/js/ui/photos.js', (source) => {
  const begin = source.indexOf('<input class="input" id="geo-country"');
  const close = begin < 0 ? -1 : source.indexOf('</datalist>', begin);
  if (begin < 0 || close < 0 || !source.slice(begin, close).includes('<datalist id="geo-countries">'))
    throw Error('TZ38_COUNTRY_DATALIST_ANCHOR_MISSING');
  const end = close + '</datalist>'.length;
  if (source.indexOf('<input class="input" id="geo-country"', end) >= 0)
    throw Error('TZ38_DUPLICATE_COUNTRY_INPUT');
  const selectMarkup = "<select class=\"input\" id=\"geo-country\" aria-label=\"Страна\"><option value=\"\">Выберите страну</option>${catalogue.countries.map(c=>`<option value=\"${esc(c.code)}\" ${state.geoCountry===c.code?'selected':''}>${esc(c.code)} — ${esc(c.name)}</option>`).join('')}</select>";
  source = source.slice(0, begin) + selectMarkup + source.slice(end);
  if (source.includes('id="geo-countries"') || !source.includes('id="geo-country"'))
    throw Error('TZ38_COUNTRY_SELECT_MISSING');
  return source;
});
rewrite('src/js/main.js', (source) => {
  // The TZ37 pointerdown + showPicker on <input list> can disrupt native
  // Electron/macOS pickers. Leave the <select> to the OS, no JS popup.
  const begin = source.indexOf('// Offer the native city and country pickers on the first pointer press.');
  const countryAnchor = "const geoCountry = document.getElementById('geo-country');";
  const end = begin < 0 ? -1 : source.indexOf(countryAnchor, begin);
  if (begin < 0 || end < 0 || source.indexOf('showPicker()', begin) < 0)
    throw Error('TZ38_SHOWPICKER_ANCHOR_MISSING');
  source = source.slice(0, begin) + source.slice(end);
  const anchor = source.indexOf("const geoCountry = document.getElementById('geo-country');");
  const oldStart = source.indexOf('  if (geoCountry)', anchor);
  const oldEnd = oldStart < 0 ? -1 : source.indexOf('  const geoCity =', oldStart);
  if (anchor < 0 || oldStart < 0 || oldEnd < 0 || oldEnd - oldStart > 1500)
    throw Error('TZ38_COUNTRY_CHANGE_ANCHOR_MISSING');
  const handler = [
    '  if (geoCountry) {',
    '    geoCountry.onchange = () => {',
    "      const value = geoCountry.value.trim().toUpperCase();",
    "      const valid = state.geoCatalogue?.countries?.some((country) => country.code === value);",
    "      state.geoCountry = valid ? value : '';",
    "      state.geoCity = '';",
    "      state.geoQuery = '';",
    '      updateCities();',
    '      mountPhotoMap();',
    '    };',
    '  }'
  ].join('\n');
  source = source.slice(0, oldStart) + handler + '\n\n' + source.slice(oldEnd);
  // TZ37 also inherited an on-focus showPicker on the city dropdown;
  // native select already opens on first click and must not re-enter itself.
  const focusStart = source.indexOf("geoCity.addEventListener('focus'");
  const focusEnd = focusStart < 0 ? -1 : source.indexOf('geoCity.onchange', focusStart);
  if (focusStart < 0 || focusEnd < 0 || focusEnd - focusStart > 700 ||
      !source.slice(focusStart, focusEnd).includes('geoCity.showPicker?.()'))
    throw Error('TZ38_CITY_FOCUS_SHOWPICKER_ANCHOR_MISSING');
  source = source.slice(0, focusStart) + source.slice(focusEnd);
  // No native picker may be opened in a pointerdown handler for GEO.
  if (source.includes("for (const pickerId of ['geo-country', 'geo-city'])"))
    throw Error('TZ38_UNSAFE_NATIVE_PICKER_RETAINED');
  return source;
});
const pkgPath = 'package.json';
const lockPath = 'package-lock.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
if (pkg.version !== '1.4.20') throw Error('TZ38_EXPECTED_1_4_20_GOT_' + pkg.version);
pkg.version = '1.4.21';
lock.version = '1.4.21';
if (lock.packages?.['']) lock.packages[''].version = '1.4.21';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
console.log('TZ38: native country select, no showPicker interception; release 1.4.21');
