function normalize(field,value){let v=String(value).normalize('NFKC').trim().replace(/\s+/gu,' ');if(field==='phone')v='+'+v.replace(/\D/g,'');if(['email','handle','bio','status','address'].includes(field))v=v.toLocaleLowerCase('en-US');return v;}
function scopeFor(field,p){if(['id','phone','email','handle'].includes(field))return 'installation';return ['bio','status'].includes(field)?`${p.country}:${p.type}`:p.country;}
function registry(store,p){
 const exists=store.db.prepare('SELECT 1 FROM issued WHERE field=? AND scope=? AND value=?');
 const insert=store.db.prepare('INSERT INTO issued VALUES(?,?,?,?)');
 return {used:(f,v)=>!!exists.get(f,scopeFor(f,p),normalize(f,v)),reserve:(f,v,id)=>insert.run(f,scopeFor(f,p),normalize(f,v),id)};
}
module.exports={normalize,scopeFor,registry};
