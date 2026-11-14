// Read-only query of production events. Compare user-facing facts with a saved snapshot.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process')
const cli=require('./dashboard-cloudbase-cli.cjs').resolveCli()
const now=Date.now(),since=now-10*86400000
const baseline=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../docs/recommendation-ranking-fixture-20260930.json'),'utf8').replace(/^\uFEFF/,''))
function decode(v){
  if(Array.isArray(v))return v.map(decode)
  if(v && typeof v==='object'){
    for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in v)return Number(v[k])
    return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]))
  }return v
}
const fields=['_id','title','summary','domain','city','createdAt','updatedAt','startTime','endTime','timePrecision','endTimePrecision','participation','participationGuide','participationOptions','stages','highlights','tags','status','canonicalEventId','mergedInto','identityMembers','detailVerificationOutcome']
const rows=[]
for(let skip=0;skip<5000;skip+=100){
  const query={find:'events',filter:{updatedAt:{$gte:since}},projection:Object.fromEntries(fields.map(k=>[k,1])),sort:{_id:1},skip,limit:100}
  const run=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','db','nosql','execute','--command',JSON.stringify([{TableName:'events',CommandType:'QUERY',Command:JSON.stringify(query)}]),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:12*1024*1024})
  if(run.status!==0)throw Error((run.stderr||run.stdout||String(run.error)).slice(0,1000))
  const envelope=JSON.parse(run.stdout.slice(run.stdout.indexOf('{'))),page=decode(envelope.data.results[0])
  if(!Array.isArray(page))throw Error('Unexpected response')
  rows.push(...page);if(page.length<100)break;if(skip===4900)throw Error('Safety limit')
}
const time=v=>v?new Date(Number(v)+28800000).toISOString().slice(0,19).replace('T',' '):''
function normalized(value){
  if(Array.isArray(value))return value.map(normalized)
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>!['fetchedAt','updatedAt','createdAt','evidenceIndex','sourceIndex','sourceUrl','sourceLabel','evidence','confidence','verifiedAt','verificationVersion'].includes(k)).map(k=>[k,normalized(value[k])]))
  return value==null?'':value
}
const oldById=new Map(baseline.events.map(e=>[e._id,e]))
const groups=[['时间',['startTime','endTime','timePrecision','endTimePrecision']],['地点',['city']],['参与方式',['participation','participationGuide','participationOptions']],['赛程阶段',['stages']],['标题/介绍',['title','summary','highlights','tags']]]
const compared=rows.filter(e=>e.status==='published' && oldById.has(e._id)).map(e=>{
  const old=oldById.get(e._id),changes=[]
  for(const [label,keys] of groups){
    const modified=keys.filter(k=>JSON.stringify(normalized(old[k]))!==JSON.stringify(normalized(e[k])))
    if(modified.length)changes.push({category:label,fields:modified.map(field=>({field,before:old[field],after:e[field]}))})
  }
  return {id:e._id,title:e.title,domain:e.domain,city:e.city,lastWrittenAt:time(e.updatedAt),changes}
}).sort((a,b)=>b.lastWrittenAt.localeCompare(a.lastWrittenAt))
const report={readOnly:true,since:time(since),until:time(now),baselineAt:time(baseline.now),timezone:'Asia/Shanghai',recordsWritten:rows.length,publishedWritten:rows.filter(e=>e.status==='published').length,confirmedChanged:compared.filter(e=>e.changes.length),unchangedAgainstBaseline:compared.filter(e=>!e.changes.length).map(e=>({id:e.id,title:e.title,lastWrittenAt:e.lastWrittenAt})),notInBaseline:rows.filter(e=>e.status==='published'&&!oldById.has(e._id)).map(e=>({id:e._id,title:e.title,createdAt:time(e.createdAt),updatedAt:time(e.updatedAt)})),records:rows}
const file=path.resolve(__dirname,'../docs/event-updates-'+now+'.json');fs.writeFileSync(file,JSON.stringify(report,null,2))
console.log(JSON.stringify({...report,file,records:undefined,confirmedChanged:report.confirmedChanged.map(e=>({...e,changes:e.changes.map(c=>({category:c.category,fields:c.fields.map(f=>f.field)}))}))}))
