// Synthetic structural examples only; never usable credentials or account data.
const cookie = (id) =>
  `[ { "name": "c_user", "value": "${id}" }, {"name":"synthetic","value":"FAKE_\\u0061|;::\\\""} ]`;
function formatA(id = '00010001') {
  return `id:${id}::password:FAKE_ACCOUNT_PASSWORD::mail:one@example.test::emailPassword:FAKE_MAIL_PASSWORD::Access Token:FAKE_OPAQUE_TOKEN::Mozilla/5.0 (Synthetic; Test)::${cookie(id).replace('},', '},\n')}\n;name:Ирина Тестовая;GEO USA;LIMIT 50`;
}
function formatB(id = '00010002') {
  return `${id}|FAKE_UNASSIGNED_PASSWORD||mail:two@example.test|https://www.facebook.com/profile.php?id=${id}|${cookie(id)}|5.10.1984|Алёна Примерова|GEO Italy|AVA https://example.test/avatar.png|DOC https://example.test/document|FP NO|sent 3|friend 12`;
}
module.exports = { cookie, formatA, formatB };
