const assert = require('assert/strict')
const fs = require('fs'), path = require('path'), vm = require('vm')
const { createRequire } = require('module')
const { isFollowed, updateFollowRecords } = require('../miniprogram/utils/follows')
const root = path.resolve(__dirname, '../miniprogram')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => {resolve=yes;reject=no}); return {promise,resolve,reject} }
const tick = () => new Promise(resolve => setImmediate(resolve))
function makePage(name, api, wxOverrides={}) {
  const filename = path.join(root, 'pages', name, name + '.js')
  const native = createRequire(filename), toasts = []
  let config
  vm.runInNewContext(read('pages/' + name + '/' + name + '.js'), {
    require: value => value.endsWith('/api') ? api : native(value),
    Page: value => {config=value}, console: {warn(){},error(){}}, Date, setTimeout, clearTimeout, setInterval, clearInterval,
    wx: Object.assign({getStorageSync(){return undefined},setStorageSync(){},showToast(value){toasts.push(value)},nextTick:fn=>fn(),pageScrollTo:opts=>opts.complete && opts.complete(),showShareMenu(){}},wxOverrides)
  })
  const page = Object.assign({},config,{data:structuredClone(config.data),setData(patch,done){Object.assign(this.data,patch);if(done)done()},trackImpressions(){}})
  return {page,toasts}
}
async function main() {
  const event = {_id:'alias',canonicalEventId:'main',identityMembers:['alias','old'],title:'活动',startTime:Date.now()+86400000,timePrecision:'date'}
  let records = [{eventId:'main',refs:['main','older-alias']},{eventId:'unrelated'}]
  records = updateFollowRecords(event,records,true,'main')
  assert.equal(records.length,2);assert(isFollowed({_id:'older-alias'},records),'keep historical aliases after confirming a write')
  records = updateFollowRecords(event,records,false,'main')
  assert.deepEqual(records,[{eventId:'unrelated'}])

  let writes=0,statusReads=0,pending=deferred()
  const api = {async getFollows(){statusReads++;return {records:[]}},setFollow:()=>{writes++;return pending.promise},recordSignal:async()=>({})}
  const {page:home,toasts:homeToasts} = makePage('home',api)
  home.followReady=true
  const first = home.onCardFollow({detail:{event,following:true}})
  assert.equal(home.data.followBusyId,'alias')
  assert(isFollowed(event,home.data.followRecords),'follow feedback appears before the network completes')
  await home.onCardFollow({detail:{event,following:true}})
  assert.equal(writes,1,'rapid taps must issue only one write')
  pending.resolve({ok:true,eventId:'main'});await first
  assert.equal(home.data.followBusyId,'');assert(isFollowed(event,home.data.followRecords))
  assert.equal(statusReads,0,'confirmed write should update without a second status query')
  assert.equal(homeToasts.length,0,'successful follow needs no blocking toast')
  pending=deferred()
  const failed=home.onCardFollow({detail:{event}})
  assert(!isFollowed(event,home.data.followRecords),'cancellation also gives immediate feedback')
  pending.reject(Error('offline'));await failed
  assert(isFollowed(event,home.data.followRecords),'failed cancellation preserves confirmed state')
  assert.equal(home.followBusy,false)

  const stale=deferred();api.getFollows=()=>stale.promise
  const refresh=home.refreshFollows()
  pending=deferred()
  const cancel=home.onCardFollow({detail:{event}})
  pending.resolve({ok:true,eventId:'main'});await cancel
  stale.resolve({records:[{eventId:'main',refs:['alias']}]});await refresh
  assert(!isFollowed(event,home.data.followRecords),'older read must not undo a confirmed write')

  home.followReady=false;api.getFollows=async()=>({records:[{eventId:'main',refs:['alias']}]})
  let desired
  api.setFollow=async(id,following)=>{desired=following;return {ok:true,eventId:'main'}}
  await home.onCardFollow({detail:{event,following:true}})
  assert.equal(desired,true,'status refresh must not reverse the visible button intent')

  home.followReady=false
  home.data.followRecords=[{eventId:'main',refs:['alias']}]
  const delayedStatus=deferred()
  api.getFollows=()=>delayedStatus.promise
  const oneTapCancel=home.onCardFollow({detail:{event,following:false}})
  delayedStatus.resolve({records:[]})
  await oneTapCancel
  assert.equal(desired,false,'one tap on followed must cancel even when refreshed records are empty')
  assert(!isFollowed(event,home.data.followRecords),'cancellation needs no second tap')

  home.followReady=true
  home.data.followRecords=[]
  await home.onCardFollow({detail:{event,following:false}})
  assert.equal(desired,false,'explicit cancellation wins over parent/component state lag')

  home.data.list=[event];home.data.nextCursor=20;home.data.loading=false
  api.getEvents=async()=>{throw Error('offline')}
  await home.loadEvents(false)
  assert.equal(home.data.list.length,1);assert.equal(home.data.error,'','refresh failure preserves existing content')
  await home.loadEvents(false,true)
  assert.equal(home.data.nextCursor,20);assert(home.data.moreError)
  const oldRequest=home.requestId;home.onReachBottom();assert.equal(home.requestId,oldRequest,'failed pagination waits for explicit retry')
  let capture
  api.getEvents=async input=>{capture=input;return {list:[],nextCursor:null,serverTime:Date.now()}}
  home.onRetryMore();await tick();assert.equal(capture.cursor,20);assert.equal(home.data.moreError,'')
  home.data.feedVisible=true;home.resetFeed({activeTab:'tech'});await tick();assert.equal(home.data.feedVisible,true)

  const details=makePage('detail',{getEventDetail:async()=>{throw Error('offline')},recordSignal:async()=>({})})
  await details.page.onLoad({id:'missing'})
  assert.equal(details.page.data.loading,false);assert(details.page.data.loadError,'network failure gets a retry state')
  const missing=makePage('detail',{getEventDetail:async()=>({event:null}),recordSignal:async()=>({})})
  await missing.page.onLoad({id:'missing'});assert.equal(missing.page.data.loadError,'')
  const later=deferred()
  const destroyed=makePage('detail',{getEventDetail:()=>later.promise,recordSignal:async()=>({})})
  const loading=destroyed.page.onLoad({id:'late'});destroyed.page.onUnload()
  later.resolve({event});await loading;assert.equal(destroyed.page.data.event,null,'unloaded page ignores late detail response')

  const previewFetch=deferred()
  const preview=makePage('detail',{getEventDetail:()=>previewFetch.promise},{getStorageSync:()=>({...event,_cardOnly:true})})
  const previewLoading=preview.page.onLoad({id:event._id})
  assert.equal(preview.page.data.previewEvent.title,event.title)
  assert.equal(preview.page.data.event,null,'partial preview must not enable full-detail actions')
  previewFetch.reject(Error('offline'));await previewLoading
  assert.equal(preview.page.data.previewEvent,null);assert(preview.page.data.loadError)
  const wrongPreview=makePage('detail',{getEventDetail:async()=>({event:null})},{getStorageSync:()=>({...event,_cardOnly:true})})
  await wrongPreview.page.onLoad({id:'another'});assert.equal(wrongPreview.page.data.previewEvent,null)

  const detailWrite=deferred()
  const detailFollow=makePage('detail',{setFollow:()=>detailWrite.promise})
  Object.assign(detailFollow.page.data,{event,followReady:true,following:false})
  const detailFollowing=detailFollow.page.onFollow()
  assert.equal(detailFollow.page.data.following,true,'detail follows optimistically too')
  detailWrite.reject(Error('offline'));await detailFollowing
  assert.equal(detailFollow.page.data.following,false);assert.equal(detailFollow.page.data.followBusy,false)

  const searchWrite=deferred()
  const searchFollow=makePage('search',{setFollow:()=>searchWrite.promise})
  searchFollow.page.followReady=true
  const searchingFollow=searchFollow.page.onCardFollow({detail:{event}})
  assert(isFollowed(event,searchFollow.page.data.followRecords),'search uses the same immediate feedback as home')
  searchWrite.resolve({ok:true,eventId:'main'});await searchingFollow
  assert.equal(searchFollow.toasts.length,0)
  let searchDesired
  const searchCancel=makePage('search',{
    getFollows:async()=>({records:[]}),
    setFollow:async(id,following)=>{searchDesired=following;return {ok:true,eventId:'main'}}
  })
  searchCancel.page.data.followRecords=[{eventId:'main',refs:['alias']}]
  await searchCancel.page.onCardFollow({detail:{event,following:false}})
  assert.equal(searchDesired,false,'search also preserves explicit cancel through status refresh')

  const followRefresh=deferred()
  const agenda=makePage('follows',{getFollows:()=>followRefresh.promise})
  agenda.page.data.list=[{id:'retained'}];agenda.page.data.groups=[{key:'week',rows:[]}];agenda.page.data.loading=false;agenda.page.data.nextCursor=12
  const returning=agenda.page.load(true,true)
  assert.equal(agenda.page.data.list.length,1);assert.equal(agenda.page.data.loading,false,'returning to follows keeps visible rows')
  const agendaRequest=agenda.page.request;agenda.page.onReachBottom();assert.equal(agenda.page.request,agendaRequest,'warm refresh blocks pagination until new order arrives')
  followRefresh.reject(Error('offline'));await returning;assert.equal(agenda.page.data.list.length,1);assert.equal(agenda.page.data.error,'')

  const rows=Array.from({length:30},(_,i)=>({event:{...event,_id:'row-'+i},agenda:{key:'week'}}))
  const requests=[]
  let secondPage=deferred()
  const paged=makePage('follows',{getFollows:input=>{requests.push(input.cursor);return input.cursor===0 ? Promise.resolve({list:rows.slice(0,12),total:30,nextCursor:12}) : secondPage.promise}})
  const retained=Array.from({length:24},(_,i)=>({id:'old-'+i}))
  Object.assign(paged.page.data,{list:retained,nextCursor:24,loading:false})
  const warm=paged.page.onShow();await tick()
  assert.deepEqual(requests,[0,12]);assert.equal(paged.page.data.list,retained,'all visible pages stay in place until the refresh completes')
  secondPage.resolve({list:rows.slice(12,24),total:30,nextCursor:24});await warm
  assert.equal(paged.page.data.list.length,24);assert.equal(paged.page.data.nextCursor,24)
  const retainedAfter=paged.page.data.list
  secondPage=deferred();const warmFailure=paged.page.onShow();await tick()
  secondPage.reject(Error('offline'));await warmFailure
  assert.equal(paged.page.data.list,retainedAfter);assert.equal(paged.page.data.nextCursor,24,'failure on a later refresh page preserves cursor')
  secondPage=deferred();const staleWarm=paged.page.onShow();await tick()
  paged.page.onFilter({currentTarget:{dataset:{filter:'ended'}}});await tick()
  secondPage.resolve({list:rows.slice(12,24),total:30,nextCursor:24});await staleWarm
  assert.equal(paged.page.data.list.length,12,'old multi-page refresh cannot overwrite a new filter')

  let navigated=false
  const fullStorage=makePage('home',{}, {setStorageSync(){throw Error('quota')},navigateTo(){navigated=true}})
  fullStorage.page.onCardTap({detail:{event}});assert(navigated,'preview storage failure does not prevent opening detail')

  let nextFeed={list:[{...event,_id:'new-event'}],feedOrder:['new-event'],nextCursor:null,serverTime:Date.now()}
  const reading=makePage('home',{getEvents:async()=>nextFeed})
  reading.page.data.list=reading.page.decorate([event],Date.now())
  reading.page.data.loading=false;reading.page.feedOrder=['alias'];reading.page.data.nextCursor=20
  reading.page.onPageScroll({scrollTop:600})
  const oldList=reading.page.data.list
  await reading.page.loadEvents(false,false,true)
  assert.equal(reading.page.data.list,oldList,'background response must not move the content being read')
  assert.equal(reading.page.data.pendingUpdate,true);assert.equal(reading.page.data.nextCursor,20)
  assert.equal(reading.page.feedOrder[0],'alias','old pagination must remain paired with the visible list')
  reading.page.onApplyFeedUpdate()
  assert.equal(reading.page.data.list[0]._id,'new-event');assert.equal(reading.page.data.pendingUpdate,false)
  assert.equal(reading.page.data.nextCursor,null);assert.equal(reading.page.scrollTop,0)

  reading.page.onPageScroll({scrollTop:600})
  nextFeed={...nextFeed,list:[event],feedOrder:['alias']}
  await reading.page.loadEvents(false,false,true)
  assert.equal(reading.page.data.pendingUpdate,true)
  await reading.page.loadEvents(false)
  assert.equal(reading.page.data.pendingUpdate,false);assert.equal(reading.page.data.list[0]._id,'alias','explicit refresh applies immediately')

  const more={...event,_id:'page-two',canonicalEventId:'page-two',identityMembers:[]}
  reading.page.data.list=reading.page.decorate([event,more],Date.now())
  reading.page.data.nextCursor=40;reading.page.feedOrder=['alias','page-two']
  nextFeed={list:[event],feedOrder:['alias','page-two'],nextCursor:20,serverTime:Date.now()}
  await reading.page.loadEvents(false,false,true)
  assert.equal(reading.page.data.list.length,2);assert.equal(reading.page.data.nextCursor,40,'unchanged first page does not discard loaded pages')
  nextFeed={...nextFeed,list:[],nextCursor:null}
  await reading.page.loadEvents(false,false,true)
  assert.equal(reading.page.data.pendingUpdate,true,'removed content also offers an update')
  reading.page.onApplyFeedUpdate();assert.equal(reading.page.data.list.length,0)

  const cache=require('../miniprogram/utils/feed-cache'), apiFile=path.join(root,'utils/api.js'), apiModule={exports:{}}
  vm.runInNewContext(fs.readFileSync(apiFile,'utf8'),{
    require:createRequire(apiFile),module:apiModule,exports:apiModule.exports,
    getApp:()=>({globalData:{useMock:false}}),console,
    wx:{getStorageSync(){return false},cloud:{callFunction(input){input.success({result:{ok:true,eventId:'main'}})}}}
  })
  const cacheVersion=cache.version();await apiModule.exports.setFollow('main',false)
  assert(cache.version()>cacheVersion,'cancelling a follow invalidates recommendation cache too')

  const card=read('components/event-card/event-card.wxml')
  for(const cls of ['more','card-follow','cta']) {
    const tag=card.match(new RegExp('<view class="'+cls+'(?:[ "][^>]*)>'))?.[0]
    assert(tag && tag.includes('hover-stop-propagation="{{true}}"'),cls+' prevents ancestor press feedback')
    assert(tag.includes('hover-stay-time="60"'),cls+' releases promptly')
  }
  const homeTemplate=read('pages/home/home.wxml')
  assert(homeTemplate.indexOf('<loading-state')<homeTemplate.indexOf('feedVisible && !loading'),'skeleton is independent of card subtree teardown')
  for(const pageName of ['home','detail','follows']) {
    assert(JSON.parse(read('pages/'+pageName+'/'+pageName+'.json')).usingComponents['loading-state'])
    assert(read('pages/'+pageName+'/'+pageName+'.wxml').includes('<loading-state'))
  }
  assert(read('components/loading-state/loading-state.wxss').includes('prefers-reduced-motion'))
  assert(read('pages/detail/detail.wxml').includes('wx:if="{{event.identityReview.status === \'pending\'}}"'),'identity conflict warning must be a real conditional binding')
  console.log('PASS: follow single-flight / confirmed state / alias preservation / stale reads / retries / refresh retention / pagination / unloaded details / independent hover and skeleton states')
}
main().catch(error=>{console.error(error);process.exitCode=1})
