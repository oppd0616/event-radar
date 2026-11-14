const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const target = path.join(__dirname, '..', 'cloudfunctions', 'fetchEvents', 'index.js')
const source = fs.readFileSync(target, 'utf8') + `
module.exports.__ladder = {
  callExaSearch,
  searchCandidateEvidence,
  mockPost(fn) { postJson = fn }
}
`

const cloudMock = {
  DYNAMIC_CURRENT_ENV: 'test',
  init() {},
  database() { return { command: {}, collection() { throw new Error('unexpected database access') } } },
  getWXContext() { return {} }
}
const sandboxModule = { exports: {} }
const sandbox = {
  module: sandboxModule,
  exports: sandboxModule.exports,
  require(name) {
    if (name === 'wx-server-sdk') return cloudMock
    if (name === 'opencc-js') return { Converter: () => (value) => String(value == null ? '' : value) }
    if (name.startsWith('.')) return require(path.resolve(path.dirname(target), name))
    return require(name)
  },
  __dirname: path.dirname(target),
  __filename: target,
  Buffer,
  URL,
  console,
  process,
  setTimeout,
  clearTimeout
}
vm.runInNewContext(source, sandbox, { filename: target })
const helpers = sandboxModule.exports.__ladder

function hostsOf(body) {
  return Array.from(body.includeDomains || body.include_domains || [])
}

function hubResult(query) {
  const finals = /finals weekend|grand final/i.test(query)
  return {
    results: [{
      title: finals ? 'VALORANT Champions 2026 Finals Weekend schedule' : 'VALORANT Champions 2026 Group Stage and Playoffs schedule',
      url: finals
        ? 'https://liquipedia.net/valorant/Champions/2026/Finals'
        : 'https://liquipedia.net/valorant/Champions/2026/Groups',
      text: finals
        ? 'VALORANT Champions 2026 grand final Oct 18 17:00, finals weekend schedule, tickets and venue'
        : 'VALORANT Champions 2026 group stage Sep 24 17:00, playoffs schedule, tickets and venue'
    }]
  }
}

async function verifyMainSearch() {
  const calls = []
  helpers.mockPost(async (url, headers, body) => {
    const hosts = hostsOf(body)
    calls.push(hosts)
    if (hosts.includes('liquipedia.net')) return hubResult(body.query)
    if (!hosts.length) throw new Error('open web ran before hub coverage completed')
    return { results: [] }
  })
  const result = await helpers.callExaSearch(
    'game', Date.parse('2026-09-15T00:00:00+08:00'), 'valorant', '', {}, false, false, 'web', '无畏契约全球冠军赛'
  )
  assert.strictEqual(result.detailCoverageComplete, true)
  assert.strictEqual(result.items.length, 2)
  assert.ok(calls.some((hosts) => hosts.includes('liquipedia.net')))
  assert.ok(!calls.some((hosts) => hosts.length === 0))
}

async function verifyCandidateSearch() {
  const calls = []
  helpers.mockPost(async (url, headers, body) => {
    const hosts = hostsOf(body)
    calls.push(hosts)
    if (hosts.includes('liquipedia.net')) return hubResult(body.query)
    if (!hosts.length) throw new Error('candidate open web ran before hub coverage completed')
    return { results: [] }
  })
  const result = await helpers.searchCandidateEvidence({
    title: '无畏契约全球冠军赛',
    domain: 'game',
    topicKey: 'valorant',
    city: '上海',
    missingDetails: ['timeline_conflict']
  }, Date.parse('2026-09-15T00:00:00+08:00'))
  assert.strictEqual(result.items.length, 2)
  assert.ok(calls.some((hosts) => hosts.includes('liquipedia.net')))
  assert.ok(!calls.some((hosts) => hosts.length === 0))
}

const previousKey = process.env.EXA_API_KEY
process.env.EXA_API_KEY = 'test-key'
Promise.resolve()
  .then(verifyMainSearch)
  .then(verifyCandidateSearch)
  .then(() => console.log('search ladder verification passed: official -> hub -> open web -> search fallback'))
  .finally(() => {
    if (previousKey == null) delete process.env.EXA_API_KEY
    else process.env.EXA_API_KEY = previousKey
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
