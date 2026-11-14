const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process')
const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const dir=path.resolve(__dirname,'../docs/identity-migration-'+Date.now())
fs.mkdirSync(dir,{recursive:true})
function invoke(name,input) {
  const result=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','fn','invoke',name,'-d',JSON.stringify(input),'--json'],{encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024})
  if(result.status!==0)throw Error((result.stderr || result.stdout).slice(0,500))
  const envelope=JSON.parse(result.stdout.slice(result.stdout.indexOf('{')))
  return JSON.parse(envelope.data.RetMsg)
}
function save(name,data){fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(data,null,2))}
const before=invoke('fetchEvents',{mode:'identity-audit'})
save('before',before)
if(!before.ok)throw Error('Pre-migration audit failed: '+JSON.stringify(before))
console.log(JSON.stringify({dir,before:{scanned:before.scanned,duplicates:before.duplicateGroups,pending:before.pendingGroups}}))
let linked=0,applied=0,remaining=before.pendingGroups
for(let batch=1;remaining>0&&batch<=30;batch++) {
  const result=invoke('fetchEvents',{mode:'identity-repair',limit:20})
  save('batch-'+batch,result)
  console.log(JSON.stringify({batch,ok:result.ok,applied:result.appliedGroups,linked:result.linkedRecords,remaining:result.remainingGroups,error:result.error||result.errorMessage}))
  if(!result.ok || !result.appliedGroups)throw Error('Migration stopped; inspect saved batch '+batch)
  linked+=result.linkedRecords;applied+=result.appliedGroups;remaining=result.remainingGroups
}
const after=invoke('fetchEvents',{mode:'identity-audit'})
save('after',after)
if(!after.ok || after.duplicateGroups || after.pendingGroups)throw Error('Migration is incomplete')
const aliases=[]
for(const group of before.groups || []) {
  for(const id of group.ids.filter(id=>id!==group.primaryId)) {
    const result=invoke('getEvents',{id})
    const row={oldId:id,expectedPrimaryId:group.primaryId,actualId:result.event && result.event._id,ok:!!result.event && result.event._id===group.primaryId}
    aliases.push(row)
    if(!row.ok)throw Error('Old detail link failed: '+JSON.stringify(row))
  }
}
save('alias-checks',aliases)
let cursor=0,feedOrder,seen=new Set(),pages=0,visible=0
do {
  const result=invoke('getEvents',{domain:'all',sortMode:'time',cursor,pageSize:30,feedOrder})
  save('feed-page-'+(++pages),result)
  if(!Array.isArray(result.list))throw Error('Feed invocation failed')
  for(const event of result.list) {
    const id=event.canonicalEventId || event._id
    if(seen.has(id))throw Error('Duplicate across live feed pages: '+id)
    seen.add(id);visible++
  }
  feedOrder=result.feedOrder;cursor=result.nextCursor
} while(cursor!=null && pages<30)
if(cursor!=null)throw Error('Feed audit incomplete')
const summary={dir,scannedBefore:before.scanned,scannedAfter:after.scanned,linkedRecords:linked,indexedGroups:applied,duplicateGroupsAfter:after.duplicateGroups,pendingGroupsAfter:after.pendingGroups,aliasesVerified:aliases.length,feedPages:pages,visibleCards:visible,duplicateCards:0,searchCalls:0}
save('summary',summary)
console.log(JSON.stringify(summary))
