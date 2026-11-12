const https=require('node:https');const net=require('node:net');
const {HttpsProxyAgent}=require('https-proxy-agent');const {SocksProxyAgent}=require('socks-proxy-agent');
function parseProxy(raw){
 if(typeof raw!=='string'||raw.length>2048)throw Error('INVALID_PROXY');const s=raw.trim();if(!s)return null;
 let u;try{u=new URL(s.includes('://')?s:`http://${s}`);decodeURIComponent(u.username);decodeURIComponent(u.password);}catch{throw Error('INVALID_PROXY');}
 if(!['http:','https:','socks5:'].includes(u.protocol)||!u.hostname||u.pathname!=='/'&&u.pathname!==''||u.search||u.hash||Number(u.port)<0||Number(u.port)>65535||u.port==='0')throw Error('INVALID_PROXY');
 return u;
}
function ipLookup(proxy,{target='https://api64.ipify.org?format=json',signal,ca}={}){
 const u=new URL(target);if(u.protocol!=='https:')throw Error('HTTPS_REQUIRED');
 let agent;if(proxy){if(proxy.protocol==='socks5:'){const remote=new URL(proxy.href);remote.protocol='socks5h:';agent=new SocksProxyAgent(remote);}else agent=new HttpsProxyAgent(proxy,{ca});}
 return new Promise((resolve,reject)=>{
  const start=performance.now();let connected=null;const req=https.get(u,{agent,ca,signal,headers:{accept:'application/json','user-agent':'BLEGO/1.1'}},res=>{
   if(res.statusCode<200||res.statusCode>=300){res.resume();reject(Error(res.statusCode===429?'RATE_LIMITED':'HTTP_ERROR'));return;}
   let bytes=0;const chunks=[];res.on('data',b=>{bytes+=b.length;if(bytes>65536){req.destroy(Error('RESPONSE_TOO_LARGE'));return;}chunks.push(b);});res.on('error',()=>reject(Error('TRANSPORT_FAILED')));res.on('end',()=>{try{const data=JSON.parse(Buffer.concat(chunks));if(!net.isIP(data.ip))throw Error();resolve({ip:data.ip,timings:{connectionMs:connected,ipRequestMs:performance.now()-start}});}catch{reject(Error('INVALID_RESPONSE'));}});
  });
  req.on('socket',socket=>{if(!socket.connecting)connected=performance.now()-start;else socket.once('secureConnect',()=>{connected=performance.now()-start;});});
  req.on('error',()=>reject(Error(signal?.aborted?'CANCELLED':'TRANSPORT_FAILED')));req.on('close',()=>agent?.destroy());
 });
}
module.exports={parseProxy,ipLookup};
