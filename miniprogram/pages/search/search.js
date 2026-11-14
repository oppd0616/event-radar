const api = require('../../utils/api')
const dayjs = require('dayjs')
const { DOMAIN_MAP, STORAGE_KEYS } = require('../../utils/constants')
const { toggleListFollow } = require('../../utils/follow-interaction')
const { requiresExactEventTime } = require('../../utils/event-time-policy')
const HISTORY = 'eventSearchHistoryV1'
const { previewOf, conditionsOf } = require('../../utils/search-presentation')
Page({
  data: { input: '', query: '', history: [], suggestions: [], suggestionsLoading: false, suggestionsError: '', prompts: ['黑客松', '演唱会 上海', '无畏契约', '漫展'], list: [], loading: false, loadingMore: false, error: '', moreError: '', total: 0, nextCursor: null, sortMode: 'relevance', city: '', cities: ['全部城市', '线上'], period: '', periods: ['不限时间', '本周', '未来30天', '自定义'], dateFrom: '', dateTo: '', includeEnded: false, followRecords: [], followBusyId: '' },
  onHide() {
    clearTimeout(this.enterTimer); clearTimeout(this.followPulseTimer)
    this.setData({ list: this.data.list.map(item => Object.assign({}, item, { _enter: false })), followPulseId: '' })
  },
  onRemoveCondition(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'query') { this.onClear(); return }
    if (key === 'city') this.setData({ city: '', cityIndex: 0 })
    else if (key === 'period') this.setData({ period: '', dateFrom: '', dateTo: '' })
    else if (key === 'ended') this.setData({ includeEnded: false })
    else return
    this.fetchResults(false)
  },
  onFocus() { this.setData({ inputFocused: true }) },
  onBlur() { this.setData({ inputFocused: false }) },
  onManageHistory() { this.setData({ historyEditing: !this.data.historyEditing }) },
  onToggleEnded() { this.setData({ includeEnded: !this.data.includeEnded }); this.fetchResults(false) },
  onResetFilters() { this.setData({ city: '', cityIndex: 0, period: '', dateFrom: '', dateTo: '', includeEnded: false }); this.fetchResults(false) },
  onLoad() {
    this.setData({ inputFocused: false, historyEditing: false, cityIndex: 0 })
    const history = wx.getStorageSync(HISTORY)
    this.setData({ history: Array.isArray(history) ? history.filter(item => typeof item === 'string').slice(0, 8) : [] })
  },
  async onShow() {
    if (this.followBusy) return
    const id = this.followRequest = (this.followRequest || 0) + 1
    try { const result = await api.getFollows(); if (!this.unloaded && id === this.followRequest) { this.followReady = true; this.setData({ followRecords: result.records || [] }) } }
    catch (error) { this.followReady = false }
  },
  onUnload() { this.unloaded = true; this.requestId = (this.requestId || 0) + 1; this.suggestionId = (this.suggestionId || 0) + 1; clearTimeout(this.inputTimer); clearTimeout(this.enterTimer); clearTimeout(this.followPulseTimer) },
  onInput(e) {
    const input = String(e.detail.value || '').slice(0, 80)
    this.setData({ input, suggestions: [], suggestionsError: '', suggestionsLoading: false })
    clearTimeout(this.inputTimer)
    const id = this.suggestionId = (this.suggestionId || 0) + 1
    if (!input.trim()) { this.requestId = (this.requestId || 0) + 1; this.setData({ query: '', conditions: [], list: [], loading: false, loadingMore: false }); return }
    if (input === this.data.query) return
    this.inputTimer = setTimeout(async () => {
      this.setData({ suggestionsLoading: true })
      try {
        const result = await api.searchEvents({ query: input.trim(), pageSize: 5 })
        if (!this.unloaded && id === this.suggestionId) this.setData({ suggestions: (result.list || []).map(item => Object.assign({}, item, previewOf(item, result.serverTime || Date.now()))), suggestionsLoading: false })
      } catch (error) { if (!this.unloaded && id === this.suggestionId) this.setData({ suggestionsLoading: false, suggestionsError: '暂时无法获取建议，仍可直接搜索' }) }
    }, 350)
  },
  onSubmit() { this.submit(this.data.input) },
  onChoose(e) { this.submit(e.currentTarget.dataset.query) },
  onPreviewTap(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.hideKeyboard()
    this.onCardTap({ detail: { id } })
  },
  submit(value) {
    const query = String(value || '').trim().slice(0, 80)
    if (!query) return
    clearTimeout(this.inputTimer); this.suggestionId = (this.suggestionId || 0) + 1
    const history = [query].concat(this.data.history.filter(item => item !== query)).slice(0, 8)
    this.setData({ input: query, query, history, suggestions: [], suggestionsLoading: false, suggestionsError: '', city: '', period: '', dateFrom: '', dateTo: '' })
    wx.hideKeyboard(); this.fetchResults(false)
    wx.setStorage({ key: HISTORY, data: history, fail: () => {} })
  },
  onClear() { this.onInput({ detail: { value: '' } }) },
  onClearHistory() { wx.removeStorageSync(HISTORY); this.setData({ history: [] }) },
  onDeleteHistory(e) { const history = this.data.history.filter(item => item !== e.currentTarget.dataset.query); wx.setStorageSync(HISTORY, history); this.setData({ history }) },
  onCity(e) { const city = this.data.cities[Number(e.detail.value)] || ''; this.setData({ city: city === '全部城市' ? '' : city, cityIndex: Number(e.detail.value) }); this.fetchResults(false) },
  onPeriod(e) { const period = ['', 'week', 'month', 'custom'][Number(e.detail.value)]; this.setData({ period }); if (period !== 'custom' || this.data.dateFrom && this.data.dateTo) this.fetchResults(false) },
  onDate(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); if (this.data.dateFrom && this.data.dateTo) this.fetchResults(false) },
  onSort(e) { this.setData({ sortMode: e.currentTarget.dataset.mode }); this.fetchResults(false) },
  onEnded(e) { this.setData({ includeEnded: e.detail.value }); this.fetchResults(false) },
  onRetry() { this.fetchResults(false) },
  onMore() { this.fetchResults(true) },
  onReachBottom() { if (this.data.nextCursor !== null && !this.data.loading && !this.data.loadingMore && !this.data.error) this.fetchResults(true) },
  async fetchResults(more) {
    if (!this.data.query || more && (this.data.loading || this.data.loadingMore || this.data.nextCursor === null)) return
    const conditions = conditionsOf(this.data)
    clearTimeout(this.enterTimer)
    if (this.data.period === 'custom' && (!this.data.dateFrom || !this.data.dateTo)) { this.requestId = (this.requestId || 0) + 1; this.setData({ conditions, loading: false, loadingMore: false, list: [], nextCursor: null }); return }
    if (this.data.period === 'custom' && this.data.dateFrom > this.data.dateTo) { this.requestId = (this.requestId || 0) + 1; this.setData({ conditions, error: '结束日期不能早于开始日期', loading: false, loadingMore: false, list: [] }); return }
    const id = this.requestId = (this.requestId || 0) + 1
    const keepResults = !more && this.resultQuery === this.data.query && this.data.list.length > 0
    const params = { query: this.data.query, sortMode: this.data.sortMode, city: this.data.city, period: this.data.period, dateFrom: this.data.dateFrom, dateTo: this.data.dateTo, includeEnded: this.data.includeEnded, pageSize: 20, cursor: more ? this.data.nextCursor : 0 }
    if (more) params.feedOrder = this.feedOrder
    this.setData(more ? { conditions, loadingMore: true, moreError: '', list: this.data.list.map(item => Object.assign({}, item, { _enter: false })) } : { conditions, loading: true, loadingMore: false, list: keepResults ? this.data.list.map(item => Object.assign({}, item, { _enter: false })) : [], error: '', moreError: '', nextCursor: null })
    try {
      const result = await api.searchEvents(params)
      if (this.unloaded || id !== this.requestId) return
      const now = result.serverTime || Date.now()
      const list = (result.list || []).map((item, index) => {
        const dateOnly = item.timePrecision === 'date' || !requiresExactEventTime(item)
        const time = item.startTime ? dayjs(item.startTime).format(dateOnly ? 'M月D日' : 'M月D日 HH:mm') : '日期待公布'
        const end = item.endTime && (item.endTimePrecision === 'date' ? dayjs(item.endTime).endOf('day').valueOf() : item.endTime)
        return Object.assign({}, item, { _enter: !more && !keepResults && index < 4, _enterDelay: index * 24, recommendReason: '', _meta: DOMAIN_MAP[item.domain] || { label: '活动', color: '#666', bg: '#EEE' }, _time: item.scheduleWindowLabel || time, _countdown: end && end < now ? '已结束' : item.currentStageState === 'active' || item.startTime <= now && end > now ? '进行中' : item.startTime > now ? '即将开始' : '已开始', _cta: '查看详情' })
      })
      this.feedOrder = result.feedOrder
      this.resultQuery = params.query
      const cities = ['全部城市', '线上'].concat((result.cities || []).filter(city => city !== '线上'))
      this.setData({ cityIndex: Math.max(0, cities.indexOf(this.data.city || '全部城市')), list: more ? this.data.list.map(item => Object.assign({}, item, { _enter: false })).concat(list.filter(item => !this.data.list.some(old => old._id === item._id))) : list, cities, total: result.total || 0, nextCursor: result.nextCursor === undefined ? null : result.nextCursor, loading: false, loadingMore: false })
      if (!more) this.enterTimer = setTimeout(() => {
        if (!this.unloaded && id === this.requestId) this.setData({ list: this.data.list.map(item => Object.assign({}, item, { _enter: false })) })
      }, 280)
    } catch (error) { if (!this.unloaded && id === this.requestId) this.setData(more ? { loadingMore: false, moreError: '加载失败，点击重试' } : { loading: false, error: error.message || '搜索失败，请重试' }) }
  },
  onCardTap(e) {
    const id=e.detail.id
    if (!id) return
    const event=e.detail.event || this.data.list.concat(this.data.suggestions).find(item=>item._id===id)
    if(event) { try { wx.setStorageSync(STORAGE_KEYS.currentEvent,Object.assign({},event,{_cardOnly:true})) } catch(error) {} }
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(id) })
  },
  async onCardFollow(e) {
    return toggleListFollow(this, e.detail.event, api, wx, e.detail.following)
  }
})
