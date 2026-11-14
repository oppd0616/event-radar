const fs=require('node:fs'),{spawnSync}=require('node:child_process')
const cli=require('./dashboard-cloudbase-cli.cjs').resolveCli(),p=require('../cloudfunctions/fetchEvents/lib/publisher-sources')
function call(args){const x=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1',...args,'--json'],{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,windowsHide:true});if(x.status!==0)throw Error('Cloud request failed (details withheld)');const result=JSON.parse(x.stdout.slice(x.stdout.indexOf('{')));if(result.success===false||result.error)throw Error('Cloud request returned error');return result.data}
function invoke(input){const raw=call(['fn','invoke','fetchEvents','-d',JSON.stringify(input)]);const result=typeof raw.RetMsg==='string'?JSON.parse(raw.RetMsg):raw.RetMsg;if(!result)throw Error('No function result');console.log(JSON.stringify(result));return result}
function decode(v){if(Array.isArray(v))return v.map(decode);if(v&&typeof v==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in v)return Number(v[k]);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]))}return v}
const report={checkedAt:new Date().toISOString(),preview:[]}
if(process.argv.includes('--apply')){
  if(process.argv.includes('--retry-deferred')){
    const id=p.key(p.seeds[0].url)
    const command={update:'eventCandidates',updates:[{q:{_id:id,kind:'publisher_source_state',lastOutcome:'queue_full',leaseToken:''},u:{$set:{nextCheckAt:0}},multi:false,upsert:false}]}
    report.retry=call(['db','nosql','execute','--command',JSON.stringify([{TableName:'eventCandidates',CommandType:'UPDATE',Command:JSON.stringify(command)}])])
    if(fs.existsSync('output/publisher-source-test/cloud-apply.json'))fs.copyFileSync('output/publisher-source-test/cloud-apply.json','output/publisher-source-test/cloud-queue-full.json')
  }
  report.apply=invoke({mode:'publisher-source-run',preview:false,sourceId:p.key(p.seeds[0].url)})
  report.repeat=invoke({mode:'publisher-source-run',preview:false,sourceId:p.key(p.seeds[0].url)})
}else for(const source of p.seeds)report.preview.push(invoke({mode:'publisher-source-run',preview:true,sourceId:p.key(source.url)}))
report.health=invoke({mode:'publisher-source-health'})
const query={find:'eventCandidates',filter:{'sources.publisherSourceUrl':{$exists:true}},projection:{_id:1,title:1,domain:1,city:1,status:1,kind:1,sources:1,nextCheckAt:1,discoveryCapacityKind:1,targetEventId:1,lastReason:1,lastErrorCode:1},limit:100}
report.candidates=decode(call(['db','nosql','execute','--command',JSON.stringify([{TableName:'eventCandidates',CommandType:'QUERY',Command:JSON.stringify(query)}])]).results[0])
console.log(JSON.stringify({candidateReadback:report.candidates}))
if(process.argv.includes('--verify-first')&&report.candidates.length){
  const candidate=report.candidates.find(x=>(x.sources||[]).some(s=>s.publisherSourceUrl===p.seeds[0].url))||report.candidates[0]
  report.verification=invoke({mode:'candidate-recheck',candidateId:candidate._id})
  report.afterVerification=decode(call(['db','nosql','execute','--command',JSON.stringify([{TableName:'eventCandidates',CommandType:'QUERY',Command:JSON.stringify({...query,filter:{_id:candidate._id}})}])]).results[0])
}
const detail=call(['fn','detail','fetchEvents'])
report.configuration={status:detail.Status,triggers:detail.Triggers,monthlyLimit:detail.Environment.Variables.find(x=>x.Key==='WSA_MONTHLY_CALL_LIMIT')?.Value}
if(!report.configuration.triggers.some(t=>t.TriggerName==='publisherSourceTimer')||!report.configuration.triggers.some(t=>t.TriggerName==='fetchTimer'))throw Error('Trigger readback mismatch')
console.log(JSON.stringify(report.configuration))
fs.writeFileSync('output/publisher-source-test/cloud-'+(process.argv.includes('--apply')?'apply':'preview')+'.json',JSON.stringify(report,null,2))
