const assert = require('assert/strict')
const { resolve } = require('../shared/stage-resolution')
const time = value => Date.parse(value + 'T00:00:00+08:00')
const exact = { key: 'knockout', name: '淘汰赛', sessionKey: '淘汰赛', venue: '长沙七彩盒子', startTime: time('2026-10-27'), endTime: time('2026-11-08'), timePrecision: 'date', evidenceVerified: true }
const coarse = { ...exact, startTime: time('2026-10-01'), endTime: time('2026-11-30'), timePrecision: 'month_range' }
for (const input of [[coarse, exact], [exact, coarse], [coarse, exact, exact]]) {
  const result = resolve(input)
  assert.equal(result.stages.length, 1)
  assert.equal(result.stages[0].startTime, exact.startTime)
  assert.equal(result.stages[0].endTime, exact.endTime)
  assert.deepEqual(resolve(result.stages), result)
}
for (const variant of [{ startTime: time('2026-10-26') }, { endTime: time('2026-11-09') }]) {
  assert.deepEqual(resolve([exact, { ...exact, ...variant }]).conflicts, ['knockout'])
  assert.equal(resolve([exact, { ...exact, ...variant }]).stages.length, 0)
}
assert.equal(resolve([exact, { ...exact, sessionKey: '淘汰赛第二场', startTime: time('2026-10-28') }]).stages.length, 2)
assert.equal(resolve([exact, { ...exact, venue: '上海体育馆', startTime: time('2026-10-28') }]).stages.length, 2)
for (const keys of [['registration', 'lottery', 'pickup'], ['oral_exam', 'written_exam'], ['presale', 'on_sale']]) {
  assert.equal(resolve(keys.map(key => ({ ...exact, key }))).stages.length, keys.length)
}
assert.equal(resolve([coarse]).stages[0].dateEvidenceVerified, false)
const { updateRisks } = require('../cloudfunctions/fetchEvents/lib/detail-update-policy')
assert.deepEqual(updateRisks({ stages: [coarse] }, { stages: [{ ...exact, sourceUrl: 'https://example.com/schedule' }] }), [])
assert(updateRisks({ stages: [exact] }, { stages: [{ ...exact, startTime: time('2026-10-26') }] }).includes('verified_stages_removed'))
assert.deepEqual(updateRisks({ startTime: coarse.startTime }, { startTime: exact.startTime }, { stages: [{ ...exact, sourceUrl: 'https://example.com/schedule' }] }), [])
assert(updateRisks({ startTime: coarse.startTime }, { startTime: exact.startTime }, { stages: [exact] }).includes('startTime_changed_without_field_evidence'))
console.log('Stage resolution: precision replacement, conflicts, idempotence and cross-type isolation passed')
