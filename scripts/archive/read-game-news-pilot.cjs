const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),cli=require('../dashboard-cloudbase-cli.cjs').resolveCli()
const out=path.resolve(__dirname,'../../output/game-news-cloud-pilot-20261030')
const queries=['events','eventCandidates'].map(table=>({TableName:table,CommandType:'QUERY',Command:JSON.stringify({find:table,filter:{title:{$regex:'荣耀之路.*长沙|长沙.*荣耀之路'}},projection:{_id:1,title:1,domain:1,city:1,status:1,kind:1,topicKey:1,sources:1,lastReason:1,missingDetails:1,createdAt:1},limit:30})}))
const p=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','db','nosql','execute','--command',JSON.stringify(queries),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,windowsHide:true})
if(p.status!==0)throw Error('Readback failed; output withheld')
const r=JSON.parse(p.stdout.slice(p.stdout.indexOf('{')));if(!r.data?.results)throw Error('Unexpected readback')
const result={checkedAt:new Date().toISOString(),events:r.data.results[0],candidates:r.data.results[1]}
fs.writeFileSync(path.join(out,'readback.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
