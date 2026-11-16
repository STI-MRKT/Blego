// Synthetic values only. Bare opaque tuples require explicit schema confirmation.
const cookie = '[{"name":"c_user","value":"10001"},{"name":"xs","value":"SYNTHETIC/:;|"}]';
const fields = {
  accountId: '10001',
  email: 'one@example.test',
  password: 'FAKE_ACCOUNT',
  emailPassword: 'FAKE_MAIL',
  twoFactorCode: 'SYNTHETIC_2FA',
  login: 'sample_login'
};
const labelled = Object.entries(fields).map(([k, v]) => `${k}=${v}`);
const cases = [
  {
    name: '2fa header code',
    text: 'id|2fa\n10001|SYNTHETIC_2FA',
    expected: [{ accountId: '10001', twoFactorCode: 'SYNTHETIC_2FA' }]
  },
  {
    name: '2fa header URL',
    text: 'id|2fa\n10001|https://example.test/2fa',
    expected: [{ accountId: '10001', twoFactorUrl: 'https://example.test/2fa' }]
  },
  {
    name: 'slash header protects URL and UA',
    text: 'id / profileUrl / userAgent / password\n10001 / https://www.facebook.com/10001 / Mozilla/5.0 (X11; Linux) / FAKE',
    expected: [
      {
        accountId: '10001',
        profileUrl: 'https://www.facebook.com/10001',
        userAgent: 'Mozilla/5.0 (X11; Linux)',
        password: 'FAKE'
      }
    ]
  },
  ...[':', '::', ';', '|', ' / ', ' \\\\ '].map((separator) => ({
    name: `labelled ${separator}`,
    text: labelled.join(separator),
    expected: [fields]
  })),
  {
    name: 'B explicitly confirmed',
    text: 'sample_login:FAKE_ACCOUNT:one@example.test:FAKE_MAIL:SYNTHETIC_2FA:10001',
    options: { schema: 'credentials6' },
    expected: [fields]
  },
  {
    name: 'B header',
    text: 'login:password:email:emailPassword:twoFactorCode:accountId\nsample_login:FAKE_ACCOUNT:one@example.test:FAKE_MAIL:SYNTHETIC_2FA:10001',
    expected: [fields]
  },
  {
    name: 'C confirmed',
    text: `sample_login | FAKE_ACCOUNT | 10001 | ${cookie} | Mozilla/5.0 (X11; Linux)`,
    options: { schema: 'account5' },
    expected: [
      {
        login: 'sample_login',
        password: 'FAKE_ACCOUNT',
        accountId: '10001',
        cookies: cookie,
        userAgent: 'Mozilla/5.0 (X11; Linux)'
      }
    ]
  },
  {
    name: 'A confirmed mixed',
    text: `one@example.test :: FAKE_TOKEN :: Mozilla/5.0 (X11; Linux) :: :: ${cookie} :: FAKE_ACCOUNT :: one@example.test;FAKE_ACCOUNT;FAKE_MAIL;1990-01-02;10001;Jane Example`,
    options: { schema: 'mixedA' },
    expected: [
      {
        email: 'one@example.test',
        token: 'FAKE_TOKEN',
        userAgent: 'Mozilla/5.0 (X11; Linux)',
        cookies: cookie,
        password: 'FAKE_ACCOUNT',
        emailPassword: 'FAKE_MAIL',
        birthDate: '1990-01-02',
        accountId: '10001',
        fullName: 'Jane Example'
      }
    ]
  },
  {
    name: 'missing mail password',
    text: 'id=10001:email=one@example.test:password=FAKE',
    expected: [{ accountId: '10001', email: 'one@example.test', password: 'FAKE' }]
  },
  {
    name: 'empty mail password',
    text: 'login:password:email:emailPassword:twoFactorCode:accountId\nsample_login:FAKE_ACCOUNT:one@example.test:::10001',
    expected: [
      {
        login: 'sample_login',
        password: 'FAKE_ACCOUNT',
        email: 'one@example.test',
        accountId: '10001'
      }
    ]
  },
  {
    name: 'backup separate',
    text: 'id=10001 / email=one@example.test / backup email=backup@example.test / mail password=FAKE_MAIL',
    expected: [
      {
        accountId: '10001',
        email: 'one@example.test',
        backupEmail: 'backup@example.test',
        emailPassword: 'FAKE_MAIL'
      }
    ]
  },
  {
    name: 'quoted password separators',
    text: 'id=10001:password="FAKE:a/b\\\\c;|::":email=one@example.test',
    expected: [{ accountId: '10001', password: 'FAKE:a/b\\c;|::', email: 'one@example.test' }]
  },
  {
    name: 'URL paths and UA preserved',
    text: 'id=10001 / profileUrl=https://www.facebook.com/10001 / userAgent=Mozilla/5.0 (X11; Linux) / password=FAKE',
    expected: [
      {
        accountId: '10001',
        profileUrl: 'https://www.facebook.com/10001',
        userAgent: 'Mozilla/5.0 (X11; Linux)',
        password: 'FAKE'
      }
    ]
  },
  {
    name: 'nested multiline cookie',
    text: `id=10001:email=one@example.test:cookie=[\n{"name":"c_user","value":"10001"},\n{"name":"xs","value":"SYNTHETIC/a:b"}\n]`,
    expected: [
      {
        accountId: '10001',
        email: 'one@example.test',
        cookies: '[\n{"name":"c_user","value":"10001"},\n{"name":"xs","value":"SYNTHETIC/a:b"}\n]'
      }
    ]
  },
  {
    name: 'Russian and English comments',
    text: 'Комментарий: пример\n# synthetic\nid=10001:пароль от почты=FAKE_MAIL:почта=one@example.test\nNotes: end',
    expected: [{ accountId: '10001', emailPassword: 'FAKE_MAIL', email: 'one@example.test' }]
  },
  {
    name: '2fa URL is distinct',
    text: 'id=10001 | 2fa=https://example.test/2fa/SYNTHETIC | 2fa code=SYNTHETIC_CODE',
    expected: [
      {
        accountId: '10001',
        twoFactorUrl: 'https://example.test/2fa/SYNTHETIC',
        twoFactorCode: 'SYNTHETIC_CODE'
      }
    ]
  },
  {
    name: 'no invented passwords in bare tuple',
    text: 'sample_login:FAKE_ACCOUNT:one@example.test:FAKE_MAIL:SYNTHETIC_2FA:10001',
    expected: [{ email: 'one@example.test' }],
    review: true
  },
  {
    name: 'mixed records do not transfer secrets',
    text: 'id=10001:email=one@example.test:emailPassword=ONE_FAKE\nid=10002 | email=two@example.test',
    expected: [
      { accountId: '10001', email: 'one@example.test', emailPassword: 'ONE_FAKE' },
      { accountId: '10002', email: 'two@example.test' }
    ]
  },
  {
    name: 'repeat layout',
    text: 'id=10001:email=one@example.test:emailPassword=ONE_FAKE\nid=10002:email=two@example.test:emailPassword=TWO_FAKE\n10003:three@example.test:THREE_FAKE',
    expected: [
      { accountId: '10001', email: 'one@example.test', emailPassword: 'ONE_FAKE' },
      { accountId: '10002', email: 'two@example.test', emailPassword: 'TWO_FAKE' },
      { accountId: '10003', email: 'three@example.test', emailPassword: 'THREE_FAKE' }
    ]
  },
  {
    name: 'unconfirmed filesystem path untouched',
    text: 'id=10001 | C:\\Users\\sample\\file.txt | /var/tmp/file.txt | password=FAKE',
    expected: [{ accountId: '10001', password: 'FAKE' }],
    review: true
  },
  {
    name: 'conflicting email not selected',
    text: 'id=10001:email=one@example.test:email=two@example.test',
    expected: [{ accountId: '10001' }],
    review: true
  }
];
module.exports = { cases };
