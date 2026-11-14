const fs=require('fs'),path=require('path'),vm=require('vm')
const root=path.resolve(__dirname,'../cloudfunctions/fetchEvents'),filename=path.join(root,'index.js'),mod={exports:{}}
vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.quality={missingDetailReasons,detailMissingFields};',{
 module:mod,exports:mod.exports,require:name=>name==='wx-server-sdk'?{init(){},database:()=>({command:{}})}:name.startsWith('.')?require(path.resolve(root,name)):require(name),
 process:{env:{}},console,Buffer,URL,setTimeout,clearTimeout
},{filename})
const modes=require(path.join(root,'lib/detail-modes'))
const base=path.resolve(__dirname,'../docs/formal-refresh-2026-09-27T02-33-31-847Z'),state=JSON.parse(fs.readFileSync(path.join(base,'state.json')))
const events=JSON.parse(fs.readFileSync(path.join(base,'after.json')))
const names={venue:'location',event_date:'date',exact_event_time:'clock'}
const rows=events.map(event=>{
 const evidence=[{description:[event.title,event.summary,JSON.stringify(event.participationGuide||{})].join('\n')}]
 const inferred=modes.inferModes(evidence,event),stored=mod.exports.quality.missingDetailReasons(event),search=mod.exports.quality.detailMissingFields([event],inferred,[],evidence)
 const unplanned=stored.map(x=>names[x]||x).filter(x=>!search.includes(x))
 return {id:event._id,title:event.title,oldMissing:state.outcomes.find(x=>x.id===event._id)?.missing||[],modes:inferred,storedMissing:stored,searchMissing:search,unplanned}
})
const report={kind:'offline stored-record replay; no new search and no database writes',checked:rows.length,unplanned:rows.filter(x=>x.unplanned.length).length,oldAccessMissing:rows.filter(x=>x.oldMissing.includes('access_time')).length,newAccessMissing:rows.filter(x=>x.storedMissing.includes('access_time')).length,rows}
const file=path.resolve(__dirname,'../docs/detail-quality-v35-replay.json');fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined,file}))
if(report.unplanned)process.exitCode=1
