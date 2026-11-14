const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const target = path.resolve(__dirname, '../miniprogram/pages/detail/detail.js')
const moduleMock = { exports: {} }
let pageConfig = null
vm.runInNewContext(fs.readFileSync(target, 'utf8') + '\nmodule.exports.__verify = { participationNodeNames, timelineItemsOf }', {
  module: moduleMock,
  exports: moduleMock.exports,
  Page(config) { pageConfig = config },
  require(name) {
    if (name === '../../utils/opening-schedule') return require('../miniprogram/utils/opening-schedule')
    if (name === 'dayjs') return require('../miniprogram/node_modules/dayjs')
    if (name === '../../utils/constants') return { DOMAIN_MAP: {} }
    if (name === '../../utils/event-time-policy') return require('../miniprogram/utils/event-time-policy')
    if (name === '../../utils/stage-state') return require('../miniprogram/utils/stage-state')
    if (name === '../../utils/content') return { hostOf: () => '', mainlandLinkType: () => '', simplifyEvent: (event) => event }
    return {}
  }
})

const { participationNodeNames, timelineItemsOf } = moduleMock.exports.__verify
const start = Date.parse('2026-08-06T00:00:00+08:00')
const end = Date.parse('2026-10-25T00:00:00+08:00')
const submission = {
  domain: 'academic', summary: '作品征稿期', startTime: start, endTime: end,
  timePrecision: 'date', endTimePrecision: 'date',
  participation: { type: 'registration', note: '官网投稿' },
  participationGuide: { accessStartTime: start, accessEndTime: end }, stages: []
}
assert.deepStrictEqual(Array.from(participationNodeNames(submission)), ['开放投稿', '投稿截止'])
assert.deepStrictEqual(Array.from(timelineItemsOf(submission, start - 1).map(item => item.name)), ['开放投稿', '投稿截止'])
const deadlineRecord = Object.assign({}, submission, { startTime: end, endTime: 0 })
assert.deepStrictEqual(Array.from(timelineItemsOf(deadlineRecord, start - 1).map(item => item.name)), ['开放投稿', '投稿截止'])
const traditionalDeadline = Object.assign({}, deadlineRecord, { summary: '徵集創意設計作品' })
assert.deepStrictEqual(Array.from(timelineItemsOf(traditionalDeadline, start - 1).map(item => item.name)), ['开放投稿', '投稿截止'])
const guide = pageConfig.guideConfig.call({ currentTime: () => start - 1 }, submission)
assert.strictEqual(guide.accessTimeLabel, '投稿开始时间')
assert.strictEqual(guide.accessEndLabel, '投稿截止时间')
const concert = Object.assign({}, submission, {
  domain: 'ent', summary: '演唱会', participation: { type: 'offline', note: '购票入场' }
})
assert(timelineItemsOf(concert, start - 1).some(item => item.name === '活动开始'))
const showStart = Date.parse('2026-09-12T19:00:00+08:00')
const sameDayNoon = Date.parse('2026-09-12T12:00:00+08:00')
const offlineShow = {
  title: '线下演唱会', domain: 'ent', city: '上海', summary: '现场演出',
  startTime: showStart, timePrecision: 'datetime',
  participation: { type: 'registration', url: 'https://example.com', note: '网上购票' },
  participationGuide: { accessStartTime: Date.parse('2026-09-10T10:00:00+08:00'), accessTimePrecision: 'datetime' },
  stages: []
}
const offlineNode = timelineItemsOf(offlineShow, sameDayNoon).find(item => item.key === 'event-start')
assert.strictEqual(offlineNode.timeText, '9月12日')
assert.strictEqual(offlineNode.state, 'active')
const offlineGuide = pageConfig.guideConfig.call({ currentTime: () => sameDayNoon }, offlineShow)
assert(offlineGuide.accessTimeText.includes('9月10日 10:00'))
let view = null
const context = {
  currentTime: () => sameDayNoon,
  guideConfig: () => ({ accessTimeText: '2026年9月10日 10:00' }),
  sourceInfo: () => ({ name: '官方', url: 'https://example.com' }),
  setData(data) { view = data }
}
pageConfig.renderEvent.call(context, offlineShow)
assert.strictEqual(view.timeText, '2026年9月12日')
assert.strictEqual(view.eventTimeLabel, '活动日期')
assert.strictEqual(view.showCountdown, false)
assert.strictEqual(view.accessTimeText, '2026年9月10日 10:00')
const streamedShow = Object.assign({}, offlineShow, {
  participationOptions: [{ type: 'livestream', url: 'https://example.com/live' }]
})
pageConfig.renderEvent.call(context, streamedShow)
assert.strictEqual(view.timeText, '2026年9月12日 19:00')
assert.strictEqual(view.showCountdown, true)
const party = Object.assign({},offlineShow,{title:'街区万圣节派对',startTime:Date.parse('2026-10-17T00:00:00+08:00'),endTime:Date.parse('2026-10-31T23:59:59+08:00'),
  openingSchedule:[{label:'派对日期',scope:'event',complete:true,dates:['2026-10-17','2026-10-24','2026-10-31']},{label:'其他来源开放日',scope:'event',complete:true,dates:['2026-10-17','2026-10-24','2026-10-31']}]})
pageConfig.renderEvent.call(Object.assign({},context,{currentTime:()=>Date.parse('2026-10-20T12:00:00+08:00')}),party)
assert.strictEqual(view.countdownStatusText,'下一场 10月24日')
assert.strictEqual(view.openingRows[0].text,'10月17日、10月24日、10月31日')
assert.strictEqual(view.showCountdown,false)
assert.strictEqual(view.openingRows.length,1)
const tournament = {
  title: '2026KPL王者荣耀年度总决赛', domain: 'game', city: '长沙', summary: '多阶段赛事',
  startTime: Date.parse('2026-10-01T00:00:00+08:00'), timePrecision: 'month_range',
  currentStageKey: 'knockout', currentStageStartTime: Date.parse('2026-10-01T00:00:00+08:00'),
  participation: { type: 'offline' }, participationGuide: {},
  stages: [
    { key: 'knockout', name: '淘汰赛', startTime: Date.parse('2026-10-01T00:00:00+08:00'),
      endTime: Date.parse('2026-11-30T23:59:59+08:00'), timePrecision: 'month_range', venue: '长沙七彩盒子' },
    { key: 'final', name: '总决赛', startTime: Date.parse('2026-11-14T00:00:00+08:00'),
      timePrecision: 'date', venue: '成都五粮液文化体育中心综合体育馆' }
  ]
}
pageConfig.renderEvent.call(Object.assign({}, context, {
  currentTime: () => Date.parse('2026-10-30T12:00:00+08:00')
}), tournament)
assert.strictEqual(view.eventTimeLabel, '总决赛日期')
assert.strictEqual(view.timeText, '2026年11月14日')
assert.strictEqual(view.endText, '', 'an approximate phase must not show a false exact end date')
assert.strictEqual(view.timelineItems.length, 1, 'only confirmed dates enter the chronological timeline')
assert.strictEqual(view.pendingTimelineItems.length, 1, 'approximate dates remain visible separately')
console.log('Detail timeline verification passed: submission access nodes do not duplicate event dates')
const groups = {
  title: '多阶段比赛', domain: 'game', participation: { type: 'offline' },
  endTime: Date.parse('2026-10-18T00:00:00+08:00'), endTimePrecision: 'date',
  stages: [{ key: 'group', name: '小组赛', startTime: Date.parse('2026-09-24T17:00:00+08:00'),
    endTime: 0, timePrecision: 'datetime', endTimePrecision: 'date' }]
}
const october1 = Date.parse('2026-10-01T12:00:00+08:00')
assert.strictEqual(timelineItemsOf(groups, october1)[0].stateText, '已开始', 'unknown phase end must not imply completion')
groups.stages[0].endTime = Date.parse('2026-10-04T00:00:00+08:00')
assert.strictEqual(timelineItemsOf(groups, october1)[0].state, 'active')
assert.strictEqual(timelineItemsOf(groups, october1)[0].timeText, '9月24日—10月4日')
assert.strictEqual(timelineItemsOf(groups, Date.parse('2026-10-04T22:00:00+08:00'))[0].state, 'active')
assert.strictEqual(timelineItemsOf(groups, Date.parse('2026-10-05T00:00:00+08:00'))[0].state, 'done')
groups.stages[0].endTime = 0
groups.stages.push({key:'knockout',name:'淘汰赛',startTime:Date.parse('2026-10-07T00:00:00+08:00'),timePrecision:'date'})
groups.currentStageKey = 'knockout'
groups.currentStageStartTime = groups.stages[1].startTime
pageConfig.renderEvent.call(Object.assign({},context,{currentTime:()=>october1}),groups)
assert.strictEqual(view.eventTimeLabel,'小组赛日期','stale cached future focus must not skip a started phase')
