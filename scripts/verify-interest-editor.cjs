const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm')
const file=path.resolve(__dirname,'../miniprogram/pages/interest-editor/interest-editor.js')
const nativeRequire=require('module').createRequire(file)
const {STORAGE_KEYS}=nativeRequire('../../utils/constants')
const initialTopics=[{domain:'game',key:'valorant',label:'无畏契约',weight:2}]
const storage=new Map([
  [STORAGE_KEYS.preferredDomains,[{domain:'game',weight:2},{domain:'tech',weight:1}]],
  [STORAGE_KEYS.preferredTopics,initialTopics],
  [STORAGE_KEYS.preferredFormats,['offline']],[STORAGE_KEYS.preferredCities,['上海']],[STORAGE_KEYS.growthGoals,['employment']]
])
const calls=[],toasts=[];let backs=0,fail=false,page
const wx={getStorageSync:key=>storage.get(key),setStorageSync:(key,value)=>storage.set(key,value),removeStorageSync:key=>storage.delete(key),navigateBack:()=>backs++,showToast:value=>toasts.push(value)}
const api={async updatePreference(value){calls.push(value);if(fail)throw Error('offline')}}
vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:value=>page=value,require:name=>name==='../../utils/api'?api:nativeRequire(name),wx,console})
function instance(){return {...page,data:JSON.parse(JSON.stringify(page.data)),setData(value){Object.assign(this.data,value)}}}
async function main(){
  const p=instance();p.onLoad()
  assert.equal(p.data.activeDomain,'tech') // Uses taxonomy order, not storage order.
  assert.equal(p.data.selectedViews[0].label,'无畏契约')
  p.onDomainTap({currentTarget:{dataset:{domain:'game'}}})
  const toggle=(domain,key)=>p.onTopicTap({currentTarget:{dataset:{domain,key}}})
  toggle('game','valorant');assert.equal(p.data.selectedTopics.length,0)
  toggle('game','valorant');assert.equal(p.data.selectedTopics.length,1)
  p.onDomainTap({currentTarget:{dataset:{domain:'tech'}}})
  toggle('tech','hackathon');assert.equal(p.data.selectedTopics.length,2)
  assert.equal(storage.get(STORAGE_KEYS.preferredTopics).length,1,'edits remain local until save')
  assert.equal(p.data.dirty,true)
  await p.onSave()
  assert.equal(backs,1);assert.equal(calls.length,1)
  assert.equal(calls[0].preferredDomains.find(item=>item.domain==='game').weight,2)
  assert.deepEqual(Array.from(calls[0].preferredFormats),['offline'])
  assert.equal(storage.get(STORAGE_KEYS.preferredTopics).length,2)
  assert.equal(storage.has('preferenceSyncPending'),false)
  const again=instance();again.onLoad()
  again.onTopicTap({currentTarget:{dataset:{domain:'tech',key:'hackathon'}}})
  fail=true;await again.onSave()
  assert.equal(storage.get('preferenceSyncPending'),true)
  assert.equal(storage.get(STORAGE_KEYS.preferredTopics).length,1)
  const retry=instance();retry.onLoad();assert.equal(retry.data.syncPending,true)
  fail=false;await retry.onSave();assert.equal(storage.has('preferenceSyncPending'),false)
  const wxml=fs.readFileSync(path.join(path.dirname(file),'interest-editor.wxml'),'utf8')
  assert.ok(wxml.includes('bindtap="onTopicTap"'))
  const preferenceWxml=fs.readFileSync(path.resolve(__dirname,'../miniprogram/pages/subscribe/subscribe.wxml'),'utf8')
  assert.ok(preferenceWxml.includes('<view class="topic-surface">'),'topic surface does not act as a hidden navigation target')
  assert.ok(preferenceWxml.includes('class="topic-add" bindtap="onEditInterests"'))
  console.log('PASS: focused topic edit, no write before save, preserves domain weights and other preferences, offline retry')
}
main().catch(error=>{console.error(error);process.exitCode=1})
