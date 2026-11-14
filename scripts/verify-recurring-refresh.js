const assert = require('assert')
const { refreshPlan } = require('../cloudfunctions/fetchEvents/lib/recurring-refresh')
const day = 86400000
const cet = { domain: 'academic', name: '全国大学英语四六级考试' }
const at = date => Date.parse(date + 'T12:00:00+08:00')
assert.strictEqual(refreshPlan(cet, at('2026-09-26')).interval, 7 * day)
assert.strictEqual(refreshPlan(cet, at('2026-07-01')).interval, 30 * day)
assert.strictEqual(refreshPlan(cet, at('2026-08-28')).interval, 4 * day)
assert.strictEqual(refreshPlan(cet, at('2026-12-26')).interval, 7 * day)
assert.strictEqual(refreshPlan(cet, at('2026-09-26'), 'network').interval, day / 24)
assert.strictEqual(refreshPlan({ domain: 'academic', name: '新办大学生竞赛' }, at('2026-09-26')).interval, day)
assert.strictEqual(refreshPlan({ domain: 'tech', name: 'CET4' }, at('2026-07-01')).interval, day)
assert(!Object.keys(refreshPlan(cet, at('2026-09-26'))).some(k => /startTime|endTime/.test(k)))
console.log('Recurring refresh verification passed')
