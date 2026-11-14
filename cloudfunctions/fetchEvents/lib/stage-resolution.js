// Dates belong to individual evidence claims. Never create a wider interval by
// taking the minimum/maximum from independent claims for the same phase.
const normalized = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s（）()·:：_-]/g, '')
const day = value => new Date(Number(value) + 28800000).toISOString().slice(0, 10)
const approximate = stage => stage.timePrecision === 'month_range'
function session(stage) {
  const value = normalized(stage.sessionKey)
  return /^(小组赛|擂台赛|突围赛|淘汰赛|季后赛|总决赛|决赛|资格赛|预选赛|口试|笔试)$/.test(value) ? '' : value
}
function sameScope(a, b) {
  if (a.key !== b.key || session(a) !== session(b)) return false
  const av = normalized(a.venue), bv = normalized(b.venue)
  return !av || !bv || av === bv || av.includes(bv) || bv.includes(av)
}
function datesAgree(a, b) {
  if (day(a.startTime) !== day(b.startTime)) return false
  if (a.timePrecision === 'datetime' && b.timePrecision === 'datetime' && Number(a.startTime) !== Number(b.startTime)) return false
  if (!Number(a.endTime) || !Number(b.endTime)) return true
  if (day(a.endTime) !== day(b.endTime)) return false
  return a.endTimePrecision !== 'datetime' || b.endTimePrecision !== 'datetime' || Number(a.endTime) === Number(b.endTime)
}
function quality(s) {
  return (s.evidenceVerified === true ? 100000 : 0) + (!approximate(s) ? 10000 : 0) +
    (s.timePrecision === 'datetime' ? 1000 : 0) + (Number(s.endTime) ? 500 : 0) + Number(s.sourceAuthority || 0)
}
function resolve(input) {
  const all = (input || []).filter(s => s && s.key && Number.isFinite(Number(s.startTime)) && Number(s.startTime) > 0)
    .map(s => ({ ...s, dateEvidenceVerified: s.evidenceVerified === true && !approximate(s) }))
  const candidates = all.filter(s => !approximate(s) || !all.some(exact =>
    !approximate(exact) && exact.evidenceVerified === true && sameScope(s, exact)))
  const groups = []
  for (const s of candidates) {
    const group = groups.find(g => g.every(other => sameScope(s, other)))
    if (group) group.push(s)
    else groups.push([s])
  }
  const stages = [], conflicts = []
  for (const group of groups) {
    const verified = group.filter(s => s.evidenceVerified === true)
    const pool = verified.length ? verified : group
    if (pool.some(a => pool.some(b => !datesAgree(a, b)))) {
      conflicts.push(group[0].key)
      continue
    }
    stages.push(pool.slice().sort((a,b) => quality(b) - quality(a) ||
      String(a.sourceUrl || '').localeCompare(String(b.sourceUrl || '')))[0])
  }
  return { stages: stages.sort((a,b) => Number(approximate(a)) - Number(approximate(b)) || Number(a.startTime) - Number(b.startTime)),
    conflicts: [...new Set(conflicts)] }
}
function mergeConflicts(inherited, resolution) {
  return [...new Set([...(inherited || []), ...resolution.conflicts])].filter(key =>
    resolution.conflicts.includes(key) || !resolution.stages.some(s => s.key === key && s.dateEvidenceVerified))
}
module.exports = { resolve, mergeConflicts, approximate, sameScope }
