(function tz30Fixtures(){
  const {test} = require('node:test');
  const assert=require('node:assert/strict');
  const cookie = (id) => JSON.stringify([{domain:'.facebook.com',name:'c_user',value:id},{domain:'.facebook.com',name:'xs',value:'FAKE_COOKIE_ONLY'}]);
  const ua = 'Mozilla/5.0 (Test; Synthetic) AppleWebKit/537.36 Chrome/141';
  const profile=(id)=> 'https://www.facebook.com/profile.php?id='+id;
  async function parse(text,filename='synthetic.txt'){
    const {parseInput}=await import('../../shared/importer.mjs');
    const {classifyRecords}=await import('../../shared/classifier.mjs');
    const parsed=await parseInput({bytes:Buffer.from(text,'utf8'),originalName:filename},{classification:true});
    return {parsed,output:classifyRecords(parsed)};
  }
  test('TZ30 synthetic order receipt: 5 records, quoted cookie and promotional envelope never become rows', async()=>{
    const lines=Array.from({length:5},(_,i)=>{
      const id='6150000000'+String(1000+i);
      return [
        'test'+i+'@example.test','FAKE_PRIMARY_'+i,'16-03-2002',profile(id),ua,
        'EAAB_FAKE_TOKEN_'+i,'backup'+i+'@example.test:FAKE_MAIL_'+i,cookie(id),
        'FAKE 2FA PLACEHOLDER','',''
      ].join('|');
    });
    const body='Номер заказа: 992010\nФормат выдачи: ...\n--------------------------------\nВаш заказ:\n'+lines.join('\n')+'\n';
    const {parsed,output}=await parse(body,'Order-992010-synthetic.txt');
    assert.equal(output.records.length,5);
    assert.equal(new Set(output.records.map(r=>r.data.accountId)).size,5);
    for(let i=0;i<5;i++){
      assert.equal(output.records[i].data.email,'test'+i+'@example.test');
      assert.equal(output.records[i].data.accountId,'6150000000'+String(1000+i));
      assert.ok(output.records[i].data.cookies?.includes('FAKE_COOKIE_ONLY'));
    }
    assert.equal(parsed.records.length,5);
  });
  test('TZ30 synthetic mixed receipt: 5 records with alternate :: separators and post-cookie fields',async()=>{
    const lines=Array.from({length:5},(_,i)=>{
      const id='6150000000'+String(2000+i),mail='mixed'+i+'@example.test', pass='FAKE_ACCOUNT_'+i;
      if(i===0)return [
        mail,pass,'FAKE_MAIL_'+i,'EAAB_FAKE_TOKEN_'+i,ua,profile(id),cookie(id),
        '6.1.1993','Example Person','GEO France'
      ].join('|');
      return [mail,'EAAB_FAKE_TOKEN_'+i,ua,'',cookie(id),pass,
        [mail,pass,'FAKE_MAIL_'+i,'04.08.1952',id,'Example Person','GEO France'].join(';')
      ].join(' :: ');
    });
    const {output}=await parse(lines.join('\n')+'\n--------------------\nCoupon: TEST_ONLY\n','synthetic-mixed.txt');
    assert.equal(output.records.length,5);
    assert.equal(new Set(output.records.map(r=>r.data.email)).size,5);
    assert.ok(output.records.every(r=>r.data.cookies));
  });
  test('TZ30 synthetic blank-token receipts: 10 local record boundaries and cookie owners',async()=>{
    const lines=Array.from({length:10},(_,i)=>{
      const id='6150000000'+String(3000+i),mail='blank'+i+'@example.test';
      return [mail,i%3===0?'EAAB_FAKE_TOKEN_'+i:'',ua,'',cookie(id),
        'FAKE_ACCOUNT_'+i,
        [mail,'FAKE_ACCOUNT_'+i,'FAKE_MAIL_'+i,'27.10.2004',id,'','',''].join(';')
      ].join(' :: ')+'; #2';
    });
    const {output}=await parse(lines.join('\n')+'\n--------------------\nDiscount code: NOT_A_RECORD\n','synthetic-blank.txt');
    assert.equal(output.records.length,10);
    for(let i=0;i<10;i++){
      assert.equal(output.records[i].data.email,'blank'+i+'@example.test');
      assert.equal(output.records[i].data.accountId,'6150000000'+String(3000+i));
      assert.ok(output.records[i].data.cookies?.includes('FAKE_COOKIE_ONLY'));
    }
  });
})();
