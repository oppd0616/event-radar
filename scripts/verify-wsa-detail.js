const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const target = path.resolve(__dirname, '../cloudfunctions/fetchEvents/index.js')
const moduleMock = { exports: {} }
vm.runInNewContext(fs.readFileSync(target, 'utf8') + '\nmodule.exports.testQueries = wsaCandidateQueries; module.exports.score = namedTargetResultScore; module.exports.support = findDateSupportingEvidence; module.exports.date = hasDateEvidence; module.exports.normalize = normalizeEvent; module.exports.detailMismatch = detailEventMismatch; module.exports.accessDeadline = hasAccessDeadlineEvidence; module.exports.stageEvidence = hasLinkedStageDateEvidence; module.exports.submissionWindow = verifiedSubmissionWindow', {
  module: moduleMock, exports: moduleMock.exports, Buffer, URL, console, process, setTimeout, clearTimeout,
  require(name) {
    if (name === 'wx-server-sdk') return { init() {}, database() { return { command: {} } } }
    if (name === 'opencc-js') return { Converter: () => (text) => String(text || '') }
    if (name === './lib/detail-script') return { detailSearchText: (value) => String(value || '').replace(/[屆國際創賽線]/g, (char) => ({屆:'届',國:'国',際:'际',創:'创',賽:'赛',線:'线'})[char]) }
    return require(name.startsWith('.') ? path.resolve(path.dirname(target), name) : name)
  }
})
const queries = moduleMock.exports.testQueries({title:'LISA×名创优品联名快闪 Pop-Up World Tour 北京站', city:'北京'}, [], false)
const score = moduleMock.exports.score
const detailMismatch = moduleMock.exports.detailMismatch
const savedBicc = require('../docs/v21-validation/1789995495142-wsa-detail-probe.json')
const biccPage = savedBicc.result.items.find((item) => item.url === 'https://cnyisai.com/event/71.html')
assert(biccPage)
const biccWindow = moduleMock.exports.submissionWindow({
  title: '2026第六屆·BICC中英國際創意大賽', domain: 'academic',
  suggestedStartTime: '2026-10-25T15:59:59Z'
}, [{title: biccPage.title, link: biccPage.url, description: biccPage.text}])
assert(biccWindow && biccWindow.startTime === Date.parse('2026-08-06T00:00:00+08:00'))
assert.strictEqual(biccWindow.timePrecision, 'date')
const liveBicc = require('../docs/v21-validation/1790041572353-detail-candidate-preview.json')
const livePage = liveBicc.result.detailPlan.wsaPass.evidence.find((item) => /cnyisai\.com\/event\/71\.html/.test(item.link))
assert(livePage)
assert(moduleMock.exports.submissionWindow({
  title: '2026第六屆·BICC中英國際創意大賽', domain: 'academic',
  suggestedStartTime: '2026-10-25T15:59:59Z'
}, [livePage]))
const submissionEnd = Date.parse('2026-10-25T00:00:00+08:00')
const submissionEvidence = {title:'BICC 2026征稿通知',description:'作品征稿期为2026年8月6日至2026年10月25日，投稿截止10月25日。'}
assert(moduleMock.exports.stageEvidence('submission', submissionEnd, submissionEvidence))
assert(moduleMock.exports.accessDeadline(Date.parse('2026-08-06T00:00:00+08:00'), submissionEnd, submissionEvidence))
assert(!moduleMock.exports.accessDeadline(NaN, submissionEnd, {description:'颁奖典礼于2026年10月25日举行'}))
assert.strictEqual(detailMismatch({title:'2026北京演唱会',city:'北京市'}, {title:'2026北京演唱会',city:'北京'}), '')
assert.strictEqual(detailMismatch({title:'2026台北演唱会',city:'臺北市'}, {title:'2026台北演唱会',city:'台北'}), '')
assert.strictEqual(detailMismatch({title:'2026香港展览',city:'香港特别行政区'}, {title:'2026香港展览',city:'中国香港'}), '')
assert.strictEqual(detailMismatch({title:'2026亚运会',city:'爱知县名古屋市'}, {title:'2026亚运会',city:'名古屋'}), '')
assert.strictEqual(detailMismatch({title:'2026广州活动',city:'广东省广州市'}, {title:'2026广州活动',city:'广州'}), '')
assert.strictEqual(detailMismatch({title:'2026比赛',city:'線上'}, {title:'2026比赛',city:'线上'}), '')
assert.strictEqual(detailMismatch({title:'2026世界赛',city:'洛杉矶/艾伦/纽约'}, {title:'2026世界赛',city:'纽约'}), 'city')
assert.strictEqual(detailMismatch({title:'2026创意大赛',city:'线上',suggestedStartTime:'2026-10-25T00:00:00+08:00'}, {title:'2026创意大赛',city:'线上',startTime:Date.parse('2026-08-06T00:00:00+08:00'),endTime:Date.parse('2026-12-24T00:00:00+08:00')}), 'occurrence_scope')
assert.strictEqual(detailMismatch({title:'2026创意大赛',city:'线上',suggestedStartTime:'2026-10-25T23:59:59+08:00'}, {title:'2026创意大赛',city:'线上',startTime:Date.parse('2026-08-06T00:00:00+08:00'),endTime:Date.parse('2026-10-25T00:00:00+08:00')}), 'occurrence_scope')
assert.strictEqual(detailMismatch({title:'2026创意大赛',city:'线上',suggestedStartTime:'2026-10-25T00:00:00+08:00'}, {title:'2026创意大赛',city:'线上',startTime:Date.parse('2026-10-26T00:00:00+08:00')}), '')
assert.strictEqual(detailMismatch({title:'2026巡演',city:'北京'}, {title:'2026巡演',city:'上海'}), 'city')
assert.strictEqual(detailMismatch({title:'2026无畏契约小组赛',city:'上海'}, {title:'2026无畏契约淘汰赛',city:'上海'}), 'phase')
// Explicit deadlines and enumerated opening dates must not be conflated.
const deadlineModule = {exports:{}}
const deadlineSource = fs.readFileSync(target,'utf8').match(/function hasAccessDeadlineEvidence\([\s\S]*?\n}\n/)[0]
vm.runInNewContext(deadlineSource + '\nmodule.exports.check=hasAccessDeadlineEvidence', {
  module: deadlineModule,
  stageDateTokens: t => [new Date(t).getUTCMonth()+1+'月'+new Date(t).getUTCDate()+'日']
})
const start = Date.parse('2026-09-09T00:00:00Z'), end = Date.parse('2026-09-11T00:00:00Z')
assert(!deadlineModule.exports.check(start,end,{description:'预约9月9日12:00、9月10日12:00、9月11日12:00'}))
assert(deadlineModule.exports.check(start,end,{description:'预约9月9日至9月11日'}))
assert(deadlineModule.exports.check(start,end,{description:'预约截止9月11日12:00'}))
assert(deadlineModule.exports.check(start,end,{description:'报名时间：\n2026年9月9日 - 2026年9月11日\n作品提交入口'}))
assert(score({title:'名创优品 LISA 联名快闪活动公告'}, 'LISA×名创优品联名快闪 Pop-Up World Tour 北京站', Date.now(), []) >= 35)
assert(score({title:'名创优品宣传图事件',description:'推荐阅读 LISA 名创优品联名快闪'}, 'LISA×名创优品联名快闪 Pop-Up World Tour 北京站', Date.now(), []) < 35)
assert.strictEqual(queries.length, 3)
assert(queries.some(q => q.includes('商场 地址')))
assert(queries.every(q => q.includes('LISA') && q.includes('名创优品') && q.includes('北京')))
assert(queries.every(q => !q.includes('Pop-Up World Tour')))
const sports = moduleMock.exports.testQueries({title:'2026 KPL年度总决赛 淘汰赛',domain:'game',city:'长沙'}, [], true)
assert(sports[0].includes('淘汰赛') && sports[0].includes('2026') && sports[0].includes('完整赛程'))
assert(sports.some(query => query.includes('每日赛程')))
const matrix = [
  [{title:'2026北京马拉松',domain:'sports',city:'北京'}, '抽签', /对阵表|售票|票价/],
  [{title:'2026下半年全国大学英语四六级考试',domain:'academic'}, '准考证', /购票|售票/],
  [{title:'2026全新智己LS6预售',domain:'auto'}, '交付', /报名|购票/],
  [{title:'2026 vivo开发者大会',domain:'tech'}, '分论坛', /购票/],
  [{title:'2026上海摄影展',domain:'culture'}, '闭馆日', /对阵表/],
  [{title:'2026单依纯演唱会成都站',city:'成都',domain:'ent'}, '二次开票', /报名/]
]
for (const [candidate, term, unwanted] of matrix) {
  const queries = moduleMock.exports.testQueries(candidate, [], candidate.domain === 'sports')
  assert(queries.join(' ').includes(term))
  assert(!unwanted.test(queries.join(' ')))
  assert(queries.every(q => q.includes('2026')))
}
const aliased = moduleMock.exports.testQueries({title:'2026 KPL年度总决赛 淘汰赛',domain:'game',city:'长沙'}, ['KPL'], true)
assert(aliased.every(q => ['2026','年度'].every(term => q.includes(term))))
assert(aliased.some(q => q.includes('淘汰赛') && q.includes('长沙')))
assert(aliased.some(q => q.includes('完整赛程') && !q.includes('长沙')))
const {parseResponse} = require('../cloudfunctions/fetchEvents/lib/wsa-search')
const result = parseResponse({Pages:[{title:'公告',url:'https://example.com/event',passage:'日期在摘要',content:'地址在动态摘要'}]})
assert(result.items[0].description.includes('日期在摘要'))
assert(result.items[0].description.includes('地址在动态摘要'))
const evidence = {title:'Lisa x 名创优品 联名活动公告',link:'https://example.com/notice',description:'中国：2026年9月12日-10月11日，北京、上海、深圳。'}
assert.strictEqual(moduleMock.exports.support('LISA×名创优品联名快闪 Pop-Up World Tour 北京站', Date.parse('2026-09-12T00:00:00+08:00'), '2026-09-12T00:00:00+08:00', [evidence]), 0)
assert.strictEqual(moduleMock.exports.support('LISA×名创优品联名快闪 Pop-Up World Tour 北京站', Date.parse('2026-10-11T00:00:00+08:00'), '2026-10-11T00:00:00+08:00', [{...evidence,description:evidence.description+'参考2025年专辑。'}]), 0)
assert.strictEqual(moduleMock.exports.support('LISA×名创优品联名快闪 Pop-Up World Tour 北京站', Date.parse('2026-09-12T00:00:00+08:00'), '2026-09-12T00:00:00+08:00', [{...evidence, description:'中国：2025年9月12日-10月11日，北京。'}]), -1)
console.log('PASS: targeted queries retain identity, stage and year; both WSA evidence fields preserved')
if (process.argv.includes('--replay')) {
  const report = require('../docs/wsa-detail-after.json')
  const items = report.items.map(item => ({title:item.title,description:item.text,link:item.url}))
  for (const raw of report.extracted) {
    console.log(JSON.stringify(items.map(item=>({title:item.title,start:moduleMock.exports.date(Date.parse(raw.startTime),item,raw.startTime),end:moduleMock.exports.date(Date.parse(raw.endTime),item,raw.endTime)}))))
    const rejected=[]
    const normalized=moduleMock.exports.normalize({...raw,domain:'culture'},Date.now(),items,rejected,{city:'北京'})
    assert(normalized, JSON.stringify(rejected))
    assert(normalized.endTime > normalized.startTime)
    assert(normalized.endTimeSource && normalized.endTimeSource.url)
    assert(normalized.participationGuide.location.includes('北京国贸商城'))
    assert(normalized.confidence <= 0.68, 'Secondary sources must not gain primary-source confidence')
    console.log(JSON.stringify({normalized,rejected}))
  }
}
if (process.argv.includes('--types')) {
  for (const key of ['running','exam']) {
    const report = require('../docs/wsa-' + key + '-after.json')
    const items = report.items.map(item => ({title:item.title,description:item.text,link:item.url}))
    const raw = report.extracted[0]
    const rejected = []
    const event = moduleMock.exports.normalize({...raw,domain:key === 'exam' ? 'academic' : 'sports'}, Date.now(), items, rejected, {})
    assert(event, JSON.stringify(rejected))
    console.log(JSON.stringify({key,stages:event.stages.map(s=>({name:s.name,session:s.sessionKey})),accessStart:event.participationGuide.accessStartTime,accessEnd:event.participationGuide.accessEndTime}))
    if (key === 'exam') assert.strictEqual(event.stages.length,4)
    else assert(event.participationGuide.accessStartTime && event.participationGuide.accessEndTime)
  }
}
