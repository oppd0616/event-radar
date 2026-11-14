const crypto = require('crypto')

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function dayOf(timestamp) {
  const date = new Date(timestamp + 8 * 3600000)
  return date.getUTCFullYear() + '-' + (date.getUTCMonth() + 1) + '-' + date.getUTCDate()
}

function hashOf(title, domain, startTime, sessionKey) {
  const base = normalizeTitle(title) + '|' + domain + '|' + dayOf(startTime)
  const session = normalizeTitle(sessionKey)
  return crypto.createHash('md5').update(base + (session ? '|' + session : '')).digest('hex')
}

function candidateFingerprint(title, domain, city) {
  return crypto.createHash('md5').update(
    normalizeTitle(title) + '|' + String(domain || '') + '|' + normalizeTitle(city)
  ).digest('hex')
}

module.exports = { normalizeTitle, dayOf, hashOf, candidateFingerprint }
