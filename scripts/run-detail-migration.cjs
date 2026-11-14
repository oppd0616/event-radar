// Sequential calls avoid two workers extracting the same ready candidate.
const {spawnSync}=require('child_process')
const fs=require('fs'),path=require('path')
const dir=path.join(__dirname,'../docs/migration-'+new Date().toISOString().replace(/[:.]/g,'-'))
fs.mkdirSync(dir,{recursive:true})
const calls=[], outcomes=[]
function checkpoint(status) {
 const report={status,calls:calls.length,attempted:outcomes.length,updated:outcomes.reduce((n,x)=>n+x.updated,0),blocked:outcomes.filter(x=>x.writeBlocked).length,withoutUpdate:outcomes.filter(x=>!x.updated).length,outcomes}
 fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(report,null,2))
 return report
}
function invoke(input) {
 const call=spawnSync(process.execPath,[path.join(__dirname,'invoke-detail-v21.cjs'),JSON.stringify(input)],{encoding:'utf8',timeout:420000,maxBuffer:16*1024*1024})
 if(call.status!==0) throw Error('CLI invocation failed: '+(call.error?.message||call.stderr||call.stdout).slice(0,1200))
 const data=JSON.parse(call.stdout.trim())
 calls.push({input,file:data.file,stage:data.stage,ok:data.ok})
 fs.writeFileSync(path.join(dir,'calls.json'),JSON.stringify(calls,null,2))
 if(data.results) outcomes.push(...data.results.filter(x=>x.stage==='candidate_recheck'))
 checkpoint('running')
 console.log(JSON.stringify({stage:data.stage,attempted:data.attempted,remaining:data.remaining,eligible:data.eligible,updated:(data.results||[]).reduce((n,x)=>n+x.updated,0),ok:data.ok,results:data.results}))
 if(data.ok!==true) throw Error('Cloud operation failed: '+JSON.stringify(data.results||data).slice(0,1200))
 return data
}
console.log('REPORT '+dir)
try {
 for(let i=0;i<100;i++) {
  const result=invoke({mode:'wsa-migration-run',maxItems:1})
  if(result.remaining===0) {
   const queued=invoke({mode:'wsa-migration-queue'})
   if(queued.eligible===0) {console.log(JSON.stringify(checkpoint('finished')));process.exit(0)}
   if(!queued.scheduled) throw Error('Queue made no progress; manual inspection required')
  } else if(!result.attempted) throw Error('Migration made no progress; manual inspection required')
 }
 throw Error('Bounded run limit reached; remaining work was not marked complete')
} catch(error) {
 checkpoint('stopped')
 console.error(error.message)
 process.exitCode=1
}
