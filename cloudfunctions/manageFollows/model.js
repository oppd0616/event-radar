const crypto = require('crypto')
function refs(event) {
  return [...new Set([event._id, event.canonicalEventId].concat(event.identityMembers || []).filter(Boolean))]
}
function matches(record, event) { return refs(event).some(id => (record.refs || [record.eventId]).includes(id)) }
// Input is getEvents' evidence-filtered detail, not raw scraper output.
function snapshot(event) {
  const g = event.participationGuide || {}, p = event.participation || {}
  const stages = (event.stages || []).map(s => ({ key: s.key, name: s.name, session: s.sessionKey, start: s.startTime, end: s.endTime, location: s.venue || s.location })).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const entrances = (event.participationOptions || []).map(o => ({url:o.url,platform:o.platform})).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return crypto.createHash('sha256').update(JSON.stringify({ start: event.startTime, end: event.endTime, precision: event.timePrecision, city:event.city, location: g.location, price:g.price, access: g.accessStartTime, accessEnd: g.accessEndTime, url: p.url, type:p.type, entrances, stages, ...(event.openingSchedule && event.openingSchedule.length ? {openingSchedule:event.openingSchedule} : {}) })).digest('hex')
}
function ended(event, now) {
  if (event.openingState && event.openingState.key === 'ended') return true
  if (event.timePrecision === 'month_range') return false
  const time = Number(event.endTime || event.startTime)
  if (!time) return false
  // An event with only a date stays in the active list throughout that China calendar day.
  if (!event.endTime || event.timePrecision === 'date') return Math.floor((time + 8*3600000)/86400000) < Math.floor((now + 8*3600000)/86400000)
  return time < now
}
function plan(event, now) {
  if (!event || event.status !== 'published') return { key:'unknown',label:'信息待确认',at:0 }
  if (ended(event,now)) return { key:'ended',label:'已结束',at:Number(event.endTime || event.startTime) }
  const guide=event.participationGuide || {}
  let deadline=Number(guide.accessEndTime)
  if(deadline && (guide.accessEndTimePrecision === 'date' || (deadline+8*3600000)%86400000 === 0)) {
    deadline=(Math.floor((deadline+8*3600000)/86400000)+1)*86400000-8*3600000-1
  }
  if (deadline > now && deadline-now <= 7*86400000) return {key:'deadline',label:'参与入口即将截止',at:deadline}
  if (event.openingState) {
    const state = event.openingState
    const at = state.key === 'today' ? now : state.nextDate ? Date.parse(state.nextDate + 'T00:00:00+08:00') : now
    return {key:state.key === 'today' ? 'ongoing' : at-now <= 7*86400000 ? 'soon' : 'upcoming', label:state.text, at}
  }
  if (event.timePrecision === 'month_range' || !Number(event.startTime)) return {key:'upcoming',label:'日期待公布',at:0}
  const start=event.openingState && event.openingState.key === 'upcoming' && event.openingState.nextDate
    ? Date.parse(event.openingState.nextDate + 'T00:00:00+08:00') : Number(event.startTime)
  const today=Math.floor((now+8*3600000)/86400000), startDay=Math.floor((start+8*3600000)/86400000)
  if (start <= now || event.timePrecision === 'date' && startDay === today) return {key:'ongoing',label:'正在进行',at:start}
  if (start-now <= 7*86400000) return {key:'soon',label:'未来七天开始',at:start}
  return {key:'upcoming',label:'后续安排',at:start}
}
function comparePlans(a,b) {
  const order={deadline:0,ongoing:1,soon:2,upcoming:3,unknown:4,ended:5}
  return order[a.plan.key]-order[b.plan.key] || (a.plan.at || Infinity)-(b.plan.at || Infinity) || b.record.followedAt-a.record.followedAt
}
function agenda(event,now) {
  if(!event || event.status !== 'published') return {key:'unavailable',at:0}
  if(ended(event,now)) return {key:'archive',at:Number(event.endTime || event.startTime)}
  const start=event.openingState && event.openingState.key === 'upcoming' && event.openingState.nextDate
    ? Date.parse(event.openingState.nextDate + 'T00:00:00+08:00') : Number(event.startTime)
  if(event.timePrecision === 'month_range' || !start) return {key:'undated',at:0}
  const chinaNow=new Date(now+8*3600000),weekday=chinaNow.getUTCDay() || 7
  const weekEnd=(Math.floor((now+8*3600000)/86400000)+8-weekday)*86400000-8*3600000
  return {key:start<weekEnd ? 'week' : 'later',at:Math.max(start,now)}
}
function compareAgenda(a,b) {
  const order={week:0,later:1,undated:2,unavailable:3,archive:4}
  const group=order[a.agenda.key]-order[b.agenda.key]
  if(group) return group
  const time=a.agenda.key === 'archive' ? b.agenda.at-a.agenda.at : a.agenda.at-b.agenda.at
  return time || b.record.followedAt-a.record.followedAt
}
module.exports = { refs, matches, snapshot, ended, plan, comparePlans, agenda, compareAgenda }
