const dayjs = require('dayjs')
const { DOMAINS, DOMAIN_MAP, STORAGE_KEYS } = require('../../utils/constants')
const api = require('../../utils/api')
const feedCache = require('../../utils/feed-cache')
const { toggleListFollow } = require('../../utils/follow-interaction')
const { requiresExactEventTime } = require('../../utils/event-time-policy')
const { isDateOnly, mergeUniqueEvents, simplifyEvent } = require('../../utils/content')
const SORT_STORAGE_KEY = 'eventSortMode'
const SORT_MODES = ['comprehensive', 'time', 'popularity']

function countdownText(startTime, endTime, now) {
  const diff = startTime - now
  if (diff <= 0) {
    if (endTime && now < endTime) return '进行中'
    return '已开始'
  }
  const m = Math.floor(diff / 60000)
  if (m < 60) return '倒计时 ' + Math.max(1, m) + ' 分钟'
  const h = Math.floor(m / 60)
  if (h < 24) return '倒计时 ' + h + ' 小时'
  const d = Math.floor(h / 24)
  const rh = h % 24
  return '倒计时 ' + d + ' 天' + (rh > 0 ? ' ' + rh + ' 小时' : '')
}

function eventCountdownText(event, now) {
  if (event && event.openingState) return event.openingState.text
  if (event && event.timePrecision === 'month_range') return '具体日期待公布'
  if (isDateOnly(event) || !requiresExactEventTime(event)) {
    const eventDay = dayjs(event.startTime).startOf('day')
    const today = dayjs(now).startOf('day')
    const days = eventDay.diff(today, 'day')
    if (days > 0) return '倒计时 ' + days + ' 天'
    if (days === 0) return '今日举行'
    if (event.endTime && now < event.endTime) return '进行中'
    return '已开始'
  }
  return countdownText(event.startTime, event.endTime, now)
}

function minutesAgoText(latestFetchedAt, serverTime) {
  const m = Math.max(0, Math.floor((serverTime - latestFetchedAt) / 60000))
  if (m < 1) return '刚刚更新'
  if (m < 60) return '更新于 ' + m + ' 分钟前'
  return '更新于 ' + Math.floor(m / 60) + ' 小时前'
}

function cardCta(event) {
  const participation = (event && event.participation) || {}
  const note = String(participation.note || '')
  if (/购票|门票|票务|抢票|开票/.test(note)) return '查看购票'
  if (participation.type === 'registration') return '查看报名'
  if (participation.type === 'livestream') return '观看直播'
  return '查看参与方式'
}

Page({
  data: {
    followRecords: [],
    followBusyId: '',
    followPulseId: '',
    tabs: [],
    activeTab: 'all',
    sortMode: 'comprehensive',
    sortIndex: 0,
    sortOptions: [
      { key: 'comprehensive', label: '综合' },
      { key: 'time', label: '时间' },
      { key: 'popularity', label: '热度' }
    ],
    feedVisible: true,
    list: [],
    loading: true,
    loadingMore: false,
    error: '',
    moreError: '',
    updatedText: '',
    latestFetchedAt: 0,
    serverTime: 0,
    nextCursor: null,
    feedbackMessage: '',
    feedbackBusy: false,
    pendingUpdate: false
  },

  onLoad() {
    if (!wx.getStorageSync(STORAGE_KEYS.onboardingDone)) {
      wx.redirectTo({ url: '/pages/onboarding/onboarding' })
      return
    }
    const savedSortMode = wx.getStorageSync(SORT_STORAGE_KEY)
    this.homeInitialized = true
    this.preferenceSignature = this.getPreferenceSignature()
    this.personalizationEnabled = wx.getStorageSync(STORAGE_KEYS.personalizationEnabled) !== false
    if (SORT_MODES.indexOf(savedSortMode) >= 0) {
      this.setData({ sortMode: savedSortMode, sortIndex: SORT_MODES.indexOf(savedSortMode) })
    }
    this.buildTabs()
    this.loadEvents(true)
  },

  onShow() {
    this.homeVisible = true
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().syncSelected()
    if (!wx.getStorageSync(STORAGE_KEYS.onboardingDone)) return
    if (!this.homeInitialized) this.onLoad()
    this.refreshFollows()
    const enabled = wx.getStorageSync(STORAGE_KEYS.personalizationEnabled) !== false
    const signature = this.getPreferenceSignature()
    const preferencesChanged=this.hasShown && signature !== this.preferenceSignature
    if (preferencesChanged) {
      this.personalizationEnabled = enabled
      this.preferenceSignature = signature
      this.buildTabs()
      this.loadEvents(true)
    }
    else if(this.hasShown && this.data.list.length && !this.feedRefreshing && this.lastFeedAt && Date.now()-this.lastFeedAt>60000) this.loadEvents(false,false,true)
    this.hasShown = true
    if (!this.data.loading && this.data.list.length) this.trackImpressions()
    this.tickUpdatedText()
    if (this.updatedTimer) clearInterval(this.updatedTimer)
    this.updatedTimer = setInterval(() => this.tickUpdatedText(), 30000)
  },

  onHide() {
    this.homeVisible = false
    this.disconnectExposureObserver()
    if (this.updatedTimer) {
      clearInterval(this.updatedTimer)
      this.updatedTimer = null
    }
  },

  async refreshFollows() {
    if (this.followBusy) return
    const request = (this.followRequest || 0) + 1
    this.followRequest = request
    try {
      const res = await api.getFollows()
      if (request !== this.followRequest || this.unloaded) return
      this.followReady = true
      this.setData({ followRecords: res.records || [] })
    } catch (error) { if (request === this.followRequest && !this.unloaded) this.followReady = false }
  },
  getPreferenceSignature() {
    return JSON.stringify([STORAGE_KEYS.preferredDomains,STORAGE_KEYS.preferredTopics,STORAGE_KEYS.preferredCities,STORAGE_KEYS.preferredFormats,STORAGE_KEYS.growthGoals,STORAGE_KEYS.personalizationEnabled].map(key => wx.getStorageSync(key)))
  },
  async onCardFollow(e) {
    return toggleListFollow(this, e.detail && e.detail.event, api, wx, e.detail && e.detail.following)
  },

  onUnload() {
    this.unloaded = true
    this.requestId = (this.requestId || 0) + 1
    this.followRequest = (this.followRequest || 0) + 1
    if (this.updatedTimer) clearInterval(this.updatedTimer)
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer)
    clearTimeout(this.followPulseTimer)
    this.disconnectExposureObserver()
  },

  buildTabs() {
    let prefs = []
    let topics = []
    try {
      prefs = wx.getStorageSync(STORAGE_KEYS.preferredDomains) || []
      topics = wx.getStorageSync(STORAGE_KEYS.preferredTopics) || []
    } catch (e) {
      prefs = []
    }
    const personalizationEnabled = wx.getStorageSync(STORAGE_KEYS.personalizationEnabled) !== false
    const weightMap = (personalizationEnabled ? prefs : []).reduce((acc, p) => {
      acc[p.domain] = p.weight || 0
      return acc
    }, {})
    if (personalizationEnabled && topics.some((topic) => topic && topic.domain === 'ent' && ['art_exhibition', 'brand_popup', 'dessert_cafe', 'nightlife'].indexOf(topic.key) >= 0)) {
      weightMap.culture = Math.max(weightMap.culture || 0, weightMap.ent || 3)
    }
    if (personalizationEnabled && topics.some((topic) => topic && topic.domain === 'ent' && topic.key === 'anime_show')) {
      weightMap.anime = Math.max(weightMap.anime || 0, weightMap.ent || 3)
    }
    const sorted = DOMAINS.slice().sort((a, b) => (weightMap[b.key] || 0) - (weightMap[a.key] || 0))
    const tabs = [{ key: 'all', label: '推荐' }].concat(sorted.map((d) => ({ key: d.key, label: d.label })))
    this.setData({ tabs })
  },

  decorate(list, serverTime) {
    return list.map(simplifyEvent).map((e) => ({
      ...e,
      _meta: DOMAIN_MAP[e.domain] || { label: e.domain, color: '#5F5E5A', bg: '#F1EFE8' },
      _timeText: e.timePrecision === 'month_range'
        ? (e.scheduleWindowLabel || '月份范围待确认') + ' · 具体日期待公布'
        : (isDateOnly(e) || !requiresExactEventTime(e)
            ? dayjs(e.startTime).format('M月D日') + (requiresExactEventTime(e) ? ' · 时刻核实中' : '')
            : dayjs(e.startTime).format('M月D日 HH:mm')),
      _countdownText: eventCountdownText(e, serverTime),
      _ctaText: cardCta(e)
    }))
  },

  onPageScroll(e) { this.scrollTop=Math.max(0,Number(e.scrollTop)||0) },

  async loadEvents(withSkeleton, append, background) {
    if (append && (this.data.loadingMore || this.data.loading || this.feedRefreshing)) return
    const requestId = (this.requestId || 0) + 1
    this.requestId = requestId
    if (!append) {
      this.pendingFeed=null
      this.setData({pendingUpdate:false})
      this.feedGeneration = (this.feedGeneration || 0) + 1
      this.feedbackUndo = null
      if (this.feedbackTimer) clearTimeout(this.feedbackTimer)
      this.setData({ feedbackMessage: '' })
    }
    const cacheKey = feedCache.key(this.data.activeTab, this.data.sortMode, this.getPreferenceSignature())
    const cacheVersion = feedCache.version()
    const cached = !append && withSkeleton ? feedCache.read(cacheKey) : null
    const keepVisible = !withSkeleton && !append && this.data.list.length > 0
    this.feedRefreshing = !append
    if (cached) {
      this.feedOrder = cached.feedOrder
      const serverTime = Date.now() + (this.serverTimeOffset || 0)
      this.setData({ list: this.decorate(cached.list || [], serverTime), loading: false, loadingMore: false,
        error: '', nextCursor: cached.nextCursor, latestFetchedAt: cached.latestFetchedAt || cached.serverTime,
        serverTime }, () => this.trackImpressions())
      this.tickUpdatedText()
    } else if (withSkeleton) this.setData({ loading: true, loadingMore: false, error: '', moreError: '', updatedText: '', latestFetchedAt: 0, nextCursor: null, list: [] })
    if (append) this.setData({ loadingMore: true, moreError: '' })
    try {
      const domain = this.data.activeTab
      const cursor = append ? this.data.nextCursor : 0
      const res = await api.getEvents({ domain, cursor, pageSize: 20, cardOnly: true, sortMode: this.data.sortMode,
        feedOrder: append ? this.feedOrder : undefined })
      if (requestId !== this.requestId) return
      if((background || cached) && cacheVersion!==feedCache.version())return
      const personalizationEnabled = res.personalizationEnabled !== false
      this.personalizationEnabled = personalizationEnabled
      wx.setStorageSync(STORAGE_KEYS.personalizationEnabled, personalizationEnabled)
      if (!append) feedCache.write(feedCache.key(domain, this.data.sortMode, this.getPreferenceSignature()), res, cacheVersion)
      const serverTime = res.serverTime || Date.now()
      this.serverTimeOffset = serverTime - Date.now()
      const incoming = this.decorate(res.list || [], serverTime)
      this.lastFeedAt=Date.now()
      if(!append && (background || cached) && (this.scrollTop || 0)>80 && this.data.list.length &&
          personalizationEnabled === (cached ? cached.personalizationEnabled !== false : this.lastRenderedPersonalization !== false)) {
        const comparable=rows=>JSON.stringify(rows.map(row=>{
          const {_meta,_timeText,_countdownText,_ctaText,...content}=row
          return content
        }))
        if(comparable(this.data.list.slice(0,incoming.length))!==comparable(incoming) || incoming.length===0 || res.nextCursor==null && this.data.list.length>incoming.length) {
          this.pendingFeed={res,version:cacheVersion,signature:this.getPreferenceSignature(),domain,sort:this.data.sortMode}
          this.setData({pendingUpdate:true,loading:false,loadingMore:false})
          return
        }
        // Keep all previously loaded pages and their pagination when content is unchanged.
        this.setData({latestFetchedAt:res.latestFetchedAt || res.serverTime,serverTime})
        this.tickUpdatedText()
        return
      }
      this.feedOrder = res.feedOrder
      this.lastRenderedPersonalization=personalizationEnabled
      // Always pass both the first page and later pages through the same final
      // rendering guard. The backend can legitimately reorder recommendations
      // between requests, and legacy records may use different document IDs.
      const previous = append ? this.data.list : []
      const list = mergeUniqueEvents(previous, incoming)
      this.setData({
        list,
        loading: false,
        loadingMore: false,
        error: '',
        moreError: '',
        latestFetchedAt: res.latestFetchedAt || res.serverTime,
        serverTime: res.serverTime || Date.now(),
        nextCursor: res.nextCursor == null ? null : res.nextCursor
      }, () => this.trackImpressions())
      this.tickUpdatedText()
    } catch (err) {
      if (requestId !== this.requestId) return
      console.error('[home] loadEvents failed', err)
      this.setData({
        loading: false,
        loadingMore: false,
        error: append || cached || keepVisible ? '' : '加载失败，请检查网络后重试',
        moreError: append ? '加载更多失败，点击重试' : ''
      })
      if (append) wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      if (cached) wx.showToast({ title: '刷新失败，暂显示最近加载的内容', icon: 'none' })
      if (keepVisible) wx.showToast({ title: '刷新失败，已保留当前活动', icon: 'none' })
    } finally {
      if (requestId === this.requestId) this.feedRefreshing = false
    }
  },

  onApplyFeedUpdate() {
    const pending=this.pendingFeed
    if(!pending)return
    this.pendingFeed=null
    this.setData({pendingUpdate:false})
    if(pending.version!==feedCache.version() || pending.signature!==this.getPreferenceSignature() || pending.domain!==this.data.activeTab || pending.sort!==this.data.sortMode) {
      this.loadEvents(false)
      return
    }
    this.requestId=(this.requestId || 0)+1
    this.feedGeneration=(this.feedGeneration || 0)+1
    this.feedRefreshing=false
    const res=pending.res,now=Date.now()+(this.serverTimeOffset || 0)
    this.feedOrder=res.feedOrder
    this.lastRenderedPersonalization=res.personalizationEnabled!==false
    this.setData({list:mergeUniqueEvents([],this.decorate(res.list || [],now)),nextCursor:res.nextCursor==null?null:res.nextCursor,
      latestFetchedAt:res.latestFetchedAt || res.serverTime,serverTime:now,loading:false,loadingMore:false,error:'',moreError:''},()=>this.trackImpressions())
    this.scrollTop=0
    wx.pageScrollTo({scrollTop:0,duration:0})
    this.tickUpdatedText()
  },

  disconnectExposureObserver() {
    if (this.exposureObserver) this.exposureObserver.disconnect()
    this.exposureObserver = null
  },

  trackImpressions() {
    this.disconnectExposureObserver()
    if (this.unloaded || this.homeVisible === false) return
    if (wx.getStorageSync(STORAGE_KEYS.personalizationEnabled) === false) return
    if (typeof wx.createIntersectionObserver !== 'function') return
    this.exposureTimes = this.exposureTimes || {}
    this.exposureObserver = wx.createIntersectionObserver(this, {observeAll:true, thresholds:[0.5]})
    this.exposureObserver.relativeToViewport().observe('.feed-card-observer', result => {
      const id = result.dataset && result.dataset.eventId
      const now = Date.now()
      if (!id || result.intersectionRatio < 0.5 || now-(this.exposureTimes[id] || 0) < 5*60000) return
      this.exposureTimes[id] = now
      api.recordImpressions([id], 'home_' + this.data.sortMode).catch(() => {})
    })
  },

  tickUpdatedText() {
    if (!this.data.latestFetchedAt) return
    const now = Date.now() + (this.serverTimeOffset || 0)
    const patch = {}
    this.data.list.forEach((item, index) => {
      const next = eventCountdownText(item, now)
      if (next !== item._countdownText) patch['list[' + index + ']._countdownText'] = next
    })
    const updatedText = minutesAgoText(this.data.latestFetchedAt, now)
    if (updatedText !== this.data.updatedText) patch.updatedText = updatedText
    if (Object.keys(patch).length) this.setData(patch)
  },

  resetFeed(nextState) {
    this.scrollTop=0
    this.feedGeneration = (this.feedGeneration || 0) + 1
    const transitionId = (this.requestId || 0) + 1
    this.requestId = transitionId
    this.setData(Object.assign({
      feedVisible: false,
      list: [],
      loading: true,
      loadingMore: false,
      error: '',
      moreError: '',
      updatedText: '',
      latestFetchedAt: 0,
      nextCursor: null
    }, nextState || {}), () => {
      // Remove the entire feed subtree so the WebView cannot reuse cards from
      // the previous tab/sort generation.
      wx.nextTick(() => {
        if (transitionId !== this.requestId) return
        this.setData({ feedVisible: true }, () => {
          if (transitionId !== this.requestId) return
          this.loadEvents(true)
          wx.pageScrollTo({ scrollTop: 0, duration: 0 })
        })
      })
    })
  },

  onTabChange(e) {
    const value = e.detail.value
    if (value === this.data.activeTab) return
    this.resetFeed({ activeTab: value })
  },

  onOpenSearch() { wx.navigateTo({ url: '/pages/search/search' }) },

  onSortChange(e) {
    const value = e.currentTarget.dataset.mode
    if (SORT_MODES.indexOf(value) < 0 || value === this.data.sortMode) return
    wx.setStorageSync(SORT_STORAGE_KEY, value)
    this.resetFeed({
      sortMode: value,
      sortIndex: SORT_MODES.indexOf(value)
    })
  },


  onPullDownRefresh() {
    this.loadEvents(false).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.nextCursor == null || this.data.loading || this.data.loadingMore || this.data.moreError) return
    this.loadEvents(false, true)
  },

  onRetry() {
    this.loadEvents(true)
  },
  onRetryMore() {
    if (this.data.nextCursor != null) this.loadEvents(false, true)
  },

  onCardTap(e) {
    const { event } = e.detail
    if(!event || !event._id) return
    try { wx.setStorageSync(STORAGE_KEYS.currentEvent, Object.assign({},event,{_cardOnly:true})) } catch(error) { /* Navigation must work even when storage is full. */ }
    wx.navigateTo({ url: '/pages/detail/detail?id=' + event._id })
  },

  onCardCta(e) {
    this.onCardTap(e)
  },

  onCardMore(e) {
    const event = e.detail.event
    wx.showActionSheet({
      itemList: ['不想看这个活动', '少推荐这个主题', '地点不适合'],
      success: async (res) => {
        if (this.data.feedbackBusy) return
        const action = ['hide', 'dislike', 'location_mismatch'][res.tapIndex]
        if (!action) return
        const previous = this.data.list
        const generation = this.feedGeneration
        this.setData({ feedbackBusy: true })
        try {
          const result = await api.recordSignal(event._id, action)
          if (generation !== this.feedGeneration) return
          // A cache-first feed may still have an older refresh in flight.
          // It must not put a just-hidden activity back onto the page.
          if (this.feedRefreshing) {
            this.requestId = (this.requestId || 0) + 1
            this.feedRefreshing = false
          }
          this.feedbackUndo = {event, index:previous.findIndex(item=>item._id===event._id), generation, feedbackAt:result.feedbackAt}
          if (this.feedbackTimer) clearTimeout(this.feedbackTimer)
          this.setData({ list:this.data.list.filter(item=>item._id!==event._id), feedbackMessage:result.skipped ? '本次浏览已隐藏' : ['已隐藏这个活动','已减少同主题推荐','已调整地点推荐'][res.tapIndex] })
          this.feedbackTimer = setTimeout(()=>{this.feedbackUndo=null;this.setData({feedbackMessage:''})},8000)
        } catch (err) {
          console.error('[home] dislike failed', err)
          wx.showToast({ title: '操作失败，请重试', icon: 'none' })
        } finally { this.setData({feedbackBusy:false}) }
      }
    })
  },

  async onUndoFeedback() {
    const undo = this.feedbackUndo
    if (!undo || this.data.feedbackBusy || undo.generation !== this.feedGeneration) return
    this.setData({feedbackBusy:true})
    try {
      if (undo.feedbackAt) await api.recordSignal(undo.event._id,'undo_feedback',{feedbackAt:undo.feedbackAt})
      if (undo.generation !== this.feedGeneration) return
      const list = this.data.list.slice()
      if (!list.some(item=>item._id===undo.event._id)) list.splice(Math.min(undo.index,list.length),0,undo.event)
      this.setData({list,feedbackMessage:''},()=>this.trackImpressions())
      this.feedbackUndo = null
      if (this.feedbackTimer) clearTimeout(this.feedbackTimer)
    } catch (error) { wx.showToast({title:'撤销失败，请重试',icon:'none'}) }
    finally { this.setData({feedbackBusy:false}) }
  }
})
