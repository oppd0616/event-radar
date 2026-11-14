const { isExperience } = require('./discovery-experience')
const { activityContent } = require('./activity-content')
const { isOnline, needsAccessTime, hasAccessTime } = require('./participation-policy')
const { isDurationStage } = require('./stage-state')
// Modes describe participation, not domains. Multiple modes may coexist.
const MODES = {
  participant_race: { pattern: /马拉松|越野赛|领物|参赛号码|marathon/i, fields: ['location', 'access'], hint: '参赛型：报名、抽签、领物、起终点分别绑定日期，不搜索观赛售票。' },
  spectator: { pattern: /小组赛|淘汰赛|总决赛|playoffs/i, fields: ['location', 'stages'], hint: '观赛型：每轮日期独立取证，联合票务页不能证明各阶段同日起赛。' },
  multi_stage: { pattern: /(?:小组赛[\s\S]{0,120}淘汰赛|淘汰赛[\s\S]{0,120}(?:决赛|总决赛)|groups?[\s\S]{0,120}playoffs?)/i, fields: ['stages'], hint: '多阶段赛事：正文提到的各阶段必须分别形成节点；只抽到总决赛不能视为完整。' },
  exam: { pattern: /准考证|考试科目|笔试|口试|CET[ -]?[46]/i, fields: ['stages', 'access'], hint: '考试型：保留不同科目场次；地区报名日期不能代表全国，考点以准考证为准。' },
  submission: { pattern: /征稿|投稿|作品提交|提交作品|作品征集|call for entries|submission(?:s)?(?: period| deadline)?/i, fields: ['submission_time'], hint: '投稿型：征稿开始、投稿截止与评审或颁奖日期分别取证；投稿期不得冒充比赛或颁奖时间。' },
  hackathon: { pattern: /黑客松|hackathon|buildathon|共创挑战|智能体.*挑战赛/i, fields: ['access'], hint: '黑客松/共创型：核实报名截止、参赛身份、组队人数、线上线下形式、工具要求和费用；报名、集中开发、作品提交、路演评审分别绑定原文日期。未知字段留空，不把报名截止当活动开始，不假定学生身份或学术加分。' },
  release: { pattern: /预售价|上市发布|正式上市|新品发布|交付时间/, fields: ['access'], hint: '发布型：发布会时间、预售期、正式上市、交付日期不是同一个时间，不互相代填。' },
  show_session: { pattern: /演唱会|音乐节|演出场次|concert|world tour/i, fields: ['location', 'access'], hint: '演出型：按城市、场次绑定开场和开票时间，直播放参与入口。' },
  conference: { pattern: /分论坛|会议议程|参会|conference|峰会|开发者日|开发者大会|创新工坊|devfest|build day|workshop|meetup/i, fields: ['location', 'access'], hint: '会议/工坊型：区分议程、动手实践、直播与报名；明确线上线下形式，不强求线上活动有实体地址。' },
  visit: { pattern: /快闪|展览|博览会|营业时间|pop.up|市集/i, fields: ['location'], hint: '游览型：核实门店地址和展期；无需购票或预约时不要求开票时间。' }
}
const fieldQueries = { location: '具体场馆 门店 地址', access: '参与方式 官方入口 开放安排', stages: '各阶段 科目 场次 日期 时间安排', date: '官方活动日期 时间安排', academic_value:'参赛资格 适用专业 主办方 证书 官方规则', attractive_highlights:'官方活动内容 嘉宾 亮点', timeline_conflict:'官方各阶段日期 赛程', broken_encoding:'官方活动详细介绍' }
function inferModes(items, candidate) {
  const text = [candidate && candidate.title || '', ...(items || []).map(activityContent)].join('\n')
  let modes = Object.keys(MODES).filter(key => MODES[key].pattern.test(text))
  const title=String(candidate && candidate.title || '')
  // Clear activity identity gates incidental keywords from other sessions,
  // advertisements and related events in a full page. Preserve raw evidence.
  if (/展览|博览会|车展|特展|原画展|个展|快闪|主题咖啡厅/.test(title)) {
    modes=modes.filter(key=>['visit','conference'].includes(key) && (key==='visit'||/峰会|论坛|大会|会议/.test(title)))
    if(!modes.includes('visit'))modes.push('visit')
  }
  if (/峰会|开发者日|开发者大会|金融.*大会|金融.*高峰会/.test(title)) {
    modes=modes.filter(key=>!['participant_race','spectator','multi_stage','exam','show_session','visit'].includes(key))
    if(!/征稿|投稿|作品征集/.test(title))modes=modes.filter(key=>key!=='submission')
    if(!/黑客松|hackathon|挑战赛/i.test(title))modes=modes.filter(key=>key!=='hackathon')
    if(!modes.includes('conference'))modes.push('conference')
  }
  if (candidate && /黑客松|hackathon|buildathon|共创挑战/i.test(String(candidate.title || ''))) {
    if (!modes.includes('hackathon')) modes.push('hackathon')
    if (!/小组赛|淘汰赛|总决赛|playoffs/i.test(String(candidate.title || ''))) {
      modes = modes.filter(key => !['spectator', 'multi_stage', 'exam'].includes(key))
    }
  }
  if (isExperience(candidate)) {
    // An independently actionable experience can mention its parent tournament
    // or concert without inheriting that parent's schedule requirements.
    modes = modes.filter(key => !['spectator', 'multi_stage', 'show_session', 'participant_race', 'exam'].includes(key))
    if (!modes.includes('visit')) modes.push('visit')
  }
  // Long aggregation pages often mention unrelated finals in recommendations.
  // A generic online academic submission is not a spectator event unless its
  // locked activity title itself names a competitive stage.
  if (candidate && candidate.domain === 'academic' && modes.includes('submission') &&
      !/小组赛|淘汰赛|总决赛|决赛|playoffs?|group stage/i.test(String(candidate.title || ''))) {
    modes = modes.filter(key => key !== 'spectator' && key !== 'multi_stage')
  }
  return modes
}
function instructions(modes) {
  return modes.map(key => MODES[key].hint).join('\n') + '\n未知或未公布字段留空，不按惯例补全。每个日期必须属于对应活动、城市、阶段和用途；不把其他城市的预约时间移植过来。'
}
function expectedStageKeys(items) {
  const text = (items || []).map(activityContent).join('\n')
  const rules = [
    ['group', /小组赛|擂台赛|group stage/i],
    ['qualifier', /突围赛|资格赛|qualifier/i],
    ['knockout', /淘汰赛|季后赛|playoffs?|bracket stage/i],
    ['final', /(?:^|[^半])总决赛|冠亚军决赛|grand final/i]
  ]
  return rules.filter(rule => rule[1].test(text)).map(rule => rule[0])
}
function expectedPreciseStageKeys(items) {
  const rules = [
    ['group', /小组赛|擂台赛|group stage/i],
    ['qualifier', /突围赛|资格赛|qualifier/i],
    ['knockout', /淘汰赛|季后赛|playoffs?|bracket stage/i],
    ['final', /(?:^|[^半])总决赛|冠亚军决赛|grand final/i]
  ]
  const exactDate = /(?:20\d{2}[年/.\-])?\d{1,2}[月/.\-]\d{1,2}日?/
  const text = (items || []).map(activityContent).join('\n')
  return rules.filter(([, phase]) => text.split(/[。；;\n]/).some(clause => phase.test(clause) && exactDate.test(clause)))
    .map(([key]) => key)
}
function missingFields(events, modes, rejected, evidenceItems) {
  if ((rejected || []).length && rejected.every(x => x.reason === 'already_ended')) return []
  if (!events.length) return (modes.includes('submission') ? ['submission_time', 'date'] : ['date'])
    .concat(modes.some(m => MODES[m].fields.includes('location')) ? ['location'] : [])
  const required = new Set(modes.flatMap(key => MODES[key].fields))
  if (events.some(needsAccessTime)) required.add('access_time')
  if (modes.includes('participant_race')) required.add('clock')
  return [...required].filter(field => !events.some(e => {
    const guide = e.participationGuide || {}
    if (field === 'clock') return e.timePrecision === 'datetime'
    if (field === 'access_time') return !needsAccessTime(e) || hasAccessTime(e)
    // Once a submission window is already open, normalization may intentionally
    // omit its past accessStartTime. A verified future deadline plus the event's
    // evidenced start is sufficient and prevents paying to rediscover old data.
    if (field === 'submission_time') return guide.accessEndTime && (guide.accessStartTime || e.startTime)
    if (field === 'location') return isOnline(e) ||
      guide.location && !/待定|待公布|待官宣/.test(guide.location)
    if (field === 'stages') return Array.isArray(e.stages) && e.stages.length > 0
    // An actionable entrance is sufficient; don't insist on an unpublished clock.
    return e.participation && e.participation.url || guide.accessStartTime
  })).concat(modes.includes('multi_stage') && !events.some(e => new Set((e.stages || []).map(s => s.key)).size >= 2) ? ['multi_stage'] : [])
    .concat((() => {
      if (!modes.includes('multi_stage')) return []
      const expected = expectedStageKeys(evidenceItems)
      if (!expected.length) return []
      const actual = new Set(events.flatMap(e => (e.stages || []).map(s => s.key)))
      return expected.some(key => !actual.has(key)) ? ['stage_coverage'] : []
    })()).concat((() => {
      if (!modes.includes('multi_stage')) return []
      const precise = expectedPreciseStageKeys(evidenceItems)
      const stages = events.flatMap(e => e.stages || [])
      return precise.some(key => !stages.some(stage => stage.key === key && stage.timePrecision !== 'month_range'))
        ? ['stage_precision'] : []
    })()).concat(modes.includes('multi_stage') && events.some(e => (e.stages || []).some(stage =>
      isDurationStage(stage) && /group|group_knockout|knockout|qualifier|preliminary|second_round|final_weekend/.test(stage.key || '') &&
      !Number(stage.endTime))) ? ['stage_end_time'] : [])
}
function supplementQueries(candidate, missing, modes) {
  const access = modes.includes('hackathon') ? '官方报名截止 参赛资格 组队要求 作品提交 费用' : modes.includes('participant_race') ? '报名 抽签 领物 官方入口' : modes.includes('exam') ? '报名官网 地区报名通知' : modes.includes('release') ? '官方预订入口 预售规则' : '官方参与入口 预约 售票安排'
  const queries = []
  for (const field of [...new Set(missing)]) {
    if (field === 'access_audience') {
      queries.push([candidate.title, '官方报名对象 观众参观 参赛报名 参展商报名 截止时间'].join(' '))
      if (queries.length >= 2) break
      continue
    }
    if (field === 'stage_end_time') {
      queries.push([candidate.title, '官方完整赛程 各阶段 开始日期 结束日期 日期范围 schedule group stage playoffs'].join(' '))
    } else if (field === 'multi_stage' || field === 'stage_coverage' || field === 'stage_precision') {
      queries.push([candidate.title, '完整赛程 小组赛 擂台赛 突围赛 淘汰赛 总决赛 精确日期 场馆 官方'].filter(Boolean).join(' '))
      queries.push([candidate.title, '每日赛程 各阶段 开始结束日期 场馆 官方'].filter(Boolean).join(' '))
    } else {
      queries.push([candidate.title, candidate.city || '', field === 'submission_time' ? '征稿开始 投稿截止 作品提交时间 官方通知' : field === 'access_time' ? '报名开始时间 截止时间 官方通知' : field === 'clock' ? '正式开始时刻 起跑时间 官方通知' : field === 'access' ? access : fieldQueries[field]].filter(Boolean).join(' '))
    }
    if (queries.length >= 2) break
  }
  return queries.slice(0, 2)
}
function mergeEvidence(previous, incoming) {
  // Keep existing indexes stable: saved stage.evidenceIndex refers to this order.
  const items = previous.map(item => ({...item}))
  let changed = false
  for (const item of incoming) {
    const old = items.find(entry => entry.link === item.link)
    if (!old) { items.push(item); changed = true; continue }
    const nextText = String(item.description || '').trim()
    if (nextText && !String(old.description || '').includes(nextText)) {
      old.description = String(old.description || '') + '\n' + nextText
      changed = true
    }
  }
  return {items, changed}
}
module.exports = { MODES, inferModes, instructions, expectedStageKeys, expectedPreciseStageKeys, missingFields, supplementQueries, mergeEvidence }
