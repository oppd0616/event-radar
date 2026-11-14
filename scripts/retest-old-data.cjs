const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process')
const source=path.resolve(__dirname,'../docs/old-data-audit-2026-09-26T08-43-56-676Z')
const dir=path.resolve(__dirname,'../docs/old-data-retest-'+new Date().toISOString().replace(/[:.]/g,'-'))
fs.mkdirSync(dir,{recursive:true})
const samples=JSON.parse(fs.readFileSync(path.join(source,'samples.json'),'utf8')).filter(x=>['game','anime','sports','auto','tech','academic'].includes(x.domain))
console.log('REPORT '+dir)
for(const old of samples){
  const input={mode:'detail-pipeline-preview',targetTitle:old.title,targetEventId:old._id,domain:old.domain,city:old.city,topicKey:(old.topicKeys||[])[0]||''}
  const r=spawnSync(process.execPath,[path.resolve(__dirname,'invoke-detail-v21.cjs'),JSON.stringify(input)],{encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024})
  if(r.status!==0){console.log(JSON.stringify({title:old.title,error:(r.stderr||r.stdout).slice(0,400)}));continue}
  const result=JSON.parse(r.stdout)
  fs.writeFileSync(path.join(dir,old._id+'.json'),JSON.stringify({old,result},null,2))
  const fresh=(result.validated||[])[0],merged=result.updatePreview&&result.updatePreview.merged
  console.log(JSON.stringify({title:old.title,ok:result.ok,validated:!!fresh,writes:result.writes,rejected:result.rejected,remaining:result.detailPlan&&result.detailPlan.remaining,risks:result.updatePreview&&result.updatePreview.risks,city:merged&&merged.city,price:merged&&merged.participationGuide&&merged.participationGuide.price,entrance:merged&&merged.participation&&merged.participation.url,oldStages:(old.stages||[]).length,mergedStages:merged&&(merged.stages||[]).length,options:fresh&&fresh.participationOptions}))
}
