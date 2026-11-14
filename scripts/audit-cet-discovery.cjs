const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process')
const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
function query(table,filter,projection,sort,limit=100){
 const command={find:table,filter,projection,sort,limit}
 const run=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','db','nosql','execute','--command',JSON.stringify([{TableName:table,CommandType:'QUERY',Command:JSON.stringify(command)}]),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024})
 if(run.status!==0)throw Error((run.stderr||run.stdout||String(run.error)).slice(0,600))
 const result=JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
 return result.data.results[0]
}
if(process.argv[2]==='queue'){
 const due=query('eventCandidates',{status:'waiting',nextCheckAt:{$lte:Date.now()}},{title:1,kind:1,nextCheckAt:1,retryCount:1,lastReason:1},{},100)
 const ready=query('eventCandidates',{status:'ready_to_extract'},{title:1,kind:1,updatedAt:1,retryCount:1},{},100)
 console.log(JSON.stringify({readOnly:true,dueFirstPageCount:due.length,cetInFirstPage:due.filter(x=>/四.*六级|CET/i.test(x.title||'')),readyCount:ready.length,ready:ready.slice(0,15),dueSample:due.slice(0,5)}));process.exit(0)
}
const match={$regex:process.argv[3] || '四.*六级|CET|英语四级|英语六级',$options:'i'}
if(process.argv[2]==='evidence'){
 const rows=query('eventCandidates',{title:match,kind:{$in:['detail_enrichment','discovery_detail']}},{title:1,status:1,lastReason:1,updatedAt:1,verificationCachedAt:1,verificationRawItems:1,targetEventId:1},{updatedAt:-1},20)
 const report=rows.map(row=>({...row,verificationRawItems:undefined,evidence:(row.verificationRawItems||[]).map(item=>({title:item.title,url:item.link,knockoutText:(String(item.description||'').match(/.{0,100}淘汰赛.{0,180}/g)||[]).slice(0,4)}))}))
 const file=path.resolve(__dirname,'../docs/event-evidence-audit-'+Date.now()+'.json')
 fs.writeFileSync(file,JSON.stringify({readOnly:true,report},null,2));console.log(JSON.stringify({file,report}));process.exit(0)
}
if(process.argv[2]==='events'){
 const rows=query('events',{title:match},{title:1,status:1,createdAt:1,startTime:1,endTime:1,stages:1,participationGuide:1,canonicalEventId:1},{createdAt:-1})
 const reports=[]
 for(const row of rows){
  if(row.status!=='published')continue
  const run=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','fn','invoke','getEvents','-d',JSON.stringify({id:row._id}),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024})
  if(run.status!==0)throw Error('Detail verification failed')
  const envelope=JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
  const result=JSON.parse(envelope.data.RetMsg)
  const e=result.event
  reports.push({id:row._id,visible:!!e,title:e&&e.title,status:row.status,startTime:e&&e.startTime,endTime:e&&e.endTime,stages:e&&e.stages,participationGuide:e&&e.participationGuide})
 }
 const file=path.resolve(__dirname,'../docs/event-published-check-'+Date.now()+'.json')
 fs.writeFileSync(file,JSON.stringify({readOnly:true,reports},null,2));console.log(JSON.stringify({file,reports}));process.exit(0)
}
const report={at:new Date().toISOString(),readOnly:true,
 targets:query('discoveryTargets',{name:match},{},{_id:1}),
 recentTargets:query('discoveryTargets',{status:'active'},{name:1,domain:1,lastSearchedAt:1,nextSearchAt:1,lastSearchError:1,refreshReason:1,updatedAt:1},{lastSearchedAt:-1},12),
 events:query('events',{title:match},{title:1,status:1,createdAt:1,updatedAt:1,startTime:1,endTime:1,detailEnrichmentStatus:1,identityReview:1},{createdAt:-1}),
 candidates:query('eventCandidates',{title:match,kind:{$nin:['identity_migration_backup','event_identity']}},{title:1,kind:1,status:1,lastReason:1,missingDetails:1,retryCount:1,nextCheckAt:1,createdAt:1,updatedAt:1,lastError:1,rejected:1,targetEventId:1},{updatedAt:-1},20)
}
const file=path.resolve(__dirname,'../docs/cet-discovery-audit-'+Date.now()+'.json')
fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(JSON.stringify({file,...report}))
