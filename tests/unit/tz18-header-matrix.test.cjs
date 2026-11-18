const { test } = require('node:test');
const assert = require('node:assert/strict');

const layouts = [
  'Логин|Пароль|Fb_ID|Имя|Фамилия|Дата рождения',
  'Fb_ID|Логин|Пароль|Cookie|Имя',
  'Имя|Фамилия|Логин|Пароль|Fb_ID|Cookie',
  'Логин|Fb_ID|Имя|Дата рождения|Пол|Страна',
  'Fb_ID|Имя|Фамилия|Дата рождения|Логин|Пароль',
  'Логин|Пароль|Имя|Фамилия|Пол|ГЕО',
  'Имя|Fb_ID|Дата рождения|Логин|Пароль|Cookie',
  'Fb_ID|Логин|Имя|Фамилия|Пароль|Дата регистрации',
  'Логин|Имя|Fb_ID|Пароль|Дата рождения|ГЕО',
  'Пароль|Логин|Fb_ID|Имя|Фамилия|Cookie',
  'Fb_ID|Cookie|User-Agent|Proxy|Логин|Пароль',
  'Логин|Пароль|Cookie|Token|Fb_ID',
  'Fb_ID|Cookie|Token|Дата создания|Статус',
  'Proxy|Логин|Пароль|Fb_ID|Cookie',
  'Fb_ID|Логин|Cookie|User-Agent|Статус',
  'Логин|Пароль|Fb_ID|2FA|Email',
  'Fb_ID|Cookie|Email|Телефон|Статус',
  'Логин|Пароль|Proxy|ГЕО|Fb_ID',
  'Cookie|Fb_ID|Логин|Дата проверки|Результат',
  'Fb_ID|Token|Cookie|Дата обновления|Статус',
  'Имя|Фамилия|Возраст|Пол|ГЕО|Fb_ID',
  'Fb_ID|Имя|Дата рождения|Город|Страна',
  'Логин|Имя|Фамилия|Аватар|Ссылка на профиль',
  'Fb_ID|Имя|Фамилия|Друзья|Подписчики',
  'Имя|Фамилия|Дата рождения|Пол|Язык|ГЕО',
  'Ссылка|Fb_ID|Имя|Фамилия|Статус профиля',
  'Fb_ID|Имя|Фото профиля|Обложка|Дата регистрации',
  'Имя|Фамилия|ГЕО|Город|Язык|Fb_ID',
  'Fb_ID|Имя|Подписчики|Друзья|Verified',
  'Логин|Fb_ID|Имя|Фамилия|Ссылка|Аватар',
  'Fb_ID|Статус|Дата проверки|Причина|Комментарий',
  'Логин|Fb_ID|Валидность|Дата проверки|Результат',
  'Fb_ID|Существует|Доступен|Заблокирован|Дата проверки',
  'Логин|Пароль|Fb_ID|Статус|Причина блокировки',
  'Fb_ID|HTTP Status|Результат|Время ответа|Дата',
  'Fb_ID|Live|Verified|Followers|Following',
  'Логин|Fb_ID|Статус входа|2FA|Cookie Status',
  'Fb_ID|Проверка профиля|Проверка ID|Итоговый статус',
  'Fb_ID|Дата проверки|Последняя активность|Статус',
  'Логин|Fb_ID|Валидность|Доступность|Примечание',
  'Логин|Пароль|Fb_ID|Имя|Дата рождения|ГЕО|Статус',
  'Fb_ID|Имя|Фамилия|Логин|Cookie|Proxy|Статус',
  'Дата добавления|Fb_ID|Логин|Имя|ГЕО|Статус',
  'Fb_ID|Имя|Дата рождения|Followers|Following|Verified',
  'Логин|Пароль|Email|Fb_ID|Имя|Дата регистрации',
  'Fb_ID|Ссылка|Имя|Фамилия|ГЕО|Дата проверки|Результат',
  'Логин|Fb_ID|Имя|Пароль|Proxy|Дата добавления|Комментарий',
  'ГЕО|Fb_ID|Имя|Фамилия|Followers|Статус|Дата проверки',
  'ID|Логин|Имя|Фамилия|Дата рождения|Статус|Комментарий',
  'Fb_ID|Логин|Имя|Фамилия|ГЕО|Followers|Following|Дата проверки'
];

const uid = '61500000123456';
const values = {
  Логин: 'sample.user',
  Пароль: 'SYNTHETIC_PASSWORD_123',
  Fb_ID: uid,
  ID: uid,
  Имя: 'Иван',
  Фамилия: 'Петров',
  'Дата рождения': '1999-05-03',
  Cookie: JSON.stringify({ c_user: uid, xs: 'SYNTHETIC' }),
  'User-Agent': 'Mozilla/5.0',
  Proxy: '127.0.0.1:8080',
  Пол: 'male',
  Страна: 'RU',
  ГЕО: 'RU',
  'Дата регистрации': '2020-04-01',
  Token: 'SYNTHETIC_TOKEN',
  'Дата создания': '2021-03-02',
  Статус: 'LIVE',
  '2FA': 'SYNTHETIC_2FA',
  Email: 'synthetic@example.test',
  Телефон: '936-364-3764',
  'Дата проверки': '2026-11-18',
  Результат: 'LIVE',
  'Дата обновления': '2023-12-04',
  Возраст: '27',
  Город: 'Moscow',
  Аватар: 'https://example.test/avatar.jpg',
  'Ссылка на профиль': 'https://www.facebook.com/profile.php?id=' + uid,
  Друзья: '100',
  Подписчики: '200',
  Язык: 'ru',
  Ссылка: 'https://www.facebook.com/profile.php?id=' + uid,
  'Статус профиля': 'ACTIVE',
  'Фото профиля': 'https://example.test/profile.jpg',
  Обложка: 'https://example.test/cover.jpg',
  Verified: 'false',
  Валидность: 'valid',
  Существует: 'yes',
  Доступен: 'yes',
  Заблокирован: 'no',
  Причина: 'none',
  Комментарий: 'synthetic note',
  'Причина блокировки': 'none',
  'HTTP Status': '200',
  'Время ответа': '123',
  Дата: '2026-11-18',
  Live: 'true',
  Followers: '123',
  Following: '456',
  'Статус входа': 'OK',
  'Cookie Status': 'valid',
  'Проверка профиля': 'done',
  'Проверка ID': 'done',
  'Итоговый статус': 'LIVE',
  'Последняя активность': '2026-11-01',
  Доступность: 'yes',
  Примечание: 'synthetic',
  'Дата добавления': '2026-10-01'
};

async function scan(text, opts = {}) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(text, 'utf8'), originalName: 'synthetic.txt' },
    { classification: true, ...opts }
  );
  return { parsed, result: classifyRecords(parsed, opts) };
}

test('TZ18 all provided pipe-header layouts map password and ID by label without guessing', async () => {
  for (const header of layouts) {
    const columns = header.split('|');
    const dataRow = columns.map((column) => values[column] ?? 'SYNTHETIC_EXTRA').join('|');
    const { parsed, result } = await scan(header + '\n' + dataRow);
    assert.equal(result.records.length, 1, header);
    assert.equal(result.records[0].sourceRecord, dataRow, header);
    assert.equal(
      result.records[0].data.password,
      columns.includes('Пароль') ? values['Пароль'] : '',
      header
    );
    assert.equal(
      result.records[0].data.accountId,
      columns.some((name) => ['Fb_ID', 'ID'].includes(name)) ? uid : '',
      header
    );
    if (columns.includes('Логин'))
      assert.equal(result.records[0].extended.login, values['Логин'], header);
    assert.equal(parsed.headerless, false, header);
  }
});

test('TZ18 unsupported registration/check date headers never become birth date', async () => {
  const header = 'Fb_ID|Дата регистрации|Статус|Дата проверки|Комментарий';
  const row = [uid, '2020-04-01', 'LIVE', '2026-11-18', 'synthetic note'].join('|');
  const { result } = await scan(header + '\n' + row);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].data.accountId, uid);
  assert.equal(result.records[0].data.birthDate, '');
  assert.ok(result.records[0].unrecognized.length > 0);
});

test('TZ18 supplied column order resolves unlabelled passwords without guessing', async () => {
  const schema = 'Логин|Пароль|Fb_ID|Имя|Фамилия|Дата рождения';
  const row = ['sample.user', 'SYNTHETIC_PASSWORD_123', uid, 'Иван', 'Петров', '1999-05-03'].join(
    '|'
  );
  const { result } = await scan(row, { headers: false, columnOrder: schema });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].data.password, 'SYNTHETIC_PASSWORD_123');
  assert.equal(result.records[0].data.accountId, uid);
  assert.equal(result.records[0].extended.login, 'sample.user');
});

test('TZ18 wrong-width positional schema never assigns a password from shifted columns', async () => {
  const schema = 'Логин|Пароль|Fb_ID|Cookie|Имя';
  const row = ['sample.user', uid, 'Иван'].join('|');
  const { result } = await scan(row, { headers: false, columnOrder: schema });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].data.password, '');
  assert.ok(result.records[0].warnings.some((w) => w.code === 'LAYOUT_WIDTH_MISMATCH'));
});
