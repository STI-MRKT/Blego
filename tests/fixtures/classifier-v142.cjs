// Every value is synthetic. Expected assignments are hand-labelled, not computed.
module.exports.cases = [
  {
    name: 'explicit English labels and separate passwords',
    text: 'id:10001|password:ACCOUNT_DEMO|email:one@example.test|email pass:MAIL_DEMO',
    expected: [
      {
        accountId: '10001',
        password: 'ACCOUNT_DEMO',
        email: 'one@example.test',
        emailPassword: 'MAIL_DEMO'
      }
    ]
  },
  {
    name: 'Russian label and quoted unusual characters',
    text: 'id:10002;почта:two@example.test;пароль от почты:" пробел :: | ; 🗝️ "',
    expected: [
      { accountId: '10002', email: 'two@example.test', emailPassword: ' пробел :: | ; 🗝️ ' }
    ]
  },
  {
    name: 'absent mail password',
    text: 'id:10003|password:ACCOUNT_ONLY|email:three@example.test',
    expected: [{ accountId: '10003', password: 'ACCOUNT_ONLY', email: 'three@example.test' }]
  },
  {
    name: 'unlabelled adjacent string remains ambiguous',
    text: 'id:10004|four@example.test|DO_NOT_GUESS',
    expected: [{ accountId: '10004', email: 'four@example.test' }],
    review: true
  },
  {
    name: 'two emails without roles remain ambiguous',
    text: 'id:10005|a@example.test|b@example.test|UNKNOWN_SECRET',
    expected: [{ accountId: '10005' }],
    review: true
  },
  {
    name: 'tab and semicolon with introductory prose',
    text: '# Синтетические данные\nid:10006\temail:six@example.test;mail pass:MAIL_SIX\nComments: synthetic only',
    expected: [{ accountId: '10006', email: 'six@example.test', emailPassword: 'MAIL_SIX' }]
  },
  {
    name: 'same width different schemes and held-out values',
    text: [
      'id:11001|email:a@example.test|email password:A_MAIL|password:A_ACCOUNT|backup email:backup-a@example.test',
      'id:11002|email:b@example.test|email password:B_MAIL|password:B_ACCOUNT|backup email:backup-b@example.test',
      'id:11003|c@example.test|C_MAIL|C_ACCOUNT|backup-c@example.test',
      'email:d@example.test|id:12001|password:D_ACCOUNT|email password:D_MAIL|backup email:backup-d@example.test',
      'email:e@example.test|id:12002|password:E_ACCOUNT|email password:E_MAIL|backup email:backup-e@example.test',
      'f@example.test|id:12003|F_ACCOUNT|F_MAIL|backup-f@example.test',
      'id:11004|g@example.test||G_ACCOUNT|backup-g@example.test'
    ].join('\n'),
    expected: [
      {
        accountId: '11001',
        email: 'a@example.test',
        emailPassword: 'A_MAIL',
        password: 'A_ACCOUNT',
        backupEmail: 'backup-a@example.test'
      },
      {
        accountId: '11002',
        email: 'b@example.test',
        emailPassword: 'B_MAIL',
        password: 'B_ACCOUNT',
        backupEmail: 'backup-b@example.test'
      },
      {
        accountId: '11003',
        email: 'c@example.test',
        emailPassword: 'C_MAIL',
        password: 'C_ACCOUNT',
        backupEmail: 'backup-c@example.test'
      },
      {
        accountId: '12001',
        email: 'd@example.test',
        emailPassword: 'D_MAIL',
        password: 'D_ACCOUNT',
        backupEmail: 'backup-d@example.test'
      },
      {
        accountId: '12002',
        email: 'e@example.test',
        emailPassword: 'E_MAIL',
        password: 'E_ACCOUNT',
        backupEmail: 'backup-e@example.test'
      },
      {
        accountId: '12003',
        email: 'f@example.test',
        emailPassword: 'F_MAIL',
        password: 'F_ACCOUNT',
        backupEmail: 'backup-f@example.test'
      },
      {
        accountId: '11004',
        email: 'g@example.test',
        password: 'G_ACCOUNT',
        backupEmail: 'backup-g@example.test'
      }
    ]
  },
  {
    name: 'conflicting layouts never guess password role',
    text: [
      'id:13001|email:a@example.test|password:A|email password:B',
      'id:13002|email:b@example.test|password:C|email password:D',
      'id:13003|email:c@example.test|email password:E|password:F',
      'id:13004|email:d@example.test|email password:G|password:H',
      'id:13005|e@example.test|UNCERTAIN_A|UNCERTAIN_B'
    ].join('\n'),
    expected: [
      { accountId: '13001', email: 'a@example.test', password: 'A', emailPassword: 'B' },
      { accountId: '13002', email: 'b@example.test', password: 'C', emailPassword: 'D' },
      { accountId: '13003', email: 'c@example.test', emailPassword: 'E', password: 'F' },
      { accountId: '13004', email: 'd@example.test', emailPassword: 'G', password: 'H' },
      { accountId: '13005', email: 'e@example.test' }
    ],
    review: true
  },
  {
    name: 'multiline nested cookie with account boundaries',
    text: 'id:14001|email:a@example.test|mail password:MAIL_A|cookies:[\n{"name":"c_user","value":"14001","extra":{"synthetic":true}}\n]\nid:14002|email:b@example.test|backup email:backup@example.test',
    expected: [
      {
        accountId: '14001',
        email: 'a@example.test',
        emailPassword: 'MAIL_A',
        cookies: '[\n{"name":"c_user","value":"14001","extra":{"synthetic":true}}\n]'
      },
      { accountId: '14002', email: 'b@example.test', backupEmail: 'backup@example.test' }
    ]
  }
];
const { formatA, formatB, cookie } = require('./classifier-v14.cjs');
module.exports.cases.push(
  {
    name: 'prior synthetic format A',
    text: formatA(),
    expected: [
      {
        accountId: '00010001',
        password: 'FAKE_ACCOUNT_PASSWORD',
        emailPassword: 'FAKE_MAIL_PASSWORD',
        email: 'one@example.test',
        token: 'FAKE_OPAQUE_TOKEN',
        userAgent: 'Mozilla/5.0 (Synthetic; Test)',
        cookies: cookie('00010001').replace('},', '},\n'),
        fullName: 'Ирина Тестовая',
        geo: 'USA'
      }
    ]
  },
  {
    name: 'prior synthetic format B keeps absent mail password empty',
    text: formatB(),
    expected: [
      {
        accountId: '00010002',
        email: 'two@example.test',
        cookies: cookie('00010002'),
        birthDate: '5.10.1984',
        fullName: 'Алёна Примерова',
        geo: 'Italy'
      }
    ],
    review: true
  }
);
module.exports.cases.push(
  {
    name: 'space-separated mail password label',
    text: 'id:15001|email fifteen@example.test|mail password SYNTHETIC_MAIL',
    expected: [
      { accountId: '15001', email: 'fifteen@example.test', emailPassword: 'SYNTHETIC_MAIL' }
    ]
  },
  {
    name: 'labelled multiline blocks keep missing password out of next account',
    text: 'Условия: синтетический пример\nid:15002\nemail:sixteen@example.test\nemail pass:ONLY_FIRST\n\nid:15003\nemail:seventeen@example.test',
    expected: [
      { accountId: '15002', email: 'sixteen@example.test', emailPassword: 'ONLY_FIRST' },
      { accountId: '15003', email: 'seventeen@example.test' }
    ]
  },
  {
    name: 'typed-looking passwords retain explicit roles',
    text: 'id:15004|email:eighteen@example.test|mail password:00001234|password:2000-01-02\nid:15005|email:nineteen@example.test|email pass:looks-like@example.test',
    expected: [
      {
        accountId: '15004',
        email: 'eighteen@example.test',
        emailPassword: '00001234',
        password: '2000-01-02'
      },
      {
        accountId: '15005',
        email: 'nineteen@example.test',
        emailPassword: 'looks-like@example.test'
      }
    ]
  }
);
