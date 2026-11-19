(function applyTZ32NewsReport(){
  'use strict';
  const fs=require('node:fs');
  const path=require('node:path');
  const file='scripts/check-news-live.cjs';
  let s=fs.readFileSync(file,'utf8');
  function replace(a,b,label){if(!s.includes(a))throw Error('TZ32 live report anchor missing: '+label);s=s.replace(a,b);}
  replace("    at: new Date().toISOString(),\n    os: process.platform,","    at: new Date().toISOString(),\n    generatedAt: new Date().toISOString(),\n    windowDays: 10,\n    os: process.platform,","report window metadata");
  replace("        sources: sources.map((s) => ({ ...s, ...snapshot.sourceStates[s.id] })),\n        displayedLinks: snapshot.items","        sources: sources.map((s) => ({ ...s, ...snapshot.sourceStates[s.id] })),\n        items: snapshot.items,\n        displayedLinks: snapshot.items","store full article metadata for seed");
  const old=[
    "  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\\n');",
    "  console.log("
  ].join('\n');
  const next=[
    "  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\\n');",
    "  const emptyTopics = report.topics.filter((topic) => topic.unique < 1);",
    "  if (!emptyTopics.length) {",
    "    const seedPath = process.argv[3] || 'resources/news-seed.json';",
    "    const seed = { version: 1, generatedAt: report.generatedAt, windowDays: 10, items: report.topics.flatMap((topic) => topic.items) };",
    "    fs.mkdirSync(path.dirname(seedPath), { recursive: true });",
    "    fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\\n');",
    "    console.log('NEWS_SEED_WRITTEN', JSON.stringify({ path: seedPath, items: seed.items.length, windowDays: seed.windowDays }));",
    "  }",
    "  console.log("
  ].join('\n');
  replace(old,next,'write offline seed');
  replace("  console.log(\n    JSON.stringify(","  if (emptyTopics.length) {\n    console.error('NEWS_TOPICS_EMPTY', emptyTopics.map((topic) => topic.topic).join(','));\n    process.exitCode = 1;\n  }\n  console.log(\n    JSON.stringify(","fail live acceptance when a topic is empty");
  fs.writeFileSync(file,s);
  console.log('TZ32 live report now emits a validated ten-day offline seed');
})();
