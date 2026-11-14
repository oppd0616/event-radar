App({
  globalData: {
    cloudReady: false,
    cloudEnv: 'cloud1-d3gm0lbv1392513d1',
    useMock: false,
    onboardingDone: false
  },

  onLaunch() {
    this.initCloud()
    this.globalData.onboardingDone = !!wx.getStorageSync('onboardingDone')
    if(this.globalData.cloudReady && this.globalData.onboardingDone) {
      try { require('./utils/api').prefetchHome() } catch(error) { console.warn('[app] home prefetch unavailable') }
    }
  },

  initCloud() {
    const hasCloud = typeof wx.cloud === 'function' || (wx.cloud && typeof wx.cloud.init === 'function')
    const isTourist = !wx.getAccountInfoSync ||
      (wx.getAccountInfoSync().miniProgram.appId || '').indexOf('tourist') >= 0
    if (hasCloud && !isTourist) {
      try {
        wx.cloud.init({ env: this.globalData.cloudEnv, traceUser: true })
        this.globalData.cloudReady = true
        this.globalData.useMock = false
        return
      } catch (e) {
        console.warn('[app] cloud init failed', e)
      }
    }
    this.globalData.cloudReady = false
    // 正式版不回退到演示活动，交由页面展示可重试的网络状态。
    this.globalData.useMock = false
  }
})
