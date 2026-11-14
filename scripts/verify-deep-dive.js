const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const target = path.join(__dirname, '..', 'cloudfunctions', 'fetchEvents', 'index.js')
const source = fs.readFileSync(target, 'utf8') + `
module.exports.__verify = {
  normalizeExtractedStages,
  mergeDiscoveredEvent,
  buildSearchPlan,
  selectDemandTarget,
  competitionEvidenceMatches,
  filterCompetitionSearchItems,
  filterGlobalRiskSearchItems,
  unwrapEventArray,
  hasDateEvidence,
  extractKnownExamSchedule,
  isLowTrustAggregatorUrl,
  topHighlights,
  hasClockEvidence,
  mergeParticipation,
  mergeHighlights
  ,discoverySourceType
  ,isCurrentDetailQueue
  ,timerInvocationAllowed
  ,candidateWindowHasEnded
  ,eventIdentityUpdateFields
  ,candidateWorkPriority
  ,sortCandidateWork
  ,structuredTextFromHtml
  ,filterAndRankNamedTargetItems
  ,pageDetailScore
  ,isDetailRichSearchItem
  ,officialDetailQuery
  ,officialDetailQueries
  ,requiredDetailEvidenceCount
  ,uniqueSearchItems
  ,compactNamedTargetEvidence
  ,dedupeEvidenceItems
  ,evidencePhaseFamilies
  ,expectedPhaseFamilies
  ,detailCoverageFor
  ,DETAIL_ENRICHMENT_VERSION
  ,missingDetailReasons
  ,mergeParticipationGuide
  ,factualSummaryForEvent
  ,wsaCandidateQueries
}
`

const cloudMock = {
  DYNAMIC_CURRENT_ENV: 'test',
  init() {},
  database() {
    return {
      command: {},
      collection() { throw new Error('database access is not expected in this verification') }
    }
  },
  getWXContext() { return {} }
}

const sandboxModule = { exports: {} }
const sandbox = {
  module: sandboxModule,
  exports: sandboxModule.exports,
  require(name) {
    if (name === 'wx-server-sdk') return cloudMock
    if (name === 'opencc-js') return { Converter: () => (value) => String(value == null ? '' : value) }
    if (name === './lib/detail-script') return { detailSearchText: (value) => String(value || '') }
    if (name === './event-time-policy') return require('../cloudfunctions/getEvents/event-time-policy')
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
const helpers = sandboxModule.exports.__verify
{
  const sources = [
    { title: '2026KPL年度总决赛规划', link: 'https://news.qq.com/rain/a/old.html', description: '2026KPL年度总决赛淘汰赛10至11月举办。' },
    { title: '2026年KPL年度总决赛赛程与奖金公布', link: 'https://news.qq.com/rain/a/new.html', description: '2026KPL年度总决赛。淘汰赛：10月27日-11月8日。' }
  ]
  const raw = { phaseKey: 'knockout', sourceLabel: '淘汰赛', startTime: '2026-10-27T00:00:00+08:00', endTime: '2026-11-08T00:00:00+08:00', evidenceIndex: 0 }
  const checked = helpers.normalizeExtractedStages([raw], sources, '2026KPL王者荣耀年度总决赛', 'game', Date.parse('2026-09-29'))
  assert.equal(checked.length, 1, 'wrong model citation index must be repaired from same-edition stage evidence')
  assert.equal(checked[0].evidenceIndex, 1)
  assert.equal(checked[0].endTime, Date.parse(raw.endTime))
  assert.equal(helpers.normalizeExtractedStages([raw], [sources[0]], '2026KPL王者荣耀年度总决赛', 'game', Date.parse('2026-09-29')).length, 0)
  assert.equal(helpers.normalizeExtractedStages([raw], [{ ...sources[1], title: '2025年KPL年度总决赛赛程' }], '2026KPL王者荣耀年度总决赛', 'game', Date.parse('2026-09-29')).length, 0)
  const stages = [
    { key: 'group', name: '擂台赛', startTime: Date.parse('2026-10-02T00:00:00+08:00'), timePrecision: 'date', evidenceVerified: true },
    ...checked
  ]
  const merged = helpers.mergeDiscoveredEvent(
    { title: '2026KPL王者荣耀年度总决赛', startTime: Date.parse('2026-10-01T00:00:00+08:00'), stages },
    { title: '2026年KPL王者荣耀年度总决赛', startTime: stages[0].startTime, stages })
  assert.equal(merged.startTime, stages[0].startTime, 'the optional 年 after an edition year must not prevent boundary recalculation')
}
const now = Date.parse('2026-09-08T00:00:00+08:00')

const detailModes = require('../cloudfunctions/fetchEvents/lib/detail-modes')
const officialSources = require('../cloudfunctions/fetchEvents/config/official-sources')
assert.deepStrictEqual(detailModes.expectedStageKeys([{
  description: '擂台赛10月2日开始，突围赛10月20日，淘汰赛10月27日，总决赛11月14日'
}]), ['group', 'qualifier', 'knockout', 'final'])
assert.ok(detailModes.missingFields([{
  stages: [{ key: 'knockout' }, { key: 'final' }], participationGuide: {}, participation: { url: 'https://example.com' }
}], ['multi_stage'], [], [{ description: '擂台赛、突围赛、淘汰赛和总决赛' }]).includes('stage_coverage'))
assert.ok(detailModes.missingFields([{
  stages: [
    { key: 'group', timePrecision: 'date' },
    { key: 'qualifier', timePrecision: 'date' },
    { key: 'knockout', timePrecision: 'month_range' },
    { key: 'final', timePrecision: 'date' }
  ], participationGuide: {}, participation: { url: 'https://example.com' }
}], ['multi_stage'], [], [{
  description: '擂台赛10月2日开始；突围赛10月20日；淘汰赛10月27日；总决赛11月14日'
}]).includes('stage_precision'))
assert.ok(officialSources.officialHostsFor('auto', '', '2026世界新能源汽车大会').includes('wnevc.org.cn'))
assert.ok(officialSources.officialHostsFor('culture', '', 'UCCA尤伦斯当代艺术中心个展').includes('ucca.org.cn'))

const authorityMerged = helpers.mergeParticipationGuide({
  location: '错误场馆', locationSource: { authority: 100 }
}, {
  location: '第三方场馆', locationSource: { authority: 50 }, price: '388元'
})
assert.strictEqual(authorityMerged.location, '错误场馆', 'lower-authority detail must not overwrite official field')
assert.strictEqual(authorityMerged.price, '388元')
assert.ok(helpers.factualSummaryForEvent({
  title: '测试赛事', city: '上海', stages: [
    { name: '小组赛', startTime: Date.parse('2026-09-24T00:00:00+08:00'), venue: '静安体育中心' },
    { name: '总决赛', startTime: Date.parse('2026-10-18T00:00:00+08:00'), venue: '梅赛德斯-奔驰文化中心' }
  ]
}).includes('小组赛、总决赛'))

const relevantNamedResults = helpers.filterAndRankNamedTargetItems([
  { title: '无畏契约改变者全球冠军赛', description: '' },
  { title: '2024无畏契约全球冠军赛主题活动', description: '' },
  { title: '无畏契约圣地亚哥大师赛活动', description: '' },
  { title: '2026无畏契约全球冠军赛', description: '官方赛程' },
  { title: '赛事手册', description: '2026无畏契约全球冠军赛完整日程' }
], '无畏契约全球冠军赛', now)
assert.deepStrictEqual(Array.from(relevantNamedResults, (item) => item.title), [
  '2026无畏契约全球冠军赛',
  '赛事手册'
])
const crossLanguageResults = helpers.filterAndRankNamedTargetItems([
  { title: 'Champions Shanghai: Finals Weekend Live Audience and Ticket Sale Information', description: 'VALORANT Champions 2026 in Shanghai' },
  { title: 'VALORANT Masters Santiago Tickets', description: 'VCT 2026' }
], '无畏契约全球冠军赛', now, ['VALORANT Champions'])
assert.deepStrictEqual(Array.from(crossLanguageResults, (item) => item.title), [
  'Champions Shanghai: Finals Weekend Live Audience and Ticket Sale Information'
])
const announcementOnly = {
  title: 'VALORANT Esports | Champions 2026 is Coming to Shanghai!',
  description: 'VALORANT Champions 2026 is heading to Shanghai'
}
const officialTicketDetail = {
  title: 'Champions Shanghai: Finals Weekend Live Audience and Ticket Sale Information',
  description: 'General sale Sep 16 11:00. Finals Oct 16-18 at Mercedes-Benz Arena. Tickets from ¥388.'
}
assert.ok(helpers.pageDetailScore(announcementOnly, 'game') < 40)
assert.ok(helpers.isDetailRichSearchItem(officialTicketDetail, 'game'))
assert.ok(helpers.officialDetailQuery({
  namedTarget: '无畏契约全球冠军赛',
  officialSearchAliases: ['VALORANT Champions']
}, 'game').includes('playoffs'))
const phaseQueries = helpers.officialDetailQueries({
  namedTarget: '无畏契约全球冠军赛',
  officialSearchAliases: ['VALORANT Champions']
}, 'game')
assert.strictEqual(phaseQueries.length, 2)
assert.ok(phaseQueries[0].includes('groups'))
assert.ok(phaseQueries[1].includes('finals weekend'))
assert.strictEqual(helpers.requiredDetailEvidenceCount({ namedTarget: '无畏契约全球冠军赛' }, 'game'), 2)
const localizedOfficialPages = helpers.uniqueSearchItems([
  { title: '日本語', link: 'https://valorantesports.com/ja-JP/news/champions-ticket-info' },
  { title: 'English', link: 'https://valorantesports.com/en-US/news/champions-ticket-info' }
])
assert.strictEqual(localizedOfficialPages.length, 1)
assert.strictEqual(localizedOfficialPages[0].title, 'English')
const compactEvidence = helpers.compactNamedTargetEvidence([
  officialTicketDetail,
  { title: 'Groups and Early Playoffs Ticket Sale Information', description: 'Sep 24 17:00, schedule and tickets at Jing’an Sports Center venue' },
  announcementOnly
], 'game')
assert.strictEqual(compactEvidence.length, 2)
assert.ok(!compactEvidence.some((item) => /Coming to Shanghai/.test(item.title)))
const duplicatedEarlyEvidence = [
  {
    title: 'Champions Shanghai: Live Audience and Ticket Sale Information for ...',
    link: 'https://valorantesports.com/en-AU/news/champions-groups?ref=search',
    description: 'VALORANT Champions 2026 group stage Sep 24 17:00, early playoffs schedule, tickets and venue'
  },
  {
    title: 'VALORANT Esports | Champions Shanghai: Live Audience and Ticket Sale Information for Groups and Early Playoffs!',
    link: 'https://valorantesports.com/en-US/news/champions-groups',
    description: 'VALORANT Champions 2026 group stage Sep 24 17:00, early playoffs schedule, tickets and venue'
  }
]
assert.strictEqual(helpers.dedupeEvidenceItems(duplicatedEarlyEvidence).length, 1)
const tournamentPlan = { namedTarget: '无畏契约全球冠军赛' }
const incompleteCoverage = helpers.detailCoverageFor(duplicatedEarlyEvidence, tournamentPlan, 'game')
assert.strictEqual(incompleteCoverage.complete, false)
assert.deepStrictEqual(Array.from(incompleteCoverage.coveredPhases), ['early'])
assert.deepStrictEqual(Array.from(incompleteCoverage.missingPhases), ['final'])
const completeCoverage = helpers.detailCoverageFor(duplicatedEarlyEvidence.concat(officialTicketDetail), tournamentPlan, 'game')
assert.strictEqual(completeCoverage.complete, true)
assert.deepStrictEqual(Array.from(helpers.expectedPhaseFamilies({ namedTarget: 'LPL夏季赛总决赛' }, 'game')), ['final'])

const selectedHighlights = helpers.topHighlights([
  { type: 'benefit', label: '免费入场' },
  { type: 'product', label: '限定甜品' },
  { type: 'matchup', label: 'BLG对阵TES' },
  { type: 'guest', label: '王俊凯表演赛' }
])
assert.strictEqual(selectedHighlights.length, 3)
assert.deepStrictEqual(Array.from(selectedHighlights, (item) => item.type), ['guest', 'matchup', 'product'])
assert.ok(helpers.isCurrentDetailQueue({ kind: 'detail_enrichment', status: 'waiting', enrichmentVersion: helpers.DETAIL_ENRICHMENT_VERSION, targetEventId: 'event-1' }, { _id: 'event-1' }))
assert.ok(helpers.isCurrentDetailQueue({ kind: 'detail_enrichment', status: 'ready_to_extract', enrichmentVersion: helpers.DETAIL_ENRICHMENT_VERSION }, { _id: 'event-1' }))
assert.ok(!helpers.isCurrentDetailQueue({ kind: 'detail_enrichment', status: 'published', enrichmentVersion: helpers.DETAIL_ENRICHMENT_VERSION - 1 }, { _id: 'event-1' }))
assert.ok(!helpers.isCurrentDetailQueue({ kind: 'detail_enrichment', status: 'waiting', enrichmentVersion: helpers.DETAIL_ENRICHMENT_VERSION - 1 }, { _id: 'event-1' }))
assert.ok(helpers.timerInvocationAllowed(23, 0))
assert.ok(helpers.timerInvocationAllowed(23, 20))
assert.ok(helpers.timerInvocationAllowed(3, 40))
assert.ok(helpers.timerInvocationAllowed(8, 0))
assert.ok(helpers.timerInvocationAllowed(8, 20))
assert.ok(helpers.timerInvocationAllowed(0, 40))
assert.ok(!helpers.timerInvocationAllowed(8, 10))
assert.ok(helpers.candidateWindowHasEnded({ suggestedStartTime: '2026-09-01T00:00:00.000Z' }, [], now))
assert.ok(!helpers.candidateWindowHasEnded({ suggestedStartTime: '2026-10-01T00:00:00.000Z' }, [], now))
assert.deepStrictEqual(
  Object.assign({}, helpers.eventIdentityUpdateFields('new-hash', 'existing-event-id')),
  {},
  'detail enrichment must never rewrite a unique event identity'
)
assert.deepStrictEqual(
  Object.assign({}, helpers.eventIdentityUpdateFields('new-hash', '')),
  { hash: 'new-hash', canonicalKey: 'new-hash' }
)
const prioritizedCandidates = helpers.sortCandidateWork([
  { title: '普通精确时间补全', kind: 'detail_enrichment', missingDetails: ['exact_event_time'], nextCheckAt: 1 },
  { title: '赛程冲突补全', kind: 'detail_enrichment', missingDetails: ['timeline_conflict'], nextCheckAt: 2 },
  { title: '普通来源复查', kind: 'source_verification', missingDetails: [], nextCheckAt: 0 }
])
assert.strictEqual(prioritizedCandidates[0].title, '赛程冲突补全')
assert.ok(helpers.candidateWorkPriority(prioritizedCandidates[0]) > helpers.candidateWorkPriority(prioritizedCandidates[1]))
const offlineSession = {
  title: '上海线下演唱会', domain: 'ent', city: '上海',
  startTime: Date.parse('2026-10-12T19:00:00+08:00'), timePrecision: 'date',
  participation: { type: 'registration', url: 'https://example.com/tickets', note: '网上购票' },
  participationGuide: { accessStartTime: Date.parse('2026-09-12T10:00:00+08:00') }
}
assert(!helpers.missingDetailReasons(offlineSession).includes('exact_event_time'))
assert(helpers.missingDetailReasons(Object.assign({}, offlineSession,
  { participationOptions: [{ type: 'livestream' }] })).includes('exact_event_time'))
assert(helpers.missingDetailReasons(Object.assign({}, offlineSession,
  { timePrecision: 'month_range' })).includes('event_date'))
const structuredPageText = helpers.structuredTextFromHtml(`
  <script type="application/ld+json">{"@type":"SportsEvent","startDate":"2026-10-18T18:00:00+08:00"}</script>
  <table><tr><th>阶段</th><th>日期</th></tr><tr><td>冠军战</td><td>10月18日 18:00</td></tr></table>
`)
assert.ok(structuredPageText.includes('STRUCTURED_DATA'))
assert.ok(structuredPageText.includes('TABLE_ROW 冠军战 | 10月18日 18:00'))

const preservedParticipation = helpers.mergeParticipation(
  { type: 'registration', url: 'https://www.damai.cn/event', note: '大麦购票' },
  { type: 'website', url: 'https://example.com/summary', note: '查看介绍' }
)
assert.strictEqual(preservedParticipation.url, 'https://www.damai.cn/event')
const mergedHighlights = helpers.mergeHighlights(
  [{ type: 'guest', label: '王俊凯表演赛', value: '王俊凯' }],
  [{ type: 'matchup', label: 'BLG对阵TES', value: 'BLG、TES' }]
)
assert.deepStrictEqual(Array.from(mergedHighlights, (item) => item.type), ['guest', 'matchup'])
assert.strictEqual(helpers.discoverySourceType('华为全联接大会'), 'critical')
assert.strictEqual(helpers.discoverySourceType('全国大学英语四、六级考试'), 'critical')
assert.strictEqual(helpers.discoverySourceType('周杰伦'), 'seed')

const afternoonStart = Date.parse('2026-09-12T14:00:00+08:00')
const eveningStart = Date.parse('2026-09-12T19:30:00+08:00')
assert.ok(helpers.hasDateEvidence(afternoonStart, { title: '２０２６年９月１２日总决赛', description: '' }, '2026-09-12T14:00:00+08:00'))
assert.ok(helpers.hasDateEvidence(afternoonStart, { title: '2026年九月十二日总决赛', description: '' }, '2026-09-12T14:00:00+08:00'))
assert.ok(helpers.hasClockEvidence(afternoonStart, { title: '', description: '总决赛将于下午2点开赛' }, 'event_start'))
assert.ok(helpers.hasClockEvidence(afternoonStart, { title: '', description: '总决赛将于下午两点开赛' }, 'event_start'))
assert.ok(helpers.hasClockEvidence(afternoonStart, { title: '', description: '活动时间为14：00—18：00' }, 'event_start'))
assert.ok(helpers.hasClockEvidence(eveningStart, { title: '', description: '嘉宾表演晚上七点半开始' }, 'event_start'))
assert.ok(!helpers.hasClockEvidence(afternoonStart, { title: '', description: '下午2点正式开票' }, 'event_start'))
assert.ok(helpers.hasClockEvidence(afternoonStart, { title: '', description: '下午2点正式开票' }, 'access_start'))
const ticketStart = Date.parse('2026-09-10T10:00:00+08:00')
const matchStart = Date.parse('2026-09-12T18:00:00+08:00')
const separatedRoles = { title: '', description: '9月10日上午10点开票，9月12日晚6点开赛' }
assert.ok(helpers.hasClockEvidence(ticketStart, separatedRoles, 'access_start'))
assert.ok(!helpers.hasClockEvidence(ticketStart, separatedRoles, 'event_start'))
assert.ok(helpers.hasClockEvidence(matchStart, separatedRoles, 'event_start'))
assert.ok(!helpers.hasClockEvidence(matchStart, separatedRoles, 'access_start'))

const deepPlan = helpers.buildSearchPlan(
  'game',
  now,
  'lol',
  '',
  { lol: 7 },
  false,
  false,
  'web'
)
assert.strictEqual(deepPlan.demandDepth, 2)
assert.ok(deepPlan.query.includes('LPL'))
assert.ok(deepPlan.query.includes('季后赛'))
assert.ok(deepPlan.query.includes('兴趣深挖第2层'))
assert.ok(deepPlan.namedTarget)
assert.ok(deepPlan.query.includes(deepPlan.namedTarget))

const allDomainTopics = {
  tech: 'ai',
  auto: 'new_energy',
  finance: 'fintech',
  ent: 'stadium_concert',
  culture: 'art_exhibition',
  game: 'lol',
  sports: 'running',
  anime: 'anime_expo',
  academic: 'math_modeling'
}
Object.keys(allDomainTopics).forEach((domain) => {
  const topicKey = allDomainTopics[domain]
  const plan = helpers.buildSearchPlan(
    domain,
    now,
    topicKey,
    '',
    { [topicKey]: 7 },
    false,
    false,
    'web'
  )
  assert.strictEqual(plan.demandDepth, 2, domain + ' should reach depth 2')
  assert.ok(plan.query.includes('兴趣深挖第2层'), domain + ' should include deepening guidance')
})

const majorPlan = helpers.buildSearchPlan('game', now, '', '', {}, true, false, 'web')
assert.strictEqual(majorPlan.selectedTopic.key, 'major')
assert.ok(/英雄联盟|王者荣耀|无畏契约/.test(majorPlan.query))

const targetTopic = helpers.selectDemandTarget({
  game: {
    lol: { score: 8, lastSearchedAt: now - 2 * 3600000 },
    valorant: { score: 4, lastSearchedAt: now - 24 * 3600000 }
  }
}, now)
assert.strictEqual(targetTopic.topicKey, 'valorant')

const signalTarget = path.join(__dirname, '..', 'cloudfunctions', 'recordSignal', 'index.js')
const signalSource = fs.readFileSync(signalTarget, 'utf8') + `
module.exports.__verify = { topicKeysOf }
`
const signalModule = { exports: {} }
vm.runInNewContext(signalSource, Object.assign({}, sandbox, {
  module: signalModule,
  exports: signalModule.exports,
  require(name) {
    if (name.startsWith('.')) return require(path.resolve(path.dirname(signalTarget), name))
    return sandbox.require(name)
  },
  __dirname: path.dirname(signalTarget),
  __filename: signalTarget
}), { filename: signalTarget })
const signalHelpers = signalModule.exports.__verify
assert.ok(signalHelpers.topicKeysOf({
  domain: 'game',
  title: '2026 LPL总决赛暨英雄联盟周年盛典',
  tags: ['电竞']
}).includes('lol'))
assert.ok(signalHelpers.topicKeysOf({
  domain: 'academic',
  title: '全国大学生数学建模竞赛报名通知'
}).includes('math_modeling'))
assert.ok(signalHelpers.topicKeysOf({
  domain: 'academic',
  title: '全国大学生软件工程与数据科学创新竞赛'
}).includes('computer_data'))
assert.ok(signalHelpers.topicKeysOf({
  domain: 'ent',
  title: '上海国际电影节主创路演'
}).includes('film_festival'))
assert.ok(signalHelpers.topicKeysOf({
  domain: 'ent',
  title: '音乐剧新一轮巡演正式开票'
}).includes('theatre'))
assert.ok(signalHelpers.topicKeysOf({
  domain: 'academic',
  title: '2026年下半年全国大学英语四六级考试报名通知'
}).includes('language_exam'))
assert.ok(signalHelpers.topicKeysOf({
  domain: 'academic',
  title: '秋季校园招聘双选会开放报名'
}).includes('campus_recruitment'))

const academicPlan = helpers.buildSearchPlan(
  'academic',
  now,
  'medicine_life',
  '',
  { medicine_life: 8 },
  false,
  false,
  'web'
)
assert.strictEqual(academicPlan.demandDepth, 2)
assert.ok(/医学|生命科学|生物医药/.test(academicPlan.query))
assert.ok(academicPlan.query.includes('区分保研与求职价值'))
assert.ok(academicPlan.query.includes('2026-2027学年'))
assert.ok(academicPlan.query.includes('2027届官方通知'))
assert.strictEqual(helpers.competitionEvidenceMatches(
  '全国大学生计算机系统能力大赛',
  ['NSCSCC 2026', '2026年全国大学生计算机系统能力大赛 CPU设计赛（龙芯杯）']
), true)
assert.strictEqual(helpers.competitionEvidenceMatches(
  '全国大学生计算机系统能力大赛',
  ['全国大学生信息安全竞赛官方网站']
), false)
assert.strictEqual(helpers.filterCompetitionSearchItems([
  { title: '全国大学生信息安全竞赛', description: '报名通知' },
  { title: '北京科技大学教务处', description: '全国大学生计算机系统能力大赛报名通知' }
], '全国大学生计算机系统能力大赛').length, 1)
assert.strictEqual(helpers.filterCompetitionSearchItems([
  {
    title: '2026年第八届全国高校计算机能力挑战赛官网',
    description: '相关竞赛包括全国大学生计算机系统能力大赛'
  }
], '全国大学生计算机系统能力大赛').length, 0)
assert.strictEqual(helpers.filterGlobalRiskSearchItems([
  { title: '官方马拉松报名通知', description: '赛事报名开始' },
  { title: '赛事赔率竞猜', description: '投注平台' },
  { title: '明星应援集资活动', description: '粉丝打投' }
]).length, 1)
assert.strictEqual(helpers.unwrapEventArray({ events: [{ title: '测试活动' }] }).length, 1)
assert.strictEqual(helpers.unwrapEventArray({ results: [] }).length, 0)
assert.strictEqual(helpers.hasDateEvidence(
  Date.parse('2026-12-12T09:00:00+08:00'),
  { title: '2026年下半年四六级考试报名通知', description: '笔试时间为12月12日9:00' },
  '2026-12-12T09:00:00+08:00'
), true)
const cetEvents = helpers.extractKnownExamSchedule([{
  title: '长江大学2026年下半年全国大学英语四、六级考试报名通知',
  description: '口试和笔试将分别于11月21日至22日和12月12日举行。一、报名时间 9月14日 10:00至9月23日 17:00。',
  link: 'https://bks.yangtzeu.edu.cn/example.htm',
  sourceName: '长江大学'
}], '全国大学英语四、六级考试', now)
assert.strictEqual(cetEvents.length, 2)
assert.ok(cetEvents[0].title.includes('下半年'))
assert.ok(cetEvents[0].title.includes('口试'))
assert.ok(cetEvents[1].title.includes('笔试'))
assert.strictEqual(cetEvents[0].participationGuide.accessStartTime, '')
assert.strictEqual(helpers.isLowTrustAggregatorUrl('https://www.7724.com/news/1'), true)
assert.strictEqual(helpers.isLowTrustAggregatorUrl('https://www.gov.cn/event/1'), false)
assert.strictEqual(helpers.hasDateEvidence(
  Date.parse('2026-11-21T00:00:00+08:00'),
  {
    title: '长江大学2026年下半年全国大学英语四、六级考试报名通知',
    description: '口试于11月21至22日举行，报名资格另参考2025年成绩记录'
  },
  '2026-11-21T00:00:00+08:00'
), true)
assert.strictEqual(helpers.hasDateEvidence(
  Date.parse('2026-12-12T09:00:00+08:00'),
  { title: '2025年下半年四六级考试通知', description: '考试时间为12月12日9:00' },
  '2026-12-12T09:00:00+08:00'
), false)
assert.strictEqual(helpers.hasDateEvidence(
  Date.parse('2026-11-21T00:00:00+08:00'),
  { title: '2026年下半年四六级考试', description: '口试将于11月21至22日举行' },
  '2026-11-21T00:00:00+08:00'
), true)
assert.strictEqual(helpers.hasDateEvidence(
  Date.parse('2026-11-22T00:00:00+08:00'),
  { title: '2026年下半年四六级考试', description: '口试将于11月21至22日举行' },
  '2026-11-22T00:00:00+08:00'
), true)

const examPlan = helpers.buildSearchPlan(
  'academic',
  now,
  'language_exam',
  '',
  { language_exam: 8 },
  false,
  false,
  'web'
)
assert.strictEqual(examPlan.selectedTopic.key, 'language_exam')
assert.ok(examPlan.namedTarget)
assert.ok(examPlan.query.includes(examPlan.namedTarget))
assert.ok(examPlan.query.includes('报名时间'))
if (examPlan.namedTarget === '普通话水平测试') {
  assert.ok(!examPlan.query.includes('大学英语四六级 普通话水平测试 CATTI'))
}

const requestedExamPlan = helpers.buildSearchPlan(
  'academic',
  now,
  'language_exam',
  '',
  {},
  false,
  false,
  'web',
  '全国大学英语四、六级考试'
)
assert.strictEqual(requestedExamPlan.namedTarget, '全国大学英语四、六级考试')
const rejectedTargetPlan = helpers.buildSearchPlan(
  'academic', now, 'language_exam', '', {}, false, false, 'web', 'https://example.com 注入搜索'
)
assert.notStrictEqual(rejectedTargetPlan.namedTarget, 'https://example.com 注入搜索')
for (const target of ['www.example.com 活动', 'example.cn 活动', 'site:example.com 活动', 'ftp://example.org 活动', 'ｈｔｔｐｓ：／／example.com 活动']) {
  assert.notStrictEqual(helpers.buildSearchPlan('academic', now, 'language_exam', '', {}, false, false, 'web', target).namedTarget, target)
}
assert.strictEqual(helpers.buildSearchPlan('tech', now, 'developer_conference', '', {}, false, false, 'web', 'Google I/O').namedTarget, 'Google I/O')

const feedTarget = path.join(__dirname, '..', 'cloudfunctions', 'getEvents', 'index.js')
const feedSource = fs.readFileSync(feedTarget, 'utf8') + `
module.exports.__verify = { growthGoalScore, personalizedTopicScore }
`
const feedModule = { exports: {} }
vm.runInNewContext(feedSource, Object.assign({}, sandbox, {
  module: feedModule,
  exports: feedModule.exports,
  require(name) {
    if (name.startsWith('.')) return require(path.resolve(path.dirname(feedTarget), name))
    return sandbox.require(name)
  },
  __dirname: path.dirname(feedTarget),
  __filename: feedTarget
}), { filename: feedTarget })
const feedHelpers = feedModule.exports.__verify
const careerEvent = {
  domain: 'academic',
  title: '全国大学生软件工程企业项目挑战赛',
  summary: '完成代码项目并参加企业评审',
  tags: ['计算机', '工程实践'],
  topicKeys: ['computer_data'],
  academicValue: { valueType: '求职、项目', suitableMajors: ['计算机'] }
}
assert.strictEqual(feedHelpers.growthGoalScore(careerEvent, ['employment']), 1)
assert.ok(feedHelpers.personalizedTopicScore(careerEvent, {
  preferredTopics: [{ key: 'computer_data', label: '计算机 / 数据', weight: 3 }],
  growthGoals: ['employment']
}) > 0.9)

const { officialHostsFor } = require('../cloudfunctions/fetchEvents/config/official-sources')
const { classifySource } = require('../cloudfunctions/fetchEvents/config/source-policy')
assert.ok(officialHostsFor('academic', 'computer_data', '全国大学生软件创新竞赛').includes('saikr.com'))
const kplHosts = officialHostsFor('game', 'honor_of_kings', '2026KPL王者荣耀年度总决赛')
assert.strictEqual(kplHosts[0], 'pvp.qq.com')
assert.ok(kplHosts.includes('wanplus.cn'))
assert.ok(!kplHosts.includes('esports.qq.com'))
assert.deepStrictEqual(
  classifySource('https://www.saikr.com/vse/example', 'academic'),
  { tier: 'vertical', authority: 68 }
)
assert.deepStrictEqual(
  classifySource('https://cc.moocollege.com/competition/example', 'academic'),
  { tier: 'vertical', authority: 74 }
)
assert.deepStrictEqual(
  classifySource('https://www.52jingsai.com/article/example', 'academic'),
  { tier: 'vertical', authority: 60 }
)
assert.deepStrictEqual(
  classifySource('https://www.vart.cc/exhibition/example', 'culture'),
  { tier: 'vertical', authority: 66 }
)
assert.deepStrictEqual(
  classifySource('https://www.bagevent.com/event/example', 'finance'),
  { tier: 'vertical', authority: 68 }
)
assert.strictEqual(officialHostsFor('academic', 'computer_data', '普通大学生软件竞赛')[0], 'saikr.com')
assert.ok(officialHostsFor('academic', 'computer_data', '普通大学生软件竞赛').includes('cc.moocollege.com'))
assert.ok(officialHostsFor('sports', 'running', '城市路跑挑战赛').includes('51sai.com'))

console.log('deep-dive verification passed')
