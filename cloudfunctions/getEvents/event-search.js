const DAY = 86400000
const aliases = [['无畏契约', '瓦罗兰特', 'valorant', 'vct'], ['英雄联盟', 'lol'], ['黑客松', 'hackathon'], ['四六级', 'cet'], ['人工智能', 'ai'], ['comicquest', 'comic quest']]
const fold = value => String(value || '').normalize('NFKC').toLowerCase()
const compact = value => fold(value).replace(/[\s\p{P}\p{S}]/gu, '')
function contains(value, word) {
  if (/^[a-z]{1,3}$/.test(word)) return new RegExp('(^|[^a-z])' + word + '([^a-z]|$)').test(fold(value))
  return compact(value).includes(compact(word))
}
function match(event, query) {
  const whole = aliases.find(group => group.some(word => compact(word) === compact(query)))
  const terms = whole ? [whole] : fold(query).trim().split(/\s+/).slice(0, 8).map(term => aliases.find(group => group.some(word => compact(word) === compact(term))) || [term])
  const fields = [[event.title].concat(event.aliases || []).join(' '), (event.tags || []).concat(event.topics || []).map(tag => typeof tag === 'string' ? tag : tag.label || tag.name || tag.key || '').join(' '), [event.city, event.location, event.participationGuide && event.participationGuide.location].join(' '), (event.stages || []).filter(stage => stage.evidenceVerified !== false).map(stage => stage.name || stage.label).join(' '), event.summary]
  let score = 0
  for (const group of terms) {
    const index = fields.findIndex(field => group.some(word => contains(field, word)))
    if (index < 0) return null
    score += [100, 60, 45, 55, 20][index]
  }
  if (compact(event.title) === compact(query)) score += 300
  return score
}
function boundary(value, precision) {
  if (!value) return null
  const time = Number(value) || Date.parse(value)
  if (!Number.isFinite(time)) return null
  return precision === 'date' ? Math.floor((time + 28800000) / DAY) * DAY - 28800000 + DAY - 1 : time
}
function dateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('日期格式无效')
  const time = Date.parse(value + 'T00:00:00+08:00')
  if (!Number.isFinite(time) || new Date(time + 28800000).toISOString().slice(0, 10) !== value) throw new Error('日期无效')
  return time
}
function searchEvents(events, input, now = Date.now()) {
  const query = String(input.query || '').trim().slice(0, 80)
  if (!query) return { list: [], cities: [] }
  let from = null, to = null
  if (input.period === 'week') { from = now; const day = new Date(now + 28800000).getUTCDay() || 7; to = Math.floor((now + 28800000) / DAY) * DAY - 28800000 + (8 - day) * DAY - 1 }
  if (input.period === 'month') { from = now; to = now + 30 * DAY }
  if (input.period === 'custom') { from = dateValue(input.dateFrom); to = dateValue(input.dateTo) + DAY - 1; if (to < from) throw new Error('结束日期不能早于开始日期') }
  const rows = events.map(event => {
    const score = match(event, query)
    const start = Number(event._searchStart || event.startTime) || 0
    const end = boundary(event._searchEnd || event.endTime || start, event._searchEndPrecision || event.endTimePrecision || event._searchPrecision || event.timePrecision)
    return { event, score, start, end, ended: end !== null && end < now }
  }).filter(row => row.score !== null && (input.includeEnded === true || !row.ended))
  const cities = [...new Set(rows.map(row => row.event.city).filter(city => city && !['全国', '待定'].includes(city)))].sort()
  const list = rows.filter(row => {
    const event = row.event
    const online = ['online', 'livestream'].includes(event.participation && event.participation.type) || event.city === '线上'
    if (input.city && !(input.city === '线上' ? online : contains(event.city, input.city))) return false
    return from === null || (row.start > 0 && !['month', 'month_range', 'unknown'].includes(event._searchPrecision || event.timePrecision) && row.start <= to && row.end >= from)
  }).sort((a, b) => Number(a.ended) - Number(b.ended) || (input.sortMode === 'time' ? a.start - b.start : b.score - a.score || a.start - b.start) || String(a.event._id).localeCompare(String(b.event._id)))
    .map(row => Object.assign({}, row.event, { recommendReason: '匹配你的搜索：' + query }))
  return { list, cities }
}
module.exports = { searchEvents, match, dateValue }
