'use strict';
// Isolate GUI test files so a stale Playwright/Electron process cannot indefinitely
// block all later regressions. Each file receives its own process group and limit.
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const files=fs.readdirSync(path.join(__dirname,'../tests/ui'))
  .filter(name=>name.endsWith('.test.cjs')).sort();
const MAX_MS=120000;
const summary=[];
async function run(file) {
  const args=['--test','--test-concurrency=1',path.join(__dirname,'../tests/ui',file)];
  const child=spawn(process.execPath,args,{detached:true,env:process.env,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',timedOut=false;
  child.stdout.on('data',c=>{stdout+=c.toString('utf8');if(stdout.length>300000)stdout=stdout.slice(-200000);});
  child.stderr.on('data',c=>{stderr+=c.toString('utf8');if(stderr.length>300000)stderr=stderr.slice(-200000);});
  const started=Date.now();
  const timeout=setTimeout(()=>{
    timedOut=true;
    try{process.kill(-child.pid,'SIGKILL');}catch{}
  },MAX_MS);
  const finished=await new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
  clearTimeout(timeout);
  const item={file,status:timedOut?'timeout':finished.code===0?'pass':'fail',durationMs:Date.now()-started,
    errors:[...stdout.split('\n'),...stderr.split('\n')].filter(x=>/✖|not ok|Error:|AssertionError|fail\s+[1-9]|ERR_|Timeout|Timed out/.test(x)).slice(-12).map(x=>x.slice(0,240))};
  if(item.status!=='pass')item.tail=(stdout+'\n'+stderr).slice(-2500);
  console.log('TZ32_GUI_SWEEP',JSON.stringify(item));
  summary.push(item);
}
(async()=>{
  for(const file of files)await run(file);
  fs.mkdirSync('release',{recursive:true});
  fs.writeFileSync('release/tz32-gui-sweep.json',JSON.stringify({at:new Date().toISOString(),files:summary},null,2)+'\n');
  console.log('TZ32_GUI_SWEEP_SUMMARY',JSON.stringify({total:summary.length,passed:summary.filter(x=>x.status==='pass').length,failed:summary.filter(x=>x.status!=='pass').length}));
  if(summary.some(x=>x.status!=='pass'))process.exitCode=1;
})().catch(e=>{console.error('TZ32_GUI_SWEEP_FAILED',String(e));process.exitCode=1;});
