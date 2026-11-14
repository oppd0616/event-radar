const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process')
const cli = 'C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const env = 'cloud1-d3gm0lbv1392513d1'
function call(args) {
  const r = spawnSync(process.execPath,[cli,'-e',env,...args,'--json'],{encoding:'utf8',timeout:300000,maxBuffer:32*1024*1024})
  if (r.status !== 0) throw Error((r.stderr || r.stdout || String(r.error)).slice(0,600))
  return JSON.parse(r.stdout.slice(r.stdout.indexOf('{')))
}
function numeric(x) { return typeof x === 'object' && x ? Number(x.$numberLong || x.$numberInt || x.$numberDouble) : Number(x) }
const mode = process.argv[2] || 'backup'
if (mode === 'backup') {
  const dir = path.resolve(__dirname,'../docs/old-data-audit-'+new Date().toISOString().replace(/[:.]/g,'-'))
  fs.mkdirSync(dir,{recursive:true})
  const records = []
  for(let skip=0;;skip+=100) {
    const query={find:'events',filter:{status:{$in:['published','pending']}},sort:{_id:1},skip,limit:100}
    const result=call(['db','nosql','execute','--command',JSON.stringify([{TableName:'events',CommandType:'QUERY',Command:JSON.stringify(query)}])])
    const page=result.data.results[0]
    if(!Array.isArray(page)) throw Error('Unexpected backup response')
    records.push(...page)
    if(page.length<100) break
    if(skip>=2000) throw Error('Safety limit reached; backup not marked complete')
  }
  fs.writeFileSync(path.join(dir,'backup.json'),JSON.stringify({at:new Date().toISOString(),records},null,2))
  const eligible=records.filter(x=>(!x.endTime || numeric(x.endTime)>=Date.now()) && (!x.startTime || numeric(x.startTime)<=Date.now()+90*86400000))
  const samples=[]
  for(const domain of [...new Set(eligible.map(x=>x.domain))]) {
    const choices=eligible.filter(x=>x.domain===domain).sort((a,b)=>numeric(a.detailEnrichmentQueueVersion||0)-numeric(b.detailEnrichmentQueueVersion||0))
    if(choices[0])samples.push(choices[0])
  }
  fs.writeFileSync(path.join(dir,'samples.json'),JSON.stringify(samples.slice(0,10),null,2))
  console.log(JSON.stringify({dir,backedUp:records.length,eligible:eligible.length,samples:samples.slice(0,10).map(x=>({id:x._id,title:x.title,domain:x.domain}))}))
} else if(mode==='preview') {
  const dir=path.resolve(process.argv[3]); const samples=JSON.parse(fs.readFileSync(path.join(dir,'samples.json'),'utf8'))
  for(const old of samples) {
    const file=path.join(dir,old._id+'-preview.json')
    if(fs.existsSync(file)) continue
    const input={mode:'detail-pipeline-preview',targetTitle:old.title,domain:old.domain,city:old.city,topicKey:(old.topicKeys||[])[0]||''}
    const result=JSON.parse(call(['fn','invoke','fetchEvents','-d',JSON.stringify(input)]).data.RetMsg)
    fs.writeFileSync(file,JSON.stringify({old,input,result},null,2))
    console.log(JSON.stringify({title:old.title,ok:result.ok,validated:(result.validated||[]).length,rejected:result.rejected,remaining:result.detailPlan&&result.detailPlan.remaining,writes:result.writes,error:result.error}))
    if(result.ok===false && /budget|auth|credential/i.test(result.error||'')) break
  }
} else if(mode==='report') {
  const dir=path.resolve(process.argv[3]); const samples=JSON.parse(fs.readFileSync(path.join(dir,'samples.json'),'utf8'))
  const date = value => value ? new Date(numeric(value)+8*3600000).toISOString().slice(0,10) : ''
  const rows=samples.map(old=>{
    const file=path.join(dir,old._id+'-preview.json')
    if(!fs.existsSync(file)) return {title:old.title,status:'not_tested'}
    const {result}=JSON.parse(fs.readFileSync(file,'utf8'))
    const fresh=(result.validated||[])[0]
    const fields=x=>({title:x.title,city:x.city,start:date(x.startTime),end:date(x.endTime),location:x.participationGuide&&x.participationGuide.location,price:x.participationGuide&&x.participationGuide.price,entrance:x.participation&&x.participation.url,stages:(x.stages||[]).map(s=>({name:s.name,date:date(s.startTime)})),source:x.source&&x.source.url})
    return {id:old._id,title:old.title,status:fresh?'validated_preview':'blocked',old:fields(old),fresh:fresh&&fields(fresh),remaining:result.detailPlan&&result.detailPlan.remaining,rejected:result.rejected,error:result.error}
  })
  fs.writeFileSync(path.join(dir,'comparison.json'),JSON.stringify({writes:0,rows},null,2))
  console.log(JSON.stringify({dir,writes:0,rows}))
} else throw Error('Unknown mode')
