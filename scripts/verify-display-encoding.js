const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

function loadHelpers(relative, names) {
  const filename = path.join(__dirname, '..', relative)
  const mod = { exports: {} }
  const cloud = { DYNAMIC_CURRENT_ENV: 'test', init() {}, database: () => ({ command: {} }) }
  const source = fs.readFileSync(filename, 'utf8') + '\nmodule.exports.__encoding = { ' + names.join(',') + ' }'
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports, URL, console, process, setTimeout, clearTimeout,
    require(name) {
      if (name === 'wx-server-sdk') return cloud
      if (name === 'opencc-js') return { Converter: () => (value) => String(value == null ? '' : value) }
      if (name === './related') return { matchRadar: () => [] }
      if (name === './event-time-policy') return require(path.join(path.dirname(filename), 'event-time-policy'))
      return require(name.startsWith('.') ? path.resolve(path.dirname(filename), name) : name)
    }
  }, { filename })
  return mod.exports.__encoding
}

const feed = loadHelpers('cloudfunctions/getEvents/index.js', ['simplified', 'simplifyEvent', 'visibleInFeed'])
const noon = Date.parse('2026-09-12T12:00:00+08:00')
const morning = Date.parse('2026-09-12T09:00:00+08:00')
const offline = { title: '线下演唱会', city: '上海', startTime: morning, timePrecision: 'datetime', participation: { type: 'registration' } }
assert(feed.visibleInFeed(offline, noon, noon + 86400000))
assert(!feed.visibleInFeed(Object.assign({}, offline, { participationOptions: [{ type: 'livestream' }] }), noon, noon + 86400000))
const push = loadHelpers('cloudfunctions/sendSubscribeMessages/index.js', ['simplified'])
const content = require('../miniprogram/utils/content')

assert.equal(feed.simplified('正常信息，具体链接待官方\uFFFD\uFFFD布'), '正常信息')
assert.equal(feed.simplified('完整正常信息'), '完整正常信息')
const event = feed.simplifyEvent({
  title: '标题\uFFFD损坏',
  summary: '十月五号开启预售，平台链接待官方\uFFFD\uFFFD布',
  tags: ['正常标签', '坏\uFFFD标签'],
  highlights: [{ type: 'guest', label: '坏\uFFFD嘉宾', value: '坏' }],
  participation: { note: '官方入口' }, participationGuide: { steps: ['正常步骤', '坏\uFFFD步骤'] }
})
assert.equal(event.title, '活动信息待更新')
assert.equal(event.summary, '十月五号开启预售')
assert.deepEqual(Array.from(event.tags), ['正常标签'])
assert.equal(event.highlights.length, 0)
assert.deepEqual(Array.from(event.participationGuide.steps), ['正常步骤'])
assert.equal(push.simplified('提醒正常，详情\uFFFD损坏'), '提醒正常')

const visibleDuplicates = content.mergeUniqueEvents([], [
  {
    _id: 'master-a',
    title: '2026上海劳力士大师赛大师赛嘉年华',
    domain: 'sports',
    startTime: Date.parse('2026-10-01T00:00:00+08:00'),
    timePrecision: 'date'
  },
  {
    _id: 'master-b',
    title: '２０２６ 上海劳力士大师赛大师赛嘉年华',
    domain: 'sports',
    startTime: Date.parse('2026-10-01T15:00:00+08:00'),
    timePrecision: 'datetime'
  }
])
assert.equal(visibleDuplicates.length, 1, 'same visible event must not render twice under different IDs')
assert.equal(content.mergeUniqueEvents([], [
  { _id: 'matinee', title: '同名演出', domain: 'ent', startTime: Date.parse('2026-10-01T14:00:00+08:00'), timePrecision: 'datetime' },
  { _id: 'evening', title: '同名演出', domain: 'ent', startTime: Date.parse('2026-10-01T19:00:00+08:00'), timePrecision: 'datetime' }
]).length, 2, 'different exact sessions must remain visible')
assert.equal(content.mergeUniqueEvents([], [
  {
    _id: 'valorant-series', title: '2026无畏契约上海全球冠军赛', domain: 'game',
    startTime: Date.parse('2026-09-24T00:00:00+08:00'), timePrecision: 'date'
  },
  {
    _id: 'valorant-stage', title: '2026无畏契约全球冠军赛 小组赛及淘汰赛（静安体育中心）', domain: 'game',
    startTime: Date.parse('2026-09-24T00:00:00+08:00'), timePrecision: 'date'
  }
]).length, 1, 'same-day tournament summary and stage card must render once')
console.log('Display encoding verification passed')
