const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm')
const learning = require('../shared/recommendation-learning')
const h = require('./audit-recommendation-ranking.cjs').loadHelpers()
const now = Date.parse('2026-09-30T12:00:00+08:00')
const prefs = {preferredDomains:[{domain:'game',weight:3}],preferredTopics:[{domain:'game',key:'valorant',label:'无畏契约',weight:3}],preferredCities:['上海'],recentSignals:[],growthGoals:[]}
const event = {_id:'a',title:'2026无畏契约体验赛',domain:'game',city:'上海',topicKeys:['valorant'],tags:['无畏契约'],startTime:now+86400000,endTime:now+2*86400000,confidence:0.95,participation:{type:'offline'}}
const signal = {eventId:'a',action:'view',domain:'game',topicKeys:['valorant'],tags:['无畏契约'],city:'上海'}
function apply(user, s, at=now, expected) { return {...user,...learning.updateLearning(user,s,at,expected).data} }
let user = {preferredTopics:prefs.preferredTopics,learnedTopicKeyWeights:{auto_show:12},learnedDomainWeights:{auto:12},recentSignals:[]}
user=apply(user,signal)
assert.equal(user.learningVersion,2)
assert.equal(Object.keys(user.learnedTopicKeyWeights).length,0,'legacy browse weights must not survive migration')
for(let i=1;i<20;i++) user=apply(user,{...signal,eventId:'weak-'+i},now+i*1000)
assert.equal(Object.keys(user.learnedTopicKeyWeights).length,0,'casual browsing must not accumulate permanent interests')
user=apply(user,{...signal,action:'follow'},now+21000)
assert.equal(user.learnedTopicKeyWeights.valorant,5)
assert(user.learnedDomainWeights.game<1,'specific follow only weakly generalizes to the whole domain')
assert.equal(learning.updateLearning(user,{...signal,action:'follow'},now+22000).duplicated,true)
const negative=apply(user,{...signal,eventId:'negative',action:'dislike'},now+23000)
const undone=learning.updateLearning(negative,{...signal,eventId:'negative',action:'undo_feedback'},now+24000,now+23000)
assert.equal(undone.duplicated,false)
assert(Math.abs(undone.data.learnedTopicKeyWeights.valorant-user.learnedTopicKeyWeights.valorant)<0.001)
assert.equal(undone.data.recentSignals.some(s=>s.eventId==='negative'),false)
assert.equal(learning.updateLearning(negative,{...signal,eventId:'other',action:'undo_feedback'},now+24000,now+23000).duplicated,true)
const saturated={learningVersion:2,learningUpdatedAt:now,recentSignals:[],learnedTopicKeyWeights:{valorant:-5.9}}
const atCap=apply(saturated,{...signal,action:'dislike'})
const revert=learning.updateLearning(atCap,{...signal,action:'undo_feedback'},now,now)
assert.equal(revert.data.learnedTopicKeyWeights.valorant,-5.9,'undo restores the actual delta even at a weight cap')
for(const action of ['hide','location_mismatch']) {
  const next=apply(user,{...signal,eventId:action,action},now+25000)
  assert(Math.abs(next.learnedTopicKeyWeights.valorant-user.learnedTopicKeyWeights.valorant)<0.001)
  assert(next.recentSignals.some(s=>s.action===action))
}
const current=h.prepare(prefs,now)
const unrelated={...event,_id:'unrelated',title:'高热度汽车展',domain:'auto',topicKeys:['auto_show'],tags:[],isHot:true}
assert(h.computeScore(event,current,now)>h.computeScore(unrelated,current,now)+0.2)
assert.equal(h.cityScore(event,['上海']),1)
assert.equal(h.cityScore({...event,city:'北京'},['上海']),0.15)
assert.equal(h.cityScore({...event,city:'北京',participation:{type:'registration'}},['上海']),0.15,'online registration is not online attendance')
assert.equal(h.cityScore({...event,city:'北京',participationOptions:[{type:'livestream'}]},['线上']),1)
const locationSignal={...signal,action:'location_mismatch',at:now}
assert.equal(h.feedbackPenalty(event,[locationSignal],now),0.18)
assert.equal(h.feedbackPenalty({...event,participation:{type:'livestream'}},[locationSignal],now),0)
assert.equal(h.feedbackPenalty({...event,city:'北京'},[locationSignal],now),0)
const topicSignal={...signal,action:'dislike',at:now}
assert.equal(h.feedbackPenalty(event,[topicSignal],now),0.25)
assert.equal(h.feedbackPenalty({...event,title:'英雄联盟赛事',topicKeys:['lol'],tags:[]},[topicSignal],now),0)
const list=[event,{...event,_id:'b',title:'无畏契约线下体验日'},unrelated].map(e=>({...e,_score:h.computeScore(e,current,now)})).sort((a,b)=>b._score-a._score)
assert.deepEqual(Array.from(h.multiRouteBlend(list,current),e=>e._id),['a','b','unrelated'],'same-domain interests can remain consecutive')
assert.equal(h.topicMatches({title:'training workshop',domain:'tech',topicKeys:[]},{key:'ai',label:'AI'}),false)
assert.equal(h.topicMatches({title:'黑客松',domain:'tech',topicKeys:['hackathon']},{key:'hackathon',domain:'academic'}),true,'shared interests work across domains')
const related=h.recommendReason({title:'开发者黑客松',domain:'tech',topicKeys:['hackathon']},{preferredTopics:[{key:'ai',label:'AI',weight:3}]})
assert(related.includes('相关'))
const {paginate}=require('../cloudfunctions/getEvents/feed-pagination')
const first=paginate(list,null,0,1),second=paginate(list.slice().reverse(),first.feedOrder,1,2)
assert.equal(new Set(first.list.concat(second.list).map(e=>e._id)).size,3)

async function serverVerification() {
  const table={users:{u:{_id:'u',_openid:'alice',personalizationEnabled:true,preferredTopics:prefs.preferredTopics,eventFollows:[{eventId:'a'}],learnedTopicKeyWeights:{auto_show:12},learnedDomainWeights:{auto:12},recentSignals:[]}},events:{a:event},behaviorLogs:[]}
  const collection=name=>({
    doc:id=>({async get(){return {data:table[name][id]}},async set({data}){table[name][id]={_id:id,...data}},async update({data}){Object.assign(table[name][id],data)}}),
    where:filter=>({limit(){return this},async get(){return {data:Object.values(table[name]).filter(r=>Object.entries(filter).every(([k,v])=>r[k]===v))}},async remove(){return {stats:{removed:0}}}}),
    async add({data}){table[name].push(data)},limit(){return {async get(){return {data:[]}}}}
  })
  const db={collection,command:{inc:n=>n,lt:n=>n},runTransaction:async fn=>fn({collection})}
  const cloud={init(){},database:()=>db,getWXContext:()=>({OPENID:'alice'})}
  const load=(name)=>{const filename=path.resolve(__dirname,'../cloudfunctions/'+name+'/index.js'),mod={exports:{}},r=require('module').createRequire(filename);vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module:mod,exports:mod.exports,require:n=>n==='wx-server-sdk'?cloud:r(n),console,Date,Set,Map,process},{filename});return mod.exports}
  const api=load('recordSignal')
  assert.equal((await api.main({eventId:'a',action:'view'})).ok,true)
  assert.equal(table.users.u.learnedTopicKeyWeights.auto_show,undefined,'persisted migration replaces stale map entries')
  await api.main({eventId:'a',action:'follow'})
  assert.equal(table.users.u.learnedTopicKeyWeights.valorant,5)
  assert.equal(table.users.u.eventFollows.length,1)
  const feedback=await api.main({eventId:'a',action:'dislike'})
  assert(feedback.feedbackAt)
  assert.equal((await api.main({eventId:'a',action:'undo_feedback',feedbackAt:feedback.feedbackAt})).ok,true)
  assert(Math.abs(table.users.u.learnedTopicKeyWeights.valorant-5)<0.001)
  table.users.u.personalizationEnabled=false
  const before=JSON.stringify(table.users.u)
  assert.equal((await api.main({eventId:'a',action:'location_mismatch'})).skipped,'personalization_disabled')
  assert.equal(JSON.stringify(table.users.u),before)
  await load('updatePreference').main({privacyAction:'clearRecommendationData'})
  assert.equal(Object.keys(table.users.u.learnedTopicKeyWeights).length,0)
  assert.equal(table.users.u.preferredTopics.length,1)
  assert.equal(table.users.u.eventFollows.length,1)
  assert.equal(table.users.u.personalizationEnabled,false)
}
async function clientVerification() {
  const calls=[],filename=path.resolve(__dirname,'../miniprogram/utils/api.js'),mod={exports:{}},r=require('module').createRequire(filename)
  let disabled=false
  const wx={getStorageSync:()=>disabled?false:true,cloud:{callFunction:input=>{calls.push(input);input.success({result:input.name==='manageFollows'?{ok:true,eventId:'canonical'}:{ok:true}})}}}
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module:mod,exports:mod.exports,require:r,wx,getApp:()=>({globalData:{useMock:false}}),console},{filename})
  await mod.exports.setFollow('alias',true)
  assert.equal(calls[1].name,'recordSignal');assert.equal(calls[1].data.eventId,'canonical');assert.equal(calls[1].data.action,'follow')
  calls.length=0;await mod.exports.setFollow('alias',false);assert.equal(calls.length,1)
  disabled=true;calls.length=0;await mod.exports.setFollow('alias',true);assert.equal(calls.length,1)
}
async function homeVerification() {
  let page, sheet, observed, exposureCount=0
  const signals=[]
  const api={recordSignal:async(id,action,extra)=>{signals.push({id,action,extra});return {ok:true,feedbackAt:123}},recordImpressions:async()=>{exposureCount++},getEvents:async()=>({list:[{_id:'c'}],nextCursor:null})}
  const wx={showActionSheet:options=>{sheet=options},getStorageSync:()=>true,setStorageSync(){},showToast(){},createIntersectionObserver:()=>({disconnect(){},relativeToViewport(){return this},observe(selector,fn){observed=fn}})}
  const filename=path.resolve(__dirname,'../miniprogram/pages/home/home.js')
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:n=>n.endsWith('/feed-cache')?require('../miniprogram/utils/feed-cache'):n.endsWith('/api')?api:n.endsWith('/constants')?{DOMAINS:[],DOMAIN_MAP:{},STORAGE_KEYS:{personalizationEnabled:'personalizationEnabled'}}:n.endsWith('/content')?{mergeUniqueEvents:(a,b)=>a.concat(b)}:{},Page:definition=>{page=definition},wx,console,Date,setTimeout:()=>1,clearTimeout(){}})
  page.data={...page.data,list:[{_id:'a'},{_id:'b'}],sortMode:'comprehensive',activeTab:'all',loading:false,loadingMore:false}
  page.setData=(data,callback)=>{Object.assign(page.data,data);if(callback)callback()}
  page.decorate=x=>x;page.tickUpdatedText=()=>{}
  page.requestId=1;page.feedGeneration=1
  page.trackImpressions()
  observed({dataset:{eventId:'a'},intersectionRatio:0.1});assert.equal(exposureCount,0)
  observed({dataset:{eventId:'a'},intersectionRatio:0.8});observed({dataset:{eventId:'a'},intersectionRatio:0.8});assert.equal(exposureCount,1)
  page.onCardMore({detail:{event:page.data.list[0]}});await sheet.success({tapIndex:1})
  assert.equal(signals[0].action,'dislike');assert.equal(page.data.list.length,1)
  await page.loadEvents(false,true)
  await page.onUndoFeedback()
  assert.equal(signals[1].action,'undo_feedback');assert.deepEqual(Array.from(page.data.list,item=>item._id),['a','b','c'])
}
Promise.resolve().then(serverVerification).then(clientVerification).then(homeVerification).then(()=>console.log('PASS: relevance, adjacent exploration, city/online fit, weak/strong learning, migration, scoped feedback, exact undo, privacy, follow feedback, viewport exposure and undo after pagination')).catch(e=>{console.error(e);process.exitCode=1})
