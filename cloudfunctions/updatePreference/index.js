const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const VALID_DOMAINS = ['tech', 'auto', 'finance', 'ent', 'culture', 'game', 'sports', 'anime', 'academic']
const VALID_FORMATS = ['livestream', 'esports', 'registration', 'offline', 'ticket', 'release']
const VALID_GROWTH_GOALS = ['postgraduate', 'employment', 'scholarship', 'research', 'portfolio', 'entrepreneurship']
const CULTURE_TOPIC_KEYS = ['art_exhibition', 'immersive_event', 'brand_popup', 'dessert_cafe', 'design_market', 'nightlife']
const LEGACY_ANIME_TOPIC_KEYS = ['anime_show']

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function userDocumentId(openid) {
  return 'user-' + crypto.createHash('sha256').update(String(openid || '')).digest('hex').slice(0, 32)
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { error: 'login required' }
  const now = Date.now()

  const privacyAction = event && event.privacyAction
  if (privacyAction === 'setPersonalization') {
    const enabled = event.enabled !== false
    const existing = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    const data = { personalizationEnabled: enabled, updatedAt: now }
    if (existing.data.length) {
      await db.collection('users').doc(existing.data[0]._id).update({ data })
    } else {
      await db.collection('users').doc(userDocumentId(OPENID)).set({
        data: Object.assign({
          _openid: OPENID,
          preferredDomains: [],
          preferredTopics: [],
          preferredFormats: [],
          preferredCities: [],
          createdAt: now
        }, data)
      })
    }
    return { ok: true, personalizationEnabled: enabled }
  }

  if (privacyAction === 'clearRecommendationData') {
    const existing = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    if (existing.data.length) {
      const clear = async context => {
        const ref = context.collection('users').doc(existing.data[0]._id)
        const current = (await ref.get()).data
        const data = Object.assign({}, current, {
          recentSignals: [],
          learnedTopicWeights: {},
          learnedTopicKeyWeights: {},
          learnedDomainWeights: {},
          learningVersion: 2,
          learningUpdatedAt: now,
          updatedAt: now
        })
        delete data._id
        await ref.set({data})
      }
      if (typeof db.runTransaction === 'function') await db.runTransaction(clear)
      else await clear(db)
    }
    const logs = await db.collection('behaviorLogs').where({ _openid: OPENID }).remove()
    return { ok: true, removed: (logs.stats && logs.stats.removed) || 0 }
  }

  if (privacyAction === 'deleteMyData') {
    const results = await Promise.all([
      db.collection('behaviorLogs').where({ _openid: OPENID }).remove(),
      db.collection('pushLogs').where({ _openid: OPENID }).remove(),
      db.collection('subscriptions').where({ _openid: OPENID }).remove(),
      db.collection('users').where({ _openid: OPENID }).remove()
    ])
    return {
      ok: true,
      removed: results.reduce((sum, item) => sum + ((item.stats && item.stats.removed) || 0), 0)
    }
  }

  const rawTopics = ((event && event.preferredTopics) || []).map((topic) => {
    if (topic && topic.domain === 'ent' && CULTURE_TOPIC_KEYS.indexOf(topic.key) >= 0) {
      return Object.assign({}, topic, { domain: 'culture' })
    }
    if (topic && topic.domain === 'ent' && LEGACY_ANIME_TOPIC_KEYS.indexOf(topic.key) >= 0) {
      return Object.assign({}, topic, { domain: 'anime', key: 'anime_music', label: '动漫音乐会' })
    }
    return topic
  })
  const raw = ((event && event.preferredDomains) || []).slice()
  if (rawTopics.some((topic) => topic && topic.domain === 'culture') && !raw.some((item) => item.domain === 'culture')) {
    raw.push({ domain: 'culture', weight: 3 })
  }
  if (rawTopics.some((topic) => topic && topic.domain === 'anime') && !raw.some((item) => item.domain === 'anime')) {
    raw.push({ domain: 'anime', weight: 3 })
  }
  const preferredDomains = raw
    .filter((p) => p && VALID_DOMAINS.indexOf(p.domain) >= 0)
    .filter((p, index, list) => list.findIndex((item) => item.domain === p.domain) === index)
    .map((p) => ({ domain: p.domain, weight: Math.max(1, Math.min(3, p.weight || 1)) }))
  const preferredTopics = rawTopics
    .filter((topic) => topic && VALID_DOMAINS.indexOf(topic.domain) >= 0 && topic.key)
    .slice(0, 36)
    .map((topic) => ({
      key: cleanText(topic.key, 40),
      label: cleanText(topic.label, 30),
      domain: topic.domain,
      weight: Math.max(1, Math.min(3, Number(topic.weight) || 1)),
      tier: topic.tier === 'trend' ? 'trend' : 'core',
      group: topic.group === 'major' ? 'major' : 'interest',
      score: Math.max(0, Math.min(100, Number(topic.score) || 0))
    }))
  const preferredFormats = ((event && event.preferredFormats) || [])
    .filter((format, index, list) => VALID_FORMATS.indexOf(format) >= 0 && list.indexOf(format) === index)
  const preferredCities = ((event && event.preferredCities) || [])
    .map((city) => cleanText(city, 20))
    .filter((city, index, list) => city && list.indexOf(city) === index)
    .slice(0, 8)
  const growthGoals = ((event && event.growthGoals) || [])
    .filter((goal, index, list) => VALID_GROWTH_GOALS.indexOf(goal) >= 0 && list.indexOf(goal) === index)
    .slice(0, 4)

  const preferenceData = {
    preferredDomains,
    preferredTopics,
    preferredFormats,
    preferredCities,
    growthGoals,
    onboardingDone: true,
    lastActiveAt: now,
    updatedAt: now
  }
  if (Object.prototype.hasOwnProperty.call(event || {}, 'personalizationEnabled')) {
    preferenceData.personalizationEnabled = event.personalizationEnabled !== false
  }

  const existing = await db.collection('users').where({ _openid: OPENID }).limit(1).get()

  if (existing.data.length) {
    await db.collection('users').doc(existing.data[0]._id).update({
      data: preferenceData
    })
  } else {
    await db.collection('users').doc(userDocumentId(OPENID)).set({
      data: {
        _openid: OPENID,
        personalizationEnabled: true,
        ...preferenceData,
        createdAt: now,
      }
    })
  }

  // 清除旧版本曾静默创建的“相关活动雷达”；当前活动提醒和用户主动开启的新活动提醒不受影响。
  await db.collection('subscriptions')
    .where({ _openid: OPENID, kind: 'radar' })
    .remove()
    .catch(() => null)

  return { ok: true, preferredDomains, preferredTopics, preferredFormats, preferredCities, growthGoals }
}
