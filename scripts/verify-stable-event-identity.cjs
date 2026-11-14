const assert=require('assert/strict'),fs=require('fs'),path=require('path')
const identity=require('../shared/event-identity')
const {plan,run:migrate}=require('../cloudfunctions/fetchEvents/lib/identity-migration')
const {database,helpers,base}=require('./verify-event-write-quality')
const {createEventWriter}=require('../cloudfunctions/fetchEvents/lib/event-write-quality')
const {paginate}=require('../cloudfunctions/getEvents/feed-pagination')
const {resolveEvent}=require('../shared/event-ref')
async function main() {
  const event={...base,title:'2026全国大学生示例大赛',city:'长沙'}
  const exhibition={...base,title:'上海敦煌当代美术馆年度大展“丝路有多长？”',city:'上海'}
  const reordered={...exhibition,title:'“丝路有多长？”敦煌当代美术馆年度大展'}
  assert.equal(identity.compare(exhibition,reordered),'same')
  assert.equal(identity.identityKey(exhibition),identity.identityKey(reordered))
  for(const changed of [
    {...reordered,title:'“丝路有多长？”其他美术馆年度大展'},
    {...reordered,title:'“另一场展览”敦煌当代美术馆年度大展'},
    {...reordered,city:'北京'},
    {...reordered,startTime:exhibition.startTime+366*86400000},
    {...reordered,sessionKey:'晚场'}
  ]) assert.notEqual(identity.compare({...exhibition,sessionKey:'上午场'},changed),'same')
  assert.equal(identity.compare(event,{...event,startTime:event.startTime+86400000,timePrecision:'date'}),'same')
  assert.equal(identity.identityKey(event),identity.identityKey({...event,domain:'tech',startTime:event.startTime+86400000}))
  assert.equal(identity.compare(event,{...event,title:'2027全国大学生示例大赛'}),'different')
  assert.equal(identity.compare({...event,title:'某IP北京快闪',city:'北京'},{...event,title:'某IP上海快闪',city:'上海'}),'different')
  assert.equal(identity.compare({...event,title:'某IP冠军赛'},{...event,title:'某IP概念网吧快闪'}),'different')
  assert.equal(identity.compare({...event,sessionKey:'下午场'},{...event,sessionKey:'晚场'}),'different')
  const db=database(),writer=createEventWriter(db)
  const parallel=await Promise.all(Array.from({length:12},(_,i)=>writer('candidate-'+i,event,null,'race')))
  assert.equal(parallel.filter(r=>r.written).length,1)
  assert.equal(Object.keys(db.records.events).length,1)
  assert(parallel.filter(r=>!r.written).every(r=>r.targetEventId==='candidate-0'))
  const primary=structuredClone(db.records.events['candidate-0'])
  const revised={...primary,summary:'新的正文',startTime:primary.startTime+86400000,endTime:primary.endTime+86400000}
  assert.equal((await writer(primary._id,revised,{summary:revised.summary,startTime:revised.startTime,endTime:revised.endTime},'update',primary)).written,true)
  assert.equal(Object.keys(db.records.events).length,1)
  const stale={...primary,summary:'过时正文'}
  assert.equal((await writer(primary._id,stale,{summary:stale.summary},'update',primary)).issues[0],'concurrent_content_update')
  db.records.events.alias={_id:'alias',status:'merged',mergedInto:primary._id}
  assert.equal((await resolveEvent(db,'alias'))._id,primary._id)
  const items=['a','b','c','d'].map(_id=>({_id}))
  const first=paginate(items,null,0,2)
  const second=paginate(items.slice().reverse(),first.feedOrder,2,2)
  assert.deepEqual(first.list.concat(second.list).map(e=>e._id),['a','b','c','d'])
  assert.deepEqual(paginate(items.filter(e=>e._id!=='a'),first.feedOrder,2,2).list.map(e=>e._id),['c','d'])
  const actual=database()
  const h=helpers(actual)
  const results=await Promise.all(Array.from({length:5},()=>h.saveEvents([structuredClone(event)],event.startTime-86400000)))
  assert.equal(Object.keys(actual.records.events).length,1)
  assert.equal(results.reduce((n,r)=>n+r.inserted,0),1)
  const oldRecords={a:{...structuredClone(event),_id:'a'},b:{...structuredClone(event),_id:'b',startTime:event.startTime+86400000,endTime:event.endTime+86400000,timePrecision:'date'}}
  const migrationDb=database(oldRecords)
  const scopedDb=database({...oldRecords,c:{...structuredClone(event),_id:'c'}})
  const scoped=await migrate(scopedDb,true,10,['a','b'])
  assert.equal(scoped.linkedRecords,1)
  assert.equal(scopedDb.records.events.c.status,event.status)
  assert.equal(scopedDb.records.events.c.mergedInto,undefined)
  await assert.rejects(()=>migrate(scopedDb,true,10,[]),/Invalid identity repair scope/)
  migrationDb.state.failAlias=true
  await assert.rejects(()=>migrate(migrationDb,true,10),/simulated alias/)
  assert.deepEqual(migrationDb.records.events,oldRecords,'Failed migration must roll back all event writes')
  assert.equal(Object.keys(migrationDb.records.eventCandidates).length,0,'Backup and claims roll back with events')
  migrationDb.state.failAlias=false
  const migrated=await migrate(migrationDb,true,10)
  assert.equal(migrated.linkedRecords,1)
  const main=migrationDb.records.events[migrated.results[0].primaryId]
  assert.equal(main.identityMembers.length,2)
  assert.equal(main.identityReview.status,'pending')
  assert.equal(Object.values(migrationDb.records.eventCandidates).filter(r=>r.kind==='identity_migration_backup')[0].records.length,2)
  assert.equal((await migrate(migrationDb,true,10)).appliedGroups,0,'Migration is idempotent')
  const aliasId=Object.values(migrationDb.records.events).find(e=>e.status==='merged')._id
  const updateAlias=await helpers(migrationDb).saveEvents([{...structuredClone(event),summary:'别名更新的新正文'}],event.startTime-86400000,aliasId)
  assert.equal(updateAlias.updated,1,'Old refresh jobs must update the canonical record')
  assert.equal(migrationDb.records.events[aliasId].status,'merged','Refreshing an alias must never republish it')
  const dir=process.argv[2]
  if(dir) {
    function decode(v){if(Array.isArray(v))return v.map(decode);if(v&&typeof v==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in v)return Number(v[k]);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]))}return v}
    const records=decode(JSON.parse(fs.readFileSync(path.join(dir,'backup.json')))).records
    const proposals=plan(records),groups=proposals.filter(p=>p.members.length>1)
    const report={total:records.length,duplicateGroups:groups.length,duplicateRecords:groups.reduce((n,p)=>n+p.members.length-1,0),groups:groups.map(p=>({primaryId:p.primaryId,title:p.title,members:p.members.map(e=>({id:e._id,title:e.title,city:e.city,startTime:e.startTime})),conflicts:p.conflicts}))}
    fs.writeFileSync(path.join(dir,'identity-v2-plan.json'),JSON.stringify(report,null,2))
    const popup=records.filter(e=>/LISA/.test(e.title))
    assert.equal(identity.groups(popup).length,popup.length,'Different popup cities and their parent must survive')
    console.log(JSON.stringify(report,null,2))
  }
  console.log('PASS: edition/city/experience boundaries, 12-way atomic identity claims, stale update rejection, 5-way production ingestion, alias resolution, stable pagination')
}
main().catch(error=>{console.error(error);process.exitCode=1})
