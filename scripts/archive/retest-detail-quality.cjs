const fs=require('fs'),path=require('path'),{spawn}=require('child_process')
const base=path.resolve(__dirname,'../../docs/formal-refresh-2026-09-27T02-33-31-847Z')
const records=JSON.parse(fs.readFileSync(path.join(base,'after.json'))),state=JSON.parse(fs.readFileSync(path.join(base,'state.json')))
const ids=['053e4eb1a9ccee10329e8441fcd93898','081d938e59635d030053ea6773f15273','37138adf6a9c12610164c3811293f677','37138adf6aa190a101bc2b7e57b01cb3']
const dir=path.resolve(__dirname,'../../docs/detail-quality-v35-'+Date.now());fs.mkdirSync(dir,{recursive:true});console.log('REPORT '+dir)
const results=[];let cursor=0
function invoke(input){return new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[path.resolve(__dirname,'../invoke-detail-v21.cjs'),JSON.stringify(input)],{windowsHide:true});let out='',err=''
 child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>{try{if(code!==0)throw Error((err||out).slice(0,400));resolve(JSON.parse(out))}catch(e){reject(e)}})
})}
async function worker(){while(cursor<ids.length){const id=ids[cursor++],old=records.find(x=>x._id===id);try{
 const result=await invoke({mode:'detail-pipeline-preview',evaluationBatch:'quality-v35-20260927',targetEventId:id,targetTitle:old.title,domain:old.domain,city:old.city,topicKey:(old.topicKeys||[])[0]||''})
 const previous=state.outcomes.find(x=>x.id===id),prior=JSON.parse(fs.readFileSync(previous.file)).result
 fs.writeFileSync(path.join(dir,id+'.json'),JSON.stringify({old,prior,result},null,2))
 const row={id,title:old.title,ok:result.ok,writes:result.writes,version:result.searchPipelineVersion,searchCalls:result.searchCalls,oldModes:prior.detailPlan?.modes,modes:result.detailPlan?.modes,oldRemaining:previous.missing,remaining:result.detailPlan?.remaining,queries:result.detailPlan?.supplementQueries,errors:result.detailPlan?.errors,validated:result.validated?.length,rejected:result.rejected,risks:result.updatePreview?.risks,file:result.file}
 results.push(row);console.log(JSON.stringify(row))
 }catch(error){results.push({id,error:error.message});console.log(JSON.stringify(results.at(-1)))}fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(results,null,2))}}
Promise.all([worker(),worker()]).then(()=>console.log('DONE '+dir))
