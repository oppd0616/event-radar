const fs=require('node:fs'),{spawnSync}=require('node:child_process')
const cli=require('./dashboard-cloudbase-cli.cjs').resolveCli()
const sample=require('../output/publisher-source-test/final-readback.json').candidates.find(x=>x.city==='上海'&&x.discoveryCapacityKind==='publisher_candidate')
if(!sample)throw Error('Expected Shanghai sample not found')
const results=[]
for(let i=0;i<2;i++){
  const args=[cli,'-e','cloud1-d3gm0lbv1392513d1','fn','invoke','fetchEvents','-d',JSON.stringify({mode:'candidate-recheck',candidateId:sample._id}),'--json']
  const p=spawnSync(process.execPath,args,{encoding:'utf8',timeout:180000,maxBuffer:8000000,windowsHide:true})
  if(p.status!==0)throw Error('Cloud verification failed (details withheld)')
  const raw=JSON.parse(p.stdout.slice(p.stdout.indexOf('{'))).data
  const result=JSON.parse(raw.RetMsg);results.push(result);console.log(JSON.stringify(result))
  if(result.stage!=='candidate_search')break
}
fs.writeFileSync('output/publisher-source-test/shanghai-verification.json',JSON.stringify({at:new Date().toISOString(),id:sample._id,results},null,2))
