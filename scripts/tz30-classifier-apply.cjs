(function applyTZ30Classifier(){
  'use strict';
  const fs=require('node:fs');
  const file='shared/classifier.mjs';
  const s=fs.readFileSync(file,'utf8');
  const marker=String.raw`(\d{1,2})([./])(\d{1,2})\5(\d{4})`;
  if(!s.includes(marker))throw Error('TZ30 date validator anchor missing');
  const next=s.replace(marker,String.raw`(\d{1,2})([./-])(\d{1,2})\5(\d{4})`);
  fs.writeFileSync(file,next);
  console.log('TZ30 classifier: DD-MM-YYYY supported with leap-year validation');
})();
