const fs=require('fs'),path=require('path'),{spawn,execFile}=require('child_process');
const {standaloneEnv}=require('../../scripts/event-dashboard-server.cjs');
const url='http://127.0.0.1:4181';
async function ready(){try{const r=await fetch(url+'/api/data',{signal:AbortSignal.timeout(1200)});const data=await r.json();return r.ok&&'recent' in data;}catch{return false;}}
(async()=>{
 if(!await ready()){
  const log=fs.openSync(path.join(__dirname,'service.log'),'a');
  const child=spawn(process.execPath,[path.resolve(__dirname,'../../scripts/event-dashboard-server.cjs')],{cwd:path.resolve(__dirname,'../..'),env:standaloneEnv(),detached:true,windowsHide:true,stdio:['ignore',log,log]});
  child.unref();fs.closeSync(log);
  let available=false;
  for(let attempt=0;attempt<30;attempt++){if(await ready()){available=true;break;}await new Promise(r=>setTimeout(r,350));}
  if(!available)throw Error('看板未能启动。请查看同目录 service.log，或将日志发给我检查。');
 }
 console.log('看板已就绪：'+url);
 if(!process.argv.includes('--no-open'))execFile('powershell.exe',['-NoProfile','-Command',"Start-Process 'http://127.0.0.1:4181'"],{windowsHide:true},e=>{if(e)console.log('请在浏览器中打开：'+url);});
})().catch(e=>{console.error(e.message);process.exitCode=1;});
