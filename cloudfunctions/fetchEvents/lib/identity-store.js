const crypto=require('crypto')
const identity=require('./stable-event-identity')
const claimId=key=>'identity-'+crypto.createHash('sha256').update(key).digest('hex').slice(0,32)
function keysFor(event) {
  const keys=[identity.identityKey(event)].filter(Boolean)
  const scope=identity.describe(event)
  for(const source of [event.source,event.participation,...(event.participationOptions || [])]) {
    try {
      const u=new URL(source && source.url),host=u.hostname.replace(/^www\./,'')
      const pathId=(/^(?:showstart.com|saikr.com|huodongxing.com|zuicool.com)$/.test(host) && u.pathname.match(/\/(?:event|vse)\/(\d+)/i)||[])[1]
      const ticketId=/(^|\.)damai\.cn$/.test(host) ? u.searchParams.get('id') : ''
      const id=pathId || ticketId
      if(id && /^\d+$/.test(id))keys.push(['ticket',host,id,scope.year,scope.city].join('|'))
    } catch(_) {}
  }
  return [...new Set(keys)]
}
async function read(ref) {
  try { const result=await ref.get(); return result && result.data || null }
  catch(error) { if(/document.*(?:not exist|not found)|DOCUMENT_NOT_EXIST/i.test(String(error.message)))return null;throw error }
}
async function resolve(db,event) {
  for(const key of keysFor(event)) {
    const claim=await read(db.collection('eventCandidates').doc(claimId(key)))
    if(claim && claim.targetEventId) {
      const seen=new Set()
      let id=claim.targetEventId
      while(id && !seen.has(id) && seen.size<8) {
        seen.add(id)
        const event=await read(db.collection('events').doc(id))
        if(!event || event.status!=='merged')return event
        id=event.mergedInto
      }
    }
  }
  return null
}
async function commit(db,id,next,data,patch,expected,contentOf,duplicates=[]) {
  const keys=[...new Set(keysFor(next).concat(expected ? keysFor(expected) : [],duplicates.flatMap(keysFor)))]
  return db.runTransaction(async tx=>{
    const ref=tx.collection('events').doc(id)
    const current=await read(ref)
    if(current && current.status==='merged') return {written:false,issues:['identity_redirect'],targetEventId:current.mergedInto}
    if(!patch && current) return {written:false,issues:['identity_exists'],targetEventId:id}
    if(patch && !current) return {written:false,issues:['identity_target_missing']}
    if(patch && expected && JSON.stringify(contentOf(current))!==JSON.stringify(contentOf(expected))) return {written:false,issues:['concurrent_content_update'],targetEventId:id}
    for(const duplicate of duplicates) {
      const other=await read(tx.collection('events').doc(duplicate._id))
      if(!other || other.status==='merged' || JSON.stringify(contentOf(other))!==JSON.stringify(contentOf(duplicate)))return {written:false,issues:['concurrent_duplicate_update']}
    }
    for(const key of keys) {
      const claim=await read(tx.collection('eventCandidates').doc(claimId(key)))
      if(claim && claim.targetEventId!==id && !duplicates.some(d=>d._id===claim.targetEventId))return {written:false,issues:['identity_claimed'],targetEventId:claim.targetEventId}
    }
    const payload=Object.assign({},data,{canonicalEventId:id,identityVersion:identity.VERSION})
    if(duplicates.length) {
      payload.identityMembers=db.command.set([...new Set((next.identityMembers||[]).concat(id,duplicates.flatMap(d=>[d._id,...(d.identityMembers||[])])))])
      const backupId='identity-backup-'+crypto.randomBytes(12).toString('hex')
      await tx.collection('eventCandidates').doc(backupId).set({data:{fingerprint:backupId,kind:'identity_migration_backup',status:'archived',primaryId:id,records:[current,...duplicates],createdAt:Date.now()}})
    }
    if(patch)await ref.update({data:payload});else await ref.set({data:payload})
    for(const duplicate of duplicates)await tx.collection('events').doc(duplicate._id).update({data:{status:'merged',mergedInto:id,canonicalEventId:id,identityVersion:identity.VERSION,updatedAt:Date.now()}})
    for(const key of keys) await tx.collection('eventCandidates').doc(claimId(key)).set({data:{fingerprint:claimId(key),kind:'event_identity',status:'active',identityKey:key,targetEventId:id,updatedAt:Date.now()}})
    return {written:true}
  })
}
module.exports={resolve,commit,read,claimId,keysFor}
