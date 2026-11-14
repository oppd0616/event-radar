// Read-only full published-library scan, stable _id cursor; no cloud mutations.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process')
const {assessProductAudience}=require('../cloudfunctions/fetchEvents/lib/product-audience')
const cli=require('./dashboard-cloudbase-cli.cjs').resolveCli()
const out=path.resolve('output/product-audience-20261030');fs.mkdirSync(out,{recursive:true})
function decode(v){if(Array.isArray(v))return v.map(decode);if(v&&typeof v==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in v)return Number(v[k]);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]))}return v}
let cursor='',requests=0;const rows=[]
while(true){
 const filter={status:'published',...(cursor?{_id:{$gt:cursor}}:{})}
 const command=[{TableName:'events',CommandType:'QUERY',Command:JSON.stringify({find:'events',filter,sort:{_id:1},projection:{_id:1,title:1,domain:1,summary:1,participationGuide:1,source:1,sources:1,updatedAt:1,startTime:1,endTime:1},limit:100})}]
 const p=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','db','nosql','execute','--command',JSON.stringify(command),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024,windowsHide:true})
 if(p.status!==0)throw Error('Read failed; private output withheld')
 const v=JSON.parse(p.stdout.slice(p.stdout.indexOf('{')));if(v.error||v.success===false||!v.data?.results)throw Error('Read rejected')
 const page=decode(v.data.results[0]);requests++;if(!Array.isArray(page))throw Error('Unexpected query format')
 rows.push(...page);if(page.length<100)break
 const next=page[page.length-1]._id;if(next<=cursor)throw Error('Cursor did not advance');cursor=next
}
const flagged=rows.map(event=>({event,assessment:assessProductAudience(event)})).filter(x=>x.assessment.decision!=='allow')
const report={at:new Date().toISOString(),scope:'All published events, cursor scan; not an atomic snapshot',scanned:rows.length,requests,cloudWrites:0,flagged}
fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify({...report,flagged:flagged.map(x=>({id:x.event._id,title:x.event.title,assessment:x.assessment}))},null,2))
