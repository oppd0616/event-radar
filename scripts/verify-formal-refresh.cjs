const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process')
const dir=path.resolve(process.argv[2]),state=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'))
const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
function decode(x){if(Array.isArray(x))return x.map(decode);if(x&&typeof x==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in x)return Number(x[k]);return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]))}return x}
const before=decode(JSON.parse(fs.readFileSync(path.join(state.backup,'backup.json'),'utf8')).records)
const ids=state.outcomes.filter(x=>x.updated>0).map(x=>x.id),records=[]
for(let offset=0;offset<ids.length;offset+=50){
 const query={find:'events',filter:{_id:{$in:ids.slice(offset,offset+50)}},limit:100}
 const r=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','db','nosql','execute','--command',JSON.stringify([{TableName:'events',CommandType:'QUERY',Command:JSON.stringify(query)}]),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024})
 if(r.status!==0)throw Error((r.stderr||r.stdout).slice(0,500))
 const result=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));records.push(...decode(result.data.results[0]))
}
const date=x=>x?new Date(Number(x)+28800000).toISOString().slice(0,10):''
const rows=ids.map(id=>{
 const old=before.find(x=>x._id===id),now=records.find(x=>x._id===id),issues=[]
 if(!now)return {id,issues:['updated_document_missing']}
 if(old.createdAt!==now.createdAt)issues.push('createdAt_changed')
 for(const key of ['startTime','endTime'])if(old[key]){
   if(!now[key])issues.push(key+'_removed')
   else if(date(old[key])!==date(now[key]))issues.push(key+'_changed')
 }
 for(const s of old.stages||[])if(s.evidenceVerified===true&&!(now.stages||[]).some(n=>n.key===s.key&&n.startTime===s.startTime))issues.push('verified_stage_removed')
 return {id,title:now.title,outcome:now.detailVerificationOutcome,pipelineVersion:now.detailVerificationPipelineVersion,city:now.city,location:now.participationGuide&&now.participationGuide.location,start:date(now.startTime),end:date(now.endTime),price:now.participationGuide&&now.participationGuide.price,entrance:now.participation&&now.participation.url,oldStages:(old.stages||[]).length,stages:(now.stages||[]).length,issues}
})
const report={checked:rows.length,issues:rows.filter(x=>x.issues.length),rows}
fs.writeFileSync(path.join(dir,'after.json'),JSON.stringify(records,null,2))
fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify(report));if(report.issues.length)process.exitCode=2
