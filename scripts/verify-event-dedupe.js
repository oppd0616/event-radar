const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const target = path.join(__dirname, '..', 'cloudfunctions', 'getEvents', 'index.js')
const source = fs.readFileSync(target, 'utf8') + `
module.exports.__verify = { suppressCoveredSeriesSummaries, dedupeFeedEvents, mergeEventStages, stageConflictsFromEvents, mergeStageConflicts, focusedStage, projectLifecycleCard }
`
const dateOnly = Date.parse('2026-09-12T00:00:00+08:00')
const exactTime = Date.parse('2026-09-12T13:00:00+08:00')
const records = [
  {
    _id: 'old-date-only',
    title: '2026 LPL夏季赛总决赛暨英雄联盟15周年盛典',
    domain: 'game',
    city: '上海',
    startTime: dateOnly,
    timePrecision: 'date',
    status: 'published',
    confidence: 0.75,
    tags: ['英雄联盟'],
    participation: { type: 'website', url: 'https://www.17173.com/a' },
    participationGuide: {}
  },
  {
    _id: 'enriched-version',
    title: '2026LPL夏季赛总决赛暨英雄联盟15周年盛典',
    domain: 'game',
    city: '上海',
    startTime: exactTime,
    timePrecision: 'datetime',
    status: 'published',
    confidence: 0.82,
    tags: ['LPL'],
    participation: { type: 'offline', url: 'https://www.17173.com/a' },
    participationGuide: { location: '上海浦发银行东方体育中心' }
  },
  {
    _id: 'enriched-title-variant',
    title: '2026 LPL总决赛暨英雄联盟15周年盛典',
    domain: 'game',
    city: '上海',
    startTime: exactTime,
    timePrecision: 'datetime',
    status: 'published',
    confidence: 0.84,
    tags: ['LPL', '英雄联盟'],
    highlights: [
      { type: 'benefit', label: '限定纪念礼', value: '纪念礼' },
      { type: 'product', label: '限定周边', value: '十五周年周边' },
      { type: 'matchup', label: '冠军对决', value: '决赛双方' },
      { type: 'guest', label: '王俊凯表演赛', value: '王俊凯' }
    ],
    participation: { type: 'offline', url: 'https://www.17173.com/a' },
    participationGuide: { location: '上海浦发银行东方体育中心' }
  },
  {
    _id: 'lpl-next-day-session',
    title: '2026LPL总决赛暨英雄联盟15周年盛典',
    domain: 'game',
    city: '上海',
    startTime: Date.parse('2026-09-13T14:00:00+08:00'),
    timePrecision: 'datetime',
    status: 'published',
    confidence: 0.85,
    tags: ['LPL', '英雄联盟'],
    highlights: [{ type: 'guest', label: '王俊凯表演赛', value: '王俊凯' }],
    participation: { type: 'offline', url: 'https://news.17173.com/a' },
    participationGuide: { location: '上海浦发银行东方体育中心' }
  },
  {
    _id: 'valorant-generic',
    title: '2026无畏契约全球冠军赛',
    domain: 'game',
    city: '上海',
    startTime: Date.parse('2026-09-24T00:00:00+08:00'),
    timePrecision: 'date',
    status: 'published',
    confidence: 0.72,
    tags: ['无畏契约'],
    participation: { type: 'website', url: 'https://zh.wikipedia.org/a' },
    participationGuide: {}
  },
  {
    _id: 'valorant-shanghai',
    title: '2026无畏契约上海全球冠军赛',
    domain: 'game',
    city: '上海',
    startTime: Date.parse('2026-09-24T00:00:00+08:00'),
    timePrecision: 'date',
    status: 'published',
    confidence: 0.84,
    tags: ['无畏契约', '电竞'],
    participation: { type: 'offline', url: 'https://valorantesports.com/' },
    participationGuide: { location: '静安体育中心' }
  }
]

function query(data) {
  return {
    where() { return this },
    orderBy(field, order) { this.order = order; return this },
    skip() { return this },
    limit() { return this },
    get() { return Promise.resolve({ data: this.order === 'desc' ? [] : data }) }
  }
}

const database = {
  command: {
    gte(value) { return { and() { return value } } },
    lte(value) { return value }
  },
  collection(name) {
    return name === 'events' ? query(records) : query([])
  }
}
const cloud = {
  DYNAMIC_CURRENT_ENV: 'test',
  init() {},
  database() { return database },
  getWXContext() { return { OPENID: 'test-user' } }
}
const moduleObject = { exports: {} }
// Fixtures describe September 12/13 sessions; keep them upcoming on every test run.
class FixtureDate extends Date {
  static now() { return Date.parse('2026-09-10T12:00:00+08:00') }
}
const sandbox = {
  module: moduleObject,
  exports: moduleObject.exports,
  console,
  URL,
  Date: FixtureDate,
  require(name) {
    if (name === 'wx-server-sdk') return cloud
    if (name === 'opencc-js') return { Converter: () => (value) => value }
    if (name.startsWith('.')) return require(path.resolve(path.dirname(target), name))
    return require(name)
  }
}
vm.runInNewContext(source, sandbox, { filename: target })

const popupSeries = [
  { title: 'LISA×名创优品联名快闪 Pop-Up World Tour 北京上海深圳站', domain: 'culture', startTime: dateOnly, city: '', source: { url: 'https://post.smzdm.com/a' } },
  { title: 'LISA×名创优品联名快闪 Pop-Up World Tour 北京站', domain: 'culture', startTime: dateOnly, city: '北京', source: { url: 'https://post.smzdm.com/b' } },
  { title: 'LISA×名创优品联名快闪 Pop-Up World Tour 上海站', domain: 'culture', startTime: dateOnly, city: '上海', source: { url: 'https://post.smzdm.com/c' } },
  { title: 'LISA×名创优品联名快闪 Pop-Up World Tour 深圳站', domain: 'culture', startTime: dateOnly, city: '深圳', source: { url: 'https://post.smzdm.com/d' } }
]
assert.strictEqual(
  sandbox.module.exports.__verify.dedupeFeedEvents(popupSeries).length,
  4,
  'multi-city summary must not absorb independently actionable city stations'
)
const stationCards = sandbox.module.exports.__verify.suppressCoveredSeriesSummaries(popupSeries)
assert.strictEqual(stationCards.length, 3, 'fully covered multi-city summary should be hidden')
assert.ok(stationCards.every((item) => !/北京上海深圳/.test(item.title)))
assert.strictEqual(
  sandbox.module.exports.__verify.suppressCoveredSeriesSummaries(popupSeries.slice(0, 3)).length,
  3,
  'summary remains when one of its named city stations is still missing'
)

const edcVariants = [
  {
    _id: 'edc-long',
    title: '2026 EDC雏菊电音嘉年华·唤醒之夜（EDC China Circuit Dreams）上海站',
    domain: 'ent', city: '上海', startTime: Date.parse('2026-10-05T00:00:00+08:00'),
    source: { url: 'https://www.shyp.gov.cn/event/1' }, participation: {}, participationGuide: {},
    highlights: [{ type: 'guest', label: '12组国际明星DJ', value: '12组DJ' }]
  },
  {
    _id: 'edc-short',
    title: '2026 EDC雏菊电音嘉年华·唤醒之夜 上海站',
    domain: 'ent', city: '上海', startTime: Date.parse('2026-10-05T00:00:00+08:00'),
    source: { url: 'https://www.shyp.gov.cn/event/2' }, participation: {},
    participationGuide: { location: '上海杨浦复兴岛岛北公共空间' },
    highlights: [{ type: 'first_launch', label: '全新企划首站', value: 'Circuit Dreams' }]
  }
]
const edcCards = sandbox.module.exports.__verify.dedupeFeedEvents(edcVariants)
assert.strictEqual(edcCards.length, 1, 'parenthetical English subtitle must not create a duplicate card')
assert.deepStrictEqual(Array.from(edcCards[0].highlights, (item) => item.type), ['guest', 'first_launch'])

const valorantFinalVariants = [
  {
    _id: 'valorant-final-summary',
    title: '2026无畏契约全球冠军赛 总决赛周末（含表演赛及总决赛）',
    domain: 'game', city: '上海', startTime: Date.parse('2026-10-16T14:00:00+08:00'),
    timePrecision: 'datetime', source: { url: 'https://www.17173.com/a' },
    participation: { type: 'registration', url: 'https://www.damai.cn/event/1', note: '大麦购票' },
    participationGuide: { platform: '大麦', location: '梅赛德斯-奔驰文化中心' }
  },
  {
    _id: 'valorant-final-venue',
    title: '2026无畏契约全球冠军赛 总决赛周末（梅赛德斯-奔驰文化中心）',
    domain: 'game', city: '上海', startTime: Date.parse('2026-10-16T14:00:00+08:00'),
    timePrecision: 'datetime', source: { url: 'https://bbs.hupu.com/a' },
    participation: { type: 'offline', url: 'https://val.qq.com/', note: '现场观赛' },
    participationGuide: { location: '梅赛德斯-奔驰文化中心' }
  },
  {
    _id: 'valorant-live-companion',
    title: '2026无畏契约全球冠军赛 中国大陆线上直播',
    domain: 'game', city: '', startTime: Date.parse('2026-09-24T00:00:00+08:00'),
    timePrecision: 'date', source: { url: 'https://cn.globalgameguide.com/a' },
    participation: { type: 'livestream', url: 'https://live.bilibili.com/123', note: 'B站官方直播间' },
    participationGuide: { platform: '哔哩哔哩直播' }
  }
]
const valorantFinalCards = sandbox.module.exports.__verify.dedupeFeedEvents(valorantFinalVariants)
assert.strictEqual(valorantFinalCards.length, 1, 'venue subtitle and livestream companion should collapse into the final event')
assert.strictEqual(valorantFinalCards[0].startTime, Date.parse('2026-10-16T14:00:00+08:00'), 'offline event time must win over livestream opening time')
assert.ok(!/线上直播/.test(valorantFinalCards[0].title), 'livestream title must not replace the main event title')
assert.ok(Array.from(valorantFinalCards[0].participationOptions).some((item) => item.type === 'livestream'), 'livestream URL must remain available in event detail')

const ticketSourceVariants = [
  {
    _id: 'mastercard-shanghai', title: '2026上海劳力士大师赛大师赛嘉年华',
    domain: 'sports', city: '上海', startTime: Date.parse('2026-10-01T00:00:00+08:00'),
    timePrecision: 'date', sessionKey: '人事体育APP', participation: { type: 'registration', url: 'https://ticket.example/a', note: '久事体育购票' },
    participationGuide: { platform: '久事体育APP' }
  },
  {
    _id: 'mastercard-dirty-city', title: '2026上海劳力士大师赛大师赛嘉年华',
    domain: 'sports', city: '全国', startTime: Date.parse('2026-10-01T00:00:00+08:00'),
    timePrecision: 'date', sessionKey: '久事体育APP微信小程序', participation: { type: 'registration', url: 'https://ticket.example/b', note: '人事体育购票' },
    participationGuide: { platform: '人事体育APP' }
  }
]

const tournamentStageVariants = [
  {
    _id: 'valorant-series-card', title: '2026无畏契约上海全球冠军赛',
    domain: 'game', city: '上海', startTime: Date.parse('2026-09-24T00:00:00+08:00'),
    timePrecision: 'date', participation: {}, participationGuide: {}
  },
  {
    _id: 'valorant-stage-card', title: '2026无畏契约全球冠军赛 小组赛及淘汰赛（静安体育中心）',
    domain: 'game', city: '上海', startTime: Date.parse('2026-09-24T00:00:00+08:00'),
    timePrecision: 'date', participation: {}, participationGuide: { location: '静安体育中心' }
  }
]
assert.strictEqual(
  sandbox.module.exports.__verify.dedupeFeedEvents(tournamentStageVariants).length,
  1,
  'same-day tournament summary and stage/venue card must merge'
)
assert.strictEqual(
  sandbox.module.exports.__verify.dedupeFeedEvents(ticketSourceVariants).length,
  1,
  'identical title and day must merge even when one source contains a dirty city value'
)

const multiStageTournament = sandbox.module.exports.__verify.dedupeFeedEvents([
  {
    _id: 'champions-group', title: '2026无畏契约全球冠军赛 小组赛',
    domain: 'game', city: '上海', startTime: Date.parse('2026-09-24T00:00:00+08:00'),
    timePrecision: 'date', participation: {}, participationGuide: { location: '静安体育中心' }
  },
  {
    _id: 'champions-final', title: '2026无畏契约全球冠军赛 总决赛',
    domain: 'game', city: '上海', startTime: Date.parse('2026-10-16T14:00:00+08:00'),
    timePrecision: 'datetime', participation: {}, participationGuide: { location: '梅赛德斯-奔驰文化中心' }
  }
])
assert.strictEqual(multiStageTournament.length, 1, 'different phases of one tournament should share one feed card')
assert.deepStrictEqual(
  Array.from(multiStageTournament[0].stages, (item) => item.key),
  ['group', 'final'],
  'merged tournament must retain its ordered stage timeline'
)

const kplKnockoutTime = Date.parse('2026-10-26T00:00:00+08:00')
const kplFinalTime = Date.parse('2026-11-14T00:00:00+08:00')
const crossCityTournament = sandbox.module.exports.__verify.dedupeFeedEvents([
  {
    _id: 'kpl-knockout', title: '2026KPL王者荣耀年度总决赛淘汰赛（长沙站）',
    domain: 'game', city: '长沙', startTime: kplKnockoutTime, timePrecision: 'date',
    stageEvidenceVerified: true, participation: {}, participationGuide: { location: '长沙七彩盒子' }
  },
  {
    _id: 'kpl-final', title: '2026KPL王者荣耀年度总决赛（成都站）',
    domain: 'game', city: '成都', startTime: kplFinalTime, timePrecision: 'date',
    stageEvidenceVerified: true, participation: {}, participationGuide: { location: '成都' }
  }
])
assert.strictEqual(crossCityTournament.length, 1, 'different city venues for distinct tournament phases must form one activity')
assert.deepStrictEqual(Array.from(crossCityTournament[0].stages, (item) => item.key), ['knockout', 'final'])
assert.strictEqual(sandbox.module.exports.__verify.dedupeFeedEvents([
  { title: '2026KPL王者荣耀年度', domain: 'game', city: '长沙', startTime: kplKnockoutTime,
    stages: [{ key: 'knockout', name: '淘汰赛', startTime: kplKnockoutTime, evidenceVerified: true }],
    participation: {}, participationGuide: {} },
  { title: '2026KPL王者荣耀年度总决赛（成都站）', domain: 'game', city: '成都',
    startTime: kplFinalTime, stageEvidenceVerified: true, participation: {}, participationGuide: {} }
]).length, 1, 'a neutral parent with a verified round should absorb a later cross-city phase')
assert.strictEqual(sandbox.module.exports.__verify.focusedStage(crossCityTournament[0].stages, Date.parse('2026-10-30T12:00:00+08:00')).stage.key, 'knockout', 'missing phase end must not advance to a future final')
assert.strictEqual(sandbox.module.exports.__verify.projectLifecycleCard(crossCityTournament[0], Date.parse('2026-10-25T12:00:00+08:00')).currentStageKey, 'knockout')
assert.strictEqual(sandbox.module.exports.__verify.projectLifecycleCard(crossCityTournament[0], Date.parse('2026-10-30T12:00:00+08:00')).currentStageKey, 'knockout')
assert.ok(/^2026KPL王者荣耀年度总决赛｜淘汰赛/.test(
  sandbox.module.exports.__verify.projectLifecycleCard(crossCityTournament[0], Date.parse('2026-10-25T12:00:00+08:00')).displayTitle
), 'the shared activity title should keep its official series name but not a stale city station')
const multiDayKnockout = Object.assign({}, crossCityTournament[0], {
  stages: [
    { key: 'knockout', name: '淘汰赛', startTime: kplKnockoutTime,
      endTime: Date.parse('2026-11-01T00:00:00+08:00'), timePrecision: 'date', endTimePrecision: 'date' },
    { key: 'final', name: '总决赛', startTime: kplFinalTime, timePrecision: 'date' }
  ]
})
assert.strictEqual(sandbox.module.exports.__verify.projectLifecycleCard(multiDayKnockout, Date.parse('2026-11-01T18:00:00+08:00')).currentStageKey, 'knockout', 'a date-only phase remains current through its last calendar day')
assert.strictEqual(sandbox.module.exports.__verify.projectLifecycleCard(multiDayKnockout, Date.parse('2026-11-02T12:00:00+08:00')).currentStageKey, 'final')
const approximateKnockout = Object.assign({}, crossCityTournament[0], {
  stages: [
    { key: 'knockout', name: '淘汰赛', startTime: Date.parse('2026-10-01T00:00:00+08:00'),
      endTime: Date.parse('2026-11-30T23:59:59+08:00'), timePrecision: 'month_range', endTimePrecision: 'month_range' },
    { key: 'final', name: '总决赛', startTime: kplFinalTime, timePrecision: 'date' }
  ]
})
assert.ok(/总决赛/.test(sandbox.module.exports.__verify.projectLifecycleCard(approximateKnockout,
  Date.parse('2026-10-30T12:00:00+08:00')).displayTitle), 'a broad month window must not be presented as a precise knockout date')
assert.strictEqual(sandbox.module.exports.__verify.projectLifecycleCard(approximateKnockout,
  Date.parse('2026-11-14T12:00:00+08:00')).currentStageKey, 'final', 'a dated final takes priority over an overlapping approximate round')
assert.strictEqual(sandbox.module.exports.__verify.projectLifecycleCard(approximateKnockout,
  Date.parse('2026-11-15T12:00:00+08:00')).currentStageKey, 'final', 'the approximate earlier round must not reappear after the final')
assert.strictEqual(sandbox.module.exports.__verify.mergeEventStages({
  title: '2026KPL王者荣耀年度总决赛', startTime: kplKnockoutTime,
  stages: [{ key: 'knockout', name: '淘汰赛', startTime: kplKnockoutTime, evidenceVerified: true }]
}, {}).length, 1, 'an explicit schedule must not infer a false final at the parent start date')

const examLifecycle = sandbox.module.exports.__verify.dedupeFeedEvents([
  {
    _id: 'cet-oral', title: '2026年下半年全国大学英语四、六级考试（口试）',
    domain: 'academic', city: '全国', startTime: Date.parse('2026-11-21T00:00:00+08:00'),
    timePrecision: 'date', participation: {}, participationGuide: {}
  },
  {
    _id: 'cet-written', title: '2026年下半年全国大学英语四、六级考试（笔试）',
    domain: 'academic', city: '全国', startTime: Date.parse('2026-12-12T00:00:00+08:00'),
    timePrecision: 'date', participation: {}, participationGuide: {}
  }
])
assert.strictEqual(examLifecycle.length, 1, 'oral and written nodes of one exam cycle should share one feed card')
assert.deepStrictEqual(Array.from(examLifecycle[0].stages, (item) => item.key), ['oral_exam', 'written_exam'])
const conflictedStages = {
  title: '某全球冠军赛', domain: 'game', startTime: Date.parse('2026-09-24T00:00:00+08:00'),
  stages: [
    { key: 'final_weekend', name: '总决赛周末', startTime: Date.parse('2026-09-24T17:00:00+08:00') },
    { key: 'final_weekend', name: '总决赛周末', startTime: Date.parse('2026-10-16T14:00:00+08:00') }
  ]
}
assert.deepStrictEqual(
  Array.from(sandbox.module.exports.__verify.stageConflictsFromEvents(conflictedStages, {})),
  ['final_weekend'],
  'contradictory dates for the same stage must be flagged'
)
assert.equal(
  sandbox.module.exports.__verify.mergeEventStages(conflictedStages, {}).length,
  0,
  'an unresolved stage conflict must not be shown as a guessed schedule'
)
assert.deepStrictEqual(
  Array.from(sandbox.module.exports.__verify.mergeStageConflicts({
    title: '某全球冠军赛', stageConflicts: ['final_weekend'], stages: []
  }, {})),
  ['final_weekend'],
  'a quarantined conflict marker must survive reads until new evidence resolves it'
)
assert.deepStrictEqual(
  Array.from(sandbox.module.exports.__verify.mergeStageConflicts({
    title: '某全球冠军赛', stageConflicts: ['final_weekend'], stages: []
  }, {
    title: '某全球冠军赛 总决赛周末', startTime: Date.parse('2026-10-16T14:00:00+08:00'),
    stageEvidenceVerified: true
  })),
  [],
  'one newly verified milestone date must clear the old conflict marker'
)
const verifiedGroupRange = sandbox.module.exports.__verify.mergeEventStages({
  title: '某全球冠军赛', stages: [
    { key: 'group', name: '小组赛', startTime: Date.parse('2026-09-24T00:00:00+08:00'), evidenceVerified: true },
    { key: 'group', name: '小组赛', startTime: Date.parse('2026-10-04T00:00:00+08:00'), evidenceVerified: true }
  ]
}, {})
assert.strictEqual(verifiedGroupRange.length, 0, 'independent dates must not manufacture a continuous range')
const independentSemifinals = sandbox.module.exports.__verify.mergeEventStages({
  title: '某全球冠军赛', stages: [
    { key: 'semifinal', name: '半决赛', sessionKey: '半决赛第一场', startTime: Date.parse('2026-10-10T18:00:00+08:00'), evidenceVerified: true },
    { key: 'semifinal', name: '半决赛', sessionKey: '半决赛第二场', startTime: Date.parse('2026-10-11T18:00:00+08:00'), evidenceVerified: true }
  ]
}, {})
assert.strictEqual(independentSemifinals.length, 2, 'independently named stage sessions must remain separate')
assert.deepStrictEqual(
  Array.from(sandbox.module.exports.__verify.stageConflictsFromEvents({ title: '某全球冠军赛', stages: independentSemifinals }, {})),
  [],
  'independently named sessions on different days are not a timeline conflict'
)
assert.strictEqual(sandbox.module.exports.__verify.dedupeFeedEvents([
  { title: '同名演出', domain: 'ent', city: '上海', startTime: Date.parse('2026-10-01T14:00:00+08:00'), timePrecision: 'datetime', sessionKey: '下午场', participation: {}, participationGuide: {} },
  { title: '同名演出', domain: 'ent', city: '上海', startTime: Date.parse('2026-10-01T19:00:00+08:00'), timePrecision: 'datetime', sessionKey: '晚场', participation: {}, participationGuide: {} }
]).length, 2, 'same-title sessions with different exact start times must remain separate')

sandbox.module.exports.main({ domain: 'all', pageSize: 20, sortMode: 'time' }).then((result) => {
  assert.strictEqual(result.list.length, 3, 'same-day duplicates collapse while different-day sessions remain')
  const lplSessions = result.list.filter((item) => /LPL/i.test(item.title))
  const lpl = lplSessions.find((item) => item._id === 'enriched-title-variant')
  const lplNextDay = lplSessions.find((item) => item._id === 'lpl-next-day-session')
  const valorant = result.list.find((item) => /无畏契约/.test(item.title))
  assert.strictEqual(lpl._id, 'enriched-title-variant', 'the LPL variant with concrete highlights should win')
  assert.deepStrictEqual(Array.from(lpl.tags).sort(), ['LPL', '英雄联盟'].sort())
  assert.strictEqual(lpl.highlights.length, 3, 'only the three most important highlights should be returned')
  assert.strictEqual(lpl.highlights[0].value, '王俊凯')
  assert.ok(/9月12日场/.test(lpl.displayTitle), 'the September 12 session should have a distinct title')
  assert.ok(/9月13日场/.test(lplNextDay.displayTitle), 'the September 13 session should have a distinct title')
  assert.strictEqual(valorant._id, 'valorant-shanghai', 'the more complete geographic title should win')
  assert.deepStrictEqual(Array.from(valorant.tags).sort(), ['无畏契约', '电竞'].sort())
  console.log('event dedupe verification passed')
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
