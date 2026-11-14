const assert=require('assert/strict'),s=require('../cloudfunctions/fetchEvents/lib/game-news-source'),p=require('../cloudfunctions/fetchEvents/lib/publisher-sources'),{database}=require('./verify-event-write-quality')
const now=Date.parse('2026-10-30T09:00:00+08:00'),doc={description:'KPL荣耀之路快闪长沙站 活动时间2026年10月24日—11月8日；地点长沙。'},row={title:'KPL荣耀之路快闪长沙站',city:'长沙',domain:'game',confidence:.95,evidenceIndex:0,newsStartDate:'2026-10-24',newsEndDate:'2026-11-08',newsDateQuote:doc.description}
assert.equal(s.dateProof(row,doc,now),'supported');assert.equal(s.dateProof(row,doc,Date.parse('2026-11-09T00:00:00+08:00')),'expired')
assert.equal(s.dateProof({...row,newsDateQuote:'报名'+doc.description},{description:'报名'+doc.description},now),'unverified')
assert.equal(s.dateProof({...row,newsEndDate:'2026-11-09'},doc,now),'unverified')
assert.equal(s.dateProof({...row,newsDateQuote:'2026年10月24日发布 KPL荣耀之路快闪长沙站'},{description:'2026年10月24日发布 KPL荣耀之路快闪长沙站'},now),'unverified')
async function main(){const db=database(),id='publisher-pilot-17173-v1';db.records.eventCandidates[id]={_id:id,fingerprint:id,kind:'publisher_pilot_state',version:s.VERSION,parsedAt:now-1,documents:[doc],identities:[row]};let saves=0
 const deps={pageItem:p.pageItem,records:async()=>[],extract:()=>{throw Error('cache must avoid AI')},fetch:()=>{throw Error('cache must avoid network')},save:async()=>{saves++;return {discoveredCandidates:1}}}
 const before=JSON.stringify(db.records);const preview=await s.run(db,now,{preview:true},deps);assert.equal(preview.titles.length,1);assert.equal(JSON.stringify(db.records),before);assert.equal(saves,0)
 const applied=await s.run(db,now,{preview:false},deps);assert.equal(applied.queued,1);assert.equal(saves,1);assert.equal(db.state.eventWrites,0)
 const repeat=await s.run(db,now+1,{preview:false},deps);assert(repeat.skipped);assert.equal(saves,1)
 const known=await s.run(db,now+2,{preview:true},{...deps,records:async()=>[{title:row.title,city:row.city,status:'published'}]});assert.equal(known.known,1)
 console.log('PASS: date evidence, expiry, wrong dates/registration isolated; preview no writes, cached enqueue, repeat throttle, known records, zero formal-event writes')}
main().catch(e=>{console.error(e);process.exitCode=1})

