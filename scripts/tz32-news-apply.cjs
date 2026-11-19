(function apply() {
  const fs=require('node:fs');
  function edit(p,fn){const before=fs.readFileSync(p,'utf8');const after=fn(before);if(before===after)throw Error('TZ32 no changes in '+p);fs.writeFileSync(p,after);console.log('TZ32 patched',p)}
  function change(s,a,b,key){if(!s.includes(a))throw Error('TZ32 missing '+key);return s.replace(a,b)}
  edit('electron/features/news/feeds.cjs',s=>{
    return change(s,
      "  const address = await require('../facebook/transport.cjs').withAbort(\n    resolvePublic(host, options.signal),\n    options.signal\n  );",
      "  const address = await resolvePublic(host, options.signal);",
      'orphaned Facebook transport');
  });
  edit('electron/features/news/service.cjs',s=>{
    const label="  const topicOf = (value) => newsTopic(value ?? getSettings(store).newsTopic);";
    s=change(s,label,[
      "  const MAX_NEWS_AGE_MS = 10 * 86400000;",
      "  const isRecent = (item) => {",
      "    // Undated items are kept for custom/test feeds; production news requires a publication date.",
      "    const official = NEWS_SOURCES.some((source) => source.id === item.sourceId);",
      "    if (!Number.isFinite(item.publishedAt)) return !official;",
      "    const time = +clock();",
      "    return item.publishedAt <= time + 3600000 && item.publishedAt >= time - MAX_NEWS_AGE_MS;",
      "  };",
      label].join('\n'),'10 day recent predicate');
    s=change(s, "      .flatMap(([, c]) => c.items.map((i) => ({ ...i, stale: !!c.stale })))", "      .flatMap(([, c]) => c.items.map((i) => ({ ...i, stale: !!c.stale })))\n      .filter(isRecent)",'prune cached old news');
    s=change(s,[
      "              const items = parsed.filter(",
      "                (i) =>",
      "                  !i.publishedAt ||",
      "                  (i.publishedAt <= +clock() + 3600000 && i.publishedAt >= +clock() - 30 * 86400000)",
      "              );"].join('\n'),
      "              const items = parsed.filter(isRecent);",
      "replace 30 days fetch");
    return s;
  });
  edit('src/js/ui/news.js',s=>change(s,
    "const items = n.items.filter(i => i.topic === n.topic).slice(0, 15);",
    "const items = n.items.filter(i => i.topic === n.topic).slice(0, 40);",
    "display up to 40 recent headlines"));
  console.log('TZ32 News source fixed and 10-day window applied');
})();
