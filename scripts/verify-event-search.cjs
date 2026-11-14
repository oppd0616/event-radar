const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const presentation = require('../miniprogram/utils/search-presentation')
const { searchEvents, match, dateValue } = require('../cloudfunctions/getEvents/event-search')
const now = Date.parse('2026-10-09T12:00:00+08:00')
const future = Date.parse('2026-10-10T00:00:00+08:00')
const events = [
  { _id: 'a', title: '上海无畏契约冠军赛', city: '上海', startTime: future, endTime: future + 10 * 86400000, timePrecision: 'date', stages: [{ name: '小组赛' }, { name: '淘汰赛' }] },
  { _id: 'b', title: '黑客松', city: '北京', startTime: future, timePrecision: 'date' },
  { _id: 'c', title: '黑客松', city: '上海', startTime: now - 86400000, endTime: now - 86400000, timePrecision: 'date' },
  { _id: 'd', title: '黑客松线上报名', city: '杭州', participation: { type: 'registration' }, startTime: future, timePrecision: 'date' },
  { _id: 'e', title: 'AI黑客松', city: '线上', participation: { type: 'online' }, startTime: future, timePrecision: 'date' }
]
assert.equal(searchEvents(events, { query: 'valorant 上海' }, now).list[0]._id, 'a')
assert.equal(searchEvents(events, { query: '小组赛' }, now).list.length, 1)
assert.equal(searchEvents(events, { query: '黑客松 上海' }, now).list.length, 0)
assert.equal(searchEvents(events, { query: '黑客松 上海', includeEnded: true }, now).list[0]._id, 'c')
assert.equal(searchEvents(events, { query: '黑客松', city: '线上' }, now).list[0]._id, 'e')
assert.equal(searchEvents(events, { query: '黑客松', city: '线上' }, now).list.length, 1)
assert.equal(searchEvents(events, { query: '黑客松', period: 'week' }, now).list.length, 3)
assert.equal(searchEvents(events, { query: '冠军赛', period: 'custom', dateFrom: '2026-10-15', dateTo: '2026-10-16' }, now).list.length, 1)
assert.equal(match({ title: 'Taipei training' }, 'ai'), null)
assert.equal(presentation.previewOf({ city: '上海', startTime: future, timePrecision: 'date', currentStageKey: 'registration', currentStageState: 'active' }, now)._previewStatus, '报名中')
assert.equal(presentation.previewOf({ city: '上海', startTime: future, timePrecision: 'month_range' }, now)._previewMeta, '上海')
assert.equal(presentation.previewOf({ city: '地点待核实' }, now)._previewMeta, '')
assert.equal(presentation.previewOf({ currentStageKey: 'registration', currentStageState: 'started' }, now)._previewStatus, '')
assert.deepEqual(presentation.conditionsOf({ query: '黑客松', city: '上海', period: 'month', includeEnded: true }).map(item => item.key), ['query', 'city', 'period', 'ended'])
assert.equal(searchEvents([{ _id: 'pending', title: '日期待定的黑客松' }], { query: '黑客松' }, now).list.length, 1, 'unknown dates are not treated as ended')
assert.throws(() => dateValue('2026-02-31'))
assert.throws(() => searchEvents(events, { query: '黑客松', period: 'custom', dateFrom: '2026-10-11', dateTo: '2026-10-10' }, now))
assert.equal(searchEvents([{ _id: 'today', title: '测试', startTime: Date.parse('2026-10-09T00:00:00+08:00'), timePrecision: 'date' }], { query: '测试' }, now).list.length, 1)
let page, resolveFirst, resolveSecond
const api = { searchEvents: () => new Promise(resolve => { if (!resolveFirst) resolveFirst = resolve; else resolveSecond = resolve }) }
vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/search/search.js'), 'utf8'), { require: name => name.includes('/api') ? api : name === 'dayjs' ? require('../miniprogram/node_modules/dayjs') : name.includes('/constants') ? { DOMAIN_MAP: {} } : name.includes('search-presentation') ? presentation : name.includes('event-time-policy') ? require('../miniprogram/utils/event-time-policy') : require('../miniprogram/utils/follows'), Page: p => page = p, wx: {}, setTimeout, clearTimeout })
page.data = Object.assign({}, page.data, { query: '旧查询' })
page.setData = function(data) { Object.assign(this.data, data) }
;(async () => {
  const first = page.fetchResults(false)
  page.data.query = '新查询'
  const second = page.fetchResults(false)
  resolveSecond({ list: [], total: 2, nextCursor: null }); await second
  resolveFirst({ list: [], total: 99, nextCursor: null }); await first
  assert.equal(page.data.total, 2, 'stale request must not replace newer results')
  clearTimeout(page.enterTimer)
  let finishRefresh
  api.searchEvents = () => new Promise(resolve => { finishRefresh = resolve })
  page.resultQuery = page.data.query
  page.data.list = [{ _id: 'existing', _enter: false }]
  const refreshing = page.fetchResults(false)
  assert.equal(page.data.loading, true)
  assert.equal(page.data.list[0]._id, 'existing', 'filter refresh retains previous cards while loading')
  finishRefresh({ list: [], total: 0, nextCursor: null }); await refreshing
  assert.equal(page.data.list.length, 0, 'confirmed empty results replace previous cards')
  clearTimeout(page.enterTimer)
  page.fetchResults = () => {}
  page.onManageHistory(); assert.equal(page.data.historyEditing, true)
  page.onManageHistory(); assert.equal(page.data.historyEditing, false)
  page.onToggleEnded(); assert.equal(page.data.includeEnded, true)
  page.data.city = '上海'; page.data.period = 'week'; page.onResetFilters()
  assert.equal(page.data.city, ''); assert.equal(page.data.period, ''); assert.equal(page.data.includeEnded, false)
  page.data.city = '上海'; page.data.period = 'month'; page.data.includeEnded = true
  page.onRemoveCondition({ currentTarget: { dataset: { key: 'city' } } })
  assert.equal(page.data.city, ''); assert.equal(page.data.period, 'month'); assert.equal(page.data.includeEnded, true)
  page.onRemoveCondition({ currentTarget: { dataset: { key: 'period' } } })
  assert.equal(page.data.period, ''); assert.equal(page.data.includeEnded, true)
  page.onRemoveCondition({ currentTarget: { dataset: { key: 'ended' } } })
  assert.equal(page.data.includeEnded, false)
  page.data.list = [{ _id: 'a', _enter: true }]; page.data.followPulseId = 'a'; page.onHide()
  assert.equal(page.data.list[0]._enter, false); assert.equal(page.data.followPulseId, '')
  const template = fs.readFileSync(require.resolve('../miniprogram/pages/search/search.wxml'), 'utf8')
  const icons = fs.readFileSync(require.resolve('../miniprogram/miniprogram_npm/tdesign-miniprogram/icon/icon.wxss'), 'utf8')
  for (const name of [...template.matchAll(/<t-icon name="([a-z0-9-]+)"/g)].map(item => item[1])) assert(icons.includes('.t-icon-' + name + ':before'), 'icon exists: ' + name)
  console.log('Event search: alias, AND, stage, archived, city, date, invalid range and stale requests passed')
})().catch(error => { console.error(error); process.exitCode = 1 })
