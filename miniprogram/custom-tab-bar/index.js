// One navigation request at a time across the separate tab-bar instances.
let activeBar = null, flight = null, desired = null
Component({
  data: {
    selected: 0,
    indicatorIndex: 0,
    indicatorInstant: true,
    list: [
      { path:'/pages/home/home',label:'发现',icon:'/assets/navigation/discover.png',selectedIcon:'/assets/navigation/discover-selected.png' },
      { path:'/pages/follows/follows',label:'关注',icon:'/assets/navigation/follows.png',selectedIcon:'/assets/navigation/follows-selected.png' },
      { path:'/pages/subscribe/subscribe',label:'偏好',icon:'/assets/navigation/preferences.png',selectedIcon:'/assets/navigation/preferences-selected.png' }
    ]
  },
  lifetimes: { attached() { this.detached=false; this.syncSelected() }, detached() { this.detached=true; if(activeBar===this)activeBar=null; this.clearMotion() } },
  pageLifetimes: { show() { this.syncSelected() }, hide() { this.clearMotion() } },
  methods: {
    clearMotion() { if(this.motionTimer) clearTimeout(this.motionTimer); this.motionTimer=null },
    syncSelected() {
      const pages=getCurrentPages(),current=pages[pages.length-1]
      const index=this.data.list.findIndex(item => current && item.path==='/'+current.route)
      if(index<0) return
      activeBar=this
      this.clearMotion()
      if(flight && desired) {
        this.setData({selected:desired.index,indicatorIndex:desired.index,indicatorInstant:false})
        return
      }
      const app=typeof getApp==='function' ? getApp() : null
      const transition=app && app.globalData && app.globalData.navTransition
      if(transition && transition.to===index && Date.now()-transition.at<450) {
        // Each tab has a distinct component instance; replay from the preceding tab,
        // not index 0, so cross-page transitions remain continuous.
        this.setData({selected:index,indicatorIndex:transition.from,indicatorInstant:true})
        this.motionTimer=setTimeout(() => {
          this.setData({indicatorIndex:index,indicatorInstant:false})
          if(app.globalData.navTransition===transition) app.globalData.navTransition=null
        },32)
      } else this.setData({selected:index,indicatorIndex:index,indicatorInstant:this.data.selected===index && this.data.indicatorIndex===index ? this.data.indicatorInstant : true})
    },
    onTab(e) {
      const index=Number(e.currentTarget.dataset.index),item=this.data.list[index]
      if(!item || this.detached || index===this.data.selected) return
      activeBar=this
      this.clearMotion()
      desired={index}
      this.setData({selected:index,indicatorIndex:index,indicatorInstant:false})
      if(!flight) this.beginSwitch(index)
    },
    beginSwitch(index) {
      const pages=getCurrentPages(),current=pages[pages.length-1]
      const previous=this.data.list.findIndex(item=>current && item.path==='/'+current.route)
      if(previous===index) {desired=null;this.syncSelected();return}
      const token={from:previous,to:index},app=typeof getApp==='function' ? getApp() : null
      flight=token
      if(app && app.globalData)app.globalData.navTransition={from:previous,to:index,at:Date.now()}
      wx.switchTab({url:this.data.list[index].path,fail:()=>{
        if(flight===token && desired && desired.index===index) {
          desired=null
          wx.showToast({title:'切换失败，请重试',icon:'none'})
        }
      },complete:()=>{
        if(flight!==token)return
        flight=null
        if(app && app.globalData)app.globalData.navTransition=null
        const bar=activeBar && !activeBar.detached ? activeBar : !this.detached ? this : null
        if(!bar){desired=null;return}
        if(desired)bar.beginSwitch(desired.index)
        else bar.syncSelected()
      }})
    }
  }
})
