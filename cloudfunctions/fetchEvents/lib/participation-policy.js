function isOnline(event) {
  const p=event.participation||{},g=event.participationGuide||{}
  if(p.type==='offline')return false
  return /^(线上|在线|online|remote)$/i.test(String(event.city||'').trim()) ||
    /全程线上|在线举办|线上(?:活动|举办|进行|开发者|工坊)|online event|remote event/i.test([event.title,event.summary,g.location].join(' '))
}
function needsAccessTime(event) {
  const p=event.participation||{},g=event.participationGuide||{}
  // An actionable entrance alone does not imply a timed opening. Historical
  // opening clocks are not necessary for ongoing booking / on-arrival visits.
  const text=[p.note,g.entryRules,...(g.steps||[])].join(' ')
  if(/无需(?:预约|报名|购票)|随到随进|现场(?:报名|购票)|已(?:开放预约|开放报名|开放注册|开售)|现已(?:开放|开售)|持续(?:开放)?(?:预约|报名|注册|售票)|随时(?:报名|预约|注册)/.test(text))return false
  return p.type==='registration' || /即将(?:开售|开票|开放报名|开放预约)|限时(?:报名|预约|抢购)|抢票|首轮(?:开票|预售)|优先(?:购|预售)|定时(?:开票|开放)|等待(?:开票|报名开放)/.test(text)
}
function hasAccessTime(event) {
  return !!(event.participationGuide?.accessStartTime || (event.stages||[]).some(s=>/^(registration|on_sale|presale)$/.test(s.key)&&s.startTime&&s.evidenceVerified===true))
}
module.exports={isOnline,needsAccessTime,hasAccessTime}
