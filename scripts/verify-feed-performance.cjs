const assert = require('assert/strict')
const fs = require('fs'), vm = require('vm'), path = require('path')
const { feedCard } = require('../cloudfunctions/getEvents/feed-card')
const cache = require('../miniprogram/utils/feed-cache')
const full = {_id:'a', canonicalEventId:'a', title:'2026赛事', domain:'game', city:'上海', startTime:100,
  participation:{type:'offline',note:'现场观赛'},participationOptions:[{type:'livestream',url:'https://example.com'}],
  source:{name:'官网',url:'https://example.com'}, evidence:'x'.repeat(10000), participationGuide:{steps:['x'.repeat(10000)]}}
const card = feedCard(full)
assert.equal(card._cardOnly, true)
assert.equal(card.canonicalEventId, full.canonicalEventId)
assert.equal(card.participationOptions[0].type,'livestream')
assert.equal(card.evidence, undefined)
assert.equal(card.participationGuide, undefined)
assert(JSON.stringify(card).length < JSON.stringify(full).length / 10)
assert.equal(full.evidence.length,10000,'projection must not mutate the original')
const id = cache.key('all','comprehensive','prefs')
const version = cache.version()
cache.write(id,{list:[card]},version,1000)
assert(cache.read(id,2000))
assert.equal(cache.read(id,92000),null)
cache.write(id,{list:[card]},version,1000)
cache.invalidate()
cache.write(id,{list:[card]},version,1100)
assert.equal(cache.read(id,2000),null,'in-flight pre-feedback response cannot restore old cache')
assert.notEqual(id,cache.key('all','comprehensive','different prefs'))
let config
let responseResolve
const api = { getEvents: () => new Promise(resolve => {responseResolve=resolve}) }
const filename=path.resolve(__dirname,'../miniprogram/pages/home/home.js')
vm.runInNewContext(fs.readFileSync(filename,'utf8'),{
  Page(c){config=c}, wx:{getStorageSync:()=>true,setStorageSync(){},showToast(){}}, console, Date,
  require(name){
    if(name==='dayjs')return require('../miniprogram/node_modules/dayjs')
    if(name==='../../utils/constants')return {DOMAINS:[],DOMAIN_MAP:{},STORAGE_KEYS:{}}
    if(name==='../../utils/api')return api
    if(name==='../../utils/feed-cache')return cache
    if(name==='../../utils/follow-interaction')return require('../miniprogram/utils/follow-interaction')
    if(name==='../../utils/event-time-policy')return require('../miniprogram/utils/event-time-policy')
    if(name==='../../utils/content')return {simplifyEvent:e=>e,isDateOnly:e=>e.timePrecision==='date',mergeUniqueEvents:(a,b)=>a.concat(b)}
    throw Error(name)
  },clearTimeout,setTimeout
})
const patches=[]
const page=Object.assign({},config,{data:{...config.data},setData(patch,callback){patches.push(patch);for(const [key,value]of Object.entries(patch))if(!key.startsWith('list['))this.data[key]=value;if(callback)callback()},trackImpressions(){}})
page.data.latestFetchedAt=Date.now()
page.data.list=[{title:'线下活动',startTime:Date.now()+86400000,timePrecision:'date',_countdownText:'old'}]
page.tickUpdatedText()
assert.equal(patches.at(-1).list,undefined,'timer must not resend whole list')
assert(patches.at(-1)['list[0]._countdownText'])
async function main(){
  const cacheId=cache.key('all','comprehensive',page.getPreferenceSignature())
  cache.write(cacheId,{list:[card],feedOrder:['a'],nextCursor:null,serverTime:Date.now()},cache.version())
  const loading=page.loadEvents(true)
  assert.equal(page.data.loading,false,'warm navigation renders cache without waiting for network')
  assert.equal(page.data.list[0]._id,'a')
  const oldRequest=page.requestId
  await page.loadEvents(false,true)
  assert.equal(page.requestId,oldRequest,'pagination waits for cache revalidation')
  responseResolve({list:[{...card,_id:'fresh'}],feedOrder:['fresh'],nextCursor:null,serverTime:Date.now()})
  await loading
  assert.equal(page.data.list[0]._id,'fresh')
  assert.equal(page.feedRefreshing,false)
  console.log('PASS: compact cards, immutable full details, context/TTL/invalidation, cache revalidation, pagination guard and partial countdown updates')
}
main().catch(error=>{console.error(error);process.exitCode=1})
