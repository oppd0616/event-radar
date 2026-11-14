const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const filename = path.join(__dirname, '../cloudfunctions/fetchEvents/index.js')
const mod = { exports: {} }
const cloud = { init() {}, database: () => ({ command: {} }) }
vm.runInNewContext(fs.readFileSync(filename, 'utf8') + `
module.exports.helpers = { extractJson, callDeepSeek, cleanSearchText, containsBrokenEncoding, missingDetailReasons, detailMissingFields, sameDiscoveredEvent, mergeDiscoveredEvent, hasLinkedStageDateEvidence, findDateSupportingEvidence, normalizeExtractedStages, phaseOf, mockPost(fn) { postJson = fn } }
`, {
  module: mod, exports: mod.exports,
  require: (name) => name === 'wx-server-sdk'
    ? cloud
    : name === './lib/detail-script' ? { detailSearchText: (value) => String(value || '') }
      : (name.startsWith('.') ? require(path.resolve(path.dirname(filename), name)) : require(name)),
  process: { env: { DEEPSEEK_API_KEY: 'test-only' } },
  console, Buffer, URL, setTimeout, clearTimeout
}, { filename })
const h = mod.exports.helpers
const event = { title: '单依纯成都站', startTime: '2026-09-13T19:00:00+08:00', evidenceIndex: 0 }
const reply = (content, reason = 'stop') => ({ choices: [{ finish_reason: reason, message: { content } }], usage: { completion_tokens: 1200 } })

async function main() {
  const pendingTicket={title:'展览',domain:'culture',startTime:1,timePrecision:'date',participation:{type:'registration',url:'https://example.com'},participationGuide:{location:'国贸商城'}}
  assert(h.missingDetailReasons(pendingTicket).includes('access_time'))
  assert(h.detailMissingFields([pendingTicket],['visit'],[],[]).includes('access_time'))
  const openTicket={...pendingTicket,participation:{...pendingTicket.participation,note:'现已开放预约'}}
  assert(!h.missingDetailReasons(openTicket).includes('access_time'))
  assert(!h.detailMissingFields([openTicket],['visit'],[],[]).includes('access_time'))
  assert(h.detailMissingFields([{...openTicket,timePrecision:'month_range'}],['visit'],[],[]).includes('date'))
  const offlineFinal = {
    title: '2026无畏契约全球冠军赛 总决赛周末（梅赛德斯-奔驰文化中心）',
    domain: 'game', city: '上海', startTime: Date.parse('2026-10-16T14:00:00+08:00'),
    timePrecision: 'datetime', participation: { type: 'offline', url: 'https://val.qq.com/' },
    participationGuide: { location: '梅赛德斯-奔驰文化中心' }
  }
  const liveCompanion = {
    title: '2026无畏契约全球冠军赛 中国大陆线上直播',
    domain: 'game', city: '', startTime: Date.parse('2026-09-24T00:00:00+08:00'),
    timePrecision: 'date', participation: { type: 'livestream', url: 'https://live.bilibili.com/123' },
    participationGuide: { platform: '哔哩哔哩直播' }
  }
  assert.ok(h.sameDiscoveredEvent(offlineFinal, liveCompanion), 'ingestion must recognize a livestream companion across dates')
  const mergedCompanion = h.mergeDiscoveredEvent(liveCompanion, offlineFinal)
  assert.equal(mergedCompanion.startTime, offlineFinal.startTime, 'ingestion must preserve the actual offline event time')
  assert.equal(mergedCompanion.participation.type, 'offline', 'the main activity remains the primary participation method')
  assert.ok(mergedCompanion.participationOptions.some((item) => item.type === 'livestream'), 'the livestream survives as a detail option')
  assert.ok(h.sameDiscoveredEvent(
    { title: '2026上海劳力士大师赛大师赛嘉年华', domain: 'sports', city: '上海', startTime: Date.parse('2026-10-01T00:00:00+08:00'), timePrecision: 'date', sessionKey: '人事体育APP', participation: {} },
    { title: '2026上海劳力士大师赛大师赛嘉年华', domain: 'sports', city: '全国', startTime: Date.parse('2026-10-01T00:00:00+08:00'), timePrecision: 'date', sessionKey: '久事体育APP微信小程序', participation: {} }
  ), 'ingestion must ignore a dirty city mismatch for an exact same-title same-day record')

  const json = JSON.stringify([event])
  assert.equal(h.extractJson('```json\n' + json + '\n```\n说明 [附注]')[0].title, event.title)
  assert.equal(h.extractJson('[说明]\n' + json)[0].title, event.title)
  const escaped = JSON.stringify([{ title: '文字中有 } ] 和 "引号" 与 \\字符' }])
  assert.equal(h.extractJson(escaped)[0].title, JSON.parse(escaped)[0].title)
  assert.equal(h.extractJson('[' + JSON.stringify(event) + ',{"title":"未完'), null)
  assert.equal(h.extractJson('{"events":' + json), null)
  assert.equal(h.cleanSearchText('待官方\uFFFD\uFFFD公布'), '待官方 公布')
  assert.ok(h.containsBrokenEncoding({ summary: '损坏\uFFFD文本' }))
  assert.ok(h.missingDetailReasons({ timePrecision: 'datetime', title: '正常标题', summary: '损坏\uFFFD文本', participation: {}, participationGuide: {} }).includes('broken_encoding'))
  assert.ok(h.missingDetailReasons({
    timePrecision: 'datetime', title: '上海快闪', city: '上海', summary: '线下活动',
    participation: { type: 'offline' }, participationGuide: {}
  }).includes('venue'), 'a city must not be treated as a concrete offline venue')
  assert.ok(!h.missingDetailReasons({
    timePrecision: 'datetime', title: '上海快闪', city: '上海', summary: '线下活动',
    participation: { type: 'offline' }, participationGuide: { location: '上海静安大悦城' }
  }).includes('venue'))
  assert.ok(h.missingDetailReasons({
    timePrecision: 'datetime', title: '上海快闪', city: '上海', summary: '线下活动',
    participation: { type: 'offline' }, participationGuide: { location: '上海' }
  }).includes('venue'), 'a city copied into location is still not a venue')
  const multiDateFinalEvidence = {
    title: 'Champions Shanghai Finals Weekend Ticket Information',
    description: 'The tournament runs September 24 to October 18. Finals Weekend starts October 16.'
  }
  assert.equal(
    h.hasLinkedStageDateEvidence('final_weekend', Date.parse('2026-09-24T00:00:00+08:00'), multiDateFinalEvidence),
    false,
    'the overall tournament date must not be assigned to finals weekend'
  )
  assert.equal(
    h.hasLinkedStageDateEvidence('final_weekend', Date.parse('2026-10-16T00:00:00+08:00'), multiDateFinalEvidence),
    true,
    'a date linked to the named stage should be accepted'
  )
  assert.equal(h.phaseOf({ title: '小组赛及淘汰赛现场观赛' }), 'group_knockout')
  const officialScheduleEvidence = [{
    title: '2026测试赛事官方赛程',
    description: '瑞士轮 9月24日至10月4日。冠军战 10月18日 18:00。',
    link: 'https://valorantesports.com/example', sourceTier: 'official', sourceAuthority: 100
  }]
  const nativeStages = h.normalizeExtractedStages([
    {
      phaseKey: 'group', sourceLabel: '瑞士轮', startTime: '2026-09-24T00:00:00+08:00',
      endTime: '2026-10-04T00:00:00+08:00', timePrecision: 'date', endTimePrecision: 'date', evidenceIndex: 0
    },
    {
      phaseKey: 'final', sourceLabel: '冠军战', startTime: '2026-10-18T18:00:00+08:00',
      endTime: '', timePrecision: 'datetime', endTimePrecision: 'date', evidenceIndex: 0,
      participants: ['A队', 'B队']
    }
  ], officialScheduleEvidence, '2026测试赛事', 'game', Date.parse('2026-09-15T00:00:00+08:00'))
  assert.deepStrictEqual(Array.from(nativeStages, (stage) => stage.name), ['瑞士轮', '冠军战'])
  assert.deepStrictEqual(Array.from(nativeStages[1].participants), ['A队', 'B队'])
  assert.strictEqual(nativeStages[0].sourceTier, 'official')
  const crossSourceEvidence = [
    { title: '2026 EDC雏菊电音嘉年华上海站', description: '票务信息陆续公布', link: 'https://example.com/a' },
    { title: '喜力星电音呈现2026 EDC雏菊电音嘉年华上海站', description: '活动将于10月5日在上海举行', link: 'https://example.org/b' }
  ]
  assert.strictEqual(
    h.findDateSupportingEvidence('2026 EDC雏菊电音嘉年华上海站', Date.parse('2026-10-05T00:00:00+08:00'), '2026-10-05T00:00:00+08:00', crossSourceEvidence),
    1,
    'a matching source with explicit date may replace a model-selected source that lacks date evidence'
  )

  let calls = 0
  const opts = { maxItems: 2, maxTokens: 1000, required: true }
  h.mockPost(async (url, headers, body) => {
    calls++
    assert.ok(body.max_tokens >= 2600, 'full two-event output needs sufficient budget')
    return calls === 1 ? reply(json.slice(0, -1), 'length') : reply(json)
  })
  const result = await h.callDeepSeek([], 0.1, Date.now(), opts)
  assert.equal(result.length, 1)
  assert.equal(calls, 2)
  assert.equal(opts.diagnostics.attempts, 2)

  calls = 0
  h.mockPost(async () => { calls++; return reply('[]') })
  assert.equal((await h.callDeepSeek([], 0.1, Date.now(), {})).length, 0)
  assert.equal(calls, 1, 'a legitimate empty result does not trigger a retry')

  calls = 0
  h.mockPost(async () => {
    calls++
    return calls === 1 ? reply(JSON.stringify([{ ...event, summary: '待官方\uFFFD\uFFFD布' }])) : reply(json)
  })
  assert.equal((await h.callDeepSeek([], 0.1, Date.now(), {}))[0].title, event.title)
  assert.equal(calls, 2, 'broken model text triggers one clean retry')

  calls = 0
  h.mockPost(async () => { calls++; return reply('[{"title":', 'length') })
  await assert.rejects(() => h.callDeepSeek([], 0.1, Date.now(), {}), (error) =>
    error.extractionStatus === 'output_truncated' && error.extractionDiagnostics.attempts === 2)
  assert.equal(calls, 2, 'retries are bounded')

  calls = 0
  h.mockPost(async () => { calls++; return reply('', 'content_filter') })
  await assert.rejects(() => h.callDeepSeek([], 0.1, Date.now(), {}), /invalid_output/)
  assert.equal(calls, 1)
  console.log('Extraction output verification passed')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
