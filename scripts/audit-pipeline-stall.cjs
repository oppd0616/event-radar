// Read-only runtime, scheduler and freshness inspection. Never print credentials.
const {spawn} = require('child_process')
const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
function run(args) {
 return new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1',...args,'--json'])
  let stdout='',stderr=''
  p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x)
  const timeout=setTimeout(()=>{p.kill();reject(Error('CLI timeout'))},45000)
  p.on('error',reject)
  p.on('close',code=>{
   clearTimeout(timeout)
   if(code) return reject(Error((stderr||stdout).slice(0,400)))
   try { const parsed=JSON.parse(stdout.slice(stdout.indexOf('{'))); resolve(parsed) }
   catch(e){ reject(e) }
  })
 })
}
function decode(x){if(Array.isArray(x))return x.map(decode);if(x&&typeof x==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in x)return Number(x[k]);return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]))}return x}
function query(table,projection,sort,limit=8,filter={}) {
 return run(['db','nosql','execute','--command',JSON.stringify([{TableName:table,CommandType:'QUERY',Command:JSON.stringify({find:table,filter,projection,sort,limit})}])]).then(r=>decode(r.data.results[0]))
}
const redact=s=>String(s).replace(/(?:sk-|AKID)[A-Za-z0-9_-]+/g,'[redacted]')
;(async()=>{
 const tasks=[
  ['function',()=>run(['fn','detail','fetchEvents']).then(r=>{
   const d=r.data; const vars=d.Environment && d.Environment.Variables || []
   const flags=['DISCOVERY_V1_ENABLED','WSA_MONTHLY_CALL_LIMIT','WSA_INVOCATION_CALL_LIMIT','TOKENHUB_SUPPLEMENT_ENABLED']
   return {Status:d.Status,StatusDesc:d.StatusDesc,Timeout:d.Timeout,ModTime:d.ModTime,Triggers:d.Triggers,
    configuredFlags:vars.filter(v=>flags.includes(v.Key)).map(v=>({key:v.Key,value:v.Value})),
    credentialPresence:vars.filter(v=>/API_KEY|SECRET_ID|SECRET_KEY|SECRETID|SECRETKEY/.test(v.Key)).map(v=>({key:v.Key,configured:!!v.Value}))}
  })],
  ['latestDiscovery',()=>query('discoveryTargets',{name:1,domain:1,lastSearchedAt:1,updatedAt:1,nextSearchAt:1,lastSearchError:1,status:1},{lastSearchedAt:-1})],
  ['latestCandidates',()=>query('eventCandidates',{title:1,kind:1,status:1,updatedAt:1,createdAt:1,lastError:1,lastReason:1,retryCount:1,nextCheckAt:1},{updatedAt:-1},12)],
  ['processedSamples',()=>query('eventCandidates',{title:1,domain:1,kind:1,status:1,updatedAt:1,lastReason:1,lastErrorCode:1,retryCount:1,missingDetails:1,verificationProvider:1,verificationCachedAt:1,verificationPipelineVersion:1,verificationSources:1,verificationRawItems:1},{updatedAt:-1},20,{retryCount:{$gt:0},updatedAt:{$gte:Date.now()-7*86400000}}).then(rows=>rows.map(row=>{
   const items=row.verificationRawItems||[]
   return {...row,verificationRawItems:undefined,evidenceCount:items.length,evidenceSamples:items.slice(0,2).map(item=>({title:item.title,url:item.link,chars:String(item.description||'').length,dateTokens:(String(item.description||'').match(/20\d{2}|\d{1,2}月\d{1,2}/g)||[]).slice(0,6)}))}
  }))],
  ['budgetHealth',()=>run(['fn','invoke','fetchEvents','-d',JSON.stringify({mode:'wsa-budget-health'})]).then(r=>JSON.parse(r.data.RetMsg))],
  ['recentLogs',()=>run(['fn','log','fetchEvents','--limit','100','--startTime','2026-10-06 12:00:00','--endTime','2026-10-07 12:00:00']).then(r=>{
    const d=r.data;return {keys:Object.keys(d||{}),logs:redact(JSON.stringify(d)).slice(0,18000)}
  })]
 ]
 await Promise.all(tasks.map(async([name,f])=>{try{console.log(JSON.stringify({name,result:await f()}))}catch(e){console.log(JSON.stringify({name,error:redact(e.message)}))}}))
})()
