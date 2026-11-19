const {test}=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os'), fs=require('node:fs'), path=require('node:path');
const {openStore}=require('../../electron/local/store.cjs');
const {updateSettings}=require('../../electron/local/settings.cjs');
const {createNewsService}=require('../../electron/features/news/service.cjs');
const {NEWS_SOURCES}=require('../../shared/news-catalog.mjs');
test('TZ32 official RSS: dated articles are limited to 10 days, old persisted cache is hidden',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'blego-news-10days-'));
  const store=await openStore(root);
  const source=NEWS_SOURCES.find(s=>s.id==='coindesk');
  const date='2026-11-19T13:00:00.000Z';
  const now=Date.parse(date);
  updateSettings(store,{newsEnabled:true,newsTopic:'crypto'});
  const article=(title,dateValue)=>'<item><title>'+title+'</title><link>https://example.org/'+title+'</link>'+ (dateValue?'<pubDate>'+new Date(dateValue).toUTCString()+'</pubDate>':'') + '</item>';
  const feed='<rss><channel>'+[
    article('Bitcoin-today',now-86400000),
    article('Bitcoin-ten-days',now-10*86400000),
    article('Bitcoin-eleven-days',now-11*86400000),
    article('Bitcoin-future',now+2*3600000),
    article('Bitcoin-undated',null)
  ].join('')+'</channel></rss>';
  const service=createNewsService({store,catalog:[source],clock:()=>new Date(date),fetcher:async()=>feed,minRefreshMs:0});
  t.after(()=>{service.close();store.close();fs.rmSync(root,{recursive:true,force:true});});
  let snapshot=await service.refreshNews({topic:'crypto'});
  assert.deepEqual(snapshot.items.map(x=>x.title),['Bitcoin-today','Bitcoin-ten-days']);
  const prev=store.db.prepare('SELECT snapshot FROM news WHERE source_id=?').get(source.id);
  const data=JSON.parse(prev.snapshot);
  data.items.push({id:'old',sourceId:source.id,topic:'crypto',link:'https://example.org/old',title:'Bitcoin-too-old',publishedAt:now-12*86400000});
  store.db.prepare('UPDATE news SET snapshot=? WHERE source_id=?').run(JSON.stringify(data),source.id);
  snapshot=service.snapshot('crypto');
  assert.deepEqual(snapshot.items.map(x=>x.title),['Bitcoin-today','Bitcoin-ten-days']);
  assert.equal(snapshot.counts.crypto,2);
});
