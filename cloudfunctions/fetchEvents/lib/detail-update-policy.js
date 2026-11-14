const { sameScope } = require('./stage-resolution')
function entranceSpecificity(value) {
  try {
    const url = new URL(String(value && value.url || ''))
    if (/^(?:\/|\/(?:zh-cn|en|cn|home)\/?)$/i.test(url.pathname) && !url.hash.includes('/detail')) return 0
    return /ticket|booking|register|signup|\/vm\/|mall\.bilibili|damai\.cn/i.test(url.href) ? 3 : 1
  } catch (_) { return -1 }
}
function preserveGuideValue(key, oldValue, nextValue) {
  if (!oldValue[key] || !nextValue[key]) return false
  // Authority does not compensate for omitted hall/floor, admission or identity rules.
  const markers = value => String(value || '').normalize('NFKC').toUpperCase().match(/(?:[A-Z]\s*\d+|[A-Z]|\d+)\s*号?馆|(?:地下)?\d+层|B\d+|实名|身份证|二维码|退票|确认邮件|审核/g) || []
  if (['location', 'entryRules', 'steps', 'eligibility'].includes(key)) {
    const nextMarkers = markers(nextValue[key])
    if (markers(oldValue[key]).some(marker => !nextMarkers.includes(marker))) return true
  }
  const oldSource = oldValue[key+'Source'], nextSource = nextValue[key+'Source']
  if (nextSource && nextSource.url && Number(nextSource.authority||0) > Number(oldSource&&oldSource.authority||0)) return false
  // Equal/no evidence cannot replace a richer statement with a short summary.
  return String(oldValue[key]).length > String(nextValue[key]).length * 1.3
}
function scopeUpdateRisks(old, incoming) {
  const risks = []
  const title = String(old.title || '')
  const context = title + ' ' + String(old.participation && old.participation.note || '')
  const guide = incoming.participationGuide || {}
  if ((guide.accessAudienceIssues || []).length) risks.push('access_audience_requires_review')
  for (const [field, sourceKey] of [['accessStartTime','accessStartSource'], ['accessEndTime','accessEndSource']]) {
    const previous = old.participationGuide || {}
    const proof = guide[field] ? guide[sourceKey] : previous[sourceKey]
    if ((guide[field] || previous[field]) && !(proof && proof.audience && proof.quote)) risks.push(field + '_audience_unverified')
  }
  for (const key of ['accessStartTime', 'accessEndTime']) {
    if (!guide[key]) continue
    const source = guide[key === 'accessStartTime' ? 'accessStartSource' : 'accessEndSource'] || {}
    const label = String(source.rawTitle || source.title || '')
    // Exhibitor/speaker/author deadlines must not become general visitor deadlines.
    if (/(参展商|展商报名|参展报名|征稿|投稿截止|讲者招募|展位申请|exhibitor|call for papers)/i.test(label) &&
        !/(参展商|展商报名|参展报名|征稿|投稿|讲者招募|展位申请|exhibitor|call for papers)/i.test(context)) {
      risks.push(key + '_audience_mismatch')
    }
  }
  // Field evidence from a child event cannot establish dates or venue for its parent.
  for (const [field, source] of [
    ['startTime', incoming.startTimeSource], ['endTime', incoming.endTimeSource],
    ['location', guide.locationSource], ['accessStartTime', guide.accessStartSource], ['accessEndTime', guide.accessEndSource]
  ]) {
    const label = String(source && (source.rawTitle || source.title) || '')
    for (const marker of ['创业企业展示', '分论坛', '分会场', '黑客松总决赛', '路演专场']) {
      if (label.includes(marker) && !title.includes(marker)) risks.push(field + '_child_event_evidence')
    }
  }
  return [...new Set(risks)]
}
function updateRisks(old, next, incoming = next) {
  const risks=[]
  for (const key of ['startTime','endTime']) {
    if (!old[key] || !next[key] || Math.floor((Number(old[key])+28800000)/86400000) === Math.floor((Number(next[key])+28800000)/86400000)) continue
    const source=incoming[key+'Source']
    const boundaryProof = (incoming.stages || []).some(stage =>
      stage.evidenceVerified === true && stage.timePrecision !== 'month_range' && stage.sourceUrl &&
      Math.floor((Number(key === 'startTime' ? stage.startTime : stage.endTime || stage.startTime) + 28800000) / 86400000) ===
        Math.floor((Number(next[key]) + 28800000) / 86400000))
    if (!boundaryProof && (Number(incoming[key]) !== Number(next[key]) || !source || !source.url)) risks.push(key+'_changed_without_field_evidence')
  }
  const missing=(old.stages||[]).filter(s=>s.evidenceVerified===true && !(next.stages||[]).some(n=>
    n.key===s.key && (Number(n.startTime)===Number(s.startTime) ||
      (s.timePrecision==='month_range' && n.timePrecision!=='month_range' &&
        n.evidenceVerified===true && n.sourceUrl && sameScope(s,n)))))
  if(missing.length) risks.push('verified_stages_removed')
  return risks
}
module.exports={entranceSpecificity,preserveGuideValue,updateRisks,scopeUpdateRisks}
