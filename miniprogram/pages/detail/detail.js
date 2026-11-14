const dayjs = require('dayjs')
const { DOMAIN_MAP, SUBSCRIBE_TEMPLATE_ID, STORAGE_KEYS } = require('../../utils/constants')
const api = require('../../utils/api')
const { isFollowed } = require('../../utils/follows')
const { requiresExactEventTime } = require('../../utils/event-time-policy')
const { hostOf, isDateOnly, mainlandLinkType, simplifyEvent } = require('../../utils/content')
const { stateOf: stageStateOf } = require('../../utils/stage-state')
const openingSchedule = require('../../utils/opening-schedule')

function inferredPrecision(timestamp, precision) {
  if (precision === 'date' || precision === 'datetime' || precision === 'month_range') return precision
  const value = dayjs(timestamp)
  return value.hour() === 0 && value.minute() === 0 ? 'date' : 'datetime'
}

function withoutFullStops(value) {
  return String(value == null ? '' : value)
    .replace(/。/g, '')
    .replace(/\.(?=\s|$)/g, '')
    .trim()
}

const GENERIC_HOT_KEYWORD_PATTERN = /^(?:活动|热门|推荐|游戏|体育|文娱|演出|数码|科技|汽车|财经|动漫|竞赛成长|线下活动|线上活动|现场参与|官网参与|需购票|需报名|电竞|赛事|比赛|总决赛|冠军赛|演唱会|音乐节|展览|快闪)$/

function hotKeywordsOf(event) {
  const candidates = Array.isArray(event.highlights)
    ? event.highlights.map((item) => typeof item === 'string' ? item : (item && (item.label || item.value)))
    : []
  const seen = {}
  return candidates.map(withoutFullStops).map((item) => item.trim()).filter((item) => {
    const key = item.toLowerCase().replace(/[\s\-—·,，!！?？"'“”‘’【】\[\]()（）]/g, '')
    if (!key || item.length < 2 || item.length > 14 || GENERIC_HOT_KEYWORD_PATTERN.test(item) || seen[key]) return false
    seen[key] = true
    return true
  }).slice(0, 3)
}

function timelineTime(timestamp, precision) {
  return dayjs(timestamp).format(precision === 'datetime' ? 'M月D日 HH:mm' : 'M月D日')
}

function monthRangeText(startTime, endTime) {
  const start = dayjs(startTime)
  const end = dayjs(endTime || startTime)
  return start.isSame(end, 'month')
    ? start.format('YYYY年M月') + ' · 具体日期待核实'
    : start.format('YYYY年M月') + '—' + end.format(start.isSame(end, 'year') ? 'M月' : 'YYYY年M月') + ' · 具体日期待核实'
}

function participationNodeNames(event) {
  const participation = event && event.participation || {}
  const text = String(participation.note || '')
  if (event && event.domain === 'academic' &&
      /征稿|徵稿|征集|徵集|投稿|作品提交|提交作品/.test([text, event.summary,
        event.academicValue && event.academicValue.keyDeadline].filter(Boolean).join(' '))) {
    return ['开放投稿', '投稿截止']
  }
  if (/购票|门票|票务|抢票|开票/.test(text)) return ['开始售票', '售票截止']
  if (participation.type === 'registration') return ['开放报名', '报名截止']
  if (participation.type === 'livestream') return ['直播开放', '直播结束']
  return ['开放预约', '预约截止']
}

function timelineItemsOf(event, now) {
  const guide = event.participationGuide || {}
  const names = participationNodeNames(event)
  const exactEventClock = requiresExactEventTime(event)
  const items = []
  if (guide.accessStartTime) items.push({
    key: 'access-start', name: names[0], startTime: Number(guide.accessStartTime),
    precision: guide.accessTimePrecision || 'date'
  })
  if (guide.accessEndTime) items.push({
    key: 'access-end', name: names[1], startTime: Number(guide.accessEndTime),
    precision: guide.accessEndTimePrecision || 'date'
  })
  const stages = Array.isArray(event.stages) ? event.stages : []
  stages.forEach((stage, index) => {
    const baseName = stage.key === 'knockout' && /小组赛及淘汰赛/.test([event.title, event.summary].join(' '))
      ? '小组赛及淘汰赛'
      : (stage.name || stage.sourceLabel || '活动阶段')
    const sessionName = withoutFullStops(stage.sessionKey || '')
    items.push({
    key: 'stage-' + (stage.key || index) + '-' + stage.startTime,
    name: sessionName && baseName.indexOf(sessionName) < 0 ? baseName + ' · ' + sessionName : baseName,
    startTime: Number(stage.startTime),
    endTime: Number(stage.endTime) || 0,
    precision: stage.timePrecision === 'month_range' ? 'month_range' :
      (exactEventClock ? (stage.timePrecision || 'date') : 'date'),
    endPrecision: exactEventClock ? (stage.endTimePrecision || 'date') : 'date',
    duration: true,
    durationType: stage.durationType,
    phaseKey: stage.key,
    venue: withoutFullStops(stage.venue || ''),
    participantsText: Array.isArray(stage.participants)
      ? stage.participants.map(withoutFullStops).filter(Boolean).join(' · ')
      : ''
    })
  })
  const sameDay = (left, right) => left && right && dayjs(left).isSame(dayjs(right), 'day')
  const submissionStartAlreadyShown = names[0] === '开放投稿' &&
    (sameDay(guide.accessStartTime, event.startTime) || sameDay(guide.accessEndTime, event.startTime))
  const submissionEndAlreadyShown = names[1] === '投稿截止' && sameDay(guide.accessEndTime, event.endTime)
  if (!stages.length && !submissionStartAlreadyShown) {
    items.push({
      key: 'event-start', name: event.timePrecision === 'month_range' ? '活动时间范围' : '活动开始', startTime: Number(event.startTime),
      endTime: Number(event.endTime) || 0,
      duration: true,
      precision: event.timePrecision === 'month_range' ? 'month_range' :
        (exactEventClock ? (event.timePrecision || 'date') : 'date')
    })
  }
  if (event.endTime && !stages.length && !submissionEndAlreadyShown && event.timePrecision !== 'month_range') items.push({
    key: 'event-end', name: '活动结束', startTime: Number(event.endTime),
    precision: exactEventClock ? (event.endTimePrecision || 'date') : 'date'
  })
  return items.filter((item) => item.startTime).sort((a, b) =>
    Number(a.precision === 'month_range') - Number(b.precision === 'month_range') || a.startTime - b.startTime)
    .filter((item, index, list) => list.findIndex((other) => other.name === item.name && other.startTime === item.startTime) === index)
    .slice(0, 12)
    .map((item) => {
      const state = stageStateOf({
        key: item.phaseKey, startTime: item.startTime, endTime: item.endTime,
        timePrecision: item.precision, endTimePrecision: item.endPrecision,
        durationType: item.durationType
      }, now, {
        duration: item.phaseKey ? undefined : !!item.duration,
        eventEndTime: item.duration ? event.endTime : 0,
        eventEndPrecision: event.endTimePrecision
      })
      return Object.assign({}, item, {
      timeText: item.precision === 'month_range'
        ? (String(item.key).startsWith('stage-')
            ? monthRangeText(item.startTime, item.endTime)
            : (event.scheduleWindowLabel || monthRangeText(item.startTime, item.endTime)))
        : timelineTime(item.startTime, item.precision) +
          (item.endTime && !dayjs(item.endTime).isSame(dayjs(item.startTime), 'day')
            ? '—' + timelineTime(item.endTime, item.endPrecision || 'date') : ''),
      state,
      stateText: state === 'active' ? '当前' : state === 'started' ? '已开始' : state === 'done' ? '已完成' : ''
      })
    })
}

Page({
  data: {
    following: false,
    followBusy: false,
    followReady: false,
    event: null,
    previewEvent: null,
    followPulse: false,
    meta: null,
    eventTimeLabel: '活动开始时间',
    timeText: '',
    endText: '',
    countdownLabel: '距活动开始',
    countdownStatusText: '',
    countdownStatusTone: '',
    showCountdown: true,
    accessTimeLabel: '',
    accessTimeText: '',
    accessTimePending: false,
    accessEndLabel: '',
    accessEndText: '',
    participationTitle: '参与方式',
    participationBadges: [],
    participationRows: [],
    participationLinks: [],
    participationSteps: [],
    timelineItems: [],
    pendingTimelineItems: [],
    timelineNeedsReview: false,
    hotKeywords: [],
    academicRows: [],
    remainMs: 0,
    focusEndTime: 0,
    focusTimePrecision: 'date',
    started: false,
    loading: true,
    loadError: '',
    reminding: false,
    sourceDisplayName: '',
    sourceDisplayUrl: ''
  },

  async onLoad(options) {
    this.detailOptions = options || {}
    const request = (this.detailRequest || 0) + 1
    this.detailRequest = request
    this.setData({ loading: true, loadError: '', previewEvent:null })
    if (wx.showShareMenu) {
      wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    }
    const id = options && options.id
    let event = null
    let freshDetail = false
    let loadError = ''
    try {
      const cached = wx.getStorageSync(STORAGE_KEYS.currentEvent)
      if (cached && cached._id === id) {
        if (!cached._cardOnly) event = cached
        const previewMeta=DOMAIN_MAP[cached.domain] || {label:'活动',color:'#68738f',bg:'#eceef5'}
        this.setData({ previewEvent:{title:cached.displayTitle || cached.title,meta:previewMeta,
          date:cached.timePrecision==='month_range' ? cached.scheduleWindowLabel || '日期待确认' : cached.startTime ? dayjs(cached.startTime).format('M月D日') : '',city:cached.city || ''} })
      }
    } catch (e) {}
    try {
      const res = await api.getEventDetail(id)
      if (request !== this.detailRequest) return
      freshDetail = !!res.event
      this.serverTimeOffset = Number(res.serverTime || Date.now()) - Date.now()
      event = res.event || null
    } catch (err) {
      if (request !== this.detailRequest) return
      loadError = '详情加载失败，请检查网络后重试'
      console.warn('[detail] fetch failed, using cache', err)
    }
    if (!event) {
      this.setData({ loading: false, loadError,previewEvent:null })
      return
    }
    this.renderEvent(event)
    await this.refreshFollow()
    if (request !== this.detailRequest) return
    if (freshDetail && options.followSnapshot) api.markFollowSeen(event._id, options.followSnapshot).catch(() => {})
    this.detailEnteredAt = this.detailVisible === false ? 0 : Date.now()
    this.detailVisibleMs = 0
    api.recordSignal(event._id, 'view').catch(() => {})
  },

  onShow() {
    this.detailVisible = true
    if (this.detailEnteredAt === 0 && this.data.event) this.detailEnteredAt = Date.now()
  },

  onHide() {
    this.detailVisible = false
    if (this.detailEnteredAt) this.detailVisibleMs = (this.detailVisibleMs || 0) + Date.now()-this.detailEnteredAt
    this.detailEnteredAt = 0
  },

  onUnload() {
    this.detailRequest = (this.detailRequest || 0) + 1
    this.detailUnloaded = true
    clearTimeout(this.followPulseTimer)
    const event = this.data.event
    const durationMs = (this.detailVisibleMs || 0) + (this.detailEnteredAt ? Date.now()-this.detailEnteredAt : 0)
    if (event && durationMs >= 3000) {
      api.recordSignal(event._id, 'dwell', { durationMs }).catch(() => {})
    }
  },

  async refreshFollow() {
    if (this.data.followBusy && this.data.followReady) return
    const request = (this.followRequest || 0) + 1
    this.followRequest = request
    try {
      const res = await api.getFollows()
      if (this.detailUnloaded || request !== this.followRequest) return
      this.setData({ following: isFollowed(this.data.event || {}, res.records), followReady: true })
    } catch (error) { if (!this.detailUnloaded && request === this.followRequest) this.setData({ followReady: false }) }
  },
  async onFollow() {
    if (this.data.followBusy || !this.data.event) return
    this.setData({ followBusy: true })
    let before
    try {
      if (!this.data.followReady) await this.refreshFollow()
      if (this.detailUnloaded) return
      if (!this.data.followReady) throw new Error('关注加载失败，请重试')
      before = this.data.following
      const following = !before
      this.followRequest = (this.followRequest || 0) + 1
      clearTimeout(this.followPulseTimer)
      this.setData({ following,followPulse:following })
      this.followPulseTimer=setTimeout(()=>{if(!this.detailUnloaded)this.setData({followPulse:false})},220)
      const result=await api.setFollow(this.data.event._id, following)
      if (result.ok === false) throw new Error(result.error || '操作失败')
      if (this.detailUnloaded) return
      this.followRequest = (this.followRequest || 0) + 1
      this.setData({ following })
    } catch (error) {
      this.followRequest = (this.followRequest || 0) + 1
      if(!this.detailUnloaded) {
        if(typeof before==='boolean')this.setData({following:before,followPulse:false})
        wx.showToast({ title: error.message || '操作失败，请重试', icon: 'none' })
      }
    }
    finally { if (!this.detailUnloaded) this.setData({ followBusy: false }) }
  },
  onRetryDetail() {
    if (!this.data.loading) this.onLoad(this.detailOptions)
  },

  sourceInfo(event) {
    const source = (event && event.source) || {}
    const rawName = String(source.name || '').trim()
    const sourceUrl = String(source.url || '')
    const participationUrl = String(event && event.participation && event.participation.url || '')
    const sourceHost = hostOf(sourceUrl)
    const linkType = mainlandLinkType(participationUrl)
    if (linkType === 'official') return { name: '中国大陆官方网站', url: participationUrl }
    if (linkType === 'ticket') return { name: '中国大陆票务渠道', url: participationUrl }
    if (/^(?:www\.)?[\w-]+(?:\.[\w-]+)+\/?$/i.test(rawName)) {
      return { name: rawName.replace(/^www\./i, '').replace(/\/$/, ''), url: sourceUrl }
    }
    if (rawName && rawName.indexOf('http') !== 0 && rawName.length <= 24) return { name: rawName, url: sourceUrl }
    return { name: sourceHost || rawName || '公开信息来源', url: sourceUrl }
  },

  guideConfig(event) {
    const participation = (event && event.participation) || {}
    const guide = (event && event.participationGuide) || {}
    const type = participation.type || 'website'
    const domain = event.domain || ''
    const note = String(participation.note || '')
    const participationHost = hostOf(participation.url)
    const platformNames = ['大麦', '猫眼', '票星球', 'Ticketmaster', 'Eventbrite', '哔哩哔哩', 'B站', '视频号', 'YouTube', 'Twitch', 'Kaggle']
    const detectedPlatform = participationHost === 'show.bilibili.com'
      ? '哔哩哔哩会员购'
      : platformNames.find((name) => note.toLowerCase().indexOf(name.toLowerCase()) >= 0)
    const isTicket = ['ent', 'culture', 'sports', 'anime'].indexOf(domain) >= 0 || /购票|门票|票务|抢票/.test(note)
    const isSubmission = participationNodeNames(event)[0] === '开放投稿'
    const accessTimeLabel = isSubmission
      ? '投稿开始时间'
      : isTicket
      ? '购票开始时间'
      : (type === 'registration'
          ? '报名开始时间'
          : (type === 'livestream' ? '直播开放时间' : '预约开放时间'))
    const typeLabels = {
      livestream: '线上直播',
      registration: isTicket ? '需购票' : (isSubmission ? '可投稿' : '需报名'),
      offline: isTicket ? '线下活动' : '现场参与',
      website: '官网参与'
    }
    const platformLabels = {
      livestream: '直播平台',
      registration: isTicket ? '购票平台' : (isSubmission ? '投稿渠道' : '报名渠道'),
      offline: isTicket ? '购票平台' : '参与入口',
      website: '活动入口'
    }
    const defaults = {
      livestream: ['复制直播链接，在浏览器中打开', '建议在活动开始前进入官方页面', '直播安排与回放信息以官方公告为准'],
      registration: isTicket
        ? ['复制参与链接，查看场次与票务信息', '按票务平台要求完成购票操作', '开售时间与入场规则以官方页面为准']
        : (isSubmission
            ? ['打开官方页面，核对作品要求和截止时间', '按要求提交作品及必要材料', '保存提交凭证并留意评审通知']
            : ['打开官方页面，查看报名条件与截止时间', '按要求填写信息并提交报名', '保存报名凭证并留意后续通知']),
      offline: ['打开官方页面，确认地点与参与要求', '按页面说明完成预约或入场准备', '临时调整以主办方最新公告为准'],
      website: ['复制参与链接，在浏览器中打开', '查看最新日程与参与说明', '重要变更以主办方公告为准']
    }
    const sourceSteps = Array.isArray(guide.steps)
      ? guide.steps.filter(Boolean).slice(0, 3).map(withoutFullStops)
      : []
    // City is useful context, but must not be presented as the actual venue.
    const location = String(guide.location || '').trim()
    const platform = String(participationHost === 'show.bilibili.com'
      ? '哔哩哔哩会员购'
      : (guide.platform || detectedPlatform || '官方页面')).trim()
    let hasOtherEntry = false
    const participationLinks = (Array.isArray(event.participationOptions) ? event.participationOptions : [])
      .filter((item, index, items) => item && item.url && item.url !== participation.url &&
        items.findIndex((other) => other && other.url === item.url) === index)
      .filter((item) => {
        // 多个票务/官网 URL 只展示一个补充入口；直播仍作为独立参与方式。
        if (item.type === 'livestream') return true
        if (hasOtherEntry) return false
        hasOtherEntry = true
        return true
      })
      .map((item) => {
        const optionHost = hostOf(item.url)
        const optionNote = String(item.note || '')
        const optionPlatform = String(item.platform ||
          (optionHost === 'live.bilibili.com' ? '哔哩哔哩直播' : '') ||
          platformNames.find((name) => optionNote.toLowerCase().indexOf(name.toLowerCase()) >= 0) ||
          optionHost || '官方入口')
        return {
          type: item.type || 'website',
          label: item.type === 'livestream' ? '直播平台' : '其他入口',
          value: withoutFullStops(optionPlatform),
          action: item.type === 'livestream' ? '复制直播链接' : '复制链接',
          url: item.url
        }
      })
    const accessTimePrecision = inferredPrecision(guide.accessStartTime, guide.accessTimePrecision)
    const accessStarted = guide.accessStartTime && Number(guide.accessStartTime) <= this.currentTime()
    const accessStartText = guide.accessStartTime
      ? dayjs(guide.accessStartTime).format(accessTimePrecision === 'datetime' ? 'YYYY年M月D日 HH:mm' : 'YYYY年M月D日') +
        (accessStarted ? ' · 已开放' : '')
      : (participation.url ? '参与入口已确认 · 开放时间核实中' : '尚未查到明确开放时间')
    const accessEndLabel = isSubmission
      ? '投稿截止时间'
      : isTicket
      ? '售票截止时间'
      : (type === 'registration' ? '报名截止时间' : '预约截止时间')
    const locationText = location || (type === 'livestream' ? '线上' : '地点核实中')
    const locationParts = locationText.match(/^(.+?)[（(]\s*(.+?)\s*[）)]$/)
    const rows = [
      // 平台/入口始终使用左右布局，较长名称在右侧区域内换行并保持右对齐
      { label: platformLabels[type] || '参与入口', value: platform, inline: true },
      {
        label: type === 'livestream' ? '参与地点' : '举办地点',
        value: locationParts ? locationParts[1].trim() : locationText,
        secondary: locationParts ? locationParts[2].trim() : '',
        location: true
      }
    ]
    if (guide.price) rows.push({ label: isTicket ? '票价' : '费用', value: guide.price })
    if (guide.eligibility) rows.push({ label: '参与条件', value: guide.eligibility })
    if (guide.entryRules) rows.push({ label: '重要规则', value: guide.entryRules })
    const displayRows = rows.map((item) => {
      const value = withoutFullStops(item.value)
      return Object.assign({}, item, {
        value,
        secondary: withoutFullStops(item.secondary),
        stacked: !item.location && !item.inline && value.length > 18
      })
    })
    const hasLivestream = type === 'livestream' || participationLinks.some((item) => item.type === 'livestream')
    const badges = Array.from(new Set(
      [typeLabels[type] || '官方参与']
        .concat(isTicket ? ['需购票'] : [])
        .concat(hasLivestream && type !== 'livestream' ? ['可在线观看'] : [])
    ))
    return {
      accessTimeLabel,
      accessTimeText: accessStartText,
      accessTimePending: !guide.accessStartTime,
      accessEndLabel,
      accessEndText: guide.accessEndTime
        ? dayjs(guide.accessEndTime).format(inferredPrecision(guide.accessEndTime, guide.accessEndTimePrecision) === 'datetime'
            ? 'YYYY年M月D日 HH:mm'
            : 'YYYY年M月D日')
        : '',
      badges,
      rows: displayRows,
      links: participationLinks,
      steps: sourceSteps.length >= 2 ? sourceSteps : (defaults[type] || defaults.website)
    }
  },

  renderEvent(event) {
    event = simplifyEvent(event)
    event = Object.assign({}, event, {
      title: withoutFullStops(event.title),
      summary: withoutFullStops(event.summary)
    })
    const now = this.currentTime()
    const openingState = openingSchedule.state(event.openingSchedule, now)
    const allTimelineItems = timelineItemsOf(event, now)
    const timelineItems = allTimelineItems.filter(item => item.precision !== 'month_range')
    const pendingTimelineItems = allTimelineItems.filter(item => item.precision === 'month_range')
    const focusStage = timelineItems.filter((item) => /^stage-/.test(item.key) && item.state === 'active').pop() ||
      timelineItems.filter((item) => /^stage-/.test(item.key) && item.state === 'started').pop() ||
      timelineItems.find((item) => /^stage-/.test(item.key) && item.state === 'upcoming')
    const timing = focusStage || {
      name: '', startTime: Number(event.startTime), endTime: Number(event.endTime) || 0,
      precision: event.timePrecision || 'date', endPrecision: event.endTimePrecision || 'date'
    }
    const remainMs = Math.max(0, timing.startTime - now)
    const guide = this.guideConfig(event)
    const sourceInfo = this.sourceInfo(event)
    const academicValue = event.academicValue || {}
    const academicRows = event.domain === 'academic'
      ? [
          { label: '适合专业', value: (academicValue.suitableMajors || []).join('、') },
          { label: '履历价值', value: academicValue.valueType },
          { label: '赛事层级', value: academicValue.level },
          { label: '可沉淀成果', value: academicValue.deliverables },
          { label: '准备投入', value: academicValue.workload },
          { label: '关键节点', value: academicValue.keyDeadline }
        ].filter((item) => item.value).map((item) => {
          const value = withoutFullStops(item.value)
          return Object.assign({}, item, { value, stacked: value.length > 18 })
        })
      : []
    const monthRange = timing.precision === 'month_range'
    const needsExactTime = requiresExactEventTime(focusStage
      ? Object.assign({}, event, { title: focusStage.name, sessionKey: focusStage.key }) : event)
    const dateOnly = timing.precision === 'date' || !needsExactTime
    const eventDay = dayjs(timing.startTime).startOf('day')
    const today = dayjs(now).startOf('day')
    const dateOnlyToday = dateOnly && eventDay.valueOf() === today.valueOf()
    const dateOnlyPassed = dateOnly && eventDay.valueOf() < today.valueOf()
    const dateOnlyDays = dateOnly ? eventDay.diff(today, 'day') : 0
    const started = dateOnly ? dateOnlyPassed : remainMs === 0
    const showCountdown = !openingState && !monthRange && !dateOnly && !started
    const countdownStatusText = openingState ? openingState.text : monthRange
      ? '阶段日期待核实'
      : (dateOnly
      ? (dateOnlyDays > 0
          ? '距活动日期 ' + dateOnlyDays + ' 天'
          : (dateOnlyToday ? '今日举行' + (needsExactTime ? ' · 具体时刻核实中' : '') : (timing.endTime && now < timing.endTime ? '进行中' : '活动已开始')))
      : (timing.endTime && now < timing.endTime ? '进行中' : '活动已开始'))
    const ongoing = started && timing.endTime && now < timing.endTime
    this.setData({
      event,
      openingRows: openingSchedule.rows((event.openingSchedule || []).filter((group,index,groups)=>group.scope !== 'event' ||
        groups.findIndex(other=>other.scope === 'event' && JSON.stringify(other.dates) === JSON.stringify(group.dates)) === index)),
      meta: DOMAIN_MAP[event.domain] || { label: event.domain, color: '#5F5E5A', bg: '#F1EFE8' },
      eventTimeLabel: focusStage ? focusStage.name + (dateOnly ? '日期' : '时间') : (dateOnly ? '活动日期' : '活动开始时间'),
      timeText: monthRange
        ? (focusStage ? focusStage.timeText : (event.scheduleWindowLabel || monthRangeText(timing.startTime, timing.endTime)))
        : (dateOnly
            ? dayjs(timing.startTime).format('YYYY年M月D日') + (needsExactTime ? ' · 具体时刻核实中' : '')
            : dayjs(timing.startTime).format('YYYY年M月D日 HH:mm')),
      endText: timing.endTime && !monthRange
        ? dayjs(timing.endTime).format(!dateOnly && inferredPrecision(timing.endTime, timing.endPrecision) === 'datetime' ? 'YYYY年M月D日 HH:mm' : 'YYYY年M月D日')
        : '',
      countdownLabel: focusStage
        ? (dateOnly ? '距' + focusStage.name + '日期' : '距' + focusStage.name)
        : (dateOnly ? '距活动日期' : '距活动开始'),
      countdownStatusText,
      countdownStatusTone: ongoing ? 'ongoing' : '',
      showCountdown,
      accessTimeLabel: guide.accessTimeLabel,
      accessTimeText: guide.accessTimeText,
      accessTimePending: guide.accessTimePending,
      accessEndLabel: guide.accessEndLabel,
      accessEndText: guide.accessEndText,
      participationBadges: guide.badges,
      participationRows: guide.rows,
      participationLinks: guide.links,
      participationSteps: guide.steps,
      timelineItems,
      pendingTimelineItems,
      timelineNeedsReview: pendingTimelineItems.length > 0 || Array.isArray(event.stageConflicts) && event.stageConflicts.length > 0,
      hotKeywords: hotKeywordsOf(event),
      academicRows,
      sourceDisplayName: sourceInfo.name,
      sourceDisplayUrl: sourceInfo.url,
      remainMs,
      focusEndTime: timing.endTime,
      focusTimePrecision: dateOnly ? 'date' : timing.precision,
      needsExactTime,
      started,
      loading: false
    })
  },

  onCountdownFinish() {
    const dateOnly = this.data.focusTimePrecision === 'date'
    const now = this.currentTime()
    const ongoing = !dateOnly && this.data.focusEndTime && now < this.data.focusEndTime
    this.setData({
      started: !dateOnly,
      showCountdown: false,
      countdownStatusText: dateOnly ? '今日举行' + (this.data.needsExactTime ? ' · 具体时刻核实中' : '') : (ongoing ? '进行中' : '活动已开始'),
      countdownStatusTone: ongoing ? 'ongoing' : ''
    })
  },

  currentTime() {
    return Date.now() + (this.serverTimeOffset || 0)
  },

  copyLink() {
    const url = this.data.event && this.data.event.participation && this.data.event.participation.url
    if (!url) return
    wx.setClipboardData({
      data: url,
      success: () => {
        api.recordSignal(this.data.event._id, 'official_click').catch(() => {})
        wx.showToast({ title: '链接已复制', icon: 'success' })
      }
    })
  },

  copyParticipationLink(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.setClipboardData({
      data: url,
      success: () => {
        api.recordSignal(this.data.event._id, 'official_click').catch(() => {})
        wx.showToast({ title: '链接已复制', icon: 'success' })
      }
    })
  },

  copySource() {
    const url = this.data.sourceDisplayUrl
    if (!url) return
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '来源链接已复制', icon: 'success' })
    })
  },

  onRemind() {
    const event = this.data.event
    if (!event || this.data.reminding) return
    this.setData({ reminding: true })
    const recordReminder = async () => {
      this.setData({ reminding: true })
      try {
        await api.addSubscriptionQuota({
          eventId: event._id,
          domain: event.domain,
          eventTitle: event.title
        })
        api.recordSignal(event._id, 'remind').catch(() => {})
        wx.showToast({ title: '提醒已开启', icon: 'none', duration: 2500 })
      } catch (err) {
        console.error('[detail] save reminder failed', err)
        wx.showModal({
          title: '提醒保存失败',
          content: '微信授权已完成，但提醒没有保存成功，请检查网络后再次点击',
          showCancel: false
        })
      } finally {
        this.setData({ reminding: false })
      }
    }
    if (SUBSCRIBE_TEMPLATE_ID === 'TEMPLATE_ID_PLACEHOLDER') {
      recordReminder()
      return
    }
    wx.requestSubscribeMessage({
      tmplIds: [SUBSCRIBE_TEMPLATE_ID],
      success: (res) => {
        if (res[SUBSCRIBE_TEMPLATE_ID] === 'accept') {
          recordReminder()
        } else {
          this.setData({ reminding: false })
          wx.showToast({ title: '未授权，可在系统设置中开启', icon: 'none' })
        }
      },
      fail: (err) => {
        this.setData({ reminding: false })
        const message = err && err.errMsg ? err.errMsg : '未知错误'
        console.error('[detail] requestSubscribeMessage failed', err)
        wx.showModal({
          title: '订阅授权失败',
          content: message,
          showCancel: false,
          confirmText: '我知道了'
        })
      }
    })
  },

  onShareAppMessage() {
    const event = this.data.event
    if (!event) return { title: '活动雷达', path: '/pages/home/home' }
    api.recordSignal(event._id, 'share').catch(() => {})
    return {
      title: event.title + '｜活动雷达',
      path: '/pages/detail/detail?id=' + event._id
    }
  },

  onShareTimeline() {
    const event = this.data.event
    if (!event) return { title: '活动雷达' }
    api.recordSignal(event._id, 'share').catch(() => {})
    return {
      title: event.title + '｜活动雷达',
      query: 'id=' + event._id
    }
  }
})
