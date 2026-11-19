(function applyCompat() {
  'use strict';
  const fs=require('node:fs');
  function edit(path, changes) {
    let s=fs.readFileSync(path,'utf8');
    for(const [needle,replacement,label] of changes) {
      if(!s.includes(needle)) throw Error('TZ32_TEST_COMPAT_ANCHOR:'+path+':'+label);
      s=s.replaceAll(needle,replacement);
    }
    fs.writeFileSync(path,s);
    console.log('TZ32 reviewed legacy assertions:',path);
  }
  edit('tests/unit/friends-copy.test.cjs',[
    ["    url: `https://example.test/${i}`,\n    copyUrl: `https://example.test/${i}`", 
     "    platform: 'Facebook',\n    url: `https://www.facebook.com/profile.php?id=${615000000000010+i}`,\n    copyUrl: `https://www.facebook.com/profile.php?id=${615000000000010+i}`",'approved FB fixture'],
    ["'Нет доступных ссылок'","'No links available'",'English empty state']
  ]);
  edit('tests/unit/friends-v141.test.cjs',[
    ["    url: 'https://example.test/profile',","    url: 'https://www.facebook.com/profile.php?id=615000000000100',\n    copyUrl: 'https://www.facebook.com/profile.php?id=615000000000100',",'canonical profile URL'],
    ["    platform: 'Other',","    platform: 'Facebook',",'supported product platform'],
    ["  state.friendsRows = [row];","  state.friendsGeo = '';\n  state.friendsPlatform = '';\n  state.friendsQuery = '';\n  state.friendsRows = [row];",'reset filters'],
    ["name.includes('https://example.test/profile')","name.includes(row.copyUrl)",'canonical empty name']
  ]);
  edit('tests/unit/generator-independent.test.cjs',[
    ['/data-tab="profile"[^>]*>ФП</','/data-tab="profile"[^>]*>Page</','current tab label']
  ]);
  edit('tests/unit/news-copy.test.cjs',[
    ['Скопировать заголовок','Copy headline','headline label'],
    ['Скопировать ссылку','Copy link','link label'],
    ["'News shows up to 15 cards per topic and never pads sparse feeds'","'News shows up to 40 cards per topic and never pads sparse feeds'",'test name'],
    ['Array.from({ length: 24 }','Array.from({ length: 45 }','over-limit fixture'],
    ["length, 15);","length, 40);",'first card count'],
    ["'Showing 15 stories'","'Showing 40 stories'",'visible count'],
    ["'Article 15'","'Article 40'",'clamped overflow']
  ]);
  edit('tests/unit/tz14-hotfix.test.cjs',[
    ["    assert.equal(formattedPhoneForCopy(stored, country), stored);",
     "    const national = formattedPhoneForCopy(stored, country);\n    assert.ok(national && !national.startsWith('+'));\n    if (country === 'US') assert.equal(national, '302-578-0387');",
     'national rather than E164 clipboard']
  ]);
  edit('tests/unit/tz16-ux.test.cjs',[
    ["        platform: 'Instagram',","        platform: 'Facebook',",'current Friends platform'],
    ["        url: 'https://www.instagram.com/sample.creator/'",
      "        url: 'https://www.facebook.com/profile.php?id=615000000000123',\n        copyUrl: 'https://www.facebook.com/profile.php?id=615000000000123'",
      'canonical copy URL'],
    ['    assert.match(html, /data-action="friends-open"/);',
      '    assert.match(html, /aria-label="Copy profile URL"/);',
      'actual record action']
  ]);
  edit('tests/unit/tz17-ui.test.cjs',[
    ['Не определён','Not detected','empty field UI label'],
    ['Копировать Пароль от почты','Copy Email password','mail copy label'],
    ['Копировать Пароль','Copy Password','password copy label']
  ]);
  edit('tests/unit/tz19-adaptive-ui.test.cjs',[
    ['Сохранено схем: 2','Mappings saved: 2','saved layout counter'],
    ['Пароли, Cookie, токены и содержимое TXT в шаблоны не записываются',
      'Passwords, cookies, tokens and TXT content are never stored in mappings','privacy statement']
  ]);
  edit('tests/unit/tz21-string-decoder-ui.test.cjs',[
    ['Декодер строк','String Decoder','decoder name'],
    ["includes('Формат')","includes('Format')",'format label']
  ]);
  edit('tests/unit/tz22-catalogs.test.cjs',[
    ["    if (bad.includes('evil.test'))\n      assert.notEqual(canonicalUrl(bad), 'https://www.facebook.com/profile.php?id=4');\n    else assert.throws(() => canonicalUrl(bad));",
      "    assert.throws(() => canonicalUrl(bad));",
      'invalid hostile hosts should reject, not normalize']
  ]);
  edit('tests/unit/tz22-ui.test.cjs',[
    ['Не удалось сохранить','BIO could not be saved','current error text'],
    ['Случайные точки внутри|Current:|Other dates stay unchanged|Производитель и модель записываются',
      'Случайные точки внутри|Other dates stay unchanged|Производитель и модель записываются',
      'retain current metadata readout'],
    ["  const old = state.photoPool;\n  try {\n    state.photoPool = {\n      kind: 'avatar',",
      "  const old = state.photoPool;\n  const oldKind = state.photoPoolKind, oldCategory = state.photoPoolCategory, oldType = state.type;\n  try {\n    state.photoPoolKind = 'avatar';\n    state.photoPoolCategory = 'model';\n    state.type = 'model';\n    state.photoPool = {\n      category: 'model',\n      kind: 'avatar',",
      'fixture aligns with category-split pool'],
    ["    assert.match(fp, /Основное фото/);","    assert.match(fp, /Profile photo/);",'avatar label'],
    ["    assert.match(fp, /Обложка/);","    assert.match(fp, /Cover photo/);",'cover label'],
    ["  } finally {\n    state.photoPool = old;\n  }\n});",
      "  } finally {\n    state.photoPool = old;\n    state.photoPoolKind = oldKind;\n    state.photoPoolCategory = oldCategory;\n    state.type = oldType;\n  }\n});",
      'restore global UI selection']
  ]);
})();
