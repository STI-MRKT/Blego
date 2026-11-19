(function tz30NewsTests(){
  const {test}=require('node:test');
  const assert=require('node:assert/strict');
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const {openStore}=require('../../electron/local/store.cjs');
  const {updateSettings}=require('../../electron/local/settings.cjs');
  const {createNewsService}=require('../../electron/features/news/service.cjs');
  const {parseFeed}=require('../../electron/features/news/feeds.cjs');
  const {NEWS_SOURCES}=require('../../shared/news-catalog.mjs');
  test('TZ30 crypto article relevant by description when title alone is ambiguous',()=>{
    const source=NEWS_SOURCES.find(s=>s.id==='decrypt');
    const xml='<rss><channel><item><title>Markets adjust to new policy</title><description>Bitcoin miners respond to blockchain regulations</description><link>https://example.org/article/markets</link><pubDate>Thu, 19 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>';
    const items=parseFeed(xml,source);
    assert.equal(items.length,1);
  });
  test('TZ30 failed feed retry after 3 minutes, successful feed retains 30 minute interval',async t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'blego-tz30-news-'));
    const store=await openStore(root);
    const source=NEWS_SOURCES.find(s=>s.id==='coindesk');
    let now=Date.parse('2026-11-19T12:00:00Z'),count=0,mode='fail';
    const clock=()=>new Date(now);
    updateSettings(store,{newsEnabled:true,newsTopic:'crypto',newsInterval:30});
    const service=createNewsService({store,clock,catalog:[source],fetcher:async()=>{
      count++;
      if(mode==='fail'){const e=Error('HTTP_ERROR');e.httpStatus=503;throw e;}
      return '<rss><channel><item><title>Bitcoin update</title><link>https://example.org/bitcoin</link><pubDate>Thu, 19 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>';
    }});
    t.after(()=>{service.close();store.close();fs.rmSync(root,{recursive:true,force:true});});
    let snapshot=await service.refreshNews({topic:'crypto'});
    assert.equal(count,1);
    assert.equal(snapshot.sourceStates[source.id].httpStatus,503);
    now+=2*60*1000;
    await service.refreshNews({topic:'crypto'});
    assert.equal(count,1,'briefly retry-throttled');
    mode='ok';
    now+=60*1000;
    snapshot=await service.refreshNews({topic:'crypto'});
    assert.equal(count,2);
    assert.equal(snapshot.items.length,1);
    assert.equal(snapshot.sourceStates[source.id].status,'ok');
    assert.equal(snapshot.sourceStates[source.id].httpStatus,null);
    now+=5*60*1000;
    await service.refreshNews({topic:'crypto'});
    assert.equal(count,2,'successful feed obeys 30m interval');
  });
})();
