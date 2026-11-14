const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm')
const event={_id:'main',status:'published',title:'测试活动',startTime:Date.now()+86400000,domain:'game',identityMembers:['main','old']}
const records={events:{main:event,old:{_id:'old',status:'merged',mergedInto:'main'}},subscriptions:{
  quota:{_id:'quota',_openid:'user',eventId:'old',remainCount:3,kind:'event'},
  radar:{_id:'radar',_openid:'user',anchorEventId:'old',remainCount:2,kind:'radar'},
  stranger:{_id:'stranger',_openid:'other',eventId:'old',remainCount:7,kind:'event'}
}}
const db={command:{in:values=>({values})},collection(name){return {
  doc(id){return {async get(){return {data:records[name][id]}},async update({data}){Object.assign(records[name][id],data)}}},
  where(filter){return {limit(){return this},async get(){return {data:Object.values(records[name]).filter(row=>Object.entries(filter).every(([k,v])=>v && v.values ? v.values.includes(row[k]) : row[k]===v))}}}},
  async add(){throw Error('Must reuse existing alias subscription')}
}}}
const cloud={init(){},database:()=>db,getWXContext:()=>({OPENID:'user'})}
function load(file,extra='') {
  const filename=path.resolve(__dirname,'../cloudfunctions',file),mod={exports:{}}
  const nativeRequire=require('module').createRequire(filename)
  vm.runInNewContext(fs.readFileSync(filename,'utf8')+extra,{module:mod,exports:mod.exports,process,console,Date,URL,
    require:n=>n==='wx-server-sdk'?cloud:n==='opencc-js'?{Converter:()=>value=>value}:nativeRequire(n)},{filename})
  return mod.exports
}
async function main() {
  const quota=load('addSubscriptionQuota/index.js')
  assert.equal((await quota.main({eventId:'old'})).ok,true)
  assert.equal(records.subscriptions.quota.eventId,'main')
  assert.equal(records.subscriptions.quota.remainCount,4)
  assert.equal(records.subscriptions.stranger.remainCount,7)
  assert.equal((await quota.main({kind:'radar',anchorEventId:'old',explicitConsent:true,grantQuota:false})).ok,true)
  assert.equal(records.subscriptions.radar.anchorEventId,'main')
  assert.equal(records.subscriptions.radar.remainCount,2)
  const reminders=load('sendSubscribeMessages/index.js','\nmodule.exports.test={findSubs}')
  const matched=await reminders.test.findSubs(event,'soon',[{eventId:'old',_openid:'user'},{eventId:'unrelated',_openid:'user'}])
  assert.equal(matched.length,1)
  assert.equal(matched[0].sub.eventId,'old')
  console.log('PASS: old event/radar quota is reused, quota preserved, other user isolated, reminder resolves alias')
}
main().catch(error=>{console.error(error);process.exitCode=1})
