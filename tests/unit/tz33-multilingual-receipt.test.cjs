const { test } = require('node:test');
const assert = require('node:assert/strict');

async function classify(input, originalName = 'localized-order.txt') {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(input, 'utf8'), originalName },
    { classification: true }
  );
  return { parsed, output: classifyRecords(parsed) };
}

function makeReceipt(locale, length = 6) {
  const rows = [];
  for (let i = 0; i < length; i++) {
    const id = String(100000000000001 + i);
    const row = [
      '-',
      'FAKE_ACCOUNT_PASSWORD_' + i,
      'person' + i + '@example.test',
      'FAKE_MAIL_PASSWORD_' + i,
      'https://2fa.fb.tools/FAKETEST2FA' + i + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      locale.name,
      locale.birthDate || '1988-05-12',
      'https://check.fb.tools/' + id,
      '-',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/150',
      JSON.stringify([
        { name: 'datr', domain: '.facebook.com', value: 'PUBLIC_TEST_ONLY' },
        { name: 'c_user', domain: '.facebook.com', value: id },
        { name: 'xs', domain: '.facebook.com', value: 'FAKE_SESSION_DONT_USE' }
      ])
    ];
    rows.push(row.join('\t'));
  }

  return [
    locale.productLabel + ': ' + locale.productTitle,
    locale.orderLabel + ': ' + (locale.orderNumber || '#37798'),
    locale.quantityLabel + ': ' + (locale.quantity || String(length) + ' pcs.'),
    'Purchase reference: SYNTHETIC-ONLY',
    '',
    'Please leave a review and try our website.',
    '=== ' + locale.section + ' ===',
    ...rows,
    ''
  ].join('\n');
}

const locales = [
  {
    code: 'ru',
    productLabel: 'Название товара',
    productTitle: 'Facebook — аккаунты',
    orderLabel: 'Номер заказа',
    quantityLabel: 'Количество товара',
    section: 'Ваш товар',
    name: 'Иван Петров',
    birthDate: '12.05.1988',
    quantity: '6 шт.'
  },
  {
    code: 'uk',
    productLabel: 'Назва товару',
    productTitle: 'Facebook — облікові записи',
    orderLabel: 'Номер замовлення',
    quantityLabel: 'Кількість товару',
    section: 'Ваше замовлення',
    name: 'Олена Коваль',
    birthDate: '12.05.1988',
    quantity: '6 шт.'
  },
  {
    code: 'de',
    productLabel: 'Produkttitel',
    productTitle: 'Facebook-Konten',
    orderLabel: 'Bestellnummer',
    quantityLabel: 'Produktmenge',
    section: 'Ihr Produkt',
    name: 'Jürgen Müller',
    birthDate: '12.05.1988',
    quantity: '6 Stück'
  },
  {
    code: 'pl',
    productLabel: 'Tytuł produktu',
    productTitle: 'Konta Facebook',
    orderLabel: 'Numer zamówienia',
    quantityLabel: 'Ilość produktu',
    section: 'Twój produkt',
    name: 'Łukasz Żółć',
    birthDate: '12.05.1988',
    quantity: '6 szt.'
  },
  {
    code: 'cs',
    productLabel: 'Název produktu',
    productTitle: 'Facebook účty',
    orderLabel: 'Číslo objednávky',
    quantityLabel: 'Množství produktu',
    section: 'Váš produkt',
    name: 'Příliš Žluťoučký',
    birthDate: '12.05.1988',
    quantity: '6 ks'
  },
  {
    code: 'zh',
    productLabel: '商品标题',
    productTitle: 'Facebook 账号',
    orderLabel: '订单号',
    quantityLabel: '商品数量',
    section: '您的商品',
    name: '张伟',
    orderNumber: '３７７９８',
    birthDate: '１９８８-０５-１２',
    quantity: '６ 件'
  },
  {
    code: 'hi',
    productLabel: 'उत्पाद शीर्षक',
    productTitle: 'Facebook खाते',
    orderLabel: 'ऑर्डर नंबर',
    quantityLabel: 'उत्पाद मात्रा',
    section: 'आपका उत्पाद',
    name: 'आदित्य शर्मा',
    orderNumber: '३७७९८',
    birthDate: '१९८८-०५-१२',
    quantity: '६ पीस'
  }
];

test('TZ33 localized receipt envelopes preserve six independent account records', async (t) => {
  for (const locale of locales) {
    await t.test(locale.code, async () => {
      const source = makeReceipt(locale);
      const { parsed, output } = await classify(source);
      assert.equal(parsed.records.length, 6);
      assert.equal(output.records.length, 6);
      assert.equal(parsed.structured, true);
      assert.equal(parsed.delimiter, '\t');

      output.records.forEach((record, index) => {
        const id = String(100000000000001 + index);
        assert.equal(record.data.accountId, id);
        assert.equal(record.data.password, 'FAKE_ACCOUNT_PASSWORD_' + index);
        assert.equal(record.data.emailPassword, 'FAKE_MAIL_PASSWORD_' + index);
        assert.equal(record.data.email, 'person' + index + '@example.test');
        assert.equal(record.data.fullName, locale.name);
        const expectedBirthDate = ['zh', 'hi'].includes(locale.code)
          ? '1988-05-12'
          : locale.birthDate || '1988-05-12';
        assert.equal(record.data.birthDate, expectedBirthDate);
        const dateEntry = record.sourceEntries.find((entry) => entry.header === 'birthDate');
        assert.equal(dateEntry.rawText.trim(), locale.birthDate || '1988-05-12');
        assert.equal(record.extended.profileUrl, 'https://check.fb.tools/' + id);
        assert.ok(record.extended.twoFactorUrl.includes('2fa.fb.tools'));
        assert.equal(
          JSON.parse(record.data.cookies).find((cookie) => cookie.name === 'c_user').value,
          id
        );
        assert.equal(source.slice(record.range.start, record.range.end), record.sourceRecord);
        for (const entry of record.sourceEntries) {
          assert.equal(source.slice(entry.range.start, entry.range.end), entry.rawText);
        }
      });
      assert.ok(!parsed.records.some((record) => /Purchase reference|Please leave/u.test(record.sourceRecord)));
    });
  }
});

test('TZ33 localized quantity must match the number of parsed account rows', async () => {
  const { shopReceiptRecords } = await import('../../shared/classifier-shop-receipt.mjs');
  const locale = locales.find((item) => item.code === 'zh');
  const source = makeReceipt({ ...locale, quantity: '７ 件' });
  assert.equal(shopReceiptRecords(source), null);
});

test('TZ33 non-Facebook localized order receipts do not activate the Facebook decoder', async () => {
  const { shopReceiptRecords } = await import('../../shared/classifier-shop-receipt.mjs');
  const source = [
    '商品标题: 文具',
    '订单号: ３７７９８',
    '商品数量: ６ 件',
    '=== 您的商品 ===',
    '-\tExample'
  ].join('\n');
  assert.equal(shopReceiptRecords(source), null);
});

const legacyFixtures = [
  {
    encoding: 'windows-1251',
    expectedLanguage: 'ru',
    base64: 'zeDn4uDt6OUg8u7i4PDgOiBGYWNlYm9vayCXIODq6uDz7fL7Cs3u7OXwIOfg6uDn4DogIzM3Nzk4Csru6+j35fHy4u4g8u7i4PDgOiAxIPjyLgoKPT09IMLg+CDy7uLg8CA9PT0KLQlGQUtFX0FDQ09VTlRfUEFTU1dPUkRfMAlwZXJzb24wQGV4YW1wbGUudGVzdAlGQUtFX01BSUxfUEFTU1dPUkRfMAlodHRwczovLzJmYS5mYi50b29scy9GQUtFVEVTVDJGQTBBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWgnI4uDtIM/l8vDu4gkxOTg4LTA1LTEyCWh0dHBzOi8vY2hlY2suZmIudG9vbHMvMTAwMDAwMDAwMDAwMDAxCS0JTW96aWxsYS81LjAgKE1hY2ludG9zaDsgSW50ZWwgTWFjIE9TIFggMTBfMTVfNykgQ2hyb21lLzE1MAlbeyJuYW1lIjoiY191c2VyIiwiZG9tYWluIjoiLmZhY2Vib29rLmNvbSIsInZhbHVlIjoiMTAwMDAwMDAwMDAwMDAxIn1dCg=='
  },
  {
    encoding: 'windows-1250',
    expectedLanguage: 'cs',
    base64: 'TuF6ZXYgcHJvZHVrdHU6IEZhY2Vib29rIProdHkKyO1zbG8gb2JqZWRu4XZreTogIzM3Nzk4Ck1ub55zdHbtIHByb2R1a3R1OiAxIGtzCgo9PT0gVuGaIHByb2R1a3QgPT09Ci0JRkFLRV9BQ0NPVU5UX1BBU1NXT1JEXzAJcGVyc29uMEBleGFtcGxlLnRlc3QJRkFLRV9NQUlMX1BBU1NXT1JEXzAJaHR0cHM6Ly8yZmEuZmIudG9vbHMvRkFLRVRFU1QyRkEwQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVoJUPjtbGmaIJ5sdZ1vdehr/QkxMi4wNS4xOTg4CWh0dHBzOi8vY2hlY2suZmIudG9vbHMvMTAwMDAwMDAwMDAwMDAxCS0JTW96aWxsYS81LjAgKE1hY2ludG9zaDsgSW50ZWwgTWFjIE9TIFggMTBfMTVfNykgQ2hyb21lLzE1MAlbeyJuYW1lIjoiY191c2VyIiwiZG9tYWluIjoiLmZhY2Vib29rLmNvbSIsInZhbHVlIjoiMTAwMDAwMDAwMDAwMDAxIn1dCg=='
  },
  {
    encoding: 'gb18030',
    expectedLanguage: 'zh',
    base64: 'yczGt7HqzOKjukZhY2Vib29rINXLusUKtqm1pbrFo7qjs6O3o7ejuaO4CsnMxrfK/cG/o7qjsSC8/goKPT09IMT6tcTJzMa3ID09PQotCUZBS0VfQUNDT1VOVF9QQVNTV09SRF8wCXBlcnNvbjBAZXhhbXBsZS50ZXN0CUZBS0VfTUFJTF9QQVNTV09SRF8wCWh0dHBzOi8vMmZhLmZiLnRvb2xzL0ZBS0VURVNUMkZBMEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaCdXFzrAJo7GjuaO4o7gto7CjtS2jsaOyCWh0dHBzOi8vY2hlY2suZmIudG9vbHMvMTAwMDAwMDAwMDAwMDAxCS0JTW96aWxsYS81LjAgKE1hY2ludG9zaDsgSW50ZWwgTWFjIE9TIFggMTBfMTVfNykgQ2hyb21lLzE1MAlbeyJuYW1lIjoiY191c2VyIiwiZG9tYWluIjoiLmZhY2Vib29rLmNvbSIsInZhbHVlIjoiMTAwMDAwMDAwMDAwMDAxIn1dCg=='
  },
  {
    encoding: 'big5',
    expectedLanguage: 'zh',
    base64: 'sNOrfrzQw0ShR0ZhY2Vib29rILFiuLkKrXGz5ri5oUeisqK2oraiuKK3CrDTq368xrZxoUeisCCl8woKPT09ILF6qrqw06t+ID09PQotCUZBS0VfQUNDT1VOVF9QQVNTV09SRF8wCXBlcnNvbjBAZXhhbXBsZS50ZXN0CUZBS0VfTUFJTF9QQVNTV09SRF8wCWh0dHBzOi8vMmZhLmZiLnRvb2xzL0ZBS0VURVNUMkZBMEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaCbFpsLYJorCiuKK3orctoq+itC2isKKxCWh0dHBzOi8vY2hlY2suZmIudG9vbHMvMTAwMDAwMDAwMDAwMDAxCS0JTW96aWxsYS81LjAgKE1hY2ludG9zaDsgSW50ZWwgTWFjIE9TIFggMTBfMTVfNykgQ2hyb21lLzE1MAlbeyJuYW1lIjoiY191c2VyIiwiZG9tYWluIjoiLmZhY2Vib29rLmNvbSIsInZhbHVlIjoiMTAwMDAwMDAwMDAwMDAxIn1dCg=='
  }
];

test('TZ33 auto-detects legacy Cyrillic, Central European and Chinese receipt encodings', async () => {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  for (const fixture of legacyFixtures) {
    const parsed = await parseInput(
      {
        bytes: Buffer.from(fixture.base64, 'base64'),
        originalName: 'legacy-localized-order.txt'
      },
      { classification: true }
    );
    assert.equal(parsed.encoding, fixture.encoding);
    const output = classifyRecords(parsed);
    assert.equal(output.records.length, 1);
    assert.equal(output.records[0].data.accountId, '100000000000001');
    assert.equal(output.records[0].data.password, 'FAKE_ACCOUNT_PASSWORD_0');
    assert.equal(output.records[0].data.emailPassword, 'FAKE_MAIL_PASSWORD_0');
  }
});
