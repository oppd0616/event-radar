const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const filename = path.resolve(__dirname, '../cloudfunctions/fetchEvents/index.js')
const moduleObject = { exports: {} }
vm.runInNewContext(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.test = {buildSearchPlan, cityLifeTopic, filterCityLifeSearchItems};', {
  module: moduleObject, exports: moduleObject.exports,
  require: name => name === 'wx-server-sdk' ? { init() {}, database: () => ({command: {}}) } :
    name.startsWith('.') ? require(path.resolve(path.dirname(filename), name)) : require(name),
  console, process, Buffer, URL, setTimeout, clearTimeout
}, { filename })
const h = moduleObject.exports.test
const now = Date.parse('2026-10-20T15:00:00+08:00')
const plan = h.buildSearchPlan('culture', now, 'seasonal_event', '香港', {}, false, true, 'web', false)
assert.match(plan.query, /Halloween/)
assert.match(plan.query, /Hong Kong/)
assert.match(plan.query, /指定开放日/)
assert.equal(plan.selectedTopic.city, '香港')
assert.equal(plan.experienceDiscovery, false, 'generic popup query must not replace seasonal intent')
const samples = [
  { title: 'Hong Kong Disneyland Halloween Time', description: 'Halloween event, September 18 to November 1, tickets and admission', expected: true },
  { title: 'Hong Kong Halloween calendar', description: 'Updated 2026 seasonal tickets', pubDate: '2020-01-01', expected: true },
  { title: '海洋公園哈囉喂', description: '香港 2026年指定日期入場及購票', expected: true },
  { title: '上海迪士尼万圣节', description: '上海限时活动预约', expected: false },
  { title: '香港餐厅投资分析', description: '行业动态', expected: false }
]
for (const {expected, ...item} of samples) assert.equal(h.filterCityLifeSearchItems([item], plan).length > 0, expected, item.title)
const pairs = new Set()
for (let day = 0; day < 77; day++) for (let hour = 0; hour < 4; hour++) {
  const topic = h.cityLifeTopic(now + day * 86400000 + hour * 3600000)
  pairs.add(topic.city + ':' + topic.key)
}
assert.equal(pairs.size, 11 * 7, 'rotation must reach every city/topic pair')
for (const key of ['brand_popup', 'dessert_cafe', 'nightlife', 'art_exhibition', 'venue_experience', 'creative_workshop']) {
  const p = h.buildSearchPlan('culture', now, key, '上海', {}, false, true, 'web', false)
  assert.equal(p.selectedTopic.key, key)
  assert.equal(p.selectedTopic.city, '上海')
  assert.ok(!p.query.includes('undefined'))
}
const christmas = h.buildSearchPlan('culture', Date.parse('2026-12-20'), 'seasonal_event', '香港', {}, false, true, 'web', false)
assert.match(christmas.query, /Christmas/)
assert.ok(!christmas.query.includes('Halloween'))
const normal = h.buildSearchPlan('culture', now, 'venue_experience', '香港', {}, false, false, 'web', false)
assert.equal(normal.selectedTopic.city, '香港')
assert.ok(!normal.query.includes('undefined'))
console.log(JSON.stringify({ok: true, sampleCount: samples.length, rotationPairs: pairs.size, query: plan.query}, null, 2))
