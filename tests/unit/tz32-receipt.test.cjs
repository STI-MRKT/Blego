const { test }=require('node:test');
const assert=require('node:assert/strict');
async function classify(input) {
  const { parseInput }=await import('../../shared/importer.mjs');
  const { classifyRecords }=await import('../../shared/classifier.mjs');
  const parsed=await parseInput(
    { bytes: Buffer.from(input,'utf8'), originalName:'synthetic-order.txt' },
    { classification:true }
  );
  return { parsed, output: classifyRecords(parsed) };
}
function makeReceipt({ length=6, mismatch=false, firstMarker='-' }={}) {
  const lines=[];
  for(let i=0;i<length;i++) {
    const id=String(100000000000001+i);
    const owner=mismatch && i===3? '100000000099999':id;
    const row=[
      firstMarker, 'FAKE_ACCOUNT_PASSWORD_'+i, 'person'+i+'@example.test',
      'FAKE_MAIL_PASSWORD_'+i, 'https://2fa.fb.tools/FAKETEST2FA'+i+'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'Пример Тестовый', i===2?'-':'1988-05-12',
      'https://check.fb.tools/'+id, '-',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/150',
      JSON.stringify([
        {name:'datr',domain:'.facebook.com',value:'PUBLIC_TEST_ONLY'},
        {name:'c_user',domain:'.facebook.com',value:owner},
        {name:'xs',domain:'.facebook.com',value:'FAKE_SESSION_DONT_USE'}
      ])
    ];
    lines.push(row.join('\t'));
  }
  return [
    'Product title: Facebook - United Kingdom. 2021-23 - Page - Email - Cookies',
    'Order number: #37798',
    'Product quantity: '+length+' pcs.',
    'Purchase date and time: 29.09.2026, 14:41',
    '',
    'Please leave a review and try our website.',
    'Useful links: https://example.test/blog',
    '=== Your product ===',
    ...lines,
    ''
  ].join('\n');
}
test('TZ32 English receipt: exactly six accounts and preserved row-local credentials and cookies',async()=>{
  const text=makeReceipt(), {parsed,output}=await classify(text);
  assert.equal(parsed.records.length,6);
  assert.equal(output.records.length,6);
  assert.equal(parsed.structured,true);
  assert.equal(new Set(output.records.map(r=>r.data.accountId)).size,6);
  output.records.forEach((r,i)=>{
    assert.equal(r.data.accountId,String(100000000000001+i));
    assert.equal(r.data.password,'FAKE_ACCOUNT_PASSWORD_'+i);
    assert.equal(r.data.emailPassword,'FAKE_MAIL_PASSWORD_'+i);
    assert.equal(r.data.email,'person'+i+'@example.test');
    assert.equal(r.data.fullName,'Пример Тестовый');
    assert.equal(r.data.birthDate,i===2?'':'1988-05-12');
    assert.equal(r.extended.profileUrl,'https://check.fb.tools/'+r.data.accountId);
    assert.ok(r.extended.twoFactorUrl.includes('2fa.fb.tools'));
    assert.ok(r.data.userAgent.includes('Mozilla/5.0'));
    assert.equal(JSON.parse(r.data.cookies).find(x=>x.name==='c_user').value,r.data.accountId);
    assert.equal(text.slice(r.range.start,r.range.end),r.sourceRecord);
    for(const entry of r.sourceEntries) assert.equal(text.slice(entry.range.start,entry.range.end),entry.rawText);
  });
  assert.ok(!parsed.records.some(r=>/Product title|Please leave/.test(r.sourceRecord)));
});
test('TZ32 mismatching Cookie owner is reported and not silently assigned to the profile URL',async()=>{
  const {parsed,output}=await classify(makeReceipt({mismatch:true}));
  assert.equal(output.records.length,6);
  assert.ok(parsed.diagnostics.some(x=>x.code==='IDENTITY_CONFLICT'));
  assert.equal(output.records[3].data.accountId,'100000000099999');
});
test('TZ32 unrelated tabular receipts do not trigger Facebook-specific decoder',async()=>{
  const { parsed }=await classify('Product title: stationary\nOrder number: #37798\nProduct quantity: 6 pcs.\n=== Your product ===\n-\tExample\n');
  assert.notEqual(parsed.records.length,6);
});
