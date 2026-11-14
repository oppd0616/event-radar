// Read-only production queue overview. Does not invoke discovery or write to CloudBase.
const {spawnSync}=require('child_process')
const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const environment='cloud1-d3gm0lbv1392513d1'
const now=Date.now()
function decode(value){
  if(Array.isArray(value))return value.map(decode)
  if(value&&typeof value==='object'){
    for(const key of ['$numberLong','$numberInt','$numberDouble'])if(key in value)return Number(value[key])
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,decode(item)]))
  }
  return value
}
function query(status,skip){
  const command={find:'eventCandidates',filter:{status},projection:{_id:1,title:1,kind:1,domain:1,topicKey:1,status:1,lastReason:1,missingDetails:1,createdAt:1,updatedAt:1,nextCheckAt:1,retryCount:1,targetEventId:1},sort:{_id:1},skip,limit:100}
  const request=[{TableName:'eventCandidates',CommandType:'QUERY',Command:JSON.stringify(command)}]
  const result=spawnSync(process.execPath,[cli,'-e',environment,'db','nosql','execute','--command',JSON.stringify(request),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024})
  if(result.status!==0)throw Error((result.stderr||result.stdout||String(result.error)).slice(0,500))
  const envelope=JSON.parse(result.stdout.slice(result.stdout.indexOf('{')))
  const rows=decode(envelope.data.results[0])
  if(!Array.isArray(rows))throw Error('Unexpected CloudBase response')
  return rows
}
const rows=[]
for(const status of ['waiting','ready_to_extract']){
  for(let skip=0;skip<5000;skip+=100){
    const page=query(status,skip)
    rows.push(...page)
    if(page.length<100)break
    if(skip===4900)throw Error('Queue exceeds audit safety limit')
  }
}
function countBy(field){return Object.fromEntries([...new Set(rows.map(row=>String(row[field]||'unknown')))].map(key=>[key,rows.filter(row=>String(row[field]||'unknown')===key).length]).sort((a,b)=>b[1]-a[1]))}
function sample(group,limit=3){return rows.filter(row=>row.domain===group).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,limit).map(row=>({title:row.title,kind:row.kind,status:row.status,reason:row.lastReason}))}
const domains=countBy('domain')
const report={readOnly:true,at:new Date(now).toISOString(),total:rows.length,due:rows.filter(row=>Number(row.nextCheckAt||0)<=now).length,retryZero:rows.filter(row=>Number(row.retryCount||0)===0).length,retriedLast24h:rows.filter(row=>Number(row.retryCount||0)>0 && Number(row.updatedAt||0)>=now-86400000).length,byStatus:countBy('status'),byKind:countBy('kind'),byDomain:domains,byReason:countBy('lastReason'),byMissing:Object.fromEntries([...new Set(rows.flatMap(row=>row.missingDetails||[]))].map(key=>[key,rows.filter(row=>(row.missingDetails||[]).includes(key)).length]).sort((a,b)=>b[1]-a[1])),examples:Object.fromEntries(Object.keys(domains).map(domain=>[domain,sample(domain)]))}
console.log(JSON.stringify(report))
