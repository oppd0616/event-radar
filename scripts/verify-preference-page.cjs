const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm')
const file=path.resolve(__dirname,'../miniprogram/pages/subscribe/subscribe.js'),nativeRequire=require('module').createRequire(file)
const {STORAGE_KEYS,SUBSCRIBE_TEMPLATE_ID}=nativeRequire('../../utils/constants')
const storage=new Map([[STORAGE_KEYS.preferredDomains,[{domain:'game',weight:2}]], [STORAGE_KEYS.preferredTopics,[{domain:'game',key:'valorant',label:'无畏契约'}]]]),toasts=[],modals=[],grants=[]
let page,saveFail=false,saves=[],quotas=0,loader=()=>Promise.resolve({list:[{_id:'a',status:'active',remainCount:3,domain:'all'},{_id:'b',status:'exhausted',remainCount:0},{_id:'r',kind:'radar',status:'active',remainCount:10}]})
const api={getSubscriptions:()=>loader(),async updatePreference(p){saves.push(p);if(saveFail)throw Error('offline')},async updatePrivacy(){},async addSubscriptionQuota(){quotas++}}
const wx={getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),showToast:x=>toasts.push(x),showModal:x=>modals.push(x),requestSubscribeMessage:x=>grants.push(x),navigateTo(){},clearStorageSync(){throw Error('Must not delete data without confirmation')}}
vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:x=>{page=x},require:n=>n==='../../utils/api'?api:nativeRequire(n),wx,console:{warn(){},error(){}},Promise})
function instance(){return {...page,data:JSON.parse(JSON.stringify(page.data)),setData(v){Object.assign(this.data,v)}}}
async function main(){
  const p=instance();p.onLoad()
  for (const domain of p.data.domains) {
    const icon=fs.readFileSync(path.resolve(__dirname,'../miniprogram' + domain.icon))
    assert.equal(icon.subarray(1,4).toString(),'PNG','each preference points to a packaged image')
    const svg=fs.readFileSync(path.resolve(__dirname,'../miniprogram/assets/preference-domains/' + domain.key + '.svg'),'utf8')
    assert.ok(svg.includes('viewBox="0 0 24 24"'))
    assert.equal(/<script|https?:\/\/(?!www\.w3\.org)/.test(svg),false)
  }
  assert.equal(p.data.selectedDomainCount,1);assert.equal(p.data.domains.length,9);assert.equal(p.data.selectedDomains[0].label,'游戏');assert.equal(p.data.topicPreview[0].label,'无畏契约')
  p.onToggleDomainEdit();assert.equal(p.data.editingDomains,true);assert.equal(p.data.activeEditDomain,'game')
  const index=p.data.domains.findIndex(d=>d.key==='game')
  const choose=value=>p.onWeightChange({currentTarget:{dataset:{index}},detail:{value}})
  choose('3');assert.equal(p.data.domains[index].weight,3);assert.equal(p.data.saveState,'dirty')
  p.onEditInterests();assert.equal(toasts[toasts.length-1].title,'请先保存领域偏好')
  choose('0');assert.equal(p.data.domains[index].weight,0);assert.equal(p.data.selectedDomainCount,0)
  choose('2');assert.equal(p.data.saveState,'clean')
  p.onEditDomainTap({currentTarget:{dataset:{key:'tech'}}});assert.equal(p.data.activeEditDomain,'tech');assert.equal(p.data.domains.find(d=>d.key==='tech').weight,2)
  p.onSelectWeight({currentTarget:{dataset:{weight:3}}});assert.equal(p.data.domains.find(d=>d.key==='tech').weight,3)
  p.onToggleDomainEdit();assert.equal(p.data.editingDomains,false);assert.equal(p.data.selectedDomains.length,1,'cancel discards unsaved selection')
  choose('4');choose('bad');assert.equal(p.data.domains[index].weight,2,'invalid picker input is ignored')
  p.setData({saving:true});choose('1');assert.equal(p.data.domains[index].weight,2);p.setData({saving:false})
  saveFail=true;await p.onSave();assert.equal(p.data.saveState,'local');assert.equal(storage.get('preferenceSyncPending'),true)
  const again=instance();again.onLoad();assert.equal(again.data.saveState,'local','pending cloud sync survives page restart')
  saveFail=false;await again.onSave();assert.equal(again.data.saveState,'saved');assert.equal(storage.has('preferenceSyncPending'),false)
  assert.equal(saves[0].preferredDomains[0].weight,2)
  await p.loadSubscriptions();assert.equal(p.data.subscriptions.length,2);assert.equal(p.data.reminderQuota,3);assert.equal(p.data.subscriptionsError,false)
  loader=()=>Promise.reject(Error('offline'));await p.loadSubscriptions();assert.equal(p.data.subscriptionsError,true);assert.equal(p.data.subscriptionsLoading,false)
  let resolve;loader=()=>new Promise(r=>{resolve=r});const pending=p.loadSubscriptions()
  await p.onPersonalizationChange({detail:{value:false}});resolve({list:[],personalizationEnabled:true});await pending
  assert.equal(p.data.personalizationEnabled,false,'stale subscription response cannot undo privacy choice')
  p.onSubscribeAll();p.onSubscribeAll();assert.equal(grants.length,1,'one authorization prompt while pending')
  grants[0].success({[SUBSCRIBE_TEMPLATE_ID]:'reject'});assert.equal(p.data.subscribing,false);assert.equal(quotas,0)
  assert.equal(p.data.dataManagementExpanded,false);p.onToggleDataManagement();assert.equal(p.data.dataManagementExpanded,true)
  p.onDeleteMyData();assert.equal(modals.length,1);assert.ok(modals[0].content.includes('关注的活动'));await modals[0].success({confirm:false});assert.equal(storage.has(STORAGE_KEYS.preferredDomains),true)
  const wxml=fs.readFileSync(path.join(path.dirname(file),'subscribe.wxml'),'utf8')
  assert.equal(/[★☆]/.test(wxml),false);assert.ok(wxml.includes('一次授权对应一次微信提醒'));assert.ok(wxml.includes('重新同步偏好'))
  assert.ok(wxml.includes('bindtap="onSelectWeight"'));assert.equal(/YOUR OWN RADAR|domain-grid|weight-bars/.test(wxml),false)
  const onboardingFile=path.resolve(__dirname,'../miniprogram/pages/onboarding/onboarding.js'),onboardingRequire=require('module').createRequire(onboardingFile)
  let onboardingPage
  vm.runInNewContext(fs.readFileSync(onboardingFile,'utf8'),{Page:x=>{onboardingPage=x},require:n=>n==='../../utils/api'?api:onboardingRequire(n),wx,console})
  const edited={...onboardingPage,data:{editing:true,domains:[{key:'game',selected:true},{key:'tech',selected:true}],selectedTopics:[],formats:[],cities:[],growthGoals:[],personalizationEnabled:true}}
  const updated=edited.buildPreferences();assert.equal(updated.preferredDomains.find(d=>d.domain==='game').weight,2,'editing topics keeps existing domain strength');assert.equal(updated.preferredDomains.find(d=>d.domain==='tech').weight,3)
  console.log('PASS: interest overview/editor/cancel, persistent sync retry, reminder quotas/errors, privacy race protection, authorization guard, destructive-action confirmation')
}
main().catch(error=>{console.error(error);process.exitCode=1})
