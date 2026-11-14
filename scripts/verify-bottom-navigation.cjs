const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm')
const root=path.resolve(__dirname,'../miniprogram'),read=p=>fs.readFileSync(path.join(root,p),'utf8')
const config=JSON.parse(read('app.json'))
assert.equal(config.tabBar.custom,true)
assert.deepEqual(config.tabBar.list.map(t=>t.text),['发现','关注','偏好'])
for(const [index,tab] of config.tabBar.list.entries()) {
  assert.ok(config.pages.includes(tab.pagePath))
  assert.ok(JSON.parse(read(tab.pagePath+'.json')).usingComponents)
  assert.ok(read(tab.pagePath+'.js').includes('getTabBar().syncSelected()'))
  assert.ok(read(tab.pagePath+'.wxml').includes('tab-page'))
}
assert.equal(read('pages/home/home.wxml').includes('hd-settings'),false)
assert.ok(read('app.wxss').includes('env(safe-area-inset-bottom)'))
for(const page of config.pages) {
  const source=read(page+'.js')
  assert.equal(/wx\.(?:navigateTo|redirectTo)\(\{\s*url:\s*['"]\/pages\/(?:home\/home|follows\/follows|subscribe\/subscribe)/.test(source),false,'tab routes must use switchTab')
}
let component,route='pages/home/home',switches=[],fail=false,toasts=[],nextTimer=0,hold=false,pending=[]
const timers=new Map(),app={globalData:{}},flush=()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn()}}
vm.runInNewContext(read('custom-tab-bar/index.js'),{Component:x=>{component=x},getCurrentPages:()=>[{route}],getApp:()=>app,setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer},clearTimeout:id=>timers.delete(id),wx:{switchTab(params){switches.push(params.url);if(hold){pending.push(params);return}if(fail)params.fail();else route=params.url.slice(1);params.complete()},showToast:x=>toasts.push(x)}})
const instance={data:JSON.parse(JSON.stringify(component.data)),setData(data){Object.assign(this.data,data)},...component.methods}
for(const tab of instance.data.list){
  for(const asset of [tab.icon,tab.selectedIcon]){
    assert.ok(asset.startsWith('/assets/navigation/'),'navigation icons must be local bundled assets')
    const png=fs.readFileSync(path.join(root,asset.slice(1)))
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
    assert.equal(png.readUInt32BE(16),72);assert.equal(png.readUInt32BE(20),72)
  }
}
assert.equal(read('custom-tab-bar/index.wxml').includes('<t-icon'),false,'navigation must render without the remote icon font')
assert.ok(read('custom-tab-bar/index.wxml').includes('item.selectedIcon'))
component.lifetimes.attached.call(instance);assert.equal(instance.data.selected,0)
instance.onTab({currentTarget:{dataset:{index:1}}});assert.equal(switches[0],'/pages/follows/follows')
assert.equal(instance.data.selected,1,'selection responds immediately')
component.pageLifetimes.show.call(instance);assert.equal(instance.data.selected,1)
assert.equal(instance.data.indicatorIndex,1);flush();assert.equal(instance.data.indicatorIndex,1)
instance.onTab({currentTarget:{dataset:{index:1}}});assert.equal(switches.length,1,'active tab should not reset list')
fail=true;instance.onTab({currentTarget:{dataset:{index:2}}});assert.equal(instance.data.selected,1);assert.equal(toasts.length,1);assert.equal(instance.data.indicatorIndex,1);assert.equal(app.globalData.navTransition,null)
fail=false;instance.onTab({currentTarget:{dataset:{index:2}}})
const destination={data:JSON.parse(JSON.stringify(component.data)),setData(data){Object.assign(this.data,data)},...component.methods}
component.lifetimes.attached.call(destination)
assert.equal(destination.data.selected,2);assert.equal(destination.data.indicatorIndex,2,'new tab instance must not flash the first tab')
flush();assert.equal(destination.data.indicatorIndex,2);assert.equal(app.globalData.navTransition,null)
destination.syncSelected();assert.equal(timers.size,0,'returning from detail must not replay old navigation motion')
hold=true
const tap=(bar,index)=>bar.onTab({currentTarget:{dataset:{index}}})
tap(destination,0);assert.equal(destination.data.selected,0)
tap(destination,1);tap(destination,2);tap(destination,1)
assert.equal(pending.length,1,'rapid taps do not start overlapping native switches')
assert.equal(destination.data.selected,1,'latest tap is immediately visible')
const first=pending.shift();route=first.url.slice(1)
const landing={data:JSON.parse(JSON.stringify(component.data)),setData(data){Object.assign(this.data,data)},...component.methods}
component.pageLifetimes.show.call(landing)
assert.equal(landing.data.selected,1,'destination instance keeps queued intent')
first.complete();assert.equal(pending.length,1);assert.equal(pending[0].url,'/pages/follows/follows')
const last=pending.shift();route=last.url.slice(1);last.complete()
assert.equal(landing.data.selected,1);assert.equal(pending.length,0)
tap(landing,2);const broken=pending.shift();broken.fail();broken.complete()
assert.equal(landing.data.selected,1);assert.equal(landing.data.indicatorIndex,1)
assert.ok(read('custom-tab-bar/index.wxml').includes('nav-indicator'))
assert.equal(read('custom-tab-bar/index.wxml').includes('nav-dot'),false)
assert.ok(read('custom-tab-bar/index.wxss').includes('height:88rpx'))
assert.ok(read('custom-tab-bar/index.wxss').includes('prefers-reduced-motion'))
assert.ok(read('pages/home/home.wxss').includes('--td-tab-item-height: 76rpx'))
const detail=read('pages/detail/detail.wxml')
assert.ok(detail.includes('d-bottom-tools'));assert.ok(detail.includes('微信订阅消息'))
assert.equal(config.tabBar.list.some(t=>t.pagePath==='pages/detail/detail'),false)
console.log('PASS: tab routing, compact layout, cross-instance sliding motion, failed-switch rollback, reduced-motion styles, safe spacing, separate detail actions')
