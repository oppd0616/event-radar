const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const records=JSON.parse(fs.readFileSync(path.join(__dirname,'../../docs/field-refresh-v35-1790515536676/after.json')));
const dir=path.resolve(__dirname,'../../docs/guard-live-'+Date.now());fs.mkdirSync(dir);console.log('REPORT '+dir);
const summary=[];
for(const old of records){
  const input={mode:'detail-pipeline-preview',evaluationBatch:'guard-live-20260927',targetEventId:old._id,targetTitle:old.title,domain:old.domain,city:old.city,topicKey:old.topicKeys?.[0]||''};
  const run=spawnSync(process.execPath,[path.join(__dirname,'../invoke-detail-v21.cjs'),JSON.stringify(input)],{encoding:'utf8',timeout:450000,maxBuffer:32*1024*1024,windowsHide:true});
  let row;
  try {
    if(run.status!==0)throw Error((run.stderr||run.stdout).slice(0,600));
    const r=JSON.parse(run.stdout);fs.writeFileSync(path.join(dir,old._id+'.json'),JSON.stringify({old,input,result:r},null,2));
    row={id:old._id,title:old.title,ok:r.ok,writes:r.writes,searchCalls:r.searchCalls,validated:r.validated?.length,remaining:r.detailPlan?.remaining,errors:r.detailPlan?.errors,risks:r.updatePreview?.risks,rejected:r.rejected,file:r.file};
    if(r.error)row.error=r.error;
  }catch(e){row={id:old._id,title:old.title,error:e.message};}
  summary.push(row);fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(row));
}
console.log('DONE '+dir);
