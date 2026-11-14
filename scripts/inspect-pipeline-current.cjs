// Read-only inspection; never output function credentials or raw provider logs.
const fs=require('fs'),{execFile}=require('child_process')
const cli=require('./dashboard-cloudbase-cli.cjs').resolveCli()
function call(args){return new Promise((resolve,reject)=>execFile(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1',...args,'--json'],{timeout:60000,maxBuffer:16000000,windowsHide:true},(error,out)=>{if(error)return reject(Error('CLI request failed'));try{resolve(JSON.parse(out.slice(out.indexOf('{'))))}catch(e){reject(e)}}))}
function decode(v){if(Array.isArray(v))return v.map(decode);if(v&&typeof v==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in v)return Number(v[k]);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]))}return v}
async function query(table,filter,projection,sort,limit=12){const command={find:table,filter,projection,sort,limit};return decode((await call(['db','nosql','execute','--command',JSON.stringify([{TableName:table,CommandType:'QUERY',Command:JSON.stringify(command)}])])).data.results[0])}
const now=Date.now(),report={at:new Date(now).toISOString()}
const jobs=[
 ['events',()=>query('events',{}, {_id:1,title:1,status:1,createdAt:1,updatedAt:1,mergedInto:1},{updatedAt:-1},8)],
 ['candidates',()=>query('eventCandidates',{}, {_id:1,title:1,kind:1,status:1,updatedAt:1,createdAt:1,nextCheckAt:1,lastReason:1,lastErrorCode:1,retryCount:1},{updatedAt:-1},15)],
 ['targets',()=>query('discoveryTargets',{}, {name:1,status:1,lastSearchedAt:1,nextSearchAt:1,updatedAt:1,lastSearchError:1},{lastSearchedAt:-1},6)],
 ['function',async()=>{const d=(await call(['fn','detail','fetchEvents'])).data;return {status:d.Status,timeout:d.Timeout,modified:d.ModTime,triggers:d.Triggers,flags:(d.Environment?.Variables||[]).filter(v=>['DISCOVERY_V1_ENABLED','WSA_MONTHLY_CALL_LIMIT','WSA_INVOCATION_CALL_LIMIT','TOKENHUB_SUPPLEMENT_ENABLED'].includes(v.Key)).map(v=>({key:v.Key,value:v.Value}))}}],
 ['logs',async()=>{const start=new Date(now-48*3600000).toISOString().slice(0,19).replace('T',' '),end=new Date(now).toISOString().slice(0,19).replace('T',' ');const d=(await call(['fn','log','fetchEvents','--limit','30','--startTime',start,'--endTime',end])).data;fs.writeFileSync('output/pipeline-current-logs.json',JSON.stringify(d,null,2));return {keys:Object.keys(d||{}),preview:JSON.stringify(d).replace(/(?:sk-|AKID)[A-Za-z0-9_-]+/g,'[redacted]').slice(0,16000)}}]
]
Promise.all(jobs.map(async([name,fn])=>{try{report[name]=await fn();console.log(JSON.stringify({name,result:report[name]}))}catch(e){report[name]={error:e.message};console.log(JSON.stringify({name,error:e.message}))}})).then(()=>fs.writeFileSync('output/pipeline-current.json',JSON.stringify(report,null,2)))
