const cloud = require('wx-server-sdk')
const OpenCC = require('opencc-js')
const { matchRadar } = require('./related')
const { requiresExactEventTime } = require('./event-time-policy')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const hkToCn = OpenCC.Converter({ from: 'hk', to: 'cn' })
const twToCn = OpenCC.Converter({ from: 'tw', to: 'cn' })

function withoutBrokenSegments(value) {
  const text = String(value == null ? '' : value)
  if (!/\uFFFD/.test(text)) return text
  return text.split(/[，。；;]/).filter((part) => part && !/\uFFFD/.test(part)).join('，').trim()
}

function simplified(value) {
  return withoutBrokenSegments(twToCn(hkToCn(String(value == null ? '' : value))))
}

function hasExactEventTime(event) {
  if (!requiresExactEventTime(event)) return false
  if (event && event.timePrecision) return event.timePrecision === 'datetime'
  const china = new Date(Number(event && event.startTime) + 8 * 3600000)
  return china.getUTCHours() !== 0 || china.getUTCMinutes() !== 0
}

function notificationIdentity(event, kind) {
  let title = String(event && event.title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
  const city = String(event && event.city || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .replace(/市$/, '')
  if (city && city.length >= 2) title = title.split(city).join('')
  const localDate = new Date(Number(event && event.startTime) + 8 * 3600000).toISOString().slice(0, 10)
  return [kind, event && event.domain, event && event.canonicalKey || title, localDate].join('|')
}

function notificationSemanticIdentity(event, kind) {
  // “新活动 / 今日举行 / 即将开始”属于同一活动提醒族，24 小时内只发一次；
  // 开放与截止是不同的行动节点，必须保留各自的提醒机会。
  const family = ['new', 'date_today', 'soon'].indexOf(kind) >= 0 ? 'event' : kind
  return notificationIdentity(event, family)
}

const DAILY_LIMIT = 3
const MIN_INTERVAL = 30 * 60000
const START_SOON_WINDOW = 2 * 3600000
const ACCESS_DEADLINE_WINDOW = 24 * 3600000
const DUE_GRACE = 15 * 60000
const NEW_ARRIVAL_WINDOW = 24 * 3600000
const MAX_PER_SUB_PER_RUN = 2
const DEFAULT_TEMPLATE_ID = 'fhWKMrhFeJEnXj5lY1zxFZeK185MlvM7o8e_2-ASgh0'
const TOPIC_ALIASES = {
  film_festival: ['电影节', '影展', '展映', '电影资料馆'],
  premiere_roadshow: ['首映', '首映礼', '电影路演', '主创路演', '点映', '观影团'],
  theatre: ['话剧', '音乐剧', '舞剧', '戏剧节', '戏剧谷'],
  immersive_theatre: ['沉浸式戏剧', '环境式戏剧', '沉浸演出'],
  computer_data: ['计算机', '软件工程', '数据科学', '网络安全', '程序设计', '算法竞赛'],
  electronic_engineering: ['电子信息', '自动化', '通信工程', '集成电路', '嵌入式'],
  mechanical_engineering: ['机械工程', '机械设计', '智能制造', '机器人'],
  civil_architecture: ['土木工程', '建筑设计', '结构设计', '城乡规划'],
  business_economics: ['经济学', '金融学', '工商管理', '市场调查', '商业案例'],
  design_media: ['视觉设计', '工业设计', '广告设计', '数字媒体', '新闻传播'],
  humanities_law: ['法学', '模拟法庭', '社会调查', '公共管理', '人文社科'],
  medicine_life: ['医学', '生命科学', '生物医药', '临床技能', '健康科普'],
  agriculture_environment: ['农业', '林业', '环境科学', '生态保护', '节能减排'],
  language_education: ['外语', '英语竞赛', '翻译比赛', '师范生', '教学技能'],
  language_exam: ['大学英语四六级', '英语四级', '英语六级', '普通话水平测试', 'CATTI'],
  qualification_exam: ['教师资格考试', '教资', '全国计算机等级考试', 'NCRE', '法律职业资格考试', '法考'],
  postgraduate_public_exam: ['研究生招生考试', '考研', '国考', '公务员招考', '选调生'],
  campus_recruitment: ['校园招聘', '秋招', '春招', '实习', '提前批', '宣讲会', '双选会']
}

function todayStr(now) {
  const d = new Date(now + 8 * 3600000)
  return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate()
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatTime(ts) {
  const d = new Date(ts + 8 * 3600000)
  return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日 ' +
    pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes())
}

function formatDate(ts) {
  const d = new Date(ts + 8 * 3600000)
  return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日'
}

function taskTime(event, kind) {
  const guide = event.participationGuide || {}
  if (kind === 'access_open') return Number(guide.accessStartTime) || event.startTime
  if (kind === 'access_deadline') return Number(guide.accessEndTime) || event.startTime
  return event.startTime
}

function taskPrompt(kind, reason) {
  if (reason) return reason
  if (kind === 'access_open') return '报名或购票即将开始'
  if (kind === 'access_deadline') return '报名或购票即将截止'
  if (kind === 'date_today') return '你关注的活动今天举行'
  if (kind === 'soon') return '你关注的活动即将开始'
  return '发现一场新的相关活动'
}

function passFrequency(sub, now, today) {
  if (sub.lastSentAt && now - sub.lastSentAt < MIN_INTERVAL) return false
  const daily = sub.dailySent || {}
  if (daily.date === today && (daily.count || 0) >= DAILY_LIMIT) return false
  return true
}

function matchesPreference(sub, event) {
  if (sub.domain !== 'all') return sub.domain === event.domain
  const domains = sub.preferredDomains || []
  const allTopics = sub.preferredTopics || []
  const topicDomains = allTopics.map((item) => item.domain).filter((item, index, list) =>
    item && list.indexOf(item) === index)
  const effectiveDomains = domains.length ? domains : topicDomains
  if (effectiveDomains.length && effectiveDomains.indexOf(event.domain) < 0) return false
  const topics = allTopics.filter((item) => item.domain === event.domain)
  if (!topics.length) return true
  const text = [event.title, event.summary].concat(event.tags || []).join(' ').toLowerCase()
  const topicHit = topics.some((item) => {
    const key = String(item.key || '').toLowerCase()
    const label = String(item.label || '').toLowerCase()
    const labelTerms = label.split(/\s*[\/／|]\s*/).filter(Boolean)
    const aliases = TOPIC_ALIASES[key] || []
    return labelTerms.concat(aliases).some((term) => text.indexOf(String(term).toLowerCase()) >= 0) ||
      (key && text.indexOf(key) >= 0)
  })
  // 用户已经选择了该领域的具体主题时，提醒必须命中主题；首页仍保留跨兴趣探索位。
  return topicHit
}

async function loadSentSet(openid) {
  const records = []
  for (let offset = 0; offset < 600; offset += 100) {
    const page = await db.collection('pushLogs')
      .where({ _openid: openid })
      .skip(offset)
      .limit(100)
      .get()
      .catch(() => ({ data: [] }))
    records.push.apply(records, page.data || [])
    if (!page.data || page.data.length < 100) break
  }
  const exact = {}
  const recentSemantic = {}
  for (const record of records) {
    exact[record.eventId + '|' + record.kind] = true
    const semanticKey = record.semanticKey
    if (semanticKey) recentSemantic[semanticKey] = Math.max(Number(recentSemantic[semanticKey]) || 0, Number(record.sentAt) || 0)
  }
  return { exact, recentSemantic }
}

async function reserveDelivery(openid, event, kind, now) {
  const result = await db.collection('pushLogs').add({
    data: {
      _openid: openid,
      eventId: event._id,
      kind,
      semanticKey: notificationSemanticIdentity(event, kind),
      status: 'sending',
      sentAt: now
    }
  })
  return result._id
}

async function sendTo(sub, event, kind, now, today, reason) {
  const templateId = process.env.SUBSCRIBE_TEMPLATE_ID || DEFAULT_TEMPLATE_ID
  if (!templateId) return { status: 'failed', error: 'missing template id' }
  const prompt = taskPrompt(kind, reason)
  let reservationId = ''
  let delivered = false
  try {
    reservationId = await reserveDelivery(sub._openid, event, kind, now)
    await cloud.openapi.subscribeMessage.send({
      touser: sub._openid,
      templateId,
      page: 'pages/detail/detail?id=' + event._id,
      data: {
        thing1: { value: simplified(prompt).slice(0, 20) },
        thing2: { value: (simplified(event.title) || '活动信息更新').slice(0, 20) },
        time17: { value: kind === 'date_today' ? formatDate(event.startTime) : formatTime(taskTime(event, kind)) },
        thing16: { value: (simplified((event.participation && event.participation.note) || '') || '打开小程序查看').slice(0, 20) }
      }
    })
    delivered = true

    // 消息一旦由微信接口确认发送，立即固化日志。即使后续订阅计数更新失败，
    // 下一轮也不会再次发送同一节点。
    await db.collection('pushLogs').doc(reservationId).update({
      data: { status: 'sent', deliveredAt: Date.now() }
    }).catch(() => null)

    const daily = sub.dailySent && sub.dailySent.date === today
      ? { date: today, count: (sub.dailySent.count || 0) + 1 }
      : { date: today, count: 1 }
    const remain = Math.max(0, (sub.remainCount || 0) - 1)

    await db.collection('subscriptions').doc(sub._id).update({
      data: {
        remainCount: remain,
        status: remain === 0 ? 'exhausted' : 'active',
        lastSentAt: now,
        dailySent: daily,
        updatedAt: now
      }
    })
    return { status: 'sent' }
  } catch (e) {
    if (!delivered && reservationId) {
      await db.collection('pushLogs').doc(reservationId).remove().catch(() => null)
    }
    const error = [e.errCode, e.errMsg || e.message].filter(Boolean).join(': ')
    console.error('[push] send failed', error)
    return delivered
      ? { status: 'sent', warning: error || 'subscription state update failed after delivery' }
      : { status: 'failed', error: error || 'unknown send error' }
  }
}

async function loadActiveSubscriptions(maxItems) {
  const list = []
  const limit = Math.max(100, Math.min(3000, Number(maxItems) || 2000))
  for (let offset = 0; offset < limit; offset += 100) {
    const page = await db.collection('subscriptions')
      .where({ status: 'active' })
      .skip(offset)
      .limit(Math.min(100, limit - offset))
      .get()
    list.push.apply(list, page.data)
    if (page.data.length < 100) break
  }
  return list.filter((sub) => Number(sub.remainCount || 0) > 0)
}

async function loadUpcomingEvents(now, maxItems) {
  const list = []
  const limit = Math.max(100, Math.min(600, Number(maxItems) || 500))
  const china = new Date(now + 8 * 3600000)
  const startOfToday = Date.UTC(china.getUTCFullYear(), china.getUTCMonth(), china.getUTCDate()) - 8 * 3600000
  const horizon = now + 180 * 24 * 3600000
  for (let offset = 0; offset < limit; offset += 100) {
    const page = await db.collection('events')
      .where({ status: 'published', startTime: _.gte(startOfToday).and(_.lte(horizon)) })
      .orderBy('startTime', 'asc')
      .skip(offset)
      .limit(Math.min(100, limit - offset))
      .get()
    list.push.apply(list, page.data)
    if (page.data.length < 100) break
  }
  return list
}

function inWindow(timestamp, from, to) {
  const value = Number(timestamp)
  return value > 0 && value >= from && value <= to
}

async function findSubs(event, kind, activeSubscriptions) {
  const active = activeSubscriptions || []
  if (kind !== 'new') {
    return active
      .filter((sub) => sub.eventId === event._id || (event.identityMembers || []).includes(sub.eventId))
      .map((sub) => ({ sub, reason: '' }))
  }

  const domainSubs = active.filter((sub) => sub.domain === event.domain || sub.domain === 'all')
  const radarSubs = active.filter((sub) => sub.kind === 'radar')

  const result = []
  for (const radar of radarSubs) {
    if (radar.explicitConsent !== true) continue
    const reason = matchRadar(radar, event)
    if (!reason) continue
    const deliverySub = domainSubs.find((sub) =>
      sub._openid === radar._openid && !sub.eventId && sub.kind !== 'radar'
    )
    if (deliverySub) result.push({ sub: deliverySub, reason })
  }
  for (const sub of domainSubs) {
    if (!sub.eventId && sub.kind !== 'radar' && matchesPreference(sub, event)) {
      result.push({ sub, reason: '' })
    }
  }

  const seen = {}
  return result.filter((item) => {
    if (seen[item.sub._id]) return false
    seen[item.sub._id] = true
    return true
  })
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (OPENID) return { ok: false, error: 'client invocation is not allowed' }
  if (!event || event.Type !== 'Timer') {
    return { ok: false, error: 'timer invocation required' }
  }
  const now = Date.now()
  const today = todayStr(now)
  await Promise.all([
    db.collection('pushLogs')
      .where({ sentAt: _.lt(now - 180 * 24 * 3600000) })
      .remove()
      .catch(() => null),
    db.collection('behaviorLogs')
      .where({ at: _.lt(now - 90 * 24 * 3600000) })
      .remove()
      .catch(() => null)
  ])
  const stats = {
    candidates: 0,
    sent: 0,
    skippedDup: 0,
    skippedQuota: 0,
    skippedBeforeSubscribe: 0,
    failed: 0,
    errors: []
  }

  const newRes = await db.collection('events')
    .where({ status: 'published', createdAt: _.gte(now - NEW_ARRIVAL_WINDOW) })
    .orderBy('createdAt', 'asc')
    .limit(50)
    .get()

  const upcomingEvents = await loadUpcomingEvents(now, 500)
  const tasks = []
  const chinaHour = new Date(now + 8 * 3600000).getUTCHours()
  for (const ev of upcomingEvents) {
    const guide = ev.participationGuide || {}
    if (inWindow(guide.accessStartTime, now - DUE_GRACE, now + START_SOON_WINDOW)) {
      tasks.push({ event: ev, kind: 'access_open' })
    }
    if (inWindow(guide.accessEndTime, now - DUE_GRACE, now + ACCESS_DEADLINE_WINDOW)) {
      tasks.push({ event: ev, kind: 'access_deadline' })
    }
    if (hasExactEventTime(ev)) {
      if (inWindow(ev.startTime, now - DUE_GRACE, now + START_SOON_WINDOW)) tasks.push({ event: ev, kind: 'soon' })
    } else if (ev.timePrecision !== 'month_range' && chinaHour >= 8 && chinaHour < 12 && todayStr(ev.startTime) === today) {
      tasks.push({ event: ev, kind: 'date_today' })
    }
  }
  // 具体节点提醒优先于普通“发现新活动”，避免同一轮对同一用户连续发送两条近似通知。
  for (const ev of newRes.data) tasks.push({ event: ev, kind: 'new' })
  stats.candidates = tasks.length

  const sentSetCache = {}
  const sentCountBySub = {}
  const deliveredThisRun = {}
  const activeSubscriptions = await loadActiveSubscriptions(2000)
  stats.activeSubscriptions = activeSubscriptions.length

  for (const task of tasks) {
    const targets = await findSubs(task.event, task.kind, activeSubscriptions)

    for (const target of targets) {
      const sub = target.sub
      if ((sentCountBySub[sub._id] || 0) >= MAX_PER_SUB_PER_RUN) continue
      const semanticKey = notificationSemanticIdentity(task.event, task.kind)
      const semanticDeliveryKey = sub._openid + '|' + semanticKey
      if (deliveredThisRun[semanticDeliveryKey]) {
        stats.skippedDup += 1
        continue
      }

      if (task.kind === 'new' && sub.createdAt && task.event.createdAt < sub.createdAt) {
        stats.skippedBeforeSubscribe += 1
        continue
      }

      if (!sentSetCache[sub._openid]) {
        sentSetCache[sub._openid] = await loadSentSet(sub._openid)
      }
      const key = task.event._id + '|' + task.kind
      const sentState = sentSetCache[sub._openid]
      if (sentState.exact[key] || (task.event.identityMembers || []).some(id => sentState.exact[id + '|' + task.kind]) || (sentState.recentSemantic[semanticKey] && now - sentState.recentSemantic[semanticKey] < 24 * 3600000)) {
        stats.skippedDup += 1
        continue
      }

      if (!passFrequency(sub, now, today)) {
        stats.skippedQuota += 1
        continue
      }

      const r = await sendTo(sub, task.event, task.kind, now, today, target.reason)
      if (r.status === 'sent') {
        sentState.exact[key] = true
        sentState.recentSemantic[semanticKey] = now
        deliveredThisRun[semanticDeliveryKey] = true
        sentCountBySub[sub._id] = (sentCountBySub[sub._id] || 0) + 1
        sub.lastSentAt = now
        stats.sent += 1
      } else if (r.status === 'failed') {
        stats.failed += 1
        if (stats.errors.length < 3) stats.errors.push(r.error)
      }
    }
  }

  console.log('[push] done', stats)
  return Object.assign({ ok: true }, stats)
}
