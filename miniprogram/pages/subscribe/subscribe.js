const { DOMAINS, DOMAIN_MAP, INTEREST_TAXONOMY, SUBSCRIBE_TEMPLATE_ID, STORAGE_KEYS } = require('../../utils/constants')
const api = require('../../utils/api')
const SYNC_PENDING_KEY = 'preferenceSyncPending'
const cleanWeight = value => Math.max(0,Math.min(3,Math.floor(Number(value)||0)))
const topicViews = topics => (Array.isArray(topics) ? topics : []).map(topic => {
  const options = INTEREST_TAXONOMY[topic.domain] || []
  const match = options.find(item => item.key === topic.key)
  return { key:topic.domain + '_' + topic.key,label:topic.label || (match && match.label) || topic.key }
})

Page({
  data: {
    domains: [],
    subscriptions: [],
    topicCount: 0,
    selectedDomainCount: 0,
    selectedDomains: [],
    topicPreview: [],
    topicOverflow: 0,
    editingDomains: false,
    activeEditDomain: '',
    activeEditLabel: '',
    activeEditWeight: 0,
    moreExpanded: false,
    weightLabels: ['未选择', '一般', '喜欢', '优先'],
    saveState: 'clean',
    reminderQuota: 0,
    subscriptionsLoading: true,
    subscriptionsError: false,
    remindersExpanded: false,
    domainsExpanded: false,
    dataManagementExpanded: false,
    aboutExpanded: false,
    personalizationEnabled: true,
    privacyBusy: false,
    saving: false,
    subscribing: false
  },

  onLoad() {
    let prefs = []
    let topics = []
    try {
      prefs = wx.getStorageSync(STORAGE_KEYS.preferredDomains) || []
      topics = wx.getStorageSync(STORAGE_KEYS.preferredTopics) || []
    } catch (e) {
      prefs = []
      topics = []
    }
    const weightMap = prefs.reduce((acc, p) => {
      acc[p.domain] = p.weight || 0
      return acc
    }, {})
    const domains = DOMAINS.map((d) => ({
      key: d.key,
      label: d.label,
      color: d.color,
      bg: d.bg,
      icon: '/assets/preference-domains/' + d.key + '.png',
      weight: cleanWeight(weightMap[d.key])
    }))
    const personalizationEnabled = wx.getStorageSync(STORAGE_KEYS.personalizationEnabled) !== false
    const topicList = topicViews(topics)
    this.setData({ domains,selectedDomains:domains.filter(d => d.weight>0), topicCount: topicList.length,topicPreview:topicList.slice(0,6),topicOverflow:Math.max(0,topicList.length-6), personalizationEnabled, selectedDomainCount:domains.filter(d => d.weight>0).length, saveState:wx.getStorageSync(SYNC_PENDING_KEY) ? 'local' : 'clean' })
    this.savedPreferenceSignature = JSON.stringify(prefs)
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().syncSelected()
    this.loadSubscriptions()
    try {
      const topics = wx.getStorageSync(STORAGE_KEYS.preferredTopics) || []
      const topicList = topicViews(topics)
      this.setData({ topicCount: topicList.length,topicPreview:topicList.slice(0,6),topicOverflow:Math.max(0,topicList.length-6) })
      if(this.data.saveState !== 'dirty') this.setData({saveState:wx.getStorageSync(SYNC_PENDING_KEY) ? 'local' : 'clean'})
      const prefs = wx.getStorageSync(STORAGE_KEYS.preferredDomains) || []
      const signature = JSON.stringify(prefs)
      if (signature !== this.savedPreferenceSignature) {
        const weights = prefs.reduce((result,p) => {result[p.domain]=p.weight || 0;return result}, {})
        const domains=this.data.domains.map(item => Object.assign({},item,{weight:cleanWeight(weights[item.key])}))
        this.setData({domains,selectedDomains:domains.filter(d => d.weight>0),selectedDomainCount:domains.filter(d => d.weight>0).length,saveState:wx.getStorageSync(SYNC_PENDING_KEY) ? 'local' : 'clean'})
        this.savedPreferenceSignature = signature
      }
    } catch (e) {}
  },

  async loadSubscriptions() {
    const request=(this.subscriptionRequest || 0)+1
    this.subscriptionRequest=request
    const privacyRevision=this.privacyRevision || 0
    this.setData({subscriptionsLoading:true,subscriptionsError:false})
    try {
      const res = await api.getSubscriptions()
      const list = (res.list || []).map((s, index) => ({
        ...s,
        _id: s._id || (s.anchorEventId ? 'radar_' + s.anchorEventId : (s.eventId ? 'event_' + s.eventId : 'domain_' + s.domain + '_' + index)),
        label: s.eventId
          ? (s.eventTitle || '指定活动')
          : (s.domain === 'all' ? '个性化新活动' : (DOMAIN_MAP[s.domain] || {}).label || s.domain)
      }))
      if(request !== this.subscriptionRequest) return
      const subscriptions=list.filter(item => item.kind !== 'radar').map(item => Object.assign({},item,{remainCount:Math.max(0,Math.floor(Number(item.remainCount)||0))}))
      this.setData({subscriptions,reminderQuota:subscriptions.reduce((sum,item) => sum+(item.status==='active' ? item.remainCount : 0),0)})
      if(privacyRevision===(this.privacyRevision || 0) && !this.data.privacyBusy) {
        this.setData({personalizationEnabled:res.personalizationEnabled !== false})
        wx.setStorageSync(STORAGE_KEYS.personalizationEnabled,res.personalizationEnabled !== false)
      }
    } catch (err) {
      console.warn('[subscribe] loadSubscriptions failed', err)
      if(request===this.subscriptionRequest) this.setData({subscriptionsError:true})
    } finally {
      if(request===this.subscriptionRequest) this.setData({subscriptionsLoading:false})
    }
  },

  onWeightChange(e) {
    if (this.data.saving) return
    const idx = Number(e.currentTarget.dataset.index)
    const weight = Number(e.detail.value)
    if (!Number.isInteger(idx) || !this.data.domains[idx] || !Number.isInteger(weight) || weight < 0 || weight > 3) return
    const domains = this.data.domains.map((item,index) => index === idx ? Object.assign({},item,{weight}) : item)
    const saved = wx.getStorageSync(STORAGE_KEYS.preferredDomains) || []
    const dirty = domains.some(d => d.weight !== cleanWeight((saved.find(p => p.domain === d.key) || {}).weight))
    const active = domains.find(d=>d.key===this.data.activeEditDomain)
    this.setData({domains,selectedDomains:domains.filter(d => d.weight > 0),selectedDomainCount:domains.filter(d => d.weight > 0).length,activeEditWeight:active ? active.weight : 0,saveState:dirty ? 'dirty' : wx.getStorageSync(SYNC_PENDING_KEY) ? 'local' : 'clean'})
  },

  onToggleDomainEdit() {
    if (this.data.saving) return
    if (this.data.editingDomains) {
      const prefs = wx.getStorageSync(STORAGE_KEYS.preferredDomains) || []
      const weights = prefs.reduce((result,item) => {result[item.domain]=item.weight;return result}, {})
      const domains = this.data.domains.map(item => Object.assign({},item,{weight:cleanWeight(weights[item.key])}))
      this.setData({editingDomains:false,activeEditDomain:'',activeEditLabel:'',activeEditWeight:0,domains,selectedDomains:domains.filter(d=>d.weight>0),selectedDomainCount:domains.filter(d=>d.weight>0).length,saveState:wx.getStorageSync(SYNC_PENDING_KEY) ? 'local' : 'clean'})
    } else {
      const active=(this.data.selectedDomains[0] || this.data.domains[0] || {})
      this.setData({editingDomains:true,activeEditDomain:active.key || '',activeEditLabel:active.label || '',activeEditWeight:active.weight || 0})
    }
  },

  onEditDomainTap(e) {
    if (this.data.saving) return
    const key = e.currentTarget.dataset.key
    const index = this.data.domains.findIndex(item => item.key === key)
    if (index < 0) return
    this.setData({activeEditDomain:key,activeEditLabel:this.data.domains[index].label,activeEditWeight:this.data.domains[index].weight || 0})
    if (!this.data.domains[index].weight) this.onWeightChange({currentTarget:{dataset:{index}},detail:{value:2}})
  },

  onSelectWeight(e) {
    const index = this.data.domains.findIndex(item => item.key === this.data.activeEditDomain)
    if (index < 0) return
    this.onWeightChange({currentTarget:{dataset:{index}},detail:{value:e.currentTarget.dataset.weight}})
  },

  async onSave() {
    if(this.data.saving) return
    const preferredDomains = this.data.domains
      .filter((d) => d.weight > 0)
      .map((d) => ({ domain: d.key, weight: d.weight }))
    const activeKeys = preferredDomains.map(item => item.domain)
    const preferredTopics = (wx.getStorageSync(STORAGE_KEYS.preferredTopics) || []).filter(item => activeKeys.indexOf(item.domain) >= 0)
    this.setData({ saving: true })
    wx.setStorageSync(STORAGE_KEYS.preferredDomains, preferredDomains)
    wx.setStorageSync(STORAGE_KEYS.preferredTopics, preferredTopics)
    wx.setStorageSync(SYNC_PENDING_KEY,true)
    this.savedPreferenceSignature = JSON.stringify(preferredDomains)
    const topicList = topicViews(preferredTopics)
    this.setData({topicCount:topicList.length,topicPreview:topicList.slice(0,6),topicOverflow:Math.max(0,topicList.length-6)})
    try {
      await api.updatePreference({
        preferredDomains,
        preferredTopics,
        preferredFormats: wx.getStorageSync(STORAGE_KEYS.preferredFormats) || [],
        preferredCities: wx.getStorageSync(STORAGE_KEYS.preferredCities) || [],
        growthGoals: wx.getStorageSync(STORAGE_KEYS.growthGoals) || []
      })
      wx.removeStorageSync(SYNC_PENDING_KEY)
      this.setData({saveState:'saved',editingDomains:false,activeEditDomain:'',activeEditLabel:'',activeEditWeight:0})
      wx.showToast({ title: '偏好已保存', icon: 'success' })
    } catch (err) {
      this.setData({saveState:'local',editingDomains:false,activeEditDomain:'',activeEditLabel:'',activeEditWeight:0})
      wx.showToast({ title: '已本地保存，云端未同步', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  onEditInterests() {
    if(this.data.saving) return
    if(this.data.saveState === 'dirty') {
      wx.showToast({ title: '请先保存领域偏好', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/interest-editor/interest-editor' })
  },

  async onPersonalizationChange(e) {
    if (this.data.privacyBusy) return
    const enabled = !!e.detail.value
    const previous = this.data.personalizationEnabled
    this.privacyRevision=(this.privacyRevision || 0)+1
    this.setData({ personalizationEnabled: enabled, privacyBusy: true })
    wx.setStorageSync(STORAGE_KEYS.personalizationEnabled, enabled)
    try {
      await api.updatePrivacy('setPersonalization', enabled)
      wx.showToast({
        title: enabled ? '已开启个性化推荐' : '已切换为通用推荐',
        icon: 'none'
      })
    } catch (err) {
      this.setData({ personalizationEnabled: previous })
      wx.setStorageSync(STORAGE_KEYS.personalizationEnabled, previous)
      wx.showToast({ title: '设置失败，请重试', icon: 'none' })
    } finally {
      this.setData({ privacyBusy: false })
    }
  },

  onClearRecommendationData() {
    if (this.data.privacyBusy) return
    wx.showModal({
      title: '清除推荐记录',
      content: '将删除浏览、停留等推荐学习记录，但保留你主动选择的兴趣、关注的活动和活动提醒。',
      confirmText: '确认清除',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ privacyBusy: true })
        try {
          await api.updatePrivacy('clearRecommendationData')
          wx.showToast({ title: '推荐记录已清除', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: '清除失败，请重试', icon: 'none' })
        } finally {
          this.setData({ privacyBusy: false })
        }
      }
    })
  },

  onDeleteMyData() {
    if (this.data.privacyBusy) return
    wx.showModal({
      title: '删除全部个人数据',
      content: '将删除兴趣、关注的活动、推荐记录和活动提醒。公开活动数据不会受到影响，删除后需要重新选择兴趣。',
      confirmText: '确认删除',
      confirmColor: '#C13E38',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ privacyBusy: true })
        try {
          await api.updatePrivacy('deleteMyData')
          wx.clearStorageSync()
          wx.reLaunch({ url: '/pages/onboarding/onboarding' })
        } catch (err) {
          this.setData({ privacyBusy: false })
          wx.showToast({ title: '删除失败，请重试', icon: 'none' })
        }
      }
    })
  },

  onPrivacyInfo() {
    wx.showModal({
      title: '数据使用说明',
      content: '开启个性化推荐后，小程序会保存你选择的兴趣，以及浏览、停留和减少推荐等反馈，用于调整活动排序。关闭后停止记录推荐反馈，并使用通用排序。关注的活动保留在你的关注列表中，不自动开启消息提醒。活动搜索服务只接收活动主题和城市，不接收你的微信身份信息。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  onOpenPrivacyContract() {
    if (typeof wx.openPrivacyContract !== 'function') {
      wx.showToast({ title: '请在微信中查看隐私保护指引', icon: 'none' })
      return
    }
    wx.openPrivacyContract({
      fail: () => wx.showToast({ title: '隐私保护指引暂未配置', icon: 'none' })
    })
  },

  onSubscribeAll() {
    if (this.data.subscribing) return
    this.setData({subscribing:true})
    const recordSubscription = async () => {
      this.setData({ subscribing: true })
      try {
        await api.addSubscriptionQuota('all')
        await this.loadSubscriptions()
        wx.showToast({ title: '已开启一次新活动提醒', icon: 'none', duration: 2500 })
      } catch (err) {
        console.error('[subscribe] save subscription failed', err)
        wx.showModal({
          title: '提醒保存失败',
          content: '微信授权已完成，但提醒次数没有保存。请检查网络后再次点击。',
          showCancel: false
        })
      } finally {
        this.setData({ subscribing: false })
      }
    }
    if (SUBSCRIBE_TEMPLATE_ID === 'TEMPLATE_ID_PLACEHOLDER') {
      recordSubscription()
      return
    }
    wx.requestSubscribeMessage({
      tmplIds: [SUBSCRIBE_TEMPLATE_ID],
      success: (res) => {
        if (res[SUBSCRIBE_TEMPLATE_ID] === 'accept') {
          recordSubscription()
        } else {
          this.setData({subscribing:false})
          wx.showToast({ title: '未授权，可在系统设置中开启', icon: 'none' })
        }
      },
      fail: (err) => {
        this.setData({ subscribing: false })
        const message = err && err.errMsg ? err.errMsg : '未知错误'
        console.error('[subscribe] requestSubscribeMessage failed', err)
        wx.showModal({
          title: '订阅授权失败',
          content: message,
          showCancel: false,
          confirmText: '我知道了'
        })
      }
    })
  },
  onToggleMore() { this.setData({moreExpanded:!this.data.moreExpanded}) },
  onToggleReminders() { this.setData({remindersExpanded:!this.data.remindersExpanded}) },
  onToggleDataManagement() { this.setData({dataManagementExpanded:!this.data.dataManagementExpanded}) },
  onToggleAbout() { this.setData({aboutExpanded:!this.data.aboutExpanded}) }
})
