const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const target = path.join(__dirname, '..', 'cloudfunctions', 'sendSubscribeMessages', 'index.js')
const source = fs.readFileSync(target, 'utf8') + `
module.exports.__verify = {
  hasExactEventTime,
  notificationSemanticIdentity,
  taskTime,
  taskPrompt,
  inWindow,
  todayStr
}
`
const cloudMock = {
  DYNAMIC_CURRENT_ENV: 'test',
  init() {},
  getWXContext() { return { OPENID: 'client-user' } },
  database() { return { command: {} } }
}
const sandboxModule = { exports: {} }
const sandbox = {
  module: sandboxModule,
  exports: sandboxModule.exports,
  require(name) {
    if (name === 'wx-server-sdk') return cloudMock
    if (name === 'opencc-js') return { Converter: () => (value) => String(value == null ? '' : value) }
    if (name === './related') return { matchRadar: () => null }
    if (name === './event-time-policy') return require('../cloudfunctions/sendSubscribeMessages/event-time-policy')
    return require(name)
  },
  console,
  process,
  Date,
  URL
}
vm.runInNewContext(source, sandbox, { filename: target })
const helpers = sandboxModule.exports.__verify

const event = {
  _id: 'event-1',
  title: '测试活动',
  domain: 'academic',
  city: '上海',
  startTime: Date.parse('2026-09-12T00:00:00+08:00'),
  timePrecision: 'date',
  participationGuide: {
    accessStartTime: Date.parse('2026-09-10T10:00:00+08:00'),
    accessEndTime: Date.parse('2026-09-11T17:00:00+08:00')
  }
}

assert.strictEqual(helpers.hasExactEventTime(event), false)
const offlineExact = Object.assign({}, event, {
  title: '上海线下演唱会', startTime: Date.parse('2026-09-12T19:00:00+08:00'),
  timePrecision: 'datetime', participation: { type: 'registration' }
})
assert.strictEqual(helpers.hasExactEventTime(offlineExact), false)
assert.strictEqual(helpers.hasExactEventTime(Object.assign({}, offlineExact,
  { participationOptions: [{ type: 'livestream' }] })), true)
assert.strictEqual(helpers.taskTime(event, 'access_open'), event.participationGuide.accessStartTime)
assert.strictEqual(helpers.taskTime(event, 'access_deadline'), event.participationGuide.accessEndTime)
assert.strictEqual(helpers.taskPrompt('access_deadline'), '报名或购票即将截止')
assert.strictEqual(
  helpers.notificationSemanticIdentity(event, 'new'),
  helpers.notificationSemanticIdentity(event, 'soon')
)
assert.notStrictEqual(
  helpers.notificationSemanticIdentity(event, 'access_open'),
  helpers.notificationSemanticIdentity(event, 'access_deadline')
)
assert.ok(helpers.inWindow(event.participationGuide.accessStartTime,
  event.participationGuide.accessStartTime - 1,
  event.participationGuide.accessStartTime + 1))

console.log('reminder milestone verification passed')
;(async () => {
  const rejected = await sandboxModule.exports.main({ Type: 'Timer' })
  assert.equal(rejected.error, 'client invocation is not allowed')
  cloudMock.getWXContext = () => ({})
  const manual = await sandboxModule.exports.main({})
  assert.equal(manual.error, 'timer invocation required')
  console.log('Reminder entry rejects forged client timers and non-timer invocation')
})().catch(error => { console.error(error); process.exitCode = 1 })
