const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { createSnapshot } = require('../cloudfunctions/getEvents/search-snapshot')
async function main() {
  let count = 0, now = 1000, release
  const cache = createSnapshot(() => { count++; return new Promise(resolve => { release = resolve }) }, 20000, () => now)
  const first = cache(), concurrent = cache()
  await Promise.resolve()
  assert.equal(count, 1, 'concurrent requests share one database read')
  release([{ _id: 'one' }]); await Promise.all([first, concurrent])
  await cache(); assert.equal(count, 1, 'warm search skips database scan')
  now += 20001
  const expired = cache(); await Promise.resolve()
  assert.equal(count, 2); release([{ _id: 'two' }]); await expired
  let failures = 0
  const failing = createSnapshot(() => { failures++; throw new Error('network') })
  await assert.rejects(failing()); await assert.rejects(failing()); assert.equal(failures, 2, 'errors must not be cached')
  let feedbackStarted = false
  const context = {
    require: name => name.includes('feed-cache') ? { invalidate() {} } : name.includes('constants') ? { STORAGE_KEYS: {} } : {},
    getApp: () => ({ globalData: { useMock: false } }),
    wx: { getStorageSync: () => true, cloud: { callFunction(options) {
      if (options.name === 'manageFollows') options.success({ result: { ok: true, eventId: 'one' } })
      else { feedbackStarted = true /* deliberately leave recommendation write unresolved */ }
    } } }, console, module: { exports: {} }
  }
  vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/utils/api.js'), 'utf8'), context)
  const result = await context.module.exports.setFollow('one', true)
  assert.equal(result.ok, true); assert.equal(feedbackStarted, true, 'feedback still sent without blocking confirmed follow')
  console.log('PASS: search single-flight / 20-second expiry / failure retry / follow feedback non-blocking')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
