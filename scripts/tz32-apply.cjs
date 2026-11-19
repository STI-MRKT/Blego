(function applyTZ32(){
  'use strict';
  const fs=require('node:fs');
  function edit(path,fn){const before=fs.readFileSync(path,'utf8'),after=fn(before);if(before===after)throw Error('TZ32 no changes: '+path);fs.writeFileSync(path,after);console.log('TZ32 patched',path);}
  function replace(s,a,b,label){if(!s.includes(a))throw Error('TZ32 anchor missing: '+label);return s.replace(a,b);}
  edit('electron/features/news/feeds.cjs',s=>{
    s=replace(s,
      "const { isPublicAddress, resolvePublic } = require('../../local/network-safety.cjs');",
      "const { isPublicAddress, resolvePublic } = require('../../local/network-safety.cjs');\nconst { withAbort } = require('../../local/async.cjs');",
      'shared async import');
    s=replace(s,
      "  const address = await require('../facebook/transport.cjs').withAbort(\n    resolvePublic(host, options.signal),\n    options.signal\n  );",
      "  const address = await withAbort(resolvePublic(host, options.signal), options.signal);",
      'remove deleted Facebook transport dependency');
    return s;
  });
  edit('shared/importer.mjs',s=>{
    const lines=s.split('\n');
    const startIndex=lines.findIndex((line)=>line.includes('const start =') && line.includes('Номер заказа'));
    if(startIndex<0)throw Error('TZ32 order start anchor missing');
    const statementEnd=lines.findIndex((line,index)=>index>startIndex && index<startIndex+6 && line.trim()===');');
    if(statementEnd<0)throw Error('TZ32 order start statement end missing');
    lines.splice(startIndex,statementEnd-startIndex+1,
      "  const russianStart = /^(?:[ \\t\\r\\n]|\\uFEFF)*Номер заказа[ \\t]*:[ \\t]*\\d{1,12}[ \\t]*$/im.exec(text.slice(0, 500));",
      "  const englishStart = /^(?:[ \\t\\r\\n]|\\uFEFF)*Order number[ \\t]*:[ \\t]*#?\\d{1,12}[ \\t]*$/im.exec(text.slice(0, 500));",
      "  const productTitle = /^Product title:[ \\t]*Facebook[ \\t]*-[ \\t]*United Kingdom.*Page.*Phone removed.*Email.*2FA.*Cookies/im.test(text.slice(0, 1200));",
      "  const quantity = /^(?:Product quantity|Количество товара)[ \\t]*:[ \\t]*(\\d{1,4})/im.exec(text.slice(0, 1200));",
      "  const start = russianStart || (englishStart && productTitle && quantity ? englishStart : null);")
    const markerIndex=lines.findIndex((line)=>line.includes('const marker =') && line.includes('Ваш заказ'));
    if(markerIndex<0)throw Error('TZ32 order marker anchor missing');
    lines[markerIndex]="  const marker = /^[ \\t]*(?:(?:={2,}[ \\t]*)?Your product(?:[ \\t]*={2,})?|Ваш заказ[ \\t]*:)[ \\t]*\\r?$/gim;";
    lines.splice(markerIndex+1,0,"  marker.lastIndex = start.index + start[0].length;");
    const returnIndex=lines.findIndex((line)=>line.trim()==='return { text: masked, receipt: true };');
    if(returnIndex<0)throw Error('TZ32 receipt return anchor missing');
    lines[returnIndex]="  return { text: masked, receipt: true, layout: englishStart && productTitle ? 'facebook-uk-page-email-2fa-cookies' : null, expectedRecords: englishStart && quantity ? Number(quantity[1]) : null };";
    s=lines.join('\n');
    const marker = "    ({ records, columns, delimiter, headerless, structured } = result);";
    const layout = [
      marker,
      "    if (receipt.layout === 'facebook-uk-page-email-2fa-cookies' && receipt.expectedRecords === result.records.length && result.records.length > 0 && result.records.every((record) => record.sourceEntries?.length === 11)) {",
      "      const headers = ['', 'Login', 'Email', 'Password', '2FA', 'Full Name', 'Date of Birth', 'Profile URL', '', 'User-Agent', 'Cookies'];",
      "      for (const record of result.records) {",
      "        for (const [index, entry] of record.sourceEntries.entries()) {",
      "          entry.header = headers[index];",
      "          entry.labelled = true;",
      "          if (index === 0 || index === 8 || String(entry.value ?? '').trim() === '-') entry.value = '';",
      "        }",
      "      }",
      "      headerless = false;",
      "    }"
    ].join('\n');
    if(!s.includes(marker))throw Error('TZ32 receipt column map anchor missing');
    s=s.replace(marker,layout);
    return s;
  });
  edit('electron/features/news/service.cjs',s=>{
    s=replace(s,
      "const { NEWS_SOURCES, newsTopic } = require('../../../shared/news-catalog.mjs');",
      "const { NEWS_SOURCES, newsTopic } = require('../../../shared/news-catalog.mjs');\nconst NEWS_HISTORY_DAYS = 10;\nconst NEWS_HISTORY_MS = NEWS_HISTORY_DAYS * 24 * 60 * 60 * 1000;\nconst inHistory = (item, now) => Number.isFinite(item?.publishedAt) && item.publishedAt >= now - NEWS_HISTORY_MS && item.publishedAt <= now + 60 * 60 * 1000;",
      'ten day history constants');
    s=replace(s,
      "  onUpdate = () => {}\n}) {",
      "  onUpdate = () => {},\n  seed = null\n}) {",
      'seed option');
    s=replace(s,
      "          received: c.received || 0,\n          httpStatus: c.httpStatus || null",
      "          received: c.received || 0,\n          accepted: c.accepted || 0,\n          httpStatus: c.httpStatus || null,\n          errorName: c.errorName || null,\n          errorCode: c.errorCode || null",
      'safe diagnostics');
    s=replace(s,
      "    const seen = new Set();\n    const items = cached\n      .flatMap(([, c]) => c.items.map((i) => ({ ...i, stale: !!c.stale })))\n      .filter((i) => {",
      "    const seen = new Set();\n    const now = +clock();\n    const items = cached\n      .flatMap(([, c]) => c.items.map((i) => ({ ...i, stale: !!c.stale })))\n      .filter((i) => inHistory(i, now))\n      .filter((i) => {",
      'prune cached articles outside ten days');
    const oldFilter=[
      "              const parsed = parseFeed(xml, source);",
      "              const items = parsed.filter(",
      "                (i) =>",
      "                  !i.publishedAt ||",
      "                  (i.publishedAt <= +clock() + 3600000 && i.publishedAt >= +clock() - 30 * 86400000)",
      "              );",
      "              if (!items.length) throw Error('EMPTY_FEED');",
      "              current = {",
      "                sourceUrl: source.url,",
      "                items,",
      "                received: parseFeed(xml, source, { relevance: false }).length,"
    ].join('\n');
    const newFilter=[
      "              const parsed = parseFeed(xml, source);",
      "              const received = parseFeed(xml, source, { relevance: false }).length;",
      "              const now = +clock();",
      "              const items = parsed.filter((item) => inHistory(item, now));",
      "              if (!items.length) throw Object.assign(Error('EMPTY_FEED'), { received });",
      "              current = {",
      "                sourceUrl: source.url,",
      "                items,",
      "                received,",
      "                accepted: items.length,"
    ].join('\n');
    s=replace(s,oldFilter,newFilter,'ten day feed acceptance');
    s=replace(s,
      "                code: /^[A-Z_]+$/.test(e.message) ? e.message : 'FETCH_FAILED',\n                httpStatus: Number.isInteger(e.httpStatus) ? e.httpStatus : null",
      "                code: /^[A-Z_]+$/.test(e.message) ? e.message : 'FETCH_FAILED',\n                httpStatus: Number.isInteger(e.httpStatus) ? e.httpStatus : null,\n                received: Number.isSafeInteger(e.received) ? e.received : previous.received || 0,\n                accepted: previous.accepted || 0,\n                errorName: typeof e.name === 'string' ? e.name.slice(0, 40) : 'Error',\n                errorCode: typeof e.code === 'string' ? e.code.slice(0, 40) : null",
      'diagnostic source error fields');
    const insertAt="  function cancel() {";
    const seedFn=[
      "  function seedCache(value) {",
      "    if (!value || value.windowDays !== NEWS_HISTORY_DAYS || !Array.isArray(value.items)) return;",
      "    const now = +clock();",
      "    const generatedAt = Number.isFinite(Date.parse(value.generatedAt)) ? new Date(value.generatedAt).toISOString() : clock().toISOString();",
      "    for (const source of catalog) {",
      "      const row = store.db.prepare('SELECT snapshot FROM news WHERE source_id=?').get(source.id);",
      "      const previous = row ? JSON.parse(row.snapshot) : null;",
      "      const cached = Array.isArray(previous?.items) ? previous.items.filter((item) => inHistory(item, now)) : [];",
      "      if (previous?.sourceUrl === source.url && cached.length) continue;",
      "      const items = value.items.filter((item) => item.sourceId === source.id && inHistory(item, now) && normalizeLink(item.link)).map((item) => ({ ...item, source: source.name, topic: source.topic, stale: false }));",
      "      if (!items.length) continue;",
      "      const seeded = { sourceUrl: source.url, items, received: items.length, accepted: items.length, status: 'ok', stale: false, lastAttemptAt: generatedAt, lastSuccessfulAt: generatedAt, seeded: true };",
      "      store.db.prepare('INSERT INTO news VALUES(?,?) ON CONFLICT(source_id) DO UPDATE SET snapshot=excluded.snapshot').run(source.id, JSON.stringify(seeded));",
      "    }",
      "  }"
    ].join('\n');
    s=replace(s,insertAt,seedFn+'\n'+insertAt,'seed cache function');
    s=replace(s,
      "  function cancel() {",
      "  seedCache(seed);\n  function cancel() {",
      'prime offline news seed on startup');
    return s;
  });
  edit('src/js/ui/news.js',s=>{
    s=replace(s,
      "const items = n.items.filter(i => i.topic === n.topic).slice(0, 15);",
      "const items = n.items.filter(i => i.topic === n.topic).slice(0, 40);",
      'show more ten day articles');
    s=replace(s,
      "'Headlines from international publications'",
      "'Stories from the last 10 days'",
      'ten day news label');
    return s;
  });
  edit('electron/main.cjs',s=>{
    const old=[
      "  news = createNewsService({",
      "    store,",
      "    onUpdate: (snapshot) => {"
    ].join('\n');
    const next=[
      "  let newsSeed = null;",
      "  try {",
      "    const candidate = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'resources', 'news-seed.json'), 'utf8'));",
      "    if (candidate.windowDays === 10 && Array.isArray(candidate.items)) newsSeed = candidate;",
      "  } catch { /* A missing offline seed is normal in development builds. */ }",
      "  news = createNewsService({",
      "    store,",
      "    seed: newsSeed,",
      "    onUpdate: (snapshot) => {"
    ].join('\n');
    return replace(s,old,next,'load bundled news seed');
  });
  console.log('TZ32 ten-day News and receipt parser fixes applied');
})();
