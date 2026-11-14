const crypto = require('crypto')
const { scopeUpdateRisks } = require('./detail-update-policy')
const identityStore = require('./identity-store')
const { assessProductAudience } = require('./product-audience')

const PUBLIC_FIELDS = ['title','summary','city','domain','topicKeys','tags','highlights','startTime','endTime','timePrecision','endTimePrecision','timeText','participation','participationOptions','participationGuide','stages','stageConflicts','academicValue','source','sources']
const DISPLAY_FIELDS = ['title','summary','city','tags','highlights','participation','participationOptions','academicValue','timeText']
const GUIDE_FIELDS = ['platform','location','price','eligibility','entryRules','steps']
function brokenText(text) {
  if (typeof text !== 'string') return false
  return /\uFFFD|[\u0000-\u0008\u000B\u000C\u000E-\u001F]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)
}
function walk(value, at, issues) {
  if (typeof value === 'string') { if (brokenText(value)) issues.push('broken_encoding:' + at); return }
  if (Array.isArray(value)) value.forEach((item,index)=>walk(item,at+'.'+index,issues))
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key,item])=>walk(item,at+'.'+key,issues))
}
function dateIssues(start, end, endPrecision, at, issues) {
  if (start != null && start !== 0 && (!Number.isFinite(Number(start)) || Number(start) <= 0)) issues.push('invalid_date:' + at + '.startTime')
  if (end != null && end !== 0 && (!Number.isFinite(Number(end)) || Number(end) <= 0)) issues.push('invalid_date:' + at + '.endTime')
  if (Number(start) > 0 && Number(end) > 0 && Number(end) < Number(start)) {
    const sameDay = Math.floor((Number(start)+28800000)/86400000) === Math.floor((Number(end)+28800000)/86400000)
    if (!(sameDay && endPrecision === 'date')) issues.push('end_before_start:' + at)
  }
}
function inspectEventWrite(next) {
  const issues=[]
  const audience = assessProductAudience(next || {})
  if (audience.decision !== 'allow') issues.push('product_audience_' + audience.decision + ':' + audience.reason)
  if (!next || !String(next.title || '').trim()) issues.push('missing_title')
  for (const key of DISPLAY_FIELDS) walk(next && next[key],key,issues)
  const guide=next && next.participationGuide || {}
  for (const key of GUIDE_FIELDS) walk(guide[key],'participationGuide.'+key,issues)
  for (const field of ['source','sources']) {
    const value=next && next.sources
    if(field==='sources' && value != null && !Array.isArray(value)) { issues.push('invalid_sources'); continue }
    const sources=field==='sources' ? value || [] : [next && next.source]
    for (const [index,source] of sources.entries()) if(source) for(const key of ['name','url']) walk(source[key],field+'.'+index+'.'+key,issues)
  }
  dateIssues(next && next.startTime,next && next.endTime,next && next.endTimePrecision,'event',issues)
  if (!Number(next && next.startTime)) issues.push('missing_start_time')
  dateIssues(guide.accessStartTime,guide.accessEndTime,guide.accessEndTimePrecision,'access',issues)
  const stages=next && next.stages
  if(stages != null && !Array.isArray(stages)) issues.push('invalid_stages')
  for (const [index,stage] of (Array.isArray(stages) ? stages : []).entries()) {
    if(!stage || typeof stage!=='object') { issues.push('invalid_stage:'+index); continue }
    for (const key of ['name','title','label','sourceLabel','sourceUrl','location','venue','participants','sessionKey']) walk(stage[key],'stages.'+index+'.'+key,issues)
    dateIssues(stage.startTime,stage.endTime,stage.endTimePrecision,'stages.'+index,issues)
  }
  issues.push(...scopeUpdateRisks(next || {},next || {}))
  return [...new Set(issues)]
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]))
  return value
}
function contentOf(event) {
  return canonical(Object.fromEntries(PUBLIC_FIELDS.filter(key=>event && event[key]!==undefined).map(key=>[key,event[key]])))
}
function createEventWriter(db) {
  async function quarantine(id, next, issues, operation) {
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify({id,content:contentOf(next),issues})).digest('hex').slice(0,32)
    await db.collection('eventCandidates').doc('quality-'+fingerprint).set({data:{
      kind:'write_quality_review',status:'quarantined',targetEventId:id,title:next.title || '',
      fingerprint:'quality-'+fingerprint,
      operation,issues,productAudience:assessProductAudience(next),proposedEvent:next,updatedAt:Date.now(),qualityVersion:1
    }})
  }
  return async function writeCheckedEvent(id, next, patch, operation, expected, duplicates) {
    const issues=inspectEventWrite(next)
    if (issues.length) { await quarantine(id,next,issues,operation); return {written:false,issues} }
    const token=crypto.randomBytes(16).toString('hex')
    const data=Object.assign({},patch || next,{productAudience:assessProductAudience(next),writeQualityToken:token,writeQualityVersion:1})
    delete data._id
    if (patch) {
      // Replace complete nested values, including legacy null parents. SDK recursive
      // updates otherwise retain removed fields or fail on academicValue:null.
      for (const key of Object.keys(data)) if(data[key] && typeof data[key]==='object') data[key]=db.command.set(data[key])
    }
    const committed=await identityStore.commit(db,id,next,data,patch,expected,contentOf,duplicates)
    if(!committed.written)return committed
    let saved
    for(let attempt=0;attempt<2;attempt++) {
      try { saved=(await db.collection('events').doc(id).get()).data; break }
      catch(error) { if(attempt===1) { await quarantine(id,next,['write_readback_unavailable'],operation); throw error } }
    }
    // Another writer won the race. Never quarantine that writer's newer record.
    if(saved && saved.writeQualityToken!==token) return {written:false,issues:['write_superseded']}
    if (JSON.stringify(contentOf(saved)) !== JSON.stringify(contentOf(next))) {
      const errors=['write_readback_mismatch']
      await quarantine(id,next,errors,operation)
      // Keep an unexpectedly written record out of publication until inspected.
      await db.collection('events').where({_id:id,writeQualityToken:token}).update({data:{status:'quarantined',writeQualityIssues:errors,updatedAt:Date.now()}})
      return {written:false,issues:errors}
    }
    return {written:true,verified:true,issues:[]}
  }
}
module.exports={brokenText,inspectEventWrite,contentOf,createEventWriter}
