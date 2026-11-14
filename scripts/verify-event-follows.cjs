const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm')
const model=require('../cloudfunctions/manageFollows/model')
const uiRoot=path.resolve(__dirname,'../miniprogram')
const card=fs.readFileSync(path.join(uiRoot,'components/event-card/event-card.wxml'),'utf8')
const detail=fs.readFileSync(path.join(uiRoot,'pages/detail/detail.wxml'),'utf8')
const follows=fs.readFileSync(path.join(uiRoot,'pages/follows/follows.wxml'),'utf8')
for(const text of [card,detail,follows]) assert.equal(/[☆★]/.test(text),false,'follow UI uses icon components, not text stars')
assert.ok(card.indexOf('catchtap="onFollowTap"')>card.indexOf('class="card-bottom"'),'card follow stays in bottom actions and prevents card navigation')
assert.ok(detail.indexOf('bindtap="onFollow"')>detail.indexOf('class="d-bottom-bar"'),'detail follow stays in fixed toolbar')
assert.ok(detail.includes('class="d-remind-title">开启提醒</text>'))
for(const p of ['components/event-card/event-card.json','pages/detail/detail.json','pages/follows/follows.json']) assert.ok(JSON.parse(fs.readFileSync(path.join(uiRoot,p),'utf8')).usingComponents['t-icon'])
const base={_id:'main',status:'published',title:'赛事',canonicalEventId:'stable',domain:'game',startTime:Date.now()+86400000,identityMembers:['main','old'],stages:[{key:'group',name:'小组赛',startTime:100},{key:'final',name:'决赛',startTime:200}],participationGuide:{location:'上海'}}
assert.equal(model.snapshot(base),model.snapshot({...base,fetchedAt:Date.now(),displayTitle:'赛事 · 决赛',currentStageName:'决赛',stages:base.stages.slice().reverse()}))
assert.notEqual(model.snapshot(base),model.snapshot({...base,participationGuide:{location:'北京'}}))
assert.notEqual(model.snapshot(base),model.snapshot({...base,stages:[{key:'group',startTime:300}]}))
assert.equal(model.matches({eventId:'old'},base),true)
assert.equal(model.matches({eventId:'other-city'},base),false)
const now=Date.parse('2026-09-29T13:00:00Z')
assert.equal(model.ended({startTime:Date.parse('2026-09-28T16:00:00Z'),timePrecision:'date'},now),false)
assert.equal(model.ended({startTime:Date.parse('2026-09-27T16:00:00Z'),timePrecision:'date'},now),true)
assert.equal(model.ended({startTime:1,timePrecision:'month_range'},now),false)
const tables={events:{main:base,old:{_id:'old',status:'merged',mergedInto:'main'}},users:{user:{_id:'user',_openid:'alice',preferredDomains:[{domain:'game',weight:3}],eventFollows:[]},stranger:{_id:'stranger',_openid:'bob',eventFollows:[{eventId:'secret'}]}}}
let openid='alice'
function collection(name){ return {
  doc(id){return {async get(){return {data:tables[name][id]}},async update({data}){Object.assign(tables[name][id],data)},async set({data}){tables[name][id]={_id:id,...data}}}},
  where(filter){return {limit(){return this},async get(){return {data:Object.values(tables[name]).filter(r=>Object.entries(filter).every(([k,v])=>r[k]===v))}}}}
} }
const db={collection,async runTransaction(fn){return fn({collection})}}
const cloud={init(){},database:()=>db,getWXContext:()=>({OPENID:openid}),async callFunction({name,data}){
  assert.equal(name,'getEvents','following must not request subscription/send APIs')
  const e=tables.events[data.id]
  return {result:{event:e && e.status==='merged' ? tables.events[e.mergedInto] : e || null}}
}}
const filename=path.resolve(__dirname,'../cloudfunctions/manageFollows/index.js'),mod={exports:{}},nativeRequire=require('module').createRequire(filename)
vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module:mod,exports:mod.exports,require:n=>n==='wx-server-sdk'?cloud:nativeRequire(n),console,Date,Set,process},{filename})
async function main(){
  const api=mod.exports
  openid='';assert.equal((await api.main({action:'list'})).error,'login required');openid='alice'
  await api.main({action:'set',eventId:'old',following:true})
  await api.main({action:'set',eventId:'main',following:true})
  assert.equal(tables.users.user.eventFollows.length,1)
  assert.equal(tables.users.user.preferredDomains[0].weight,3)
  assert.equal(tables.users.stranger.eventFollows.length,1)
  let result=await api.main({action:'list'})
  assert.equal(result.list.length,1);assert.equal(result.list[0].hasUpdate,false)
  assert.equal(result.list[0].intent,'interested','old follows default to interested')
  assert.equal((await api.main({action:'list',intent:'planned'})).list.length,0)
  await api.main({action:'intent',eventId:'old',intent:'planned'})
  await api.main({action:'set',eventId:'main',following:true})
  assert.equal((await api.main({action:'list',intent:'planned'})).list.length,1,'intent survives duplicate follow and alias')
  assert.equal((await api.main({action:'intent',eventId:'main',intent:'auto_register'})).error,'invalid intent')
  await api.main({action:'intent',eventId:'main',intent:'interested'})
  assert.equal((await api.main({action:'list',intent:'planned'})).list.length,0)
  const oldSnapshot=result.list[0].snapshot
  base.participationGuide.location='新场馆'
  result=await api.main({action:'list'});assert.equal(result.list[0].hasUpdate,true)
  await api.main({action:'seen',eventId:'main',snapshot:oldSnapshot})
  assert.equal((await api.main({action:'list'})).list[0].hasUpdate,true,'stale page cannot acknowledge newer facts')
  await api.main({action:'seen',eventId:'main',snapshot:result.list[0].snapshot})
  assert.equal((await api.main({action:'list'})).list[0].hasUpdate,false)
  assert.equal((await api.main({action:'set',eventId:'missing',following:true})).error,'event unavailable')
  await api.main({action:'set',eventId:'old',following:false});assert.equal(tables.users.user.eventFollows.length,0)
  openid='new-user';await api.main({action:'set',eventId:'main',following:true})
  assert.equal((await api.main({action:'status'})).records.length,1)
  const past={...base,_id:'past',canonicalEventId:'past',identityMembers:['past'],startTime:Date.now()-3*86400000,endTime:Date.now()-2*86400000}
  tables.events.past=past
  await api.main({action:'set',eventId:'past',following:true})
  const all=await api.main({action:'list',filter:'all'})
  assert.equal(all.list.length,2,'all follows retains ended and current records')
  assert.equal(all.list[all.list.length-1].agenda.key,'archive','archive follows current schedule')
  assert.equal((await api.main({action:'list',filter:'ended'})).list.length,1)
  assert.equal((await api.main({action:'list',filter:'active'})).list.length,1,'legacy active filter stays compatible')
  console.log('PASS: follows isolation, alias merge, idempotency, fact updates, acknowledgement, date boundaries, independent reminder/interest state')
}
main().catch(error=>{console.error(error);process.exitCode=1})
