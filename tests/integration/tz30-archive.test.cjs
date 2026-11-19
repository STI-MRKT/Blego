(function tz30ArchiveTests(){
  const {test}=require('node:test');
  const assert=require('node:assert/strict');
  const {fixture}=require('../fixtures/archive.cjs');
  const {createArchiveService}=require('../../electron/features/archive/service.cjs');
  test('TZ30 cookie files retain original row index when earlier record has no cookie',async t=>{
    const f=await fixture(t), svc=f.classification;
    const raw=JSON.stringify([{fullName:'Sample One',accountId:'61500000000101',email:'one@example.test',password:'FAKE_PASS1'},
      {fullName:'Sample Two',accountId:'61500000000102',email:'two@example.test',password:'FAKE_PASS2',cookies:JSON.stringify([{domain:'.facebook.com',name:'c_user',value:'61500000000102'},{domain:'.facebook.com',name:'xs',value:'FAKE_COOKIE_VALUE'}])}]);
    const x=await svc.read({bytes:Buffer.from(raw),originalName:'synthetic.json',requestId:'tz30-cookie-row'});
    svc.confirmClassification(x.operationId,x.status==='preview_complete'?'accept_complete':'accept_partial');
    const archive=createArchiveService(f);
    const saved=await archive.saveArchive(x.operationId,{includeCookies:true});
    const opened=await archive.openArchive(saved.archiveId);
    assert.equal(opened.records.length,2);
    assert.equal(opened.records[0].cookieFile,null);
    assert.match(opened.records[1].cookieFile,/cookie-0002\.txt$/);
    assert.match(await archive.readCookie(saved.archiveId,1),/FAKE_COOKIE_VALUE/);
    await assert.rejects(archive.readCookie(saved.archiveId,0),/ARCHIVE_COOKIES_UNAVAILABLE/);
    assert.equal((await archive.readColumn(saved.archiveId,'cookies')).split('\n').length,1);
  });
  test('TZ30 archive hides unresolved technical panel and uses inline cookie card',async()=>{
    const {state}=await import('../../src/js/state.js');
    const {historyHTML}=await import('../../src/js/ui/history.js');
    const prior=state.archiveView;
    try{
      state.archiveView={entry:{archiveId:'synthetic',originalName:'synthetic.txt',processedAt:'2026-11-19T12:00:00Z',counts:{total:2}},
        records:[{accountId:'61500000000101',fullName:'Sample One',cookieFile:null},{accountId:'61500000000102',fullName:'Sample Two',cookieFile:'cookie-files/cookie-0002.txt'}],
        cookieFiles:['cookie-files/cookie-0002.txt'],unresolvedText:'{"code":"REQUIRES_REVIEW"}'};
      const html=historyHTML();
      assert.doesNotMatch(html,/Unresolved records|Copy unresolved text|Save Cookie 1|Cookie files <span>/);
      assert.match(html,/data-action="archive-cookie-copy"/);
      assert.match(html,/data-action="archive-copy-column"/);
      assert.match(html,/data-field="cookies"/);
    }finally{state.archiveView=prior;}
  });
})();
