const { normalizeTitle } = require('./event-identity')
let converter
function norm(value) {
  if (!converter) converter = require('opencc-js').Converter({ from: 't', to: 'cn' })
  return normalizeTitle(converter(String(value || '')))
}

function timing(row, text, now) {
  const end = String(row.discoveryEndDate || '')
  const quote = String(row.discoveryEndQuote || '')
  if (!/^20\d\d-\d\d-\d\d$/.test(end) || !quote || quote.length > 1400 ||
      !norm(text).includes(norm(quote)) || !norm(quote).includes(norm(row.title))) return 'unverified'
  const [year, month, day] = end.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return 'unverified'
  const endPattern = new RegExp('(?:至|到|—|–|-|~|～|结束[日时间：:\\s]*)\\s*(?:' + year + '[年/.-])?0?' + month + '[月/.-]0?' + day + '(?![0-9])')
  if (!endPattern.test(quote.replace(/\s+/g, '')) || !text.includes(String(year)) || /报名|预约|开票|售票|投稿/.test(quote)) return 'unverified'
  return Date.parse(end + 'T23:59:59.999+08:00') < now ? 'expired' : 'date_supported'
}

// Identity discovery is not detail verification. Only retain identities whose
// literal names and city can be traced to the bounded text shown to the model.
function validate(rows, items, options = {}) {
  const accepted = [], rejected = [], seen = new Set()
  for (const row of rows || []) {
    const title = String(row.title || '').trim()
    const supports = item => norm(title).length >= 4 &&
      norm([item.title, String(item.description || '').slice(0, 45000)].join('\n')).includes(norm(title))
    let index = Number(row.evidenceIndex)
    const linked = items.findIndex(item => item.link === row.detailUrl && supports(item))
    if (linked >= 0) index = linked
    else if (!Number.isInteger(index) || !items[index] || !supports(items[index])) {
      const matches = items.map((item, i) => supports(item) ? i : -1).filter(i => i >= 0)
      index = matches.length === 1 ? matches[0] : -1
    }
    if (index < 0) { rejected.push({ title, reason: 'identity_not_supported' }); continue }
    const evidence = items[index]
    const text = [evidence.title, String(evidence.description || '').slice(0, 45000)].join('\n')
    const city = String(row.city || '').trim()
    if ((options.city && norm(city) !== norm(options.city)) ||
        (city && city !== '线上' && !norm(text).includes(norm(city)))) {
      rejected.push({ title, reason: 'city_not_verified', city }); continue
    }
    const key = norm(title) + '|' + norm(city) + '|' + norm(row.parentTitle)
    if (seen.has(key)) continue
    seen.add(key)
    const clean = { ...row, title, city, evidenceIndex: index }
    clean.discoveryTiming = timing(clean, text, options.now || Date.now())
    if (clean.discoveryTiming === 'expired') {
      rejected.push({ title, reason: 'expired', end: clean.discoveryEndDate }); continue
    }
    if (clean.discoveryTiming === 'unverified') {
      delete clean.discoveryEndDate
      delete clean.discoveryEndQuote
    }
    // A discovered detail URL must actually occur in the source. A model URL
    // pointing at another article must not silently override its evidence.
    if (clean.detailUrl && clean.detailUrl !== evidence.link &&
        !text.includes(clean.detailUrl)) delete clean.detailUrl
    accepted.push(clean)
  }
  return { accepted, rejected }
}

async function discover(items, options, extract) {
  const bounded = (items || []).slice(0, 20)
  const groups = [], audit = { documents: bounded.length, batches: 0, rejected: [] }
  for (let offset = 0; offset < bounded.length; offset += 10) {
    const batch = bounded.slice(offset, offset + 10)
    audit.batches++
    const raw = await extract(batch)
    const checked = validate(raw, batch, options)
    audit.rejected.push(...checked.rejected)
    groups.push(checked.accepted.map(row => ({ ...row, evidenceIndex: row.evidenceIndex + offset })))
  }
  // Both search groups retain room even when the first directory is prolific.
  const rows = []
  for (let i = 0; i < Math.max(0, ...groups.map(group => group.length)); i++) {
    for (const group of groups) if (group[i]) rows.push(group[i])
  }
  const checked = validate(rows, bounded, options)
  audit.rejected.push(...checked.rejected)
  if (typeof options.onDiscoveryAudit === 'function') options.onDiscoveryAudit(audit)
  return checked.accepted.slice(0, 20)
}

module.exports = { VERSION: '2026-10-29.1', validate, discover, timing }
