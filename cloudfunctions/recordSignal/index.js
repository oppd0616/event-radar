const cloud = require('wx-server-sdk')
const { resolveEvent } = require('./event-ref')
const crypto = require('crypto')
const { ACTION_WEIGHTS, updateLearning } = require('./recommendation-learning')
const { identityKeys, demandRoutes } = require('./interest-expansion')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command


function userDocumentId(openid) {
  return 'user-' + crypto.createHash('sha256').update(String(openid || '')).digest('hex').slice(0, 32)
}

// 只把活动库中已经验证过的内容映射到有限的主题键，避免把任意标题或用户输入
// 直接变成搜索词。topicDemand 使用 eventCandidates 中的确定性文档保存匿名聚合值，
// 不记录 openid，也不需要增加新的数据库集合。
const TOPIC_RULES = {
  tech: {
    ai: /(人工智能|大模型|生成式ai|\bai\b|机器学习)/i,
    mobile: /(手机|iphone|安卓|鸿蒙|智能终端)/i,
    chips_pc: /(芯片|处理器|显卡|电脑|pc\b)/i,
    robotics: /(机器人|人形机器人)/i,
    developer: /(开发者|技术峰会|创新工坊|devfest|build day|workshop|meetup)/i,
    hackathon: /(黑客松|hackathon|buildathon|共创挑战|智能体.*挑战赛|vibe coding)/i,
    imaging: /(摄影|影像|相机)/i,
    open_source: /(开源|github|社区共创|开源贡献)/i,
    smart_device: /(智能硬件|可穿戴|智能设备)/i
  },
  auto: {
    new_energy: /(新能源|电动车|纯电|混动)/i,
    new_car: /(新车|车型|上市发布)/i,
    autonomous: /(智能驾驶|自动驾驶|无人驾驶)/i,
    auto_show: /(车展|汽车展)/i,
    motorsport: /(赛车|f1\b|formula 1)/i,
    performance_car: /(性能车|改装车)/i,
    motorcycle: /(摩托车|机车)/i,
    auto_tech: /(汽车科技|智能座舱)/i
  },
  finance: {
    investment: /(投资|资管)/i,
    fintech: /(金融科技|fintech)/i,
    bitcoin: /(比特币|bitcoin|btc\b)/i,
    web3: /(web3|区块链)/i,
    startup: /(创业|融资|路演)/i,
    business_summit: /(商业峰会|商业论坛)/i,
    quant: /(量化交易|量化投资)/i,
    macro: /(宏观经济|经济论坛)/i
  },
  ent: {
    stadium_concert: /(演唱会|巡演|巡回演出)/i,
    music_festival: /(音乐节|music festival)/i,
    c_pop: /(华语|国语流行)/i,
    k_j_pop: /(日韩|韩国|日本|k-pop|j-pop)/i,
    western_music: /(欧美歌手|欧美音乐)/i,
    livehouse: /(live\s?house|现场音乐)/i,
    comedy: /(脱口秀|喜剧|相声)/i,
    film_festival: /(电影节|影展|展映|电影资料馆)/i,
    premiere_roadshow: /(首映礼?|电影路演|主创路演|点映|观影团)/i,
    theatre: /(话剧|音乐剧|舞剧|戏剧节|戏剧谷)/i,
    immersive_theatre: /(沉浸式戏剧|环境式戏剧|沉浸演出)/i
  },
  culture: {
    art_exhibition: /(艺术展|画展|美术馆|画廊|摄影展)/i,
    immersive_event: /(沉浸|互动体验)/i,
    japan_exhibition: /(日本|东京|大阪|京都)/i,
    korea_exhibition: /(韩国|首尔|釜山)/i,
    brand_popup: /(首店|快闪|限时店|品牌体验)/i,
    dessert_cafe: /(甜品|咖啡|烘焙|茶饮)/i,
    design_market: /(设计市集|创意市集|潮流艺术)/i,
    nightlife: /(酒吧|夜店|夜生活|电音|dj\b|club\b)/i
  },
  game: {
    honor_of_kings: /(王者荣耀|kpl\b)/i,
    lol: /(英雄联盟|league of legends|\blol\b|\blpl\b)/i,
    valorant: /(无畏契约|valorant|vct\b)/i,
    peace_elite: /(和平精英|pel\b)/i,
    console: /(单机游戏|主机游戏|playstation|xbox|switch)/i,
    steam_pc: /(steam|pc游戏)/i,
    game_expo: /(游戏展|电竞展|chinajoy)/i,
    indie_game: /(独立游戏|indie game)/i
  },
  sports: {
    football: /(足球|中超|英超|欧冠)/i,
    basketball: /(篮球|cba\b|nba\b)/i,
    badminton_pingpong: /(羽毛球|乒乓球)/i,
    tennis: /(网球|atp\b|wta\b)/i,
    running: /(马拉松|路跑|越野跑)/i,
    cycling_outdoor: /(骑行|徒步|户外挑战)/i,
    winter_extreme: /(滑雪|攀岩|冰雪|极限运动)/i,
    campus_sports: /(高校体育|大学生联赛|校园体育)/i
  },
  anime: {
    anime_expo: /(漫展|动漫展|comic con)/i,
    ip_popup: /(动漫ip|主题快闪)/i,
    goods_figures: /(谷子|手办|模型|潮玩)/i,
    cosplay: /(cosplay|coser|角色扮演)/i,
    tcg: /(集换式卡牌|卡牌赛|tcg\b)/i,
    voice_actor: /(声优|见面会)/i,
    anime_music: /(动漫音乐会|游戏音乐会)/i,
    doujin_only: /(同人展|only展|only\s)/i
  },
  academic: {
    computer_data: /(计算机|软件工程|数据科学|网络安全|算法竞赛|程序设计)/i,
    electronic_engineering: /(电子信息|自动化|通信工程|集成电路|嵌入式)/i,
    mechanical_engineering: /(机械工程|机器人大赛|智能制造|机械设计)/i,
    civil_architecture: /(土木工程|建筑设计|结构设计|城乡规划)/i,
    business_economics: /(经济学|金融学|工商管理|市场调查|商业案例)/i,
    design_media: /(视觉设计|工业设计|广告设计|数字媒体|新闻传播)/i,
    humanities_law: /(法学|模拟法庭|社会调查|公共管理|人文社科)/i,
    medicine_life: /(医学|生命科学|生物医药|临床技能|健康科普)/i,
    agriculture_environment: /(农业|林业|环境科学|生态保护|节能减排)/i,
    language_education: /(外语|英语竞赛|翻译比赛|师范生|教学技能)/i,
    math_modeling: /(数学建模|数模竞赛)/i,
    programming: /(程序设计|编程竞赛|算法竞赛|acm\b|icpc\b)/i,
    ai_competition: /(人工智能竞赛|ai竞赛)/i,
    innovation: /(创新创业|互联网\+)/i,
    robot_competition: /(机器人竞赛)/i,
    hackathon: /(黑客松|hackathon)/i,
    design_competition: /(设计竞赛|设计大赛)/i,
    academic_conference: /(学术会议|征稿)/i,
    research_program: /(科研项目|科研训练|学术夏令营|大学生创新训练|实验室开放)/i,
    industry_challenge: /(企业案例赛|商业挑战赛|企业命题|真实项目|行业挑战赛)/i,
    language_exam: /(大学英语四六级|英语四级|英语六级|普通话水平测试|catti)/i,
    qualification_exam: /(教师资格考试|教资|全国计算机等级考试|ncre|法律职业资格考试|法考)/i,
    postgraduate_public_exam: /(研究生招生考试|考研|国考|公务员招考|选调生)/i,
    campus_recruitment: /(校园招聘|秋招|春招|实习|提前批|宣讲会|双选会)/i
  }
}

function tagKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[.$]/g, '_')
    .slice(0, 24)
}

function topicKeysOf(target) {
  const domain = String(target && target.domain || '')
  const rules = TOPIC_RULES[domain] || {}
  const known = Object.keys(rules)
  const explicit = Array.isArray(target && target.topicKeys)
    ? target.topicKeys.filter((key) => known.indexOf(key) >= 0)
    : []
  const text = [target && target.title, target && target.summary]
    .concat((target && target.tags) || [])
    .join(' ')
  const inferred = known.filter((key) => rules[key].test(text))
  return Array.from(new Set(identityKeys(target).concat(explicit, inferred))).slice(0, 5)
}

function demandDocId(domain, topicKey) {
  return 'topic-demand-' + domain + '-' + topicKey
}

async function updateTopicDemand(domain, topicKeys, delta, now) {
  if (!domain || !topicKeys.length || !delta) return false
  const writes = topicKeys.map(async (topicKey) => {
    const id = demandDocId(domain, topicKey)
    const increments = {
      score: _.inc(delta),
      signalCount: _.inc(1),
      positiveSignals: _.inc(delta > 0 ? 1 : 0),
      negativeSignals: _.inc(delta < 0 ? 1 : 0),
      lastSignalAt: now,
      updatedAt: now
    }
    try {
      await db.collection('eventCandidates').doc(id).update({ data: increments })
    } catch (updateError) {
      let current
      try {
        current = await db.collection('eventCandidates').where({ _id: id }).limit(1).get()
      } catch (readError) {
        throw updateError
      }
      if (current && current.data && current.data.length) throw updateError
      await db.collection('eventCandidates').doc(id).set({
        data: {
          fingerprint: id,
          kind: 'topic_demand',
          status: 'topic_demand',
          domain,
          topicKey,
          score: delta,
          signalCount: 1,
          positiveSignals: delta > 0 ? 1 : 0,
          negativeSignals: delta < 0 ? 1 : 0,
          lastSignalAt: now,
          lastSearchedAt: 0,
          createdAt: now,
          updatedAt: now
        }
      })
    }
  })
  await Promise.all(writes)
  return true
}

function buildLearningUpdate(user, target, eventId, action, durationMs, now, feedbackAt) {
  const tags = (target.tags || []).map(tagKey).filter(Boolean).slice(0, 6)
  const topicKeys = topicKeysOf(target)
  const domain = target.domain
  const signal = { eventId, action, domain, tags, topicKeys, city: String(target.city || '').slice(0,30) }
  if (durationMs) signal.durationMs = durationMs
  const result = updateLearning(user, signal, now, feedbackAt)
  if (result.duplicated) return result
  const data = result.data
  if (!user.lastLogCleanupAt || now - user.lastLogCleanupAt > 24 * 3600000) {
    data.lastLogCleanupAt = now
  }
  return { duplicated: false, weight: result.weight, tags, topicKeys, domain, data, feedbackAt: now }
}

async function persistLearning(user, openid, target, eventId, action, durationMs, now, feedbackAt) {
  if (user._id && typeof db.runTransaction === 'function') {
    return db.runTransaction(async (transaction) => {
      const latestResult = await transaction.collection('users').doc(user._id).get()
      const latestUser = latestResult && latestResult.data ? latestResult.data : user
      if (latestUser.personalizationEnabled === false) return { skipped: 'personalization_disabled' }
      const update = buildLearningUpdate(latestUser, target, eventId, action, durationMs, now, feedbackAt)
      if (update.duplicated) return update
      const replacement = Object.assign({}, latestUser, update.data)
      delete replacement._id
      await transaction.collection('users').doc(user._id).set({ data: replacement })
      return update
    })
  }

  // 兼容首次使用和不提供事务接口的旧运行环境。已有用户在支持事务的
  // wx-server-sdk 中始终走上面的原子读改写，避免快速连点互相覆盖。
  const update = buildLearningUpdate(user, target, eventId, action, durationMs, now, feedbackAt)
  if (update.duplicated) return update
  if (user._id) {
    const replacement = Object.assign({}, user, update.data)
    delete replacement._id
    await db.collection('users').doc(user._id).set({ data: replacement })
  } else {
    await db.collection('users').doc(userDocumentId(openid)).set({
      data: Object.assign({
        _openid: openid,
        preferredDomains: [],
        preferredTopics: [],
        preferredFormats: [],
        preferredCities: [],
        createdAt: now
      }, update.data)
    })
  }
  return update
}

async function writeLog(data) {
  try {
    await db.collection('behaviorLogs').add({ data })
    return { ok: true }
  } catch (e) {
    const message = String((e && (e.errMsg || e.message)) || 'unknown database error')
    // 行为日志不应阻断浏览和提醒，但必须以 error 级别暴露，并回传明确诊断状态，
    // 避免集合漏建后长期无声丢失曝光数据。
    console.error('[recordSignal] BEHAVIOR_LOG_WRITE_FAILED', message)
    return { ok: false, error: message }
  }
}

exports.main = async (event) => {
  if (event && event.mode === 'health') {
    try {
      await db.collection('behaviorLogs').limit(1).get()
      return { ok: true, stage: 'health', behaviorLogs: true }
    } catch (e) {
      return {
        ok: false,
        stage: 'health',
        behaviorLogs: false,
        error: 'behaviorLogs unavailable: ' + String((e && (e.errMsg || e.message)) || 'unknown error')
      }
    }
  }
  const { OPENID } = cloud.getWXContext()
  let eventId = event && String(event.eventId || '')
  const action = event && event.action
  if (!OPENID || !Object.prototype.hasOwnProperty.call(ACTION_WEIGHTS, action)) {
    return { ok: false, error: 'invalid signal' }
  }
  const now = Date.now()
  const users = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
  const user = users.data[0] || {}
  if (user.personalizationEnabled === false) {
    return { ok: true, skipped: 'personalization_disabled' }
  }

  if (action === 'impression') {
    const eventIds = Array.isArray(event && event.eventIds)
      ? Array.from(new Set(event.eventIds.map(String).filter(Boolean))).slice(0, 12)
      : []
    if (!eventIds.length) return { ok: false, error: 'eventIds required' }
    const logResult = await writeLog({
      _openid: OPENID,
      action,
      eventIds,
      scene: String(event.scene || 'home').slice(0, 20),
      at: now
    })
    return {
      ok: true,
      action,
      count: eventIds.length,
      logged: logResult.ok,
      logError: logResult.error || ''
    }
  }

  if (!eventId) return { ok: false, error: 'eventId required' }

  const target = { data: await resolveEvent(db, eventId) }
  if (!target || !target.data) return { ok: false, error: 'event not found' }
  eventId = target.data._id

  const durationMs = Math.max(0, Math.min(30 * 60 * 1000, Number(event && event.durationMs) || 0))
  const learning = await persistLearning(user, OPENID, target.data, eventId, action, durationMs, now, event && event.feedbackAt)
  if (learning.skipped) return { ok: true, skipped: learning.skipped }
  if (learning.duplicated) return { ok: true, duplicated: true }
  const { weight, tags, topicKeys, domain, data } = learning
  const logResult = await writeLog({
    _openid: OPENID,
    eventId,
    action,
    domain,
    tags,
    topicKeys,
    durationMs,
    at: now
  })
  // 公共需求只保存匿名聚合值。一次浏览是弱信号，提醒/进入官方入口等强行为
  // 才会较快把主题推进到更深的采集层级。
  const demandDelta = ['hide', 'location_mismatch', 'undo_feedback'].includes(action) ? 0 : action === 'view'
    ? 0.15
    : (action === 'dwell'
        ? Math.min(2, Math.max(0.5, weight * 0.65))
        : (action === 'dislike' ? -2 : weight))
  let demandUpdated = false
  let discoveryDemandUpdated = false
  let discoveryError = ''
  try {
    const routes = demandRoutes(domain, topicKeys)
    for (const route of routes) {
      // Only strong positive actions expand to an adjacent activity form.
      if (route.factor < 1 && (!['follow','remind','official_click','share'].includes(action) || demandDelta <= 0)) continue
      demandUpdated = await updateTopicDemand(route.domain, [route.topicKey], demandDelta * route.factor, now) || demandUpdated
    }
  } catch (e) {
    // 深挖需求是增强链路，失败不能影响用户浏览、提醒或原有个性化学习。
    console.warn('[recordSignal] topic demand unavailable', e.message)
  }
  // Only the server-persisted target ID is accepted; client text cannot create search work.
  const discoveryId = target.data.discoveryTargetId
  if (demandDelta && /^target-[a-f0-9]{32}$/.test(String(discoveryId || ''))) {
    try {
      await db.collection('discoveryTargets').doc(discoveryId).update({ data: {
        demandScore: _.inc(demandDelta), updatedAt: now
      } })
      discoveryDemandUpdated = true
    } catch (e) {
      discoveryError = e.message
      console.warn('[recordSignal] discovery demand unavailable', e.message)
    }
  }
  if (data.lastLogCleanupAt) {
    await db.collection('behaviorLogs')
      .where({ _openid: OPENID, at: _.lt(now - 90 * 24 * 3600000) })
      .remove()
      .catch(() => null)
  }
  return {
    ok: true,
    action,
    logged: logResult.ok,
    logError: logResult.error || '',
    demandUpdated,
    discoveryDemandUpdated,
    discoveryError,
    topicKeys,
    feedbackAt: learning.feedbackAt
  }
}
