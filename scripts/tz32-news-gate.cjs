'use strict';
// Release gate: never pass a news build with five empty topic feeds.
const fs=require('node:fs');
const path=process.argv[2] || 'release/news-live-tz32.json';
const report=JSON.parse(fs.readFileSync(path,'utf8'));
const topics=['fashion','ai','crypto','finance','tech'];
const now=Date.parse(report.at);
const earliest=now-10*86400000, latest=now+3600000;
const summary=[],errors=[];
for(const id of topics) {
  const topic=report.topics.find(t=>t.topic===id);
  if(!topic || topic.successful<1 || topic.unique<1) {
    errors.push('EMPTY_NEWS_TOPIC:'+id);
    continue;
  }
  const items=topic.displayedLinks || [];
  for(const item of items) {
    if (!Number.isFinite(item.publishedAt) ||
        item.publishedAt<earliest || item.publishedAt>latest)
      errors.push('NEWS_OUTSIDE_TEN_DAY_WINDOW:'+id);
  }
  summary.push({topic:id,sources:topic.successful,unique:topic.unique,displayed:items.length});
}
console.log('TZ32_NEWS_GATE',JSON.stringify({at:report.at,summary,errors}));
if(errors.length) process.exit(1);
