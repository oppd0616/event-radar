const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const filename = path.resolve(__dirname, '../miniprogram/pages/home/home.js')
const mod = { exports: {} }
let pageConfig
vm.runInNewContext(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.__verify = { eventCountdownText }', {
  module: mod, exports: mod.exports,
  Page(config) { pageConfig = config },
  require(name) {
    if (name === 'dayjs') return require('../miniprogram/node_modules/dayjs')
    if (name === '../../utils/constants') return { DOMAINS: [], DOMAIN_MAP: {}, STORAGE_KEYS: {} }
    if (name === '../../utils/event-time-policy') return require('../miniprogram/utils/event-time-policy')
    if (name === '../../utils/content') return { isDateOnly: (event) => event.timePrecision === 'date', simplifyEvent: (event) => event }
    return {}
  }
})

const now = Date.parse('2026-09-12T12:00:00+08:00')
const startTime = Date.parse('2026-09-12T19:00:00+08:00')
const offline = { title: '上海线下演唱会', city: '上海', domain: 'ent', startTime, timePrecision: 'datetime', participation: { type: 'registration' } }
assert.strictEqual(mod.exports.__verify.eventCountdownText(offline, now), '今日举行')
const offlineCard = pageConfig.decorate([offline], now)[0]
assert.strictEqual(offlineCard._timeText, '9月12日')
assert.strictEqual(offlineCard._countdownText, '今日举行')
const live = Object.assign({}, offline, { participationOptions: [{ type: 'livestream' }] })
const liveCard = pageConfig.decorate([live], now)[0]
assert.strictEqual(liveCard._timeText, '9月12日 19:00')
assert(liveCard._countdownText.includes('小时'))
console.log('Home time display verification passed')
