const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const target = path.join(__dirname, '..', 'cloudfunctions', 'getEvents', 'index.js')
const source = fs.readFileSync(target, 'utf8')
const now = Date.now()
const longRunning = {
  _id: 'long-running',
  title: '长期进行中的展览',
  domain: 'culture',
  city: '上海',
  startTime: now - 30 * 24 * 3600000,
  endTime: now + 30 * 24 * 3600000,
  timePrecision: 'date',
  status: 'published',
  confidence: 0.9,
  tags: ['展览'],
  participation: { type: 'offline', url: 'https://example.com/event' },
  participationGuide: { location: '示例展馆' }
}

function query() {
  return {
    where() { return this },
    orderBy(field, order) { this.field = field; this.order = order; return this },
    skip() { return this },
    limit() { return this },
    get() {
      // 模拟 startTime 最近 200 条已经被已结束活动占满，而 endTime 召回仍能找到长期活动。
      return Promise.resolve({ data: this.field === 'endTime' ? [longRunning] : [] })
    }
  }
}

const database = {
  command: {
    gte(value) { return { value, and() { return value } } },
    lte(value) { return value }
  },
  collection() { return query() }
}
const cloud = {
  DYNAMIC_CURRENT_ENV: 'test',
  init() {},
  database() { return database },
  getWXContext() { return { OPENID: '' } }
}
const moduleObject = { exports: {} }
const sandbox = {
  module: moduleObject,
  exports: moduleObject.exports,
  console,
  URL,
  require(name) {
    if (name === 'wx-server-sdk') return cloud
    if (name === 'opencc-js') return { Converter: () => (value) => value }
    return require('module').createRequire(target)(name)
  }
}

vm.runInNewContext(source, sandbox, { filename: target })
sandbox.module.exports.main({ domain: 'culture', pageSize: 20, sortMode: 'time' }).then((result) => {
  assert.strictEqual(result.list.length, 1)
  assert.strictEqual(result.list[0]._id, longRunning._id)
  console.log('ongoing recall verification passed')
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
