// Dates are local calendar days (UTC+8), not continuous opening intervals.
function dayKey(ms) { return new Date(Number(ms) + 28800000).toISOString().slice(0, 10) }
function datesIn(text, year) {
  const out = new Set()
  const add = (m, d) => {
    const key = year + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0')
    const time = Date.parse(key + 'T00:00:00+08:00')
    if (Number.isFinite(time) && dayKey(time) === key) out.add(key)
  }
  for (const match of String(text).matchAll(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/g)) {
    if (Number(match[1]) === year) add(+match[2], +match[3])
  }
  // Explicit Chinese lists, including omitted repeated month: 10月17日、24日及31日.
  for (const match of String(text).matchAll(/(\d{1,2})月\s*(\d{1,2})日?((?:\s*(?:、|及|和|与|與|,)\s*\d{1,2}日?)*)/g)) {
    add(+match[1], +match[2])
    for (const d of match[3].matchAll(/\d{1,2}/g)) add(+match[1], +d[0])
  }
  return [...out].sort()
}
function normalize(groups, items, start, end) {
  const result = []
  for (const group of Array.isArray(groups) ? groups.slice(0, 8) : []) {
    const item = items[Number(group.evidenceIndex)]
    const quote = String(group.quote || '').trim()
    const compact = text => String(text || '').replace(/\s/g, '')
    if (!item || !quote || quote.length > 7000 || !compact(item.description).includes(compact(quote))) continue
    const dates = [...new Set(Array.isArray(group.dates) ? group.dates : [])].sort()
    if (!dates.length || dates.length > 90 || dates.some(d => !/^20\d{2}-\d{2}-\d{2}$/.test(d))) continue
    const allowed = new Set(datesIn(quote, Number(dates[0].slice(0, 4))))
    if (dates.some(d => !allowed.has(d) || d < dayKey(start) || (end && d > dayKey(end)))) continue
    result.push({label: String(group.label || '开放安排').slice(0, 50),
      scope: group.scope === 'event' ? 'event' : 'component',
      complete: group.complete === true && allowed.size === dates.length,
      dates, source: {url: item.link, quote}})
  }
  return result
}
function state(groups, now) {
  const dates = [...new Set((groups || []).filter(g => g.scope === 'event' && g.complete === true)
    .reduce((all, g) => all.concat(g.dates || []), []))].sort()
  if (!dates.length) return null
  const today = dayKey(now)
  const next = dates.find(d => d > today)
  if (dates.includes(today)) return {key: 'today', text: '今日举行', nextDate: next || ''}
  return next ? {key: 'upcoming', text: '下一场 ' + Number(next.slice(5, 7)) + '月' + Number(next.slice(8)) + '日', nextDate: next} :
    {key: 'ended', text: '已结束', nextDate: ''}
}
function rows(groups) {
  return (groups || []).map(g => ({label: g.label,
    text: (g.dates || []).map(d => Number(d.slice(5, 7)) + '月' + Number(d.slice(8)) + '日').join('、'),
    sourceUrl: g.source && g.source.url || ''})).filter(g => g.text)
}
module.exports = { dayKey, datesIn, normalize, state, rows }
