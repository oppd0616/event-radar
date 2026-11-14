// A missing duration is unknown, not a zero-length interval. Dates use China time.
const DAY = 86400000
const dateKey = time => Math.floor((Number(time) + 28800000) / DAY)
const POINT_KEYS = new Set(['on_sale', 'presale', 'lottery', 'results', 'opening', 'closing'])
function isDurationStage(stage) {
  return stage.durationType === 'interval' ||
    (stage.durationType !== 'point' && !POINT_KEYS.has(stage.key))
}
function stateOf(stage, now, options = {}) {
  const start = Number(stage.startTime)
  const end = Number(stage.endTime)
  if (!(start > 0) || stage.timePrecision === 'month_range') return 'pending'
  const dateOnly = options.exactClock === false || stage.timePrecision !== 'datetime'
  if (dateOnly ? dateKey(start) > dateKey(now) : start > now) return 'upcoming'
  if (end >= start) {
    const endDateOnly = options.exactClock === false || stage.endTimePrecision !== 'datetime'
    return (endDateOnly ? dateKey(end) >= dateKey(now) : end >= now) ? 'active' : 'done'
  }
  if (options.duration === true || (options.duration !== false && isDurationStage(stage))) {
    const parentEnd = Number(options.eventEndTime)
    if (parentEnd >= start && (options.eventEndPrecision === 'datetime'
      ? parentEnd < now : dateKey(parentEnd) < dateKey(now))) return 'done'
    return dateOnly && dateKey(start) === dateKey(now) ? 'active' : 'started'
  }
  return dateKey(start) === dateKey(now) ? 'active' : 'done'
}
module.exports = { stateOf, isDurationStage }
