const W_PREF = 0.45
const W_TIME = 0.35
const W_CONF = 0.20
const HOT_BOOST = 0.15

function prefScore(domain, preferredDomains) {
  if (!preferredDomains || preferredDomains.length === 0) return 0.5
  const hit = preferredDomains.find((p) => p.domain === domain)
  if (!hit) return 0.3
  const w = Math.max(1, Math.min(3, hit.weight || 1))
  return w / 3
}

function timeScore(startTime, now, endTime) {
  const h = (startTime - now) / 3600000
  if (h < 0) return endTime && endTime >= now ? 0.85 : 0
  if (h <= 24) return 1 - h / 48
  if (h <= 168) return 0.5 - (h - 24) / 288
  return 0.05
}

function computeScore(event, preferredDomains, now) {
  let s = W_PREF * prefScore(event.domain, preferredDomains) +
    W_TIME * timeScore(event.startTime, now, event.endTime) +
    W_CONF * (event.confidence || 0)
  if (event.isHot) s += HOT_BOOST
  return s
}

function sortEvents(list, preferredDomains, now) {
  return list
    .map((e) => Object.assign({}, e, { _score: computeScore(e, preferredDomains, now) }))
    .sort((a, b) => (b._score - a._score) || (a.startTime - b.startTime))
}

module.exports = {
  W_PREF,
  W_TIME,
  W_CONF,
  HOT_BOOST,
  timeScore,
  computeScore,
  sortEvents
}
