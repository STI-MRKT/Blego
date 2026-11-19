const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseInput } = require('../../shared/importer.mjs');

test('TZ32 English order receipt with Your product marker preserves six tabular records and nested JSON cells', async () => {
  const rows = Array.from({length:6},(_,i)=>[
    '-', 'value-'+i, 'contact'+i+'@example.test', 'opaque-'+i,
    'https://example.test/verify/'+i, 'Example Person '+i,
    i===2?'-':'1988-05-'+String(i+1).padStart(2,'0'),
    'https://example.test/profile/'+(i+1), '-',
    'Mozilla/5.0 (Synthetic; Test)', JSON.stringify([
      {name:'attribute',value:'sample-'+i,flags:{secure:true}},
      {name:'dimension',value:'desktop'}
    ])
  ].join('\t'));
  const source=[
    'Product title: Facebook - United Kingdom. 2021-23 - Page - Phone removed - Email - 2FA - Cookies',
    'Order number: #37798',
    'Product quantity: 6 pcs.',
    'Purchase date and time: 29.09.2026, 14:41',
    '',
    'Review text and useful links: https://example.test/blog',
    '',
    '=== Your product ===',
    ...rows
  ].join('\n');
  const parsed=await parseInput({bytes:Buffer.from(source,'utf8'),originalName:'synthetic-order.txt'},{classification:true});
  assert.equal(parsed.records.length,6);
  assert.equal(parsed.headerless,true);
  assert.ok(parsed.records.every((record)=>record.sourceEntries.length===11));
  assert.ok(parsed.records.every((record)=>!/Order number|Product quantity|Review text|Your product/.test(record.sourceRecord)));
  assert.equal(parsed.records[2].sourceEntries[6].value,'-');
  assert.match(String(parsed.records[5].sourceEntries[10].value),/sample-5/);
});
