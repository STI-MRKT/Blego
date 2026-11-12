const http=require('node:http'),https=require('node:https'),net=require('node:net'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {execFileSync}=require('node:child_process');
async function fixtures(t,{auth=false,status=200,body='{"ip":"203.0.113.1"}'}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blego-tls-'));const keyFile=path.join(root,'key'),certFile=path.join(root,'cert');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyFile,'-out',certFile,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
 const key=fs.readFileSync(keyFile),cert=fs.readFileSync(certFile);const servers=[],sockets=new Set();
 async function listen(s){servers.push(s);s.on('connection',sock=>{sockets.add(sock);sock.on('close',()=>sockets.delete(sock));sock.on('error',()=>{});});await new Promise(r=>s.listen(0,'127.0.0.1',r));return s.address().port;}
 t.after(async()=>{for(const s of sockets)s.destroy();await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));fs.rmSync(root,{recursive:true,force:true});});
 const target=await listen(https.createServer({key,cert},(req,res)=>{res.writeHead(status);res.end(body);}));
 function tunnel(server){server.on('connect',(req,client,head)=>{if(auth&&req.headers['proxy-authorization']!=='Basic '+Buffer.from('user:pass').toString('base64')){client.end('HTTP/1.1 407 Proxy Authentication Required\r\n\r\n');return;}const upstream=net.connect(target,'127.0.0.1',()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream).pipe(client);});sockets.add(upstream);upstream.on('error',()=>client.destroy());});return server;}
 const hp=await listen(tunnel(http.createServer()));const sp=await listen(tunnel(https.createServer({key,cert})));
 let remoteDns=false;
 const socks=await listen(net.createServer(client=>{let stage='hello',buffer=Buffer.alloc(0);client.on('data',function read(chunk){buffer=Buffer.concat([buffer,chunk]);
  if(stage==='hello'){if(buffer.length<2+buffer[1])return;buffer=buffer.subarray(2+buffer[1]);client.write(Buffer.from([5,auth?2:0]));stage=auth?'auth':'connect';}
  if(stage==='auth'){if(buffer.length<2)return;const n=buffer[1];if(buffer.length<3+n)return;const m=buffer[2+n];if(buffer.length<3+n+m)return;const ok=buffer.subarray(2,2+n).toString()==='user'&&buffer.subarray(3+n,3+n+m).toString()==='pass';client.write(Buffer.from([1,ok?0:1]));buffer=buffer.subarray(3+n+m);if(!ok){client.end();return;}stage='connect';}
  if(stage==='connect'){if(buffer.length<5)return;const atyp=buffer[3];const size=atyp===3?7+buffer[4]:atyp===1?10:22;if(buffer.length<size)return;remoteDns=atyp===3;client.removeListener('data',read);const upstream=net.connect(target,'127.0.0.1',()=>{client.write(Buffer.from([5,0,0,1,127,0,0,1,0,0]));if(buffer.length>size)upstream.write(buffer.subarray(size));client.pipe(upstream).pipe(client);});sockets.add(upstream);upstream.on('error',()=>client.destroy());}
 });}));
 const credentials=auth?'user:pass@':'';return {target:`https://localhost:${target}/`,ca:cert,proxies:[`http://${credentials}127.0.0.1:${hp}`,`https://${credentials}localhost:${sp}`,`socks5://${credentials}127.0.0.1:${socks}`],remoteDns:()=>remoteDns};
}
module.exports={fixtures};
