const {test}=require('node:test'); const assert=require('node:assert/strict');
const {copyText,validateSender,externalUrl}=require('../../electron/local/ipc.cjs');
test('clipboard_failure_is_not_success',()=>{
 assert.equal(copyText('x',{writeText(){throw Error();},readText(){return '';}}).ok,false);
 assert.equal(copyText('x',{writeText(){},readText(){return '';}}).ok,false);
 assert.equal(copyText('Кириллица',{writeText(){},readText(){return 'Кириллица';}}).ok,true);
});
test('untrusted_ipc_is_rejected',()=>{
 const wc={}; const frame={url:'http://127.0.0.1:1/',origin:'http://127.0.0.1:1'};wc.mainFrame=frame;
 assert.equal(validateSender({sender:wc,senderFrame:frame},wc,'http://127.0.0.1:1/'),true);
 assert.equal(validateSender({sender:{},senderFrame:frame},wc,'http://127.0.0.1:1/'),false);
 assert.equal(validateSender({sender:wc,senderFrame:{...frame}},wc,'http://127.0.0.1:1/'),false);
 for(const url of ['javascript:alert(1)','file:///tmp/x','https://user:pass@host/','bad']) assert.equal(externalUrl(url),null);
});
