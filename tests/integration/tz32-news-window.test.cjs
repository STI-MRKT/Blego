const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openStore } = require('../../electron/local/store.cjs');
const { updateSettings } = require('../../electron/local/settings.cjs');
const { createNewsService } = require('../../electron/features/news/service.cjs');

const xml = `<rss><channel>
<item><guid>recent</guid><title>Technology update</title><link>https://example.test/recent</link><pubDate>Wed, 18 Nov 2026 12:00:00 GMT</pubDate></item>
<item><guid>old</guid><title>Technology archive</title><link>https://example.test/old</link><pubDate>Sun, 08 Nov 2026 12:00:00 GMT</pubDate></item>
<item><guid>undated</guid><title>Technology undated item</title><link>https://example.test/undated</link></item>
</channel></rss>`;
const source = {id:'fixture-tech',name:'Fixture Tech',topic:'tech',url:'https://example.test/feed'};
const fixed = new Date('2026-11-19T12:00:00Z');

test('TZ32 only caches dated stories from the last ten days and records received versus accepted counts', async (t) => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'blego-tz32-window-'));
  const store=await openStore(root);
  updateSettings(store,{newsEnabled:true,newsTopic:'tech'});
  const service=createNewsService({store,catalog:[source],clock:()=>new Date(fixed),minRefreshMs:0,fetcher:async()=>xml});
  t.after(()=>{service.close();store.close();fs.rmSync(root,{recursive:true,force:true});});
  const snapshot=await service.refreshNews({topic:'tech',force:true});
  assert.equal(snapshot.items.length,1);
  assert.equal(snapshot.items[0].id,'fixture-tech:recent');
  assert.equal(snapshot.sourceStates[source.id].received,3);
  assert.equal(snapshot.sourceStates[source.id].accepted,1);
});

test('TZ32 bundled seed hydrates an empty store but never overwrites a fresh cache', async (t) => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'blego-tz32-seed-'));
  const store=await openStore(root);
  updateSettings(store,{newsEnabled:true,newsTopic:'tech'});
  let calls=0;
  const recent={id:'fixture-tech:recent',title:'Technology update',link:'https://example.test/recent',sourceId:source.id,source:source.name,topic:'tech',publishedAt:Date.parse('2026-11-18T12:00:00Z'),description:'Technology'};
  const seed={version:1,generatedAt:'2026-11-19T12:00:00.000Z',windowDays:10,items:[recent,{...recent,id:'old',link:'https://example.test/old',publishedAt:Date.parse('2026-11-08T12:00:00Z')}]};
  const service=createNewsService({store,catalog:[source],clock:()=>new Date(fixed),seed,fetcher:async()=>{calls++;return xml;}});
  t.after(()=>{service.close();store.close();fs.rmSync(root,{recursive:true,force:true});});
  assert.equal(service.snapshot('tech').items.length,1);
  assert.equal(service.snapshot('tech').items[0].id,'fixture-tech:recent');
  assert.equal(calls,0);
  await service.refreshNews({topic:'tech'});
  assert.equal(calls,0,'fresh bundled seed observes the normal refresh interval');
});
