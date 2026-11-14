const stageResolution = require('./stage-resolution')
const { stateOf: stageStateOf } = require('./stage-state')
const cloud = require('wx-server-sdk')
const OpenCC = require('opencc-js')
const { requiresExactEventTime } = require('./event-time-policy')
const stableIdentity = require('./stable-event-identity')
const { paginate } = require('./feed-pagination')
const { feedCard } = require('./feed-card')
const openingSchedule = require('./opening-schedule')
const { searchEvents } = require('./event-search')
const { createSnapshot } = require('./search-snapshot')
const { createPublicPoolCache, fetchPages } = require('./public-feed-pool')
const { learningState, signalWeight, STRONG_ACTIONS } = require('./recommendation-learning')
const { identityKeys } = require('./interest-expansion')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const HIGHLIGHT_TYPE_PRIORITY = { guest: 70, matchup: 65, first_launch: 60, limited: 55, product: 50, work: 45, benefit: 40 }

function topHighlights(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, order) => ({ item, order }))
    .sort((left, right) =>
      (HIGHLIGHT_TYPE_PRIORITY[right.item && right.item.type] || 0) -
      (HIGHLIGHT_TYPE_PRIORITY[left.item && left.item.type] || 0) || left.order - right.order
    )
    .slice(0, 3)
    .map((entry) => entry.item)
}
const hkToCn = OpenCC.Converter({ from: 'hk', to: 'cn' })
const twToCn = OpenCC.Converter({ from: 'tw', to: 'cn' })

function withoutBrokenSegments(value) {
  const text = String(value == null ? '' : value)
  if (!/\uFFFD/.test(text)) return text
  return text.split(/[，。；;]/).filter((part) => part && !/\uFFFD/.test(part)).join('，').trim()
}

// Dedupe compares the same titles many times. Conversion is pure, so reusing
// its result avoids thousands of identical OpenCC calls without changing rules.
const simplifiedCache = new Map()
function simplified(value) {
  const text = String(value == null ? '' : value)
  if (!text) return ''
  if (simplifiedCache.has(text)) return simplifiedCache.get(text)
  const result = withoutBrokenSegments(twToCn(hkToCn(text)))
  if (text.length <= 2000) {
    if (simplifiedCache.size >= 1024) simplifiedCache.delete(simplifiedCache.keys().next().value)
    simplifiedCache.set(text, result)
  }
  return result
}

const CULTURE_TOPIC_KEYS = ['art_exhibition', 'immersive_event', 'brand_popup', 'dessert_cafe', 'design_market', 'nightlife']
const LEGACY_ANIME_TOPIC_KEYS = ['anime_show']

function migrateCulturePreferences(preferences) {
  const topics = (preferences.preferredTopics || []).map((topic) => {
    if (topic && topic.domain === 'ent' && CULTURE_TOPIC_KEYS.indexOf(topic.key) >= 0) {
      return Object.assign({}, topic, { domain: 'culture' })
    }
    if (topic && topic.domain === 'ent' && LEGACY_ANIME_TOPIC_KEYS.indexOf(topic.key) >= 0) {
      return Object.assign({}, topic, { domain: 'anime', key: 'anime_music', label: '动漫音乐会' })
    }
    return topic
  })
  const domains = (preferences.preferredDomains || []).slice()
  if (topics.some((topic) => topic && topic.domain === 'culture') && !domains.some((item) => item.domain === 'culture')) {
    domains.push({ domain: 'culture', weight: 3 })
  }
  if (topics.some((topic) => topic && topic.domain === 'anime') && !domains.some((item) => item.domain === 'anime')) {
    domains.push({ domain: 'anime', weight: 3 })
  }
  return Object.assign({}, preferences, { preferredDomains: domains, preferredTopics: topics })
}

function simplifyEvent(event) {
  if (!event) return event
  const participation = Object.assign({}, event.participation || {}, {
    note: simplified(event.participation && event.participation.note)
  })
  const guide = Object.assign({}, event.participationGuide || {}, {
    platform: simplified(event.participationGuide && event.participationGuide.platform),
    location: simplified(event.participationGuide && event.participationGuide.location),
    price: simplified(event.participationGuide && event.participationGuide.price),
    eligibility: simplified(event.participationGuide && event.participationGuide.eligibility),
    entryRules: simplified(event.participationGuide && event.participationGuide.entryRules),
    steps: Array.isArray(event.participationGuide && event.participationGuide.steps)
      ? event.participationGuide.steps.map(simplified).filter(Boolean)
      : []
  })
  const academicValue = Object.assign({}, event.academicValue || {}, {
    suitableMajors: Array.isArray(event.academicValue && event.academicValue.suitableMajors)
      ? event.academicValue.suitableMajors.map(simplified).filter(Boolean)
      : [],
    valueType: simplified(event.academicValue && event.academicValue.valueType),
    level: simplified(event.academicValue && event.academicValue.level),
    deliverables: simplified(event.academicValue && event.academicValue.deliverables),
    workload: simplified(event.academicValue && event.academicValue.workload),
    keyDeadline: simplified(event.academicValue && event.academicValue.keyDeadline)
  })
  const participationOptions = (Array.isArray(event.participationOptions) ? event.participationOptions : [])
    .map((item) => Object.assign({}, item, {
      note: simplified(item && item.note),
      platform: simplified(item && item.platform)
    }))
    .filter((item) => item.url || item.note)
  const stages = mergeEventStages(event, {}).map((stage) => Object.assign({}, stage, {
    name: simplified(stage && stage.name),
    venue: simplified(stage && stage.venue),
    sessionKey: simplified(stage && stage.sessionKey)
  })).filter((stage) => stage.key && Number(stage.startTime))
  return Object.assign({}, event, {
    title: simplified(event.title) || '活动信息待更新',
    summary: simplified(event.summary),
    city: simplified(event.city),
    tags: Array.isArray(event.tags) ? event.tags.map(simplified).filter(Boolean) : [],
    highlights: topHighlights(event.highlights)
      .map((item) => Object.assign({}, item, {
          label: simplified(item && item.label),
          value: simplified(item && item.value)
        })).filter((item) => item.label),
    participation,
    participationOptions,
    stages,
    stageConflicts: mergeStageConflicts(event, {}),
    participationGuide: guide,
    academicValue,
    source: Object.assign({}, event.source || {}, { name: simplified(event.source && event.source.name) })
  })
}

function normalizeIdentityTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function localDateKey(timestamp) {
  return new Date(Number(timestamp) + 8 * 3600000).toISOString().slice(0, 10)
}

function sourceFamily(value) {
  try {
    const parts = new URL(value).hostname.toLowerCase().replace(/^www\./, '').split('.')
    const suffix3 = parts.slice(-3).join('.')
    return /(?:com|net|org|gov|edu)\.cn$/.test(suffix3) ? suffix3 : parts.slice(-2).join('.')
  } catch (e) {
    return ''
  }
}

function sameSourceFamily(left, right) {
  const leftFamilies = [left.source && left.source.url, left.participation && left.participation.url]
    .map(sourceFamily).filter(Boolean)
  const rightFamilies = [right.source && right.source.url, right.participation && right.participation.url]
    .map(sourceFamily).filter(Boolean)
  return leftFamilies.some((item) => rightFamilies.indexOf(item) >= 0)
}

function titlesStrictlyMatch(leftTitle, rightTitle) {
  const left = normalizeIdentityTitle(leftTitle)
  const right = normalizeIdentityTitle(rightTitle)
  if (!left || !right) return false
  if (left === right) return true
  const shorter = left.length <= right.length ? left : right
  const longer = left.length > right.length ? left : right
  return shorter.length >= 8 && longer.indexOf(shorter) >= 0 && shorter.length / longer.length >= 0.62
}

function titleWithoutEditionModifiers(title) {
  return normalizeIdentityTitle(title)
    .replace(/(?:春季赛|夏季赛|秋季赛|冬季赛|春季|夏季|秋季|冬季|年度|赛季)/g, '')
}

function titleWithoutParentheticalSubtitle(title) {
  return normalizeIdentityTitle(String(title || '')
    .replace(/（(?=[^（）]{0,80}[A-Za-z])[^（）]{1,80}）/g, ' ')
    .replace(/\((?=[^()]{0,80}[A-Za-z])[^()]{1,80}\)/g, ' '))
}

function titleWithoutParentheticalDetails(title) {
  return normalizeIdentityTitle(String(title || '')
    .replace(/[（(][^（）()]{1,100}[）)]/g, ' '))
}

function isLivestreamCompanion(event) {
  const participation = event && event.participation || {}
  return participation.type === 'livestream' || /(?:线上|官方|全程|中国大陆)?直播(?:间|入口)?/.test(simplified(event && event.title))
}

function phaseOf(event) {
  const text = simplified([event && event.sessionKey, event && event.title].filter(Boolean).join(' '))
  const phases = [
    ['final_weekend', /总决赛周末/],
    ['loser_final', /败者组决赛/],
    ['winner_final', /胜者组决赛/],
    ['semifinal', /半决赛/],
    ['quarterfinal', /四分之一决赛|八强赛/],
    ['group_knockout', /小组赛及淘汰赛/], ['knockout', /淘汰赛/],
    ['group', /小组赛/],
    ['final', /总决赛|决赛/],
    ['qualifier', /资格赛|预选赛/],
    ['opening', /开幕式/],
    ['closing', /闭幕式|颁奖典礼/],
    ['showmatch', /明星表演赛|表演赛/],
    ['oral_exam', /口试/], ['written_exam', /笔试/],
    ['preliminary', /初赛/], ['second_round', /复赛/],
    ['registration', /报名(?:启动|开启|截止)?/], ['lottery', /抽签(?:结果)?/],
    ['pickup', /领物|装备领取/], ['presale', /预售|优先购/],
    ['on_sale', /正式开票|开票/], ['application', /网申/],
    ['interview', /面试/], ['results', /成绩公布|结果公布|获奖名单/]
  ]
  const hit = phases.find((item) => item[1].test(text))
  return hit ? hit[0] : ''
}

const STAGE_NAMES = {
  group: '小组赛', group_knockout: '小组赛及淘汰赛', knockout: '淘汰赛', quarterfinal: '四分之一决赛',
  semifinal: '半决赛', winner_final: '胜者组决赛', loser_final: '败者组决赛',
  final: '总决赛', final_weekend: '总决赛周末', qualifier: '资格赛',
  opening: '开幕式', closing: '闭幕式', showmatch: '表演赛',
  oral_exam: '口试', written_exam: '笔试', preliminary: '初赛', second_round: '复赛',
  registration: '开放报名', lottery: '抽签结果', pickup: '领取装备',
  presale: '预售', on_sale: '正式开票', application: '开放网申',
  interview: '面试', results: '结果公布'
}


function stageFromEvent(event) {
  // An explicit schedule is stronger than the phase word in a parent title.
  // Inferring from the parent startTime would create a false extra round.
  if (Array.isArray(event && event.stages) && event.stages.length) return null
  const key = phaseOf(event)
  if (!key) return null
  const guide = event && event.participationGuide || {}
  const stageSource = event && event.timePrecision === 'month_range' && event.scheduleWindowSource
    ? event.scheduleWindowSource
    : event && event.source || {}
  return {
    key,
    name: STAGE_NAMES[key] || key,
    startTime: Number(event.startTime) || 0,
    endTime: Number(event.endTime) || 0,
    timePrecision: event.timePrecision || 'date',
    endTimePrecision: event.endTimePrecision || 'date',
    venue: simplified(guide.location).slice(0, 40),
    sessionKey: simplified(event.sessionKey).slice(0, 30),
    evidenceVerified: event.stageEvidenceVerified === true,
    sourceUrl: stageSource.url || '',
    sourceTier: stageSource.tier || '',
    sourceAuthority: Number(stageSource.authority) || 0
  }
}

function stageCandidates(left, right) {
  const candidates = []
  ;[left, right].forEach((event) => {
    ;(Array.isArray(event && event.stages) ? event.stages : []).forEach((stage) => candidates.push(stage))
    const inferred = stageFromEvent(event)
    if (inferred) candidates.push(inferred)
  })
  return candidates.filter((stage) => stage && stage.key && Number(stage.startTime))
}

function stageConflictsFromEvents(left, right) {
  return stageResolution.resolve(stageCandidates(left, right)).conflicts
}

function mergeStageConflicts(left, right) {
  return stageResolution.mergeConflicts(
    (left && left.stageConflicts || []).concat(right && right.stageConflicts || []),
    stageResolution.resolve(stageCandidates(left, right)))
}

function mergeEventStages(left, right) {
  return stageResolution.resolve(stageCandidates(left, right)).stages.slice(0, 16)
}

function seriesIdentityTitle(event) {
  let title = simplified(event && event.title)
    .replace(/[（(][^（）()]{1,100}[）)]/g, ' ')
    .replace(/(?:中国大陆|大陆|全国)?(?:线上|官方|全程)?直播(?:间|入口)?/g, ' ')
    .replace(/(?:在线观看|观看直播|直播观看|直播预约)/g, ' ')
    .replace(/(?:总决赛周末|小组赛及淘汰赛|败者组决赛|胜者组决赛|四分之一决赛|八强赛|半决赛|总决赛|淘汰赛|决赛|小组赛|资格赛|预选赛|明星表演赛|表演赛|开幕式|闭幕式|颁奖典礼|口试|笔试|初赛|复赛|报名启动|报名开启|报名截止|报名|抽签结果|抽签|装备领取|领物|预售|优先购|正式开票|开票|网申|面试|成绩公布|结果公布|获奖名单)/g, ' ')
  SERIES_CITY_NAMES.forEach((city) => { title = title.split(city).join(' ') })
  return normalizeIdentityTitle(title)
    .replace(/(20\d{2})年/g, '$1')
    .replace(/kpl王者荣耀|王者荣耀kpl/g, 'kpl')
    .replace(/lpl英雄联盟|英雄联盟lpl/g, 'lpl')
    .replace(/vct无畏契约|无畏契约vct/g, 'vct')
}

function sameSeriesIdentity(left, right) {
  const leftYear = simplified(left && left.title).match(/20\d{2}/)
  const rightYear = simplified(right && right.title).match(/20\d{2}/)
  if (leftYear && rightYear && leftYear[0] !== rightYear[0]) return false
  return titlesStrictlyMatch(seriesIdentityTitle(left), seriesIdentityTitle(right))
}

function compatibleEventPhases(left, right) {
  const leftPhase = phaseOf(left)
  const rightPhase = phaseOf(right)
  if (!leftPhase || !rightPhase) return true
  if (leftPhase === rightPhase) return true
  return (leftPhase === 'final_weekend' && rightPhase === 'final') ||
    (leftPhase === 'final' && rightPhase === 'final_weekend')
}

function titleWithoutKnownCities(title, cities) {
  let value = normalizeIdentityTitle(title)
  ;(cities || []).forEach((city) => {
    const key = normalizeIdentityTitle(city).replace(/市$/, '')
    if (key && key.length >= 2) value = value.split(key).join('')
  })
  return value
}

function eventTitlesMatch(left, right) {
  if (titlesStrictlyMatch(left.title, right.title)) return true
  if (titlesStrictlyMatch(titleWithoutEditionModifiers(left.title), titleWithoutEditionModifiers(right.title))) return true
  if (compatibleEventPhases(left, right) && titlesStrictlyMatch(
    titleWithoutParentheticalDetails(left.title),
    titleWithoutParentheticalDetails(right.title)
  )) return true
  const cities = [left.city, right.city].filter(Boolean)
  if (!cities.length) return false
  const leftCore = titleWithoutKnownCities(left.title, cities)
  const rightCore = titleWithoutKnownCities(right.title, cities)
  return titlesStrictlyMatch(leftCore, rightCore)
}

function isDatePrecision(event) {
  return event.timePrecision === 'date' || !event.timePrecision
}

function visibleInFeed(event, now, horizon) {
  return (event.startTime >= now && event.startTime <= horizon) ||
    (event.endTime && event.endTime >= now) ||
    ((isDatePrecision(event) || !requiresExactEventTime(event)) &&
      localDateKey(event.startTime) === localDateKey(now))
}

function sameOccurrenceTime(left, right) {
  if (localDateKey(left.startTime) !== localDateKey(right.startTime)) return false
  const leftExact = !isDatePrecision(left)
  const rightExact = !isDatePrecision(right)
  return !(leftExact && rightExact) || Number(left.startTime) === Number(right.startTime)
}

function sameFeedEvent(left, right) {
  if (left && right && left.canonicalEventId && right.canonicalEventId) return left.canonicalEventId === right.canonicalEventId
  const identityDecision = stableIdentity.compare(left, right)
  if (identityDecision === 'same') return true
  if (identityDecision === 'review') return false
  if (left.canonicalKey && right.canonicalKey && left.canonicalKey === right.canonicalKey) return true
  if (left.domain !== right.domain) return false
  const leftPhase = phaseOf(left)
  const rightPhase = phaseOf(right)
  const lifecycleStages = (event) => (Array.isArray(event && event.stages) ? event.stages : [])
    .some((stage) => stage && stage.evidenceVerified === true &&
      /^(?:group|group_knockout|knockout|quarterfinal|semifinal|winner_final|loser_final|final|final_weekend|qualifier|oral_exam|written_exam|preliminary|second_round)$/.test(stage.key))
  const lifecyclePeers = sameSeriesIdentity(left, right) && !!(
    (leftPhase && rightPhase && leftPhase !== rightPhase) ||
    (leftPhase && lifecycleStages(right)) ||
    (rightPhase && lifecycleStages(left)))
  const leftCities = citiesNamedInTitle(left)
  const rightCities = citiesNamedInTitle(right)
  if (leftCities.length && rightCities.length && leftCities.join('|') !== rightCities.join('|') && !lifecyclePeers) return false
  const sameDay = localDateKey(left.startTime) === localDateKey(right.startTime)
  const liveCompanion = isLivestreamCompanion(left) || isLivestreamCompanion(right)
  const sameCity = !left.city || !right.city || normalizeIdentityTitle(left.city) === normalizeIdentityTitle(right.city)
  const stagedSeries = lifecyclePeers || (sameCity && sameSeriesIdentity(left, right) &&
    !!(leftPhase || rightPhase) && leftPhase !== rightPhase)
  if (!sameDay && !stagedSeries && !(liveCompanion && sameSeriesIdentity(left, right) && compatibleEventPhases(left, right))) return false
  // 同领域、同日、完全同名的记录通常只是不同票务或资讯来源。
  // 城市和场次字段可能被来源误填；若两条都有不同的具体开场时间，仍保留为独立场次。
  if (normalizeIdentityTitle(left.title) === normalizeIdentityTitle(right.title) && sameOccurrenceTime(left, right)) return true
  // 同一天开始的赛事总卡与阶段/场馆卡属于同一可参与事件。阶段日程并入
  // 详情页；不同日期的淘汰赛、决赛仍保留为独立节点。
  if (sameDay && sameOccurrenceTime(left, right) && sameSeriesIdentity(left, right)) {
    const leftPhase = phaseOf(left)
    const rightPhase = phaseOf(right)
    if (!leftPhase || !rightPhase || compatibleEventPhases(left, right)) return true
  }
  if (stagedSeries) return true
  if (left.sessionKey && right.sessionKey && normalizeIdentityTitle(left.sessionKey) !== normalizeIdentityTitle(right.sessionKey)) return false
  if (!liveCompanion && left.city && right.city && normalizeIdentityTitle(left.city) !== normalizeIdentityTitle(right.city)) return false
  if (!eventTitlesMatch(left, right)) {
    // The same official source often alternates between a short title and a
    // title carrying an English campaign subtitle in parentheses.
    if (liveCompanion && sameSeriesIdentity(left, right) && compatibleEventPhases(left, right)) return true
    if (!titlesStrictlyMatch(
      titleWithoutParentheticalSubtitle(left.title),
      titleWithoutParentheticalSubtitle(right.title)
    )) return false
  }
  return true
}

function participationOptionsOf(event) {
  const result = (Array.isArray(event && event.participationOptions) ? event.participationOptions : []).slice()
  const participation = event && event.participation || {}
  if (participation.url || participation.note) {
    result.push({
      type: participation.type || 'website',
      url: participation.url || '',
      note: participation.note || '',
      platform: event && event.participationGuide && event.participationGuide.platform || ''
    })
  }
  return result.filter((item, index, items) => {
    if (!item || (!item.url && !item.note)) return false
    const key = item.url || [item.type, normalizeIdentityTitle(item.note)].join('|')
    return items.findIndex((other) => other && (other.url || [other.type, normalizeIdentityTitle(other.note)].join('|')) === key) === index
  }).slice(0, 5)
}

function mergeParticipationOptions(left, right) {
  return participationOptionsOf(left).concat(participationOptionsOf(right)).filter((item, index, items) => {
    const key = item.url || [item.type, normalizeIdentityTitle(item.note)].join('|')
    return items.findIndex((other) => (other.url || [other.type, normalizeIdentityTitle(other.note)].join('|')) === key) === index
  }).slice(0, 5)
}

function feedCompleteness(event) {
  const guide = event.participationGuide || {}
  const participation = event.participation || {}
  return (!isDatePrecision(event) ? 8 : 0) +
    (event.endTime ? 2 : 0) +
    (participation.url ? 2 : 0) +
    (Array.isArray(event.highlights) ? Math.min(6, event.highlights.length * 2) : 0) +
    ['platform', 'location', 'price', 'eligibility', 'entryRules', 'accessStartTime', 'accessEndTime']
      .reduce((score, key) => score + (guide[key] ? 1 : 0), 0) +
    (Array.isArray(guide.steps) ? Math.min(3, guide.steps.length) : 0) +
    Number(event.confidence || 0)
}

function mergeFeedDuplicates(left, right) {
  const leftLive = isLivestreamCompanion(left)
  const rightLive = isLivestreamCompanion(right)
  const preferred = leftLive !== rightLive
    ? (leftLive ? right : left)
    : (feedCompleteness(right) > feedCompleteness(left) ? right : left)
  const secondary = preferred === right ? left : right
  const leftPhase = phaseOf(left)
  const rightPhase = phaseOf(right)
  const titleEvent = leftLive !== rightLive
    ? preferred
    : (leftPhase !== rightPhase && (!leftPhase || !rightPhase)
        ? (!leftPhase ? left : right)
        : preferred)
  const preferredGuide = preferred.participationGuide || {}
  const secondaryGuide = secondary.participationGuide || {}
  return Object.assign({}, secondary, preferred, {
    title: titleEvent.title,
    topicKeys: Array.from(new Set((left.topicKeys || []).concat(right.topicKeys || []))),
    tags: Array.from(new Set((left.tags || []).concat(right.tags || []))).slice(0, 8),
    highlights: topHighlights((left.highlights || []).concat(right.highlights || []).filter((item, index, items) =>
      item && item.label && items.findIndex((other) => other &&
        normalizeIdentityTitle(other.label) === normalizeIdentityTitle(item.label)
      ) === index
    )),
    participationOptions: mergeParticipationOptions(left, right),
    stages: mergeEventStages(left, right),
    stageConflicts: mergeStageConflicts(left, right),
    participationGuide: Object.assign({}, secondaryGuide, preferredGuide),
    confidence: Math.max(Number(left.confidence) || 0, Number(right.confidence) || 0)
  })
}

function dedupeFeedEvents(list) {
  const result = []
  for (const event of list || []) {
    const index = result.findIndex((item) => sameFeedEvent(item, event))
    if (index < 0) result.push(event)
    else result[index] = mergeFeedDuplicates(result[index], event)
  }
  return result
}

const SERIES_CITY_NAMES = [
  '北京', '上海', '广州', '深圳', '成都', '重庆', '杭州', '南京', '武汉', '西安',
  '苏州', '天津', '长沙', '郑州', '青岛', '厦门', '宁波', '合肥', '济南', '昆明',
  '沈阳', '大连', '福州', '无锡', '佛山', '东莞', '珠海', '南宁', '南昌', '贵阳',
  '哈尔滨', '长春', '石家庄', '太原', '兰州', '海口', '三亚', '香港', '澳门', '台北'
]

function citiesNamedInTitle(event) {
  const title = simplified(event && event.title)
  const named = SERIES_CITY_NAMES.filter((city) => title.indexOf(city) >= 0)
  const eventCity = simplified(event && event.city).replace(/市$/, '')
  if (eventCity && SERIES_CITY_NAMES.indexOf(eventCity) >= 0 && named.indexOf(eventCity) < 0) named.push(eventCity)
  return Array.from(new Set(named))
}

function eventSeriesCore(event) {
  let value = normalizeIdentityTitle(event && event.title)
  SERIES_CITY_NAMES.forEach((city) => { value = value.split(normalizeIdentityTitle(city)).join('') })
  return value.replace(/(?:全国|多城|巡回|各地)?站/g, '')
}

// Keep a multi-city summary until every city named in it has a concrete city card.
// Once all stations are present, the summary adds no actionable information.
function suppressCoveredSeriesSummaries(list) {
  const events = list || []
  return events.filter((event, index) => {
    const cities = citiesNamedInTitle(event)
    if (cities.length < 2) return true
    const core = eventSeriesCore(event)
    if (core.length < 6) return true
    const covered = cities.every((city) => events.some((peer, peerIndex) => {
      if (peerIndex === index || peer.domain !== event.domain) return false
      const peerCities = citiesNamedInTitle(peer)
      if (peerCities.length !== 1 || peerCities[0] !== city) return false
      if (localDateKey(peer.startTime) !== localDateKey(event.startTime)) return false
      return titlesStrictlyMatch(core, eventSeriesCore(peer))
    }))
    return !covered
  })
}

function sameEventSeries(left, right) {
  if (!left || !right || left.domain !== right.domain) return false
  if (left.city && right.city && normalizeIdentityTitle(left.city) !== normalizeIdentityTitle(right.city)) return false
  if (!sameSourceFamily(left, right)) return false
  return titlesStrictlyMatch(
    titleWithoutEditionModifiers(left.title),
    titleWithoutEditionModifiers(right.title)
  )
}

function sessionDescriptor(event) {
  if (event.sessionKey) return simplified(event.sessionKey).replace(/[。.]$/g, '').slice(0, 18)
  const evidenceText = simplified([event.title, event.summary].join(' '))
  const phase = evidenceText.match(/败者组决赛|胜者组决赛|明星表演赛|生态表演赛|开幕式|闭幕式|颁奖典礼|半决赛|总决赛/)
  if (phase && normalizeIdentityTitle(event.title).indexOf(normalizeIdentityTitle(phase[0])) < 0) return phase[0]
  const local = new Date(Number(event.startTime) + 8 * 3600000)
  return (local.getUTCMonth() + 1) + '月' + local.getUTCDate() + '日场'
}

function disambiguateSeriesTitles(list) {
  const result = (list || []).map((item) => Object.assign({}, item))
  result.forEach((event, index) => {
    const peers = result.filter((other, otherIndex) =>
      otherIndex !== index &&
      localDateKey(other.startTime) !== localDateKey(event.startTime) &&
      sameEventSeries(event, other)
    )
    if (!peers.length) return
    const descriptor = sessionDescriptor(event)
    event.displayTitle = event.title.indexOf(descriptor) >= 0
      ? event.title
      : event.title + '｜' + descriptor
  })
  return result
}

function lifecycleBaseTitle(event) {
  const raw = simplified(event && event.title)
  if (!phaseOf(event)) return raw
  return raw
    .replace(/(?:总决赛周末|小组赛及淘汰赛|败者组决赛|胜者组决赛|四分之一决赛|八强赛|半决赛|(?<!年度)(?<!全球)总决赛|淘汰赛|(?<!总)决赛|小组赛|资格赛|预选赛|明星表演赛|表演赛|开幕式|闭幕式|颁奖典礼|口试|笔试|初赛|复赛|报名启动|报名开启|报名截止|报名|抽签结果|抽签|装备领取|领物|预售|优先购|正式开票|开票|网申|面试|成绩公布|结果公布|获奖名单)/g, ' ')
    .replace(new RegExp('[（(](?:' + SERIES_CITY_NAMES.join('|') + ')站[）)]', 'g'), ' ')
    .replace(/\s*[（(][^（）()]*(?:体育|中心|场馆|馆|场)[^（）()]*[）)]\s*/g, ' ')
    .replace(/[｜|·\-—\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim() || raw
}

function focusedStage(stages, now, event) {
  const ordered = (stages || []).filter((item) => Number(item.startTime) && item.timePrecision !== 'month_range').slice()
    .sort((a, b) => Number(a.startTime) - Number(b.startTime))
  const exactClock = requiresExactEventTime(event)
  const state = item => stageStateOf(item, now, {
    exactClock, eventEndTime: event && event.endTime,
    eventEndPrecision: event && event.endTimePrecision
  })
  const activeCandidates = ordered.filter(item => state(item) === 'active')
  const active = activeCandidates.sort((a, b) => Number(b.startTime) - Number(a.startTime))[0]
  if (active) return { stage: active, state: 'active' }
  const started = ordered.filter(item => state(item) === 'started').pop()
  if (started) return { stage: started, state: 'started' }
  const upcoming = ordered.find(item => state(item) === 'upcoming')
  if (upcoming) return { stage: upcoming, state: 'upcoming' }
  return ordered.length ? { stage: ordered[ordered.length - 1], state: 'past' } : null
}

function projectLifecycleCard(event, now) {
  const openingState = openingSchedule.state(event.openingSchedule, now)
  if (openingState) event = Object.assign({}, event, {openingState})
  const stages = mergeEventStages(event, {})
  if (stages.length < 2) return Object.assign({}, event, { stages })
  const focus = focusedStage(stages, now, event)
  if (!focus) return Object.assign({}, event, { stages })
  const stage = focus.stage
  const suffix = stage.timePrecision === 'month_range'
    ? stage.name + '日期待核实'
    : (focus.state === 'active' ? stage.name + '进行中' :
      focus.state === 'started' ? stage.name + '已开始' : stage.name)
  return Object.assign({}, event, {
    stages,
    displayTitle: lifecycleBaseTitle(event) + '｜' + suffix,
    currentStageKey: stage.key,
    currentStageName: stage.name,
    currentStageState: focus.state,
    startTime: Number(stage.startTime),
    endTime: Number(stage.endTime) || undefined,
    timePrecision: stage.timePrecision || 'date',
    endTimePrecision: stage.endTimePrecision || 'date'
  })
}

function prefScore(domain, preferredDomains) {
  if (!preferredDomains || preferredDomains.length === 0) return 0.5
  const hit = preferredDomains.find((p) => p.domain === domain)
  if (!hit) return 0.3
  const w = Math.max(1, Math.min(3, hit.weight || 1))
  return w / 3
}

function eventText(event) {
  return [event.title, event.summary, event.city, event.location]
    .concat(event.tags || [])
    .join(' ')
    .toLowerCase()
}

// 首页请求不调用大模型：用稳定的主题键和少量高频别名补齐常见表达差异。
// 活动入库时仍应尽量写入规范 tags；这里是面向历史数据与外部来源的轻量兜底。
const TOPIC_ALIASES = {
  ai: ['ai', '人工智能', '大模型', '生成式人工智能', '机器学习'],
  developer: ['开发者日', '开发者大会', '开发者会议', '创新工坊', '技术沙龙', 'devfest', 'build day', 'workshop', 'meetup', 'developer conference'],
  hackathon: ['黑客松', 'hackathon', 'buildathon', 'AI共创', '智能体挑战赛', 'vibe coding'],
  open_source: ['开源', '开源社区', '社区共创', '开源贡献'],
  new_energy: ['新能源汽车', '新能源车', '电动车', '纯电汽车'],
  autonomous: ['智能驾驶', '自动驾驶', '无人驾驶'],
  bitcoin: ['比特币', 'bitcoin', 'btc'],
  stadium_concert: ['体育场演唱会', '演唱会', '巡演', '巡回演出', '巡回演唱会'],
  music_festival: ['音乐节', 'music festival'],
  livehouse: ['livehouse', 'live house', '现场音乐'],
  film_festival: ['电影节', '影展', '展映', '电影资料馆'],
  premiere_roadshow: ['首映', '首映礼', '电影路演', '主创路演', '点映', '观影团'],
  theatre: ['话剧', '音乐剧', '舞剧', '戏剧节', '戏剧谷'],
  immersive_theatre: ['沉浸式戏剧', '环境式戏剧', '沉浸演出'],
  art_exhibition: ['艺术展', '艺术展览', '美术展', '当代艺术'],
  brand_popup: ['首店', '快闪', '限时店', 'popup', 'pop-up'],
  dessert_cafe: ['甜品', '甜点', '咖啡', '烘焙', '茶饮'],
  nightlife: ['酒吧', '夜店', '夜生活', '电子音乐派对', 'dj set', 'club night'],
  honor_of_kings: ['王者荣耀', 'kpl'],
  lol: ['英雄联盟', 'lol', 'lpl', 'league of legends'],
  valorant: ['无畏契约', 'valorant', '瓦罗兰特'],
  football: ['足球', '中超', '英超', '欧冠'],
  basketball: ['篮球', 'cba', 'nba'],
  running: ['马拉松', '路跑', '跑步', '越野跑'],
  anime_expo: ['漫展', '动漫展', '动漫游戏展', 'comic con'],
  ip_popup: ['动漫ip快闪', '动漫快闪', '主题快闪'],
  cosplay: ['cosplay', '角色扮演', 'coser'],
  doujin_only: ['only', '同人展', 'only展'],
  math_modeling: ['数学建模', '数模竞赛'],
  programming: ['程序设计', '编程竞赛', '算法竞赛', 'acm', 'icpc'],
  innovation: ['创新创业', '大学生创新', '互联网+'],
  research_program: ['科研项目', '科研训练', '学术夏令营', '大学生创新训练', '实验室开放'],
  industry_challenge: ['企业案例赛', '商业挑战赛', '企业命题', '真实项目', '行业挑战赛'],
  language_exam: ['大学英语四六级', '英语四级', '英语六级', '普通话水平测试', 'catti'],
  qualification_exam: ['教师资格考试', '教资', '全国计算机等级考试', 'ncre', '法律职业资格考试', '法考'],
  postgraduate_public_exam: ['研究生招生考试', '考研', '国考', '公务员招考', '选调生'],
  campus_recruitment: ['校园招聘', '秋招', '春招', '实习', '提前批', '宣讲会', '双选会'],
  computer_data: ['计算机', '软件工程', '数据科学', '网络安全', '算法竞赛', '程序设计'],
  electronic_engineering: ['电子信息', '自动化', '通信工程', '集成电路', '嵌入式'],
  mechanical_engineering: ['机械工程', '机器人大赛', '智能制造', '机械设计'],
  civil_architecture: ['土木工程', '建筑设计', '结构设计', '城乡规划'],
  business_economics: ['经济学', '金融学', '工商管理', '市场调查', '商业案例'],
  design_media: ['视觉设计', '工业设计', '广告设计', '数字媒体', '新闻传播'],
  humanities_law: ['法学', '模拟法庭', '社会调查', '公共管理', '人文社科'],
  medicine_life: ['医学', '生命科学', '生物医药', '临床技能', '健康科普'],
  agriculture_environment: ['农业', '林业', '环境科学', '生态保护', '节能减排'],
  language_education: ['外语', '英语竞赛', '翻译比赛', '师范生', '教学技能']
}

const TOPIC_LABELS = {
  ai: 'AI / 大模型', mobile: '手机新品', chips_pc: '电脑与芯片', robotics: '机器人', developer: '开发者活动',
  new_energy: '新能源汽车', autonomous: '智能驾驶', auto_show: '国际车展', motorsport: '赛车',
  investment: '投资活动', fintech: '金融科技', bitcoin: '比特币', web3: 'Web3', startup: '创业融资',
  stadium_concert: '演唱会', music_festival: '音乐节', c_pop: '华语音乐', k_j_pop: '日韩音乐', livehouse: '现场音乐', film_festival: '电影节 / 展映', premiere_roadshow: '首映 / 路演', theatre: '话剧 / 音乐剧', immersive_theatre: '沉浸式戏剧',
  art_exhibition: '艺术展览', immersive_event: '沉浸体验', brand_popup: '首店快闪', dessert_cafe: '甜品咖啡', design_market: '设计市集', nightlife: '酒吧夜生活',
  honor_of_kings: '王者荣耀', lol: '英雄联盟', valorant: '无畏契约', peace_elite: '和平精英', console: '主机游戏', steam_pc: 'PC游戏', game_expo: '游戏展会', indie_game: '独立游戏',
  football: '足球', basketball: '篮球', badminton_pingpong: '羽毛球 / 乒乓球', tennis: '网球', running: '跑步赛事', cycling_outdoor: '骑行 / 徒步', winter_extreme: '冰雪 / 攀岩', campus_sports: '高校体育',
  anime_expo: '漫展', ip_popup: '动漫IP快闪', goods_figures: '谷子 / 手办', cosplay: 'Cosplay', tcg: '卡牌赛事', voice_actor: '声优活动', anime_music: '动漫音乐会', doujin_only: '同人展',
  computer_data: '计算机 / 数据', electronic_engineering: '电子 / 自动化', mechanical_engineering: '机械 / 机器人', civil_architecture: '土木 / 建筑', business_economics: '经管 / 金融', design_media: '设计 / 传媒', humanities_law: '人文 / 法学', medicine_life: '医学 / 生命科学', agriculture_environment: '农林 / 环境', language_education: '语言 / 教育',
  math_modeling: '数学建模', programming: '程序设计', ai_competition: 'AI竞赛', innovation: '创新创业', robot_competition: '机器人竞赛', hackathon: '黑客松', design_competition: '设计竞赛', academic_conference: '学术会议', research_program: '科研项目 / 夏令营', industry_challenge: '企业案例 / 项目赛', language_exam: '四六级 / 普通话', qualification_exam: '职业资格考试', postgraduate_public_exam: '考研 / 公考', campus_recruitment: '校招 / 实习'
}

const GROWTH_GOAL_RULES = {
  postgraduate: /(保研|升学|推免|学术|论文|科研|国家级|全国大学生|高含金量)/i,
  employment: /(求职|就业|校招|秋招|春招|实习|宣讲会|双选会|企业|工程实践|开发者|黑客松|商业案例|职业技能)/i,
  scholarship: /(评奖|评优|奖学金|竞赛|大赛|挑战杯|国家级|省级)/i,
  research: /(科研|论文|会议|征稿|实验|研究|学术)/i,
  portfolio: /(作品集|项目|作品征集|设计|开发|实践成果)/i,
  entrepreneurship: /(创新创业|创业|路演|商业计划|互联网\+)/i
}

function growthGoalScore(event, goals) {
  if (event.domain !== 'academic' || !goals || !goals.length) return event.domain === 'academic' ? 0.45 : 0.5
  const text = eventText(event) + ' ' + JSON.stringify(event.academicValue || {})
  return goals.some((goal) => GROWTH_GOAL_RULES[goal] && GROWTH_GOAL_RULES[goal].test(text)) ? 1 : 0.18
}

function personalizedTopicScore(event, preferences) {
  const explicit = preferences.preferredTopics || []
  const learned = Object.entries(preferences.learnedTopicKeyWeights || {})
    .filter(([,weight]) => Number(weight) >= 2)
    .map(([key,weight]) => ({key,label:TOPIC_LABELS[key] || key,weight:Math.min(2,Number(weight)/3)}))
  // Strong follows can drive related forms, while explicit choices remain strongest.
  const base = topicScore(event, explicit.concat(learned))
  if (event.domain !== 'academic') return base
  return 0.7 * base + 0.3 * growthGoalScore(event, preferences.growthGoals || [])
}

function labelTerms(label) {
  const value = String(label || '').toLowerCase().trim()
  if (!value) return []
  return [value].concat(value.split(/\s*[\/／|]\s*/).filter(Boolean))
}

function containsTerm(text, term) {
  const value = String(term || '').toLowerCase().trim()
  if (!value) return false
  // 避免短英文词误命中其他单词，例如 ai 命中 training。
  if (/^[a-z0-9+#. ]+$/.test(value)) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp('(^|[^a-z0-9])' + escaped + '([^a-z0-9]|$)', 'i').test(text)
  }
  return text.indexOf(value) >= 0
}

function topicMatches(event, topic) {
  const topicKey = String(topic && topic.key || '')
  if (identityKeys(event).includes(topicKey)) return true
  if (topicKey && Array.isArray(event.topicKeys) && event.topicKeys.indexOf(topicKey) >= 0) return true
  const text = eventText(event)
  const aliases = TOPIC_ALIASES[topicKey] || []
  const terms = labelTerms(topic && topic.label).concat(aliases)
  return terms.some((term) => containsTerm(text, term))
}

function topicScore(event, preferredTopics) {
  if (!preferredTopics || preferredTopics.length === 0) return 0.45
  let best = 0
  preferredTopics.forEach((topic) => {
    if (topicMatches(event, topic)) {
      best = Math.max(best, Math.max(1, Math.min(3, topic.weight || 1)) / 3)
    }
  })
  if (best) return best
  const related = relatedInterest(event, preferredTopics)
  return related ? 0.38 * Math.max(1, Math.min(3, related.weight || 1)) / 3 : 0.08
}

// Explore nearby interests rather than treating every other domain as novelty.
const RELATED_TOPICS = [
  ['ai', 'developer', 'hackathon', 'open_source', 'ai_competition'],
  ['robotics', 'robot_competition', 'mechanical_engineering'],
  ['programming', 'computer_data', 'hackathon', 'open_source'],
  ['stadium_concert', 'music_festival', 'livehouse'],
  ['film_festival', 'premiere_roadshow'],
  ['theatre', 'immersive_theatre'],
  ['anime_expo', 'cosplay', 'doujin_only', 'goods_figures', 'ip_popup'],
  ['art_exhibition', 'design_market', 'immersive_event'],
  ['running', 'cycling_outdoor'],
  ['new_energy', 'auto_show', 'new_car', 'autonomous'],
  ['startup', 'industry_challenge', 'innovation']
]
function relatedInterest(event, topics) {
  return (topics || []).find(topic => RELATED_TOPICS.some(group =>
    group.includes(topic.key) && group.some(key => key !== topic.key && topicMatches(event, {key, label:TOPIC_LABELS[key] || key}))))
}

function hasOnlineParticipation(event) {
  const options = [event.participation || {}].concat(event.participationOptions || [])
  return options.some(option => option.type === 'livestream') ||
    /^(?:线上|在线|全国线上)$/.test(String(event.city || '')) ||
    /线上|在线|远程|online/i.test(String(event.participationGuide && event.participationGuide.location || ''))
}

function formatScore(event, preferredFormats) {
  if (!preferredFormats || preferredFormats.length === 0) return 0.5
  const type = event.participation && event.participation.type
  const text = eventText(event)
  if (preferredFormats.indexOf(type) >= 0) return 1
  if (preferredFormats.indexOf('esports') >= 0 && /(电竞|赛事|联赛|总决赛)/.test(text)) return 1
  if (preferredFormats.indexOf('ticket') >= 0 && ['ent', 'culture', 'sports', 'anime'].indexOf(event.domain) >= 0) return 0.9
  if (preferredFormats.indexOf('release') >= 0 && /(发布|新品|首发|直面会)/.test(text)) return 0.9
  return 0.2
}

function cityScore(event, preferredCities) {
  if (!preferredCities || preferredCities.length === 0) return 0.5
  const text = [event.city, event.location, event.participationGuide && event.participationGuide.location].filter(Boolean).join(' ').toLowerCase()
  if (preferredCities.some(city => city && !['全国', '线上'].includes(city) && text.includes(String(city).toLowerCase().replace(/市$/, '')))) return 1
  if (hasOnlineParticipation(event)) return preferredCities.includes('线上') ? 1 : 0.8
  if (preferredCities.indexOf('全国') >= 0) return 0.65
  if (!text) return preferredCities.includes('线上') ? 0.25 : 0.4
  return 0.15
}

function recentBehaviorScore(event, recentSignals, now) {
  const eventTags = (event.tags || []).map((tag) => String(tag).toLowerCase())
  const eventTopicKeys = event.topicKeys || []
  const perEvent = new Map()
  ;(recentSignals || []).forEach((signal) => {
    const base = signalWeight(signal)
    if (!base || !signal.at) return
    const ageDays = Math.max(0, now - signal.at) / (24 * 3600000)
    if (ageDays > 90) return
    const decay = Math.pow(0.5, ageDays / (STRONG_ACTIONS.has(signal.action) ? 30 : 7))
    const signalTags = (signal.tags || []).map((tag) => String(tag).toLowerCase())
    const overlap = signalTags.filter((tag) => eventTags.indexOf(tag) >= 0).length
    const topicOverlap = (signal.topicKeys || []).filter((key) => eventTopicKeys.indexOf(key) >= 0).length
    const similarity = Math.min(1, (signal.domain === event.domain ? 0.05 : 0) + topicOverlap * 0.8 + overlap * 0.15)
    const value = base * decay * similarity
    const previous = perEvent.get(signal.eventId) || 0
    // Repeated views of one event must not mimic interest in many events.
    perEvent.set(signal.eventId, value < 0 ? Math.min(previous, value) : previous < 0 ? previous : Math.max(previous, value))
  })
  const affinity = Array.from(perEvent.values()).reduce((n,value) => n+value,0)
  return 0.5 + 0.5 * Math.tanh(affinity / 8)
}

function behaviorScore(event, learnedTopicWeights, learnedTopicKeyWeights, learnedDomainWeights, recentSignals, now) {
  const text = eventText(event)
  let strongest = null
  Object.keys(learnedTopicWeights || {}).forEach((tag) => {
    if (!tag || text.indexOf(tag) < 0) return
    const weight = Number(learnedTopicWeights[tag]) || 0
    if (strongest === null || Math.abs(weight) > Math.abs(strongest)) strongest = weight
  })
  const domainWeight = Number((learnedDomainWeights || {})[event.domain]) || 0
  let topicKeyWeight = null
  Object.keys(learnedTopicKeyWeights || {}).forEach((key) => {
    const direct = topicMatches(event, { key, label: TOPIC_LABELS[key] || key })
    const adjacent = relatedInterest(event, [{key}])
    if (!direct && !adjacent) return
    const value = Number(learnedTopicKeyWeights[key]) || 0
    // A dislike of one form must not spread to adjacent interests.
    if (!direct && value <= 0) return
    const adjusted = direct ? value : value * 0.5
    if (topicKeyWeight === null || Math.abs(adjusted) > Math.abs(topicKeyWeight)) topicKeyWeight = adjusted
  })
  const tagWeight = strongest === null ? 0 : strongest
  const keyWeight = topicKeyWeight === null ? 0 : topicKeyWeight
  const combined = clampBehavior(keyWeight * 0.75 + tagWeight * 0.2 + domainWeight * 0.05)
  const learned = 0.5 + 0.5 * Math.tanh(combined / 8)
  const recent = recentBehaviorScore(event, recentSignals, now)
  return 0.4 * learned + 0.6 * recent
}

function clampBehavior(value) {
  return Math.max(-6, Math.min(12, value))
}

function timeScore(startTime, now, endTime) {
  const h = (startTime - now) / 3600000
  if (h < 0) return endTime && endTime >= now ? 0.85 : 0
  if (h <= 24) return 1 - h / 48
  if (h <= 168) return 0.5 - (h - 24) / 288
  return 0.05
}

function isOverseas(event) {
  if (event.marketScope === 'overseas') return true
  if (event.marketScope === 'mainland') return false
  const text = eventText(event)
  return /(海外|全球线上|香港|澳门|台湾|台北|东京|首尔|新加坡|曼谷|纽约|旧金山|洛杉矶|伦敦|巴黎|柏林|悉尼|tokyo|seoul|singapore|bangkok|new york|san francisco|los angeles|london|paris|berlin|sydney)/.test(text)
}

function boundedScore(value, fallback) {
  const number = Number(value)
  return isNaN(number) ? fallback : Math.max(0, Math.min(1, number))
}

function eventValueScore(event) {
  const mainlandPopularity = boundedScore(event.mainlandPopularity, event.isHot ? 0.75 : 0.4)
  if (isOverseas(event)) {
    const accessible = event.participation && event.participation.type === 'offline' ? 0.35 : 0.8
    return 0.78 * mainlandPopularity + 0.22 * accessible
  }
  const interestingness = boundedScore(event.interestingness, 0.5)
  const growthPotential = boundedScore(event.growthPotential, 0.5)
  const necessity = boundedScore(event.necessity, event.domain === 'academic' ? 0.75 : 0.35)
  return 0.2 * mainlandPopularity + 0.28 * interestingness + 0.27 * growthPotential + 0.25 * necessity
}

function interestScore(event, preferences, now) {
  return 0.60 * personalizedTopicScore(event, preferences) +
    0.15 * prefScore(event.domain, preferences.preferredDomains || []) +
    0.05 * formatScore(event, preferences.preferredFormats || []) +
    0.05 * cityScore(event, preferences.preferredCities || []) +
    0.15 * behaviorScore(
      event,
      preferences.learnedTopicWeights,
      preferences.learnedTopicKeyWeights,
      preferences.learnedDomainWeights,
      preferences.recentSignals,
      now
    )
}

function fatiguePenalty(event, recentSignals, now) {
  let passiveViews = 0
  let positive = false
  ;(recentSignals || []).forEach((signal) => {
    if (signal.eventId !== event._id || now - signal.at > 30 * 24 * 3600000) return
    if (['follow', 'remind', 'share', 'official_click'].indexOf(signal.action) >= 0) positive = true
    if (signal.action === 'view') passiveViews += 1
  })
  if (positive || passiveViews < 2) return 0
  return Math.min(0.18, (passiveViews - 1) * 0.05)
}

function heatScore(event) {
  const popularity = boundedScore(event.mainlandPopularity, event.isHot ? 0.78 : 0.38)
  const buzzLevel = event.socialBuzz && event.socialBuzz.level
  const buzz = buzzLevel === 'high' ? 1 : (buzzLevel === 'medium' ? 0.68 : (buzzLevel === 'low' ? 0.35 : 0.25))
  const level = event.popularityLevel === 'major' ? 1 : (event.popularityLevel === 'vertical' ? 0.62 : 0.34)
  return 0.72 * popularity + 0.18 * buzz + 0.10 * level
}

function compareByTime(a, b, now) {
  const aOngoing = a.startTime <= now && a.endTime && a.endTime >= now
  const bOngoing = b.startTime <= now && b.endTime && b.endTime >= now
  if (aOngoing !== bOngoing) return aOngoing ? -1 : 1
  if (aOngoing && bOngoing) return (a.endTime - b.endTime) || (b._score - a._score)
  return (a.startTime - b.startTime) || (b._score - a._score)
}

function computeScore(event, preferences, now) {
  return 0.60 * interestScore(event, preferences, now) +
    0.14 * cityScore(event, preferences.preferredCities || []) +
    0.08 * timeScore(event.startTime, now, event.endTime) +
    0.08 * boundedScore(event.confidence, 0.5) +
    0.06 * eventValueScore(event) + 0.04 * heatScore(event) -
    fatiguePenalty(event, preferences.recentSignals, now) -
    feedbackPenalty(event, preferences.recentSignals, now)
}

function feedbackPenalty(event, signals, now) {
  let topicPenalty = 0, locationPenalty = 0
  for (const signal of signals || []) {
    if (!signal.at || now-signal.at > 30*86400000) continue
    if (signal.action === 'dislike' && (signal.topicKeys || []).some(key => topicMatches(event, {key, label:TOPIC_LABELS[key] || key}))) topicPenalty = 0.25
    if (signal.action === 'location_mismatch' && !hasOnlineParticipation(event) && signal.city && event.city &&
        normalizeIdentityTitle(signal.city) === normalizeIdentityTitle(event.city)) locationPenalty = 0.18
  }
  return topicPenalty + locationPenalty
}

function prepareRecommendationPreferences(preferences, now) {
  return Object.assign({}, preferences, learningState(preferences, now))
}

function recommendReason(event, preferences) {
  const text = eventText(event)
  const hit = (preferences.preferredTopics || []).find((topic) => topicMatches(event, topic))
  if (hit) return '因为你关注“' + hit.label + '”'
  const adjacent = relatedInterest(event, preferences.preferredTopics)
  const learnedHit = Object.keys(preferences.learnedTopicWeights || {}).find((tag) =>
    Number(preferences.learnedTopicWeights[tag]) >= 3 && text.indexOf(tag) >= 0
  )
  const learnedTopicHit = Object.keys(preferences.learnedTopicKeyWeights || {}).find((key) =>
    Number(preferences.learnedTopicKeyWeights[key]) >= 2 &&
    topicMatches(event, { key, label: TOPIC_LABELS[key] || key })
  )
  if (learnedTopicHit) return '根据你最近关注的“' + (TOPIC_LABELS[learnedTopicHit] || learnedTopicHit) + '”'
  const learnedAdjacent = Object.keys(preferences.learnedTopicKeyWeights || {}).find(key =>
    Number(preferences.learnedTopicKeyWeights[key]) >= 2 && relatedInterest(event, [{key}]))
  if (learnedAdjacent) return '与你关注的“' + (TOPIC_LABELS[learnedAdjacent] || learnedAdjacent) + '”相关'
  if (learnedHit) return '根据你最近关注的“' + learnedHit + '”'
  if (adjacent) return '与你关注的“' + adjacent.label + '”相关'
  if (isOverseas(event) && boundedScore(event.mainlandPopularity, 0) >= 0.7) return '在国内受到较高关注'
  if (!isOverseas(event) && boundedScore(event.necessity, 0) >= 0.7) return '值得关注的刚需活动'
  if (!isOverseas(event) && boundedScore(event.growthPotential, 0) >= 0.72) return '值得提前关注'
  if (!isOverseas(event) && boundedScore(event.interestingness, 0) >= 0.72) return '近期有趣新活动'
  if ((preferences.preferredDomains || []).some((item) => item.domain === event.domain)) return '来自你关注的领域'
  if (event.isHot) return '近期高关注活动'
  if (event.popularityLevel === 'niche') return '为你探索的小众活动'
  return '为你探索的新活动'
}

function popularityLevel(event) {
  if (isOverseas(event)) {
    const mainlandPopularity = boundedScore(event.mainlandPopularity, event.isHot ? 0.65 : 0.35)
    if (mainlandPopularity >= 0.72) return 'major'
    if (mainlandPopularity >= 0.42) return 'vertical'
    return 'niche'
  }
  const potentialValue = Math.max(
    boundedScore(event.interestingness, 0),
    boundedScore(event.growthPotential, 0),
    boundedScore(event.necessity, 0)
  )
  if (potentialValue >= 0.75) return 'major'
  if (['major', 'vertical', 'niche'].indexOf(event.popularityLevel) >= 0) {
    return event.popularityLevel
  }
  return event.isHot ? 'major' : 'vertical'
}

function multiRouteBlend(list, preferences) {
  const pending = list.slice()
  const result = []
  const topics = preferences && preferences.preferredTopics || []
  const direct = event => topics.some(topic => topicMatches(event,topic))
  const adjacent = event => !direct(event) && !!relatedInterest(event,topics)
  while (pending.length) {
    const recent = result.slice(-3)
    const directAvailable = pending.some(direct)
    const nearbyCount = result.slice(-9).filter(adjacent).length
    let bestIndex = 0, bestScore = -Infinity
    pending.forEach((item,index) => {
      const repeated = recent.filter(previous => sameSeriesIdentity(previous,item) && previous.city === item.city).length
      // Small series penalty only; no mandatory alternating domains or sources.
      let score = item._score - repeated * 0.05
      if (directAvailable && adjacent(item) && nearbyCount >= 2) score -= 0.12
      if (score > bestScore) { bestScore = score; bestIndex = index }
    })
    result.push(pending.splice(bestIndex,1)[0])
  }
  return result
}


async function fetchEventPool(where, order, maxItems, orderField) {
  const sortField = orderField || 'startTime'
  return fetchPages((offset, size) => db.collection('events')
      .where(where)
      .orderBy(sortField, order)
      .skip(offset)
      .limit(size)
      .get(), maxItems)
}

const loadPublicFeedPool = createPublicPoolCache(async domain => {
  const now = Date.now(), horizon = now + 180 * 86400000
  const upcomingWhere = { status:'published', startTime:_.gte(now).and(_.lte(horizon)) }
  const ongoingWhere = { status:'published', startTime:_.lte(now) }
  const ongoingWithEndWhere = { status:'published', endTime:_.gte(now) }
  if(domain !== 'all') for(const where of [upcomingWhere,ongoingWhere,ongoingWithEndWhere]) where.domain=domain
  let cacheable=true
  const [upcomingRes,ongoingWithEndRes,ongoingRecentRes]=await Promise.all([
    fetchEventPool(upcomingWhere,'asc',500),
    fetchEventPool(ongoingWithEndWhere,'asc',200,'endTime').catch(error=>{
      console.warn('[getEvents] endTime ongoing route unavailable',error && error.message)
      cacheable=false
      return {data:[]}
    }),
    fetchEventPool(ongoingWhere,'desc',200)
  ])
  return {upcomingRes,ongoingWithEndRes,ongoingRecentRes,cacheable}
})

async function getDetail(id) {
  let res = await db.collection('events').doc(id).get().catch(() => null)
  const visited = new Set([id])
  while (res && res.data && res.data.status === 'merged' && res.data.mergedInto && !visited.has(res.data.mergedInto) && visited.size < 8) {
    visited.add(res.data.mergedInto)
    res = await db.collection('events').doc(res.data.mergedInto).get().catch(() => null)
  }
  if (!res || !res.data || res.data.status !== 'published') return { event: null, serverTime: Date.now() }
  let merged = res.data
  try {
    const related = await db.collection('events')
      .where({ status: 'published', domain: res.data.domain })
      .limit(100)
      .get()
    related.data.forEach((item) => {
      if (item._id !== merged._id && sameFeedEvent(merged, item)) merged = mergeFeedDuplicates(merged, item)
    })
  } catch (error) {
    console.warn('[getEvents] detail companion lookup unavailable', error && error.message)
  }
  const event = simplifyEvent(merged)
  event.openingState = openingSchedule.state(event.openingSchedule, Date.now())
  const projected = projectLifecycleCard(event, Date.now())
  event.stageConflicts = mergeStageConflicts(event, {})
  event.stages = projected.stages
  if (projected.currentStageKey) {
    event.displayTitle = projected.displayTitle
    event.currentStageKey = projected.currentStageKey
    event.currentStageName = projected.currentStageName
    event.currentStageState = projected.currentStageState
    event.currentStageStartTime = projected.startTime
    event.stages = projected.stages
  }
  return { event, serverTime: Date.now() }
}

const loadSearchSnapshot = createSnapshot(async () => {
  const pool = []
  for (let offset = 0; offset < 10000; offset += 100) {
    const result = await db.collection('events').where({ status: 'published' }).orderBy('_id', 'asc').skip(offset).limit(100).get()
    pool.push(...result.data)
    if (result.data.length < 100) break
    if (offset === 9900) throw new Error('搜索数据量超出限制，请稍后重试')
  }
  return suppressCoveredSeriesSummaries(dedupeFeedEvents(pool.map(simplifyEvent)))
})

async function getSearchResults(input) {
  const now = Date.now()
  if (!String(input.query || '').trim()) return { list: [], total: 0, cities: [], nextCursor: null, feedOrder: [], serverTime: now }
  let events = await loadSearchSnapshot()
  events = events.map(item => Object.assign(projectLifecycleCard(item, now), { _searchStart: item.startTime, _searchEnd: item.endTime, _searchPrecision: item.timePrecision, _searchEndPrecision: item.endTimePrecision }))
  const results = searchEvents(disambiguateSeriesTitles(events), input, now)
  const size = Math.max(1, Math.min(30, Math.floor(Number(input.pageSize) || 20)))
  const page = paginate(results.list, input.feedOrder, Math.max(0, Math.floor(Number(input.cursor) || 0)), size)
  return Object.assign({}, page, { list: page.list.map(feedCard), total: results.list.length, cities: results.cities, serverTime: now })
}

exports.main = async (event) => {
  if (event && event.id) return getDetail(event.id)
  if (event && event.search === true) return getSearchResults(event)

  const { domain } = event || {}
  const requestedSort = event && event.sortMode
  const sortMode = ['comprehensive', 'time', 'popularity'].indexOf(requestedSort) >= 0
    ? requestedSort
    : 'comprehensive'
  const cursor = Math.max(0, Math.floor(Number(event && event.cursor) || 0))
  const pageSize = Math.max(1, Math.min(30, Math.floor(Number(event && event.pageSize) || 20)))
  const now = Date.now()
  const horizon = now + 180 * 24 * 60 * 60 * 1000

  const preferenceTask = (async () => {
  let preferences = {
    personalizationEnabled: true,
    preferredDomains: [],
    preferredTopics: [],
    preferredFormats: [],
    preferredCities: [],
    growthGoals: [],
    learnedTopicWeights: {},
    learnedTopicKeyWeights: {},
    learnedDomainWeights: {},
    recentSignals: []
  }
  try {
    const { OPENID } = cloud.getWXContext()
    const u = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (u.data.length) {
      preferences = {
        personalizationEnabled: u.data[0].personalizationEnabled !== false,
        preferredDomains: u.data[0].preferredDomains || [],
        preferredTopics: u.data[0].preferredTopics || [],
        preferredFormats: u.data[0].preferredFormats || [],
        preferredCities: u.data[0].preferredCities || [],
        growthGoals: u.data[0].growthGoals || [],
        learnedTopicWeights: u.data[0].learnedTopicWeights || {},
        learnedTopicKeyWeights: u.data[0].learnedTopicKeyWeights || {},
        learnedDomainWeights: u.data[0].learnedDomainWeights || {},
        recentSignals: u.data[0].recentSignals || [],
        learningVersion: u.data[0].learningVersion || 0,
        learningUpdatedAt: u.data[0].learningUpdatedAt || 0
      }
    }
  } catch (e) {
    console.warn('[getEvents] read prefs failed', e)
  }
  return preferences
  })()
  const [publicPool, loadedPreferences] = await Promise.all([loadPublicFeedPool(domain), preferenceTask])
  const {upcomingRes,ongoingWithEndRes,ongoingRecentRes} = publicPool
  let preferences = loadedPreferences
  preferences = migrateCulturePreferences(preferences)
  const personalizationEnabled = preferences.personalizationEnabled !== false
  if (!personalizationEnabled) {
    preferences = {
      personalizationEnabled: false,
      preferredDomains: [],
      preferredTopics: [],
      preferredFormats: [],
      preferredCities: [],
      growthGoals: [],
      learnedTopicWeights: {},
      learnedTopicKeyWeights: {},
      learnedDomainWeights: {},
      recentSignals: []
    }
  }
  preferences = prepareRecommendationPreferences(preferences, now)

  const byId = {}
  upcomingRes.data
    .concat(ongoingWithEndRes.data)
    .concat(ongoingRecentRes.data)
    .filter((e) => visibleInFeed(e, now, horizon))
    .forEach((e) => { byId[e._id] = e })
  let list = Object.keys(byId).map((id) => simplifyEvent(byId[id]))
  // 兼容旧数据：同一活动只有日期与具体时刻不同，也只向用户返回信息更完整的一条。
  list = dedupeFeedEvents(list)
  // 分站都已存在时，不再额外展示同一天的多城市汇总卡片。
  list = suppressCoveredSeriesSummaries(list)
  // 一个系列只占一张首页卡片，倒计时自动聚焦正在进行或下一个阶段。
  list = list.map((item) => projectLifecycleCard(item, now))
  // 跨日期的同系列内容保留为独立场次，但必须为用户显示可区分的标题。
  list = disambiguateSeriesTitles(list)
  const dislikeCutoff = now - 90 * 24 * 60 * 60 * 1000
  const dislikedIds = new Set((preferences.recentSignals || [])
    .filter((item) => ['dislike','hide','location_mismatch'].includes(item.action) && item.at >= dislikeCutoff)
    .map((item) => item.eventId))
  list = list.filter((item) => !dislikedIds.has(item.canonicalEventId || item._id) &&
    !(item.identityMembers || []).some(id => dislikedIds.has(id)))
  list = list.map((e) => Object.assign({}, e, {
    _score: computeScore(e, preferences, now),
    _heatScore: heatScore(e),
    _interestScore: interestScore(e, preferences, now),
    _behaviorScore: behaviorScore(
      e,
      preferences.learnedTopicWeights,
      preferences.learnedTopicKeyWeights,
      preferences.learnedDomainWeights,
      preferences.recentSignals,
      now
    ),
    _urgencyScore: timeScore(e.startTime, now, e.endTime),
    _exploreScore: 0.5 * eventValueScore(e) +
      0.3 * (e.popularityLevel === 'niche' ? 1 : 0.45) +
      0.2 * boundedScore(e.growthPotential, 0.5),
    _qualityScore: 0.58 * boundedScore(e.confidence, 0.5) + 0.42 * eventValueScore(e),
    recommendReason: recommendReason(e, preferences)
  }))
  if (sortMode === 'time') {
    list.sort((a, b) => compareByTime(a, b, now))
  } else if (sortMode === 'popularity') {
    list.sort((a, b) => (b._heatScore - a._heatScore) || compareByTime(a, b, now))
  } else {
    list.sort((a, b) => (b._score - a._score) || compareByTime(a, b, now))
    if (!domain || domain === 'all') list = multiRouteBlend(list, preferences)
  }

  const pagination = paginate(list, event && event.feedOrder, cursor, pageSize)
  const latestFetchedAt = list.reduce((max, e) => {
    const t = e.source && e.source.fetchedAt ? e.source.fetchedAt : 0
    return Math.max(max, t)
  }, 0)

  return {
    list: event && event.cardOnly === true ? pagination.list.map(feedCard) : pagination.list,
    feedOrder: pagination.feedOrder,
    serverTime: now,
    latestFetchedAt: latestFetchedAt || now,
    personalizationEnabled,
    sortMode,
    recommendationVersion: 3,
    nextCursor: pagination.nextCursor
  }
}
