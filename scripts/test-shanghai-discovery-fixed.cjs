// Read-only replay against frozen WSA evidence, plus an optional fresh search.
const fs=require('fs'),path=require('path'),vm=require('vm'),{spawnSync}=require('child_process')
const root=path.resolve(__dirname,'..'),dir=path.join(root,'output/shanghai-youth-pilot-20261029-retry')
const {database}=require('./verify-event-write-quality')
async function main(){
 const mode=process.argv[2]||'replay',name=process.argv[3]||mode,out=path.join(dir,`fixed-${name}.json`)
 if(fs.existsSync(out))throw Error('Output exists; use another run label to preserve evidence')
 const cli=require('./dashboard-cloudbase-cli.cjs').resolveCli()
 const r=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','fn','detail','fetchEvents','--json'],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024,windowsHide:true})
 if(r.status!==0)throw Error('Cloud environment read failed; output withheld')
 const env={};for(const v of JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))).data.Environment.Variables)if(/^(WSA_|DEEPSEEK_)/.test(v.Key))env[v.Key]=v.Value
 const filename=path.join(root,'cloudfunctions/fetchEvents/index.js'),mod={exports:{}},db=database()
 vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.preview={callDeepSeekDiscovery,callDeepSeek,normalizeEvent}',{module:mod,exports:mod.exports,require:n=>n==='wx-server-sdk'?{init(){},database:()=>db,getWXContext:()=>({})}:n.startsWith('.')?require(path.resolve(path.dirname(filename),n)):require(n),process:{env},console,Buffer,URL,setTimeout,clearTimeout},{filename})
 const report={at:new Date().toISOString(),readOnly:true,temporaryMonthlyLimitOverride:true,searchCalls:0,rounds:[]}
 if(mode==='detail'){
  const replay=JSON.parse(fs.readFileSync(path.join(dir,'fixed-v2.json')))
  for(const term of ['ENHYPEN','逐梦之旅','Vera Wang']){
   const round=replay.rounds.find(r=>r.rows.some(x=>x.title.includes(term))),row=round.rows.find(x=>x.title.includes(term))
   const items=[round.items[row.evidenceIndex]],rejected=[],now=Date.now()
   const raw=await mod.exports.preview.callDeepSeek(items,.1,now,{maxItems:1,maxTokens:2400,focusTitle:row.title,required:true,modeInstructions:'只核验上海这一站。其他城市的日期和场地不得混入。原文只有结束日而缺开始日时，不得猜测开始日，返回空数组。'})
   const validated=(raw||[]).map(x=>mod.exports.preview.normalizeEvent({...x,domain:row.domain},now,items,rejected,{city:'上海',evidenceIdentity:row.title})).filter(Boolean)
   report.rounds.push({title:row.title,items,raw,validated,rejected});fs.writeFileSync(out,JSON.stringify(report,null,2))
   console.log(JSON.stringify({title:row.title,extracted:(raw||[]).length,validated:validated.map(x=>({title:x.title,city:x.city,startTime:x.startTime,endTime:x.endTime})),rejected}))
  }
  return
 }
 let inputs
 if(mode==='fresh'){
  Object.assign(process.env,env)
  const query='上海 2026年10月29日至11月28日 快闪 市集 展览 前滩太古里 兴业太古汇 新天地 活动时间 地点'
  report.searchCalls=1
  const response=await require('../cloudfunctions/fetchEvents/lib/wsa-search').search(query)
  inputs=[{round:'fresh',items:response.items.slice(0,20),query}]
 }else inputs=[1,2,3].map(n=>JSON.parse(fs.readFileSync(path.join(dir,`round-${n}.json`))))
 for(const input of inputs){
  const entry={round:input.round,items:input.items,query:input.query,audit:null,rows:[]}
  try{entry.rows=await mod.exports.preview.callDeepSeekDiscovery(input.items,Date.now(),{publisher:true,city:'上海',onDiscoveryAudit:a=>entry.audit=a})}catch(e){entry.error=e.message}
  report.rounds.push(entry);fs.writeFileSync(out,JSON.stringify(report,null,2))
  console.log(JSON.stringify({round:entry.round,audit:entry.audit,rows:entry.rows,error:entry.error}))
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
