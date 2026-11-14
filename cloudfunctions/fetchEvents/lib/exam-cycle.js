const day = value => new Date(Number(value) + 8 * 3600000).toISOString().slice(0, 10)
function verifiedExamCycle(stages, start, end) {
  const exams = (stages || []).filter(s => s.evidenceVerified === true &&
    ['oral_exam', 'written_exam', 'preliminary', 'second_round'].includes(s.key) && Number(s.startTime) > 0)
  if (exams.length < 2 || !Number.isFinite(start) || !Number.isFinite(end)) return false
  const first = Math.min(...exams.map(s => Number(s.startTime)))
  const last = Math.max(...exams.map(s => Number(s.endTime) || Number(s.startTime)))
  return day(first) === day(start) && day(last) === day(end)
}
module.exports = { verifiedExamCycle }
