const { sortEvents } = require('./score')
const { STORAGE_KEYS } = require('./constants')

const SEED_TEMPLATES = [
  {
    title: '苹果秋季新品发布会',
    summary: 'iPhone 18 系列与新一代 Apple Watch 预计亮相，官网全程直播。',
    domain: 'tech',
    tags: ['苹果', 'iPhone'],
    startInHours: 13 * 24,
    durationHours: 2,
    participation: { type: 'livestream', url: 'https://www.apple.com.cn/apple-events/', note: 'Apple 官网直播' },
    source: { name: 'Apple Newsroom', url: 'https://www.apple.com.cn/newsroom/' },
    confidence: 0.95,
    isHot: true
  },
  {
    title: '华为 Mate 80 系列新品发布会',
    summary: '华为年度旗舰发布会，预计搭载新一代麒麟芯片与鸿蒙新特性。',
    domain: 'tech',
    tags: ['华为', 'Mate'],
    startInHours: 20 * 24,
    durationHours: 2,
    participation: { type: 'livestream', url: 'https://consumer.huawei.com/cn/', note: '华为官网及视频号直播' },
    source: { name: '华为终端', url: 'https://consumer.huawei.com/cn/' },
    confidence: 0.88,
    isHot: true
  },
  {
    title: '骁龙峰会 2026（Snapdragon Summit）',
    summary: '高通下一代旗舰移动平台发布，小米、荣耀等厂商嘉宾出席。',
    domain: 'tech',
    tags: ['高通', '芯片'],
    startInHours: 55 * 24,
    durationHours: 6,
    participation: { type: 'livestream', url: 'https://www.qualcomm.com/snapdragon-summit', note: '官网注册观看' },
    source: { name: 'Qualcomm', url: 'https://www.qualcomm.com' },
    confidence: 0.82,
    isHot: false
  },
  {
    title: '特斯拉 Robotaxi 发布会',
    summary: '无人驾驶出租车量产版发布，得州工厂现场直播。',
    domain: 'auto',
    tags: ['特斯拉', '自动驾驶'],
    startInHours: 9 * 24,
    durationHours: 1.5,
    participation: { type: 'livestream', url: 'https://www.tesla.com', note: 'Tesla 官网直播' },
    source: { name: 'Tesla', url: 'https://www.tesla.com' },
    confidence: 0.85,
    isHot: true
  },
  {
    title: '广州国际汽车展览会 2026',
    summary: '年度收官 A 级车展，覆盖整车、新能源与智能驾驶全链路。',
    domain: 'auto',
    tags: ['车展', '新能源'],
    startInHours: 86 * 24,
    durationHours: 72,
    participation: { type: 'offline', url: 'https://www.autoguangzhou.com.cn/', note: '广交会展馆，官网预约入场' },
    source: { name: '广州车展官网', url: 'https://www.autoguangzhou.com.cn/' },
    confidence: 0.9,
    isHot: false
  },
  {
    title: '比亚迪仰望 U9 赛道日活动',
    summary: '仰望 U9 纽北圈速挑战直播，同步开启试驾报名。',
    domain: 'auto',
    tags: ['比亚迪', '仰望'],
    startInHours: 6 * 24,
    durationHours: 4,
    participation: { type: 'registration', url: 'https://www.bydauto.com.cn/', note: '官方 App 报名' },
    source: { name: '比亚迪汽车', url: 'https://www.bydauto.com.cn/' },
    confidence: 0.72,
    isHot: false
  },
  {
    title: '香港金融科技周 2026',
    summary: '亚洲旗舰金融科技会议，覆盖数字资产、支付与监管科技议题。',
    domain: 'finance',
    tags: ['金融科技', '香港'],
    startInHours: 63 * 24,
    durationHours: 40,
    participation: { type: 'registration', url: 'https://www.fintechweek.hk/', note: '官网注册参会' },
    source: { name: 'InvestHK', url: 'https://www.fintechweek.hk/' },
    confidence: 0.9,
    isHot: false
  },
  {
    title: '巴菲特股东大会（伯克希尔年会）',
    summary: '投资界年度盛会，奥马哈现场 + 全球网络直播。',
    domain: 'finance',
    tags: ['巴菲特', '投资'],
    startInHours: 250 * 24,
    durationHours: 8,
    participation: { type: 'livestream', url: 'https://www.berkshirehathaway.com/', note: '官网直播' },
    source: { name: 'Berkshire Hathaway', url: 'https://www.berkshirehathaway.com/' },
    confidence: 0.85,
    isHot: false
  },
  {
    title: '邓紫棋 I AM GLORIA 巡回演唱会 · 上海站',
    summary: '体育场级舞美制作，新专辑曲目首唱。',
    domain: 'ent',
    tags: ['邓紫棋', '巡演'],
    startInHours: 22 * 24,
    durationHours: 3,
    participation: { type: 'registration', url: 'https://www.damai.cn/', note: '大麦预约抢票提醒' },
    source: { name: '大麦网', url: 'https://www.damai.cn/' },
    confidence: 0.92,
    isHot: true
  },
  {
    title: '五月天 5525 回到那一天 巡回演唱会 · 北京站',
    summary: '鸟巢连开三场，出道周年纪念特别企划。',
    domain: 'ent',
    tags: ['五月天', '演唱会'],
    startInHours: 35 * 24,
    durationHours: 3.5,
    participation: { type: 'registration', url: 'https://www.damai.cn/', note: '大麦预约抢票提醒' },
    source: { name: '相信音乐', url: 'https://www.bin-music.com/' },
    confidence: 0.86,
    isHot: false
  },
  {
    title: 'Coldplay Music Of The Spheres 巡演 · 中国香港站',
    summary: '启德体育园开唱，开票即秒空场次加开公告。',
    domain: 'ent',
    tags: ['Coldplay', '巡演'],
    startInHours: 48 * 24,
    durationHours: 3,
    participation: { type: 'registration', url: 'https://www.cityline.com/', note: 'Cityline 登记候补' },
    source: { name: 'Live Nation', url: 'https://www.livenation.com/' },
    confidence: 0.8,
    isHot: false
  },
  {
    title: 'ChinaJoy 2027 中国国际数码互动娱乐展览会',
    summary: '全球游戏厂商年度大秀，新游试玩与电竞表演赛。',
    domain: 'game',
    tags: ['ChinaJoy', '游戏展'],
    startInHours: 330 * 24,
    durationHours: 96,
    participation: { type: 'registration', url: 'https://www.chinajoy.net/', note: '官网购票预约' },
    source: { name: 'ChinaJoy 官网', url: 'https://www.chinajoy.net/' },
    confidence: 0.88,
    isHot: true
  },
  {
    title: '英雄联盟 S16 全球总决赛',
    summary: '年度最高荣誉赛事，决赛阶段落地成都。',
    domain: 'game',
    tags: ['英雄联盟', '电竞'],
    startInHours: 70 * 24,
    durationHours: 6,
    participation: { type: 'livestream', url: 'https://lol.qq.com/', note: '官方赛事直播' },
    source: { name: '英雄联盟赛事', url: 'https://lol.qq.com/' },
    confidence: 0.84,
    isHot: true
  },
  {
    title: '黑神话系列新作实机演示直播',
    summary: '游戏科学新作首次实机公开，B 站独家直播。',
    domain: 'game',
    tags: ['黑神话', '单机'],
    startInHours: 4 * 24,
    durationHours: 1,
    participation: { type: 'livestream', url: 'https://www.bilibili.com/', note: 'B 站直播间' },
    source: { name: '游戏科学', url: 'https://www.gamesci.com.cn/' },
    confidence: 0.66,
    isHot: false
  },
  {
    title: '中国大学生数学建模竞赛（国赛）',
    summary: '全国高校规模最大的基础性学科竞赛，赛题 72 小时限时完成。',
    domain: 'academic',
    tags: ['数学建模', '国赛'],
    startInHours: 8 * 24,
    durationHours: 72,
    participation: { type: 'registration', url: 'http://www.mcm.edu.cn/', note: '官网报名（通过学校组队）' },
    source: { name: '全国大学生数学建模竞赛组委会', url: 'http://www.mcm.edu.cn/' },
    confidence: 0.93,
    isHot: true
  },
  {
    title: '中国国际大学生创新大赛（原互联网+）总决赛',
    summary: '覆盖新工科、新医科等赛道，全国总决赛现场路演。',
    domain: 'academic',
    tags: ['创新创业', '总决赛'],
    startInHours: 42 * 24,
    durationHours: 48,
    participation: { type: 'registration', url: 'https://cy.ncss.cn/', note: '全国大学生创业服务网报名' },
    source: { name: '大赛组委会', url: 'https://cy.ncss.cn/' },
    confidence: 0.87,
    isHot: false
  },
  {
    title: 'Kaggle 年度全球数据科学大赛',
    summary: '百万美元奖池，线上参赛，全球排行榜实时更新。',
    domain: 'academic',
    tags: ['Kaggle', '数据科学'],
    startInHours: 15 * 24,
    durationHours: 24 * 60,
    participation: { type: 'registration', url: 'https://www.kaggle.com/competitions', note: 'Kaggle 官网注册参赛' },
    source: { name: 'Kaggle', url: 'https://www.kaggle.com/' },
    confidence: 0.78,
    isHot: false
  },
  {
    title: '任天堂直面会（Nintendo Direct）',
    summary: 'Switch 2 新作阵容公开，全球同步直播。',
    domain: 'game',
    tags: ['任天堂', '直面会'],
    startInHours: 30,
    durationHours: 1,
    participation: { type: 'livestream', url: 'https://www.nintendo.com/nintendo-direct/', note: '官方频道直播' },
    source: { name: 'Nintendo', url: 'https://www.nintendo.com/' },
    confidence: 0.9,
    isHot: false
  },
  {
    title: '世界人工智能大会 WAIC 2027 筹备发布会',
    summary: '公布明年大会主题与首批演讲嘉宾名单。',
    domain: 'tech',
    tags: ['WAIC', '人工智能'],
    startInHours: 90,
    durationHours: 2,
    participation: { type: 'livestream', url: 'https://www.worldaic.com.cn/', note: '官网直播' },
    source: { name: 'WAIC 组委会', url: 'https://www.worldaic.com.cn/' },
    confidence: 0.7,
    isHot: false
  },
  {
    title: '蔚来 NIO Day 2026',
    summary: '年度用户大会，新车型与换电网络规划发布。',
    domain: 'auto',
    tags: ['蔚来', 'NIO Day'],
    startInHours: 110 * 24,
    durationHours: 3,
    participation: { type: 'livestream', url: 'https://www.nio.cn/', note: '蔚来 App 直播' },
    source: { name: '蔚来', url: 'https://www.nio.cn/' },
    confidence: 0.8,
    isHot: false
  }
]

function buildEvents(now) {
  return SEED_TEMPLATES.map((t, i) => {
    const startTime = now + Math.round(t.startInHours * 3600000)
    return {
      _id: 'mock_' + i,
      title: t.title,
      summary: t.summary,
      domain: t.domain,
      tags: t.tags,
      startTime: startTime,
      endTime: t.durationHours ? startTime + Math.round(t.durationHours * 3600000) : undefined,
      participation: t.participation,
      source: Object.assign({ fetchedAt: now - 2 * 60000 }, t.source),
      confidence: t.confidence,
      status: 'published',
      isHot: !!t.isHot,
      createdAt: now - (SEED_TEMPLATES.length - i) * 3600000,
      updatedAt: now - 2 * 60000
    }
  })
}

function getPrefs() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.preferredDomains) || []
  } catch (e) {
    return []
  }
}

function getEvents(params) {
  const { domain, cursor = 0, pageSize = 20, sortMode = 'comprehensive' } = params || {}
  const now = Date.now()
  let list = buildEvents(now).filter((e) => e.startTime >= now || (e.endTime && e.endTime >= now))
  if (domain && domain !== 'all') list = list.filter((e) => e.domain === domain)
  if (sortMode === 'time') {
    list.sort((a, b) => a.startTime - b.startTime)
  } else if (sortMode === 'popularity') {
    list.sort((a, b) => {
      const aHeat = Number(a.mainlandPopularity) || (a.isHot ? 0.8 : 0.35)
      const bHeat = Number(b.mainlandPopularity) || (b.isHot ? 0.8 : 0.35)
      return (bHeat - aHeat) || (a.startTime - b.startTime)
    })
  } else {
    list = sortEvents(list, getPrefs(), now)
  }
  const page = list.slice(cursor, cursor + pageSize)
  const latestFetchedAt = list.reduce((max, e) => Math.max(max, e.source.fetchedAt || 0), 0)
  return Promise.resolve({
    list: page,
    serverTime: now,
    personalizationEnabled: wx.getStorageSync(STORAGE_KEYS.personalizationEnabled) !== false,
    sortMode,
    latestFetchedAt: latestFetchedAt || now - 2 * 60000,
    nextCursor: cursor + pageSize < list.length ? cursor + pageSize : null
  })
}

function getEventById(id) {
  const now = Date.now()
  const hit = buildEvents(now).find((e) => e._id === id)
  return Promise.resolve({ event: hit || null, serverTime: now })
}

function updatePreference(params) {
  const privacyAction = params && params.privacyAction
  if (privacyAction === 'setPersonalization') {
    const enabled = params.enabled !== false
    wx.setStorageSync(STORAGE_KEYS.personalizationEnabled, enabled)
    return Promise.resolve({ ok: true, personalizationEnabled: enabled })
  }
  if (privacyAction === 'clearRecommendationData') {
    return Promise.resolve({ ok: true, removed: 0 })
  }
  if (privacyAction === 'deleteMyData') {
    wx.clearStorageSync()
    return Promise.resolve({ ok: true, removed: 0 })
  }
  const preferredDomains = (params && params.preferredDomains) || []
  const preferredTopics = (params && params.preferredTopics) || []
  const preferredFormats = (params && params.preferredFormats) || []
  const preferredCities = (params && params.preferredCities) || []
  const growthGoals = (params && params.growthGoals) || []
  if (params && Object.prototype.hasOwnProperty.call(params, 'personalizationEnabled')) {
    wx.setStorageSync(STORAGE_KEYS.personalizationEnabled, params.personalizationEnabled !== false)
  }
  wx.setStorageSync(STORAGE_KEYS.preferredDomains, preferredDomains)
  wx.setStorageSync(STORAGE_KEYS.preferredTopics, preferredTopics)
  wx.setStorageSync(STORAGE_KEYS.preferredFormats, preferredFormats)
  wx.setStorageSync(STORAGE_KEYS.preferredCities, preferredCities)
  wx.setStorageSync(STORAGE_KEYS.growthGoals, growthGoals)
  wx.setStorageSync(STORAGE_KEYS.onboardingDone, true)
  return Promise.resolve({ ok: true, preferredDomains, preferredTopics, preferredFormats, preferredCities, growthGoals })
}

function getSubscriptions() {
  let subs = []
  try {
    subs = wx.getStorageSync(STORAGE_KEYS.mockSubscriptions) || []
  } catch (e) {
    subs = []
  }
  const setting = wx.getStorageSync(STORAGE_KEYS.personalizationEnabled)
  return Promise.resolve({ list: subs, personalizationEnabled: setting !== false })
}

function addSubscriptionQuota(params) {
  const domain = (params && params.domain) || 'all'
  const requestedRadar = params && params.kind === 'radar'
  const eventId = requestedRadar ? '' : (params && params.eventId)
  const eventTitle = params && params.eventTitle
  const kind = requestedRadar ? 'radar' : (eventId ? 'event' : 'domain')
  const grantQuota = kind !== 'radar' || !params || params.grantQuota !== false
  const anchorEventId = kind === 'radar' ? params.anchorEventId : ''
  const anchor = anchorEventId ? buildEvents(Date.now()).find((e) => e._id === anchorEventId) : null
  let subs = []
  try {
    subs = wx.getStorageSync(STORAGE_KEYS.mockSubscriptions) || []
  } catch (e) {
    subs = []
  }
  const hit = kind === 'radar'
    ? subs.find((s) => s.kind === 'radar' && s.anchorEventId === anchorEventId)
    : (eventId
        ? subs.find((s) => s.eventId === eventId)
        : subs.find((s) => s.kind !== 'radar' && !s.eventId && s.domain === domain))
  if (hit) {
    hit.remainCount += grantQuota ? 1 : 0
    hit.status = 'active'
  } else {
    subs.push({
      _id: kind === 'radar' ? 'mock_radar_' + anchorEventId : (eventId ? 'mock_event_' + eventId : 'mock_domain_' + domain),
      kind,
      eventId: eventId || undefined,
      eventTitle: eventId ? eventTitle : undefined,
      domain,
      remainCount: grantQuota ? 1 : 0,
      status: 'active',
      lastSentAt: 0,
      sentEventIds: []
    })
    if (kind === 'radar' && anchor) {
      const radar = subs[subs.length - 1]
      radar.anchorEventId = anchorEventId
      radar.anchorEventTitle = anchor.title
      radar.anchorDomain = anchor.domain
      radar.anchorTags = anchor.tags || []
      radar.anchorParticipationType = (anchor.participation || {}).type || ''
      radar.discoveryMode = params.discoveryMode === 'precise' ? 'precise' : 'explore'
      radar.domain = anchor.domain
    }
  }
  wx.setStorageSync(STORAGE_KEYS.mockSubscriptions, subs)
  return Promise.resolve({ ok: true, list: subs })
}

function recordSignal() {
  return Promise.resolve({ ok: true })
}

function route(name, data) {
  switch (name) {
    case 'manageFollows':
      return manageMockFollows(data || {})
    case 'getEvents':
      if (data && data.id) return getEventById(data.id)
      return getEvents(data)
    case 'updatePreference':
      return updatePreference(data)
    case 'getSubscriptions':
      return getSubscriptions()
    case 'addSubscriptionQuota':
      return addSubscriptionQuota(data)
    case 'recordSignal':
      return recordSignal(data)
    default:
      return Promise.reject(new Error('mock route not found: ' + name))
  }
}

function manageMockFollows(input) {
  const key = 'eventRadarMockFollows'
  const records = wx.getStorageSync(key) || []
  const events = buildEvents(Date.now())
  if (input.action === 'list') {
    const ended = e => Number(e.endTime || e.startTime) < Date.now()
    const eligible = records.map(r => ({ record:r,event:events.find(e => e._id===r.eventId) })).filter(row => input.filter==='ended' ? row.event && ended(row.event) : !row.event || !ended(row.event))
    const cursor=Number(input.cursor)||0
    return Promise.resolve({list:eligible.slice(cursor,cursor+12).map(({record,event}) => ({event,eventId:record.eventId,title:record.title,unavailable:!event,hasUpdate:false,snapshot:'mock',followedAt:record.followedAt})),total:eligible.length,nextCursor:cursor+12<eligible.length ? cursor+12 : null})
  }
  if (input.action === 'set') {
    const event=events.find(e => e._id===input.eventId)
    if(input.following && !event) return Promise.reject(new Error('活动不可用'))
    const next=records.filter(r => r.eventId!==input.eventId)
    if(input.following) next.push({eventId:event._id,refs:[event._id],title:event.title,followedAt:Date.now()})
    wx.setStorageSync(key,next)
    return Promise.resolve({ok:true,following:input.following})
  }
  if(input.action === 'seen') return Promise.resolve({ok:true})
  return Promise.resolve({records})
}

module.exports = {
  buildEvents,
  route
}
