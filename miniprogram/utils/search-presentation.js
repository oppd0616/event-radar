// Presentation only: never invent a date, venue or registration state.
function previewOf(event, now = Date.now()) {
  const parts = []
  if (event.city && !/待定|核实|未知/.test(event.city)) parts.push(event.city)
  const start = Number(event.startTime)
  if (start > 0 && !['unknown', 'month_range', 'month'].includes(event.timePrecision)) {
    const local = new Date(start + 8 * 3600000)
    const year = local.getUTCFullYear()
    const currentYear = new Date(now + 8 * 3600000).getUTCFullYear()
    parts.push((year !== currentYear ? year + '年' : '') + (local.getUTCMonth() + 1) + '月' + local.getUTCDate() + '日')
  } else if (event.scheduleWindowLabel) parts.push(event.scheduleWindowLabel)
  const active = event.currentStageState === 'active'
  const status = active && ['registration', 'on_sale', 'presale'].includes(event.currentStageKey)
    ? ({ registration: '报名中', on_sale: '售票中', presale: '预售中' })[event.currentStageKey]
    : active ? '进行中' : ''
  return { _previewMeta: parts.join(' · '), _previewStatus: status }
}
function conditionsOf(data) {
  const conditions = []
  if (data.query) conditions.push({ key: 'query', label: data.query })
  if (data.city) conditions.push({ key: 'city', label: data.city })
  if (data.period) {
    const label = data.period === 'week' ? '本周' : data.period === 'month' ? '未来30天'
      : data.dateFrom && data.dateTo ? data.dateFrom.slice(5).replace('-', '.') + ' — ' + data.dateTo.slice(5).replace('-', '.') : '自定义日期'
    conditions.push({ key: 'period', label })
  }
  if (data.includeEnded) conditions.push({ key: 'ended', label: '含已结束' })
  return conditions
}
module.exports = { previewOf, conditionsOf }
