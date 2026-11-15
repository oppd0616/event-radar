const fs=require('fs'),path=require('path'),{spawn}=require('child_process')
const command=process.argv[2], limit=Number(process.argv[4]||6)
const num=x=>typeof x==='object'&&x?Number(x.$numberLong||x.$numberInt||x.$numberDouble):Number(x)
let dir,state
if(command==='start'){
  const backup=path.resolve(process.argv[3]),records=JSON.parse(fs.readFileSync(path.join(backup,'backup.json'),'utf8')).records
  const now=Date.now(),samples=JSON.parse(fs.readFileSync(path.join(backup,'samples.json'),'utf8'))
  const pilot=samples.filter(x=>['game','anime','sports','auto','tech','academic'].includes(x.domain)).map(x=>x._id)
  const eligible=records.filter(x=>(!x.endTime||num(x.endTime)>=now)&&(!x.startTime||num(x.startTime)<=now+90*86400000))
    .sort((a,b)=>(pilot.includes(a._id)?pilot.indexOf(a._id):-1)<0?pilot.includes(b._id)?1:0:pilot.includes(b._id)?pilot.indexOf(a._id)-pilot.indexOf(b._id):-1)
  dir=path.resolve(__dirname,'../../docs/formal-refresh-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(dir,{recursive:true})
  state={backup,createdAt:new Date().toISOString(),status:'running',targets:eligible.map(x=>({id:x._id,title:x.title,domain:x.domain})),outcomes:[],calls:[]}
}else{dir=path.resolve(process.argv[3]);state=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'))}
function checkpoint(status){
  state.status=status;state.updatedAt=new Date().toISOString()
  fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(state,null,2))
  const summary={status,total:state.targets.length,attempted:state.outcomes.length,updated:state.outcomes.filter(x=>x.updated>0).length,blocked:state.outcomes.filter(x=>x.writeBlocked||x.updateBlocked&&x.updateBlocked.length).length,remaining:state.targets.length-state.outcomes.length,outcomes:state.outcomes}
  fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));return summary
}
function invoke(input){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.resolve(__dirname,'../invoke-detail-v21.cjs'),JSON.stringify(input)],{windowsHide:true,stdio:['ignore','pipe','pipe']})
  let stdout='',stderr=''
  child.stdout.on('data',data=>{stdout+=data});child.stderr.on('data',data=>{stderr+=data})
  child.on('error',reject);child.on('close',code=>{
    if(code!==0)return reject(Error((stderr||stdout).slice(0,500)))
    try { resolve(JSON.parse(stdout)) } catch(error) { reject(Error('Invalid invocation response: '+error.message)) }
  })
})}
async function invokeWithRetry(input){
  for(let attempt=0;attempt<3;attempt++){
    try { return await invoke(input) } catch(error) {
      if(attempt===2 || !/socket hang up|ECONNRESET|ETIMEDOUT|network|fetcherror|请求超时/i.test(error.message))throw error
      console.log(JSON.stringify({retry:attempt+1,id:input.targetEventId,reason:'transient_connection_error'}))
      await new Promise(resolve=>setTimeout(resolve,2000*(attempt+1)))
    }
  }
}
if(command==='record'){
  const file=path.resolve(process.argv[4]),saved=JSON.parse(fs.readFileSync(file,'utf8')),result=saved.result
  const id=saved.input.targetEventId,target=state.targets.find(x=>x.id===id)
  if(!target || saved.input.mode!=='detail-refresh')throw Error('Result does not belong to this refresh')
  state.rechecks=(state.rechecks||[]).concat({id,previous:state.outcomes.find(x=>x.id===id),file})
  state.outcomes=state.outcomes.filter(x=>x.id!==id)
  state.outcomes.push({...target,ok:result.ok,stage:result.stage,updated:Number(result.updated)||0,published:Number(result.published)||0,validated:Number(result.validated)||0,writeBlocked:!!result.writeBlocked,updateBlocked:result.updateBlocked,rejected:result.rejected,missing:result.remainingMissing,obsolete:result.obsolete,error:result.error,file})
  checkpoint(state.status);console.log('Recorded '+id);process.exit(0)
}
console.log('REPORT '+dir);delete state.lastError;checkpoint('running')
const pending=state.targets.filter(x=>!state.outcomes.some(y=>y.id===x.id)).slice(0,limit)
let cursor=0,failure=null
async function worker(){
  while(cursor<pending.length && !failure){
    const target=pending[cursor++]
    try {
    let result
    for(let phase=0;phase<2;phase++){
      const input={mode:'detail-refresh',targetEventId:target.id,reviewDateChanges:true}
      result=await invokeWithRetry(input);state.calls.push({id:target.id,file:result.file,stage:result.stage,ok:result.ok});checkpoint('running')
      if(result.ok===false && /budget|limit|credential|auth|额度/i.test(result.error||''))throw Error(result.error)
      if(result.stage!=='candidate_search')break
    }
    if(result.stage==='candidate_search')throw Error('Search repeated without extraction for '+target.id)
    const outcome={...target,ok:result.ok,stage:result.stage,updated:Number(result.updated)||0,published:Number(result.published)||0,validated:Number(result.validated)||0,writeBlocked:!!result.writeBlocked,updateBlocked:result.updateBlocked,rejected:result.rejected,missing:result.remainingMissing,obsolete:result.obsolete,note:result.note,error:result.error,file:result.file}
    state.outcomes.push(outcome);checkpoint('running');console.log(JSON.stringify(outcome))
    } catch(error) { failure=error;state.lastError=error.message }
  }
}
Promise.all(Array.from({length:Math.max(1,Math.min(3,Number(process.argv[5])||1))},()=>worker())).then(()=>{
  const summary=checkpoint(failure?'stopped':state.outcomes.length===state.targets.length?'finished':'batch_complete')
  console.log(JSON.stringify({...summary,outcomes:undefined}))
  if(failure){console.error(failure.message);process.exitCode=1}
}).catch(error=>{state.lastError=error.message;checkpoint('stopped');console.error(error.message);process.exitCode=1})
