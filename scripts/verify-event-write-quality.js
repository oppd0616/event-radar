const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { inspectEventWrite, createEventWriter } = require('../cloudfunctions/fetchEvents/lib/event-write-quality')
const start = Date.parse('2026-10-01T19:00:00+08:00')
const base = { title: '中文活动🎉', domain: 'culture', startTime: start, endTime: start + 3600000,
  timePrecision: 'datetime', endTimePrecision: 'datetime', summary: '正常中文', status: 'published',
  confidence: 0.95, participation: { type: 'offline' }, participationGuide: { location: '上海展览馆' },
  source: { name: '主办方', url: 'https://example.com/event' } }
const clone = value => structuredClone(value)

// A deliberately small SDK fake: recursive updates fail for a null parent,
// while command.set replaces it. This reproduces the production SDK failure.
function database(initial = {}) {
  const records = { events: clone(initial), eventCandidates: {} }
  const state = { eventWrites: 0, onRead: null, failures: 0, inTransaction:false }
  let pending=Promise.resolve()
  function update(record, data) {
    for (const [key,value] of Object.entries(data)) {
      if(value && value.__replace) record[key]=clone(value.value)
      else if(value && typeof value==='object' && !Array.isArray(value)) {
        if(record[key]===null) throw new Error('Cannot create field in null parent')
        record[key]=Object.assign(record[key] || {},clone(value))
      } else record[key]=clone(value)
    }
  }
  const db = { command: { set: value=>({__replace:true,value}) }, records, state,
    runTransaction(callback) {
      const run=pending.then(async()=>{
        const before=clone(records)
        state.inTransaction=true
        try { return await callback(db) }
        catch(error) { Object.assign(records,before); throw error }
        finally { state.inTransaction=false }
      })
      pending=run.catch(()=>{})
      return run
    },
    collection(name) {
      const table=records[name]
      return {
        doc(id) { return {
          async get() {
            if(!state.inTransaction && name==='events' && state.failures>0) { state.failures--; throw new Error('transient read failure') }
            if(!state.inTransaction && name==='events' && state.onRead && table[id]) state.onRead(table[id])
            return {data:clone(table[id])}
          },
          async set({data}) {
            if(name==='eventCandidates' && Object.values(table).some(row=>row._id!==id && (row.fingerprint||null)===(data.fingerprint||null)))throw Error('duplicate key fingerprint')
            table[id]={...clone(data),_id:id}; if(name==='events') state.eventWrites++
          },
          async update({data}) { if(state.failAlias && data.status==='merged')throw Error('simulated alias write failure'); update(table[id],data); if(name==='events') state.eventWrites++ }
        } },
        where(filter) { return {
          limit() { return this }, skip() { return this },
          async get() { return {data:Object.values(table).filter(row=>Object.entries(filter).every(([k,v])=>row[k]===v)).map(clone)} },
          async update({data}) { for(const row of Object.values(table)) if(Object.entries(filter).every(([k,v])=>row[k]===v)) update(row,data) }
        } },
        skip() { return this }, limit() { return this }, orderBy() { return this },
        async get() { return {data:Object.values(table).map(clone)} }
      }
    }
  }
  return db
}
function helpers(db) {
  const filename=path.resolve(__dirname,'../cloudfunctions/fetchEvents/index.js')
  const mod={exports:{}}
  vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.test={saveEvents,repairDuplicateEvents,repairStageTimeInvariants,writeEventPatch}',{
    module:mod,exports:mod.exports, require:name=>name==='wx-server-sdk'
      ? {init(){},database:()=>db,getWXContext:()=>({})}
      : name.startsWith('.') ? require(path.resolve(path.dirname(filename),name)) : require(name),
    process, console, Buffer, URL, setTimeout,clearTimeout
  },{filename})
  return mod.exports.test
}
async function main() {
  assert.deepEqual(inspectEventWrite(base),[])
  for(const bad of ['坏\uFFFD字','坏\uD800字','坏\uDC00字','坏\u0000字']) {
    assert(inspectEventWrite({...base,summary:bad}).includes('broken_encoding:summary'))
    assert(inspectEventWrite({...base,participationGuide:{location:bad}}).includes('broken_encoding:participationGuide.location'))
    assert(inspectEventWrite({...base,stages:[{name:bad,startTime:start}]}).includes('broken_encoding:stages.0.name'))
  }
  assert.deepEqual(inspectEventWrite({...base,summary:' café 中文\n换行\t🎉',fieldReview:{archived:'坏\uFFFD'}}),[])
  assert(inspectEventWrite({...base,endTime:start-86400000}).includes('end_before_start:event'))
  assert(inspectEventWrite({...base,startTime:Infinity}).includes('invalid_date:event.startTime'))
  assert.deepEqual(inspectEventWrite({...base,endTime:Date.parse('2026-10-01T00:00:00+08:00'),endTimePrecision:'date'}),[])
  assert(inspectEventWrite({...base,participationGuide:{accessStartTime:start}}).includes('accessStartTime_audience_unverified'))
  assert.deepEqual(inspectEventWrite({...base,title:'某大会分论坛',startTimeSource:{title:'某大会分论坛'}}),[])
  assert(inspectEventWrite({...base,startTimeSource:{title:'某大会分论坛'}}).includes('startTime_child_event_evidence'))
  assert(inspectEventWrite({...base,stages:[null]}).includes('invalid_stage:0'))

  const db=database({old:{...clone(base),_id:'old',academicValue:null}})
  const write=createEventWriter(db)
  const bad={...base,summary:'坏\uFFFD字'}
  assert.equal((await write('new',bad,null,'insert')).written,false)
  assert.equal((await write('old',bad,{summary:bad.summary},'update')).written,false)
  assert.equal(db.state.eventWrites,0)
  assert.equal(db.records.events.old.summary,base.summary)
  assert.equal(Object.keys(db.records.eventCandidates).length,2)
  assert.equal((await write('new',base,null,'insert')).verified,true)
  const patch={academicValue:{suitableMajors:['计算机']},participationGuide:{location:'新地点'}}
  // A distinct event, so its identity does not conflict with the earlier insert.
  db.records.events.old.title='另一场中文展览'
  assert.equal((await write('old',{...db.records.events.old,...patch},patch,'update')).verified,true)
  assert.deepEqual(db.records.events.old.academicValue,{suitableMajors:['计算机']})
  db.state.failures=1
  assert.equal((await write('retry',{...base,title:'重试活动'},null,'insert')).verified,true)
  db.state.onRead=record=>{record.summary='unexpected mutation'}
  assert.equal((await write('mismatch',{...base,title:'回读活动'},null,'insert')).written,false)
  assert.equal(db.records.events.mismatch.status,'quarantined')
  db.state.onRead=record=>{record.writeQualityToken='another-writer';record.summary='newer valid text'}
  assert.equal((await write('race',{...base,title:'并发活动'},null,'insert')).issues[0],'write_superseded')
  assert.equal(db.records.events.race.status,'published')

  // Exercise actual production call sites, not just the standalone validator.
  const normalDb=database()
  const h=helpers(normalDb)
  const stats=await h.saveEvents([clone(base)],start-86400000)
  assert.equal(stats.inserted,1)
  const old=Object.values(normalDb.records.events)[0]
  const update=await h.saveEvents([{...clone(base),summary:'更新的中文介绍'}],start-86400000,old._id)
  assert.equal(update.updated,1)
  const blockedDb=database()
  const blocked=await helpers(blockedDb).saveEvents([{...clone(base),participationGuide:{location:'场馆\uFFFD'}}],start-86400000)
  assert.equal(blocked.inserted,0)
  assert.equal(blockedDb.state.eventWrites,0)
  const dupDb=database({a:{...clone(base),_id:'a',title:'测试展览',summary:'乱码\uFFFD'},b:{...clone(base),_id:'b',title:'测试展览',summary:'乱码\uFFFD'}})
  const dedupe=await helpers(dupDb).repairDuplicateEvents(100)
  assert.equal(dedupe.duplicateGroups,1)
  assert.equal(dedupe.mergedGroups,0)
  assert.equal(dupDb.records.events.b.status,'published')
  assert.equal(dupDb.state.eventWrites,0)
  const validDupDb=database({a:{...clone(base),_id:'a'},b:{...clone(base),_id:'b'}})
  const validDedupe=await helpers(validDupDb).repairDuplicateEvents(100)
  assert.equal(validDedupe.mergedGroups,1)
  assert.equal(Object.values(validDupDb.records.events).filter(row=>row.status==='merged').length,1)
  const repairDb=database({a:{...clone(base),_id:'a',stages:[{name:'阶段',startTime:start,endTime:start-86400000}]}})
  const repair=await helpers(repairDb).repairStageTimeInvariants(100)
  assert.equal(repair.repairedRecords,1)
  assert.equal(repairDb.records.events.a.stages[0].endTime,0)
  console.log('PASS: encoding, date/scope checks, quarantine, null-parent replacement, readback/race, production insert/update/dedupe/stage repair')
}
module.exports={database,helpers,base}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1})
