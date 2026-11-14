// Only new, unlisted discoveries use these bounds. Legacy queues/seeds are unchanged.
const DAY = 86400000
const VERSION = 1
const LIMIT = 60
const TTL = 30 * DAY
function sourceAlias(rows, { title, domain, city, evidence, exclusive }) {
  if (!exclusive || !evidence) return null
  const norm = x => String(x || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const year = (String(title).match(/20\d{2}/) || [])[0]
  if (!year) return null // Never collapse undated recurring sessions.
  const sourceTitle = norm(evidence.title)
  return (rows || []).find(x => {
    const previousYear = (String(x.title).match(/20\d{2}/) || [])[0]
    const previousTitle = norm(x.title)
    return x.domain === domain && previousYear === year && norm(x.city) === norm(city) &&
      previousTitle.length >= 12 && sourceTitle.includes(previousTitle) &&
      (x.sources || []).some(s => s.url === evidence.link)
  }) || null
}
async function read(doc) {
  try { return (await doc.get()).data } catch (error) {
    if (/document.*(?:not exist|not found)|DOCUMENT_NOT_EXIST/i.test(String(error.message || error.errMsg))) return null
    throw error
  }
}
function expired(item, now) {
  return Number(item.discoveryAdmissionVersion) === VERSION &&
    Number(item.discoveryExpiresAt) > 0 && Number(item.discoveryExpiresAt) <= now
}
async function reserve(tx, domain, key, now, expiry, kind = 'candidate', limit = LIMIT) {
  const doc = tx.collection('eventCandidates').doc('discovery-capacity-' + kind + '-' + domain)
  const old = await read(doc)
  const slots = Object.fromEntries(Object.entries(old && old.slots || {}).filter(([, until]) => Number(until) > now))
  if (kind === 'publisher_candidate') {
    // Small bounded pool: repair a terminal slot even if post-publication target
    // registration failed, without evicting an active candidate.
    for (const id of Object.keys(slots)) {
      const candidate = await read(tx.collection('eventCandidates').doc(id))
      if (candidate && ['published', 'rejected', 'merged', 'expired'].includes(candidate.status)) delete slots[id]
    }
  }
  if (!slots[key] && Object.keys(slots).length >= limit) return false
  slots[key] = expiry
  await doc.set({ data: { fingerprint: 'discovery-capacity-' + kind + '-' + domain, kind: 'discovery_capacity', status: 'meta', domain, slots, updatedAt: now } })
  return true
}
async function release(tx, domain, key) {
  const candidate = await read(tx.collection('eventCandidates').doc(key))
  const kind = candidate && candidate.discoveryCapacityKind === 'publisher_candidate' ? 'publisher_candidate' : 'candidate'
  const doc = tx.collection('eventCandidates').doc('discovery-capacity-' + kind + '-' + domain)
  const old = await read(doc)
  if (!old || !old.slots || !old.slots[key]) return
  const slots = { ...old.slots }
  delete slots[key]
  await doc.set({ data: { fingerprint: 'discovery-capacity-' + kind + '-' + domain, kind: 'discovery_capacity', status: 'meta', domain, slots, updatedAt: Date.now() } })
}
module.exports = { VERSION, LIMIT, TTL, DAY, expired, reserve, release, read, sourceAlias }
