const cloud = require('wx-server-sdk')
const { resolveEvent } = require('./event-ref')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const VALID_DOMAINS = ['tech', 'auto', 'finance', 'ent', 'culture', 'game', 'sports', 'anime', 'academic', 'all']

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { error: 'login required' }
  const now = Date.now()
  const requestedRadar = event && event.kind === 'radar'
  if (requestedRadar && event.explicitConsent !== true) {
    return { ok: false, error: 'explicit consent required for related-event tracking' }
  }
  let eventId = !requestedRadar && event && event.eventId ? String(event.eventId) : ''
  let eventMembers = []
  const kind = requestedRadar ? 'radar' : (eventId ? 'event' : 'domain')
  const grantQuota = kind !== 'radar' || !event || event.grantQuota !== false
  let anchorEventId = kind === 'radar' && event && event.anchorEventId
    ? String(event.anchorEventId)
    : ''
  let domain = event && VALID_DOMAINS.indexOf(event.domain) >= 0 ? event.domain : 'all'
  let eventTitle = ''
  let anchor = null
  let preferenceSnapshot = null

  if (kind === 'domain' && domain === 'all') {
    const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
    const user = userRes.data[0] || {}
    preferenceSnapshot = {
      preferredDomains: (user.preferredDomains || []).map((item) => item.domain).filter(Boolean).slice(0, 9),
      preferredTopics: (user.preferredTopics || []).map((item) => ({
        key: String(item.key || '').slice(0, 40),
        label: String(item.label || '').slice(0, 30),
        domain: item.domain
      })).filter((item) => item.key && item.domain).slice(0, 36)
    }
  }

  if (kind === 'radar' && !anchorEventId) return { error: 'anchor event is required' }

  if (kind === 'radar') {
    const anchorDoc = { data: await resolveEvent(db, anchorEventId) }
    if (!anchorDoc || !anchorDoc.data || anchorDoc.data.status !== 'published') {
      return { error: 'anchor event not found or unavailable' }
    }
    anchor = anchorDoc.data
    anchorEventId = anchor._id
    domain = anchor.domain
  }

  if (eventId) {
    const eventDoc = { data: await resolveEvent(db, eventId) }
    if (!eventDoc || !eventDoc.data || eventDoc.data.status !== 'published') {
      return { error: 'event not found or unavailable' }
    }
    const target = eventDoc.data
    eventId = target._id
    eventMembers = Array.from(new Set([eventId].concat(target.identityMembers || [])))
    const stillActive = target.startTime >= now || (target.endTime && target.endTime >= now)
    if (!stillActive) return { error: 'event already ended' }
    domain = target.domain
    eventTitle = String(target.title || '').slice(0, 50)
  }

  let existing
  if (kind === 'radar') {
    existing = await db.collection('subscriptions')
      .where({ _openid: OPENID, kind: 'radar', anchorEventId: db.command.in(Array.from(new Set([anchorEventId].concat(anchor.identityMembers || [])))) })
      .limit(1)
      .get()
  } else if (eventId) {
    existing = await db.collection('subscriptions')
      .where({ _openid: OPENID, eventId: db.command.in(eventMembers) })
      .limit(1)
      .get()
  } else {
    const candidates = await db.collection('subscriptions')
      .where({ _openid: OPENID, domain })
      .limit(20)
      .get()
    existing = { data: candidates.data.filter((s) => !s.eventId && s.kind !== 'radar').slice(0, 1) }
  }

  if (existing.data.length) {
    const sub = existing.data[0]
    const updateData = {
      remainCount: (sub.remainCount || 0) + (grantQuota ? 1 : 0),
      status: 'active',
      kind,
      updatedAt: now
    }
    if (eventId) { updateData.eventTitle = eventTitle; updateData.eventId = eventId }
    if (anchor) {
      updateData.anchorEventId = anchorEventId
      updateData.anchorEventTitle = String(anchor.title || '').slice(0, 50)
      updateData.anchorDomain = anchor.domain
      updateData.anchorTags = (anchor.tags || []).slice(0, 6)
      updateData.anchorParticipationType = (anchor.participation || {}).type || ''
      updateData.discoveryMode = event.discoveryMode === 'precise' ? 'precise' : 'explore'
      updateData.explicitConsent = true
    }
    if (preferenceSnapshot) Object.assign(updateData, preferenceSnapshot)
    await db.collection('subscriptions').doc(sub._id).update({
      data: updateData
    })
  } else {
    const subscription = {
      _openid: OPENID,
      kind,
      domain,
      templateId: process.env.SUBSCRIBE_TEMPLATE_ID || '',
      remainCount: grantQuota ? 1 : 0,
      status: 'active',
      lastSentAt: 0,
      dailySent: { date: '', count: 0 },
      createdAt: now,
      updatedAt: now
    }
    if (eventId) {
      subscription.eventId = eventId
      subscription.eventTitle = eventTitle
    }
    if (anchor) {
      subscription.anchorEventId = anchorEventId
      subscription.anchorEventTitle = String(anchor.title || '').slice(0, 50)
      subscription.anchorDomain = anchor.domain
      subscription.anchorTags = (anchor.tags || []).slice(0, 6)
      subscription.anchorParticipationType = (anchor.participation || {}).type || ''
      subscription.discoveryMode = event.discoveryMode === 'precise' ? 'precise' : 'explore'
      subscription.explicitConsent = true
    }
    if (preferenceSnapshot) Object.assign(subscription, preferenceSnapshot)
    await db.collection('subscriptions').add({
      data: subscription
    })
  }

  const res = await db.collection('subscriptions').where({ _openid: OPENID }).limit(50).get()
  return { ok: true, list: res.data }
}
