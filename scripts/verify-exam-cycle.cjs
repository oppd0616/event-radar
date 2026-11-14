const assert = require('assert')
const { verifiedExamCycle } = require('../cloudfunctions/fetchEvents/lib/exam-cycle')
const at = value => Date.parse(value + 'T00:00:00+08:00')
const start = at('2026-11-21'), end = at('2026-12-12')
const stages = [
  { key: 'oral_exam', startTime: start, endTime: at('2026-11-22'), evidenceVerified: true },
  { key: 'written_exam', startTime: end, evidenceVerified: true }
]
assert(verifiedExamCycle(stages, start, end))
assert(!verifiedExamCycle([], start, end))
assert(!verifiedExamCycle(stages.map(s => ({ ...s, evidenceVerified: false })), start, end))
assert(!verifiedExamCycle(stages, at('2026-09-01'), end), 'registration must not become exam start')
assert(!verifiedExamCycle([{ ...stages[0], key: 'registration' }, stages[1]], start, end))
assert(!verifiedExamCycle(stages, start, at('2026-12-13')))
console.log('Verified multi-stage exam cycles passed')
