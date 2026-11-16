// Entirely synthetic. No source account file or real credentials belong in Git.
const fields = {
  login: 'synthetic.fr.account',
  password: '  SYNTHETIC:pass;|=/\\ "quotes"  ',
  email: 'synthetic-fr@example.test',
  emailPassword: '"SYNTHETIC mail password"  ',
  accountId: '000100013',
  birthDate: '1991-09-18',
  token: '  SYNTHETIC_TOKEN:a=b;|/\\  ',
  userAgent: 'Mozilla/5.0 (Synthetic; Test) Example/1.0',
  cookies: '[{"name":"c_user","value":"000100013"},{"name":"xs","value":"SYNTHETIC:;|/"}]'
};
const labels = {
  login: 'Login FB',
  password: 'Password',
  email: 'Email',
  emailPassword: 'Email password',
  accountId: 'ID Account',
  birthDate: 'Date of Birth',
  token: 'Token',
  userAgent: 'User-agent',
  cookies: 'Cookie'
};
const pairs = Object.entries(fields).map(([key, value]) => [labels[key], value]);
const block = pairs.map((pair) => pair.join('\t')).join('\r\n');
module.exports = { fields, labels, pairs, block };
