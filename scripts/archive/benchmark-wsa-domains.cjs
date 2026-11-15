// Read-only paired query benchmark; no activity writes.
const {spawnSync}=require('child_process')
const fs=require('fs'), path=require('path')
const pnpm='C:/Users/oppd_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pnpm/bin/pnpm.mjs'
const samples=[
 ['tech','PyCon China 2026',''],
 ['auto','2026全新一代智己LS6预售',''],
 ['finance','第23届中国—东盟博览会、中国—东盟商务与投资峰会',''],
 ['ent','ITZY 2026 WORLD TOUR IN TAIPEI','台北'],
 ['culture','LISA×名创优品联名快闪 Pop-Up World Tour 北京站','北京'],
 ['game','2026无畏契约全球冠军赛','上海'],
 ['sports','2026北京马拉松','北京'],
 ['anime','2026凡人动画·星海天南嘉年华FES（凡人修仙传）',''],
 ['academic','2026年下半年全国大学英语四、六级考试','']
]
const dir=path.join(__dirname,'../../docs/benchmarks',new Date().toISOString().replace(/[:.]/g,'-'))
fs.mkdirSync(dir,{recursive:true})
console.log('OUTPUT '+dir)
const summaries=[]
for(const [domain,targetTitle,city] of samples) for(const variant of ['before','after']) {
 const started=Date.now()
 const input={mode:'wsa-detail-probe',comparison:'query-only',domain,targetTitle,city,variant,extract:true}
 const run=spawnSync(process.execPath,[pnpm,'dlx','--package','@cloudbase/cli','tcb','fn','invoke','fetchEvents','-d',JSON.stringify(input),'--env-id','cloud1-d3gm0lbv1392513d1','--json'],{encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024})
 let data
 try {
  if(run.status!==0) throw Error(run.error?.message||'CLI failed: '+run.status)
  const envelope=JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
  data=JSON.parse(envelope.data.RetMsg)
 } catch(error) {data={ok:false,error:error.message}}
 fs.writeFileSync(path.join(dir,domain+'-'+variant+'.json'),JSON.stringify(data,null,2))
 const accepted=data.validated||[]
 const summary={domain,targetTitle,variant,ok:data.ok,scope:data.comparisonScope,retrieved:data.retrieved,validated:accepted.length,rejected:data.rejected,error:data.error,elapsedMs:Date.now()-started,
  events:accepted.map(e=>({title:e.title,startTime:e.startTime,endTime:e.endTime,timePrecision:e.timePrecision,location:e.participationGuide?.location,accessStartTime:e.participationGuide?.accessStartTime,accessEndTime:e.participationGuide?.accessEndTime,stages:e.stages}))}
 summaries.push(summary)
 fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summaries,null,2))
 console.log(JSON.stringify(summary))
 if(run.status!==0) {console.log('Stopped on CLI failure; remaining samples not tested.');break}
}
