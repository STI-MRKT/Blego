const assert=require('node:assert/strict');
(async()=>{
 const {parseFile}=await import('../src/js/services/importer.js');
 const cases=[
 ['A11 late JSON field',()=>{const rows=Array.from({length:51},()=>({project:'test'}));rows[50].late='retained';assert.equal(parseFile(JSON.stringify(rows),'json').rows[50].data.late,'retained');}],
 ['A12 extra CSV cell',()=>{assert.match(JSON.stringify(parseFile('project,owner\nx,y,extra','csv')),/extra/);}],
 ['A13 unclosed quote',()=>{assert.ok(parseFile('project,owner\nx,"open','csv').error);}]
 ];
 let failures=0; for(const [name,run] of cases){try{run();console.log(`PASS ${name}`);}catch{failures++;console.log(`FAIL ${name}`);}}
 process.exitCode=failures?1:0;
})();
