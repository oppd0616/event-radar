const fs=require('node:fs'),{spawnSync}=require('node:child_process')
const cli=require('../dashboard-cloudbase-cli.cjs').resolveCli()
function call(args){const x=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1',...args,'--json'],{encoding:'utf8',timeout:120000,maxBuffer:8000000,windowsHide:true});if(x.status)throw Error('Cloud read failed');return JSON.parse(x.stdout.slice(x.stdout.indexOf('{'))).data}
function decode(v){if(Array.isArray(v))return v.map(decode);if(v&&typeof v==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in v)return Number(v[k]);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]))}return v}
function query(table,filter,projection){return decode(call(['db','nosql','execute','--command',JSON.stringify([{TableName:table,CommandType:'QUERY',Command:JSON.stringify({find:table,filter,projection,limit:100})}])]).results[0])}
const candidates=query('eventCandidates',{'sources.publisherSourceUrl':{$exists:true}},{_id:1,title:1,domain:1,city:1,status:1,lastReason:1,targetEventId:1,discoveryCapacityKind:1,nextCheckAt:1})
const ids=candidates.map(x=>x.targetEventId).filter(Boolean)
const events=query('events',{$or:[{_id:{$in:ids}},{domain:'tech',city:'广州',title:{$regex:'云峰论剑'}},{domain:'tech',city:'上海',title:{$regex:'Harness 工程实践'}},{'source.url':'https://developer.cloud.tencent.com.cn/salon/salon-2534'}]},{_id:1,title:1,domain:1,city:1,status:1,startTime:1,endTime:1,timePrecision:1,source:1,participationGuide:1,createdAt:1})
const capacity=query('eventCandidates',{_id:{$in:['discovery-capacity-candidate-tech','discovery-capacity-publisher_candidate-tech']}},{_id:1,slots:1})
const d=call(['fn','detail','fetchEvents'])
const r={at:new Date().toISOString(),candidates,events,capacity:capacity.map(x=>({id:x._id,occupied:Object.keys(x.slots||{}).length})),configuration:{triggers:d.Triggers,monthlyLimit:d.Environment.Variables.find(x=>x.Key==='WSA_MONTHLY_CALL_LIMIT')?.Value}}
fs.writeFileSync('output/publisher-source-test/final-readback.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r,null,2))
