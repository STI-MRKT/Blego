function validateSender(event,webContents,url){
 return Boolean(webContents && event.sender===webContents && event.senderFrame===webContents.mainFrame && event.senderFrame?.origin===new URL(url).origin && event.senderFrame?.url===url);
}
function externalUrl(raw){try{if(typeof raw!=='string'||raw.length>8192)return null;const u=new URL(raw);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function copyText(text,clipboard){
 if(typeof text!=='string'||text.length>4*1024*1024)return {ok:false,code:'INVALID_TEXT'};
 try{clipboard.writeText(text);if(clipboard.readText()!==text)throw Error();return {ok:true};}catch{return {ok:false,code:'CLIPBOARD_FAILED'};}
}
function registerIpc(ipcMain,getWindow,getUrl,handlers){
 for(const [name,handler] of Object.entries(handlers))ipcMain.handle(`local:${name}`,async(event,arg)=>{
  if(!validateSender(event,getWindow()?.webContents,getUrl()))throw Error('UNTRUSTED_IPC');
  try{return {ok:true,value:await handler(arg)};}catch(e){return {ok:false,code:/^[A-Z][A-Z_]+$/.test(e.code||e.message)?(e.code||e.message):'OPERATION_FAILED'};}
 });
}
module.exports={validateSender,externalUrl,copyText,registerIpc};
