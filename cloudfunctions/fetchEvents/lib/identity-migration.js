const crypto=require('crypto')
const identity=require('./stable-event-identity')
const {read,claimId,keysFor}=require('./identity-store')
function stable(value) { return Array.isArray(value) ? value.map(stable) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])) : value }
function score(event) {
  const guide=event.participationGuide || {}
  return (event.canonicalEventId===event._id ? 1000 : 0) +
    (event.status==='published' ? 100 : 0) +
    [event.startTimeSource,event.endTimeSource,guide.locationSource,guide.accessStartSource].filter(s=>s && s.url && s.quote).length*20 +
    (event.stages || []).filter(s=>s.evidenceVerified).length*5 +
    (guide.location ? 2 : 0)
}
function plan(records) {
  return identity.groups(records).map(members=>{
    const sorted=members.slice().sort((a,b)=>score(b)-score(a)||String(a._id).localeCompare(String(b._id)))
    const conflicts=[]
    for(const field of ['startTime','endTime']) {
      const values=[...new Set(members.map(e=>Number(e[field])||0).filter(Boolean))]
      if(values.length>1)conflicts.push({field,values})
    }
    return {primaryId:sorted[0]._id,title:sorted[0].title,members:sorted,conflicts}
  })
}
async function load(db) {
  const records=[]
  for(let offset=0;offset<5000;offset+=100) {
    const page=await db.collection('events').orderBy('_id','asc').skip(offset).limit(100).get()
    records.push(...page.data)
    if(page.data.length<100)return records.filter(e=>['published','pending'].includes(e.status))
  }
  throw Error('identity scan limit reached; audit is incomplete')
}
async function run(db, apply, limit, eventIds) {
  if(eventIds!==undefined && (!Array.isArray(eventIds) || !eventIds.length || eventIds.some(id=>typeof id!=='string' || !id)))throw Error('Invalid identity repair scope')
  const all=await load(db)
  const records=eventIds ? all.filter(e=>eventIds.includes(e._id)) : all
  if(eventIds && records.length!==new Set(eventIds).size)throw Error('Identity repair scope includes missing or inactive records')
  const plans=plan(records)
  const pending=plans.filter(p=>p.members.length>1 || p.members.some(e=>e.identityVersion!==identity.VERSION))
  const groups=plans.filter(p=>p.members.length>1).map(p=>({primaryId:p.primaryId,title:p.title,ids:p.members.map(e=>e._id),conflicts:p.conflicts}))
  if(!apply)return {ok:true,stage:'identity_audit',version:identity.VERSION,scanned:records.length,duplicateGroups:groups.length,duplicateRecords:groups.reduce((n,g)=>n+g.ids.length-1,0),pendingGroups:pending.length,groups}
  const results=[]
  // Duplicate groups first so the user-visible correction is not delayed by indexing singletons.
  pending.sort((a,b)=>b.members.length-a.members.length)
  for(const proposal of pending.slice(0,Math.max(1,Math.min(20,Number(limit)||10)))) {
    const result=await db.runTransaction(async tx=>{
      const fresh=[]
      for(const old of proposal.members) {
        const current=await read(tx.collection('events').doc(old._id))
        if(!current || JSON.stringify(stable(current))!==JSON.stringify(stable(old)))return {applied:false,primaryId:proposal.primaryId,reason:'concurrent_update'}
        fresh.push(current)
      }
      const ids=fresh.map(e=>e._id),allKeys=[...new Set(fresh.flatMap(keysFor))]
      for(const key of allKeys) {
        const claim=await read(tx.collection('eventCandidates').doc(claimId(key)))
        if(claim && !ids.includes(claim.targetEventId))return {applied:false,primaryId:proposal.primaryId,reason:'identity_claim_outside_group'}
      }
      const archiveId='identity-backup-'+crypto.randomBytes(12).toString('hex')
      const now=Date.now()
      // No facts are guessed or overwritten. Original records remain recoverable.
      await tx.collection('eventCandidates').doc(archiveId).set({data:{fingerprint:archiveId,kind:'identity_migration_backup',status:'archived',primaryId:proposal.primaryId,records:fresh,createdAt:now}})
      const primary=fresh.find(e=>e._id===proposal.primaryId)
      const members=[...new Set(fresh.flatMap(e=>[e._id,...(e.identityMembers || [])]))]
      for(const old of fresh) {
        const data={canonicalEventId:proposal.primaryId,identityVersion:identity.VERSION,identityBackupId:archiveId,updatedAt:now}
        if(old._id===proposal.primaryId) {
          data.identityMembers=db.command.set(members)
          if(proposal.conflicts.length) {
            data.identityReview=db.command.set({status:'pending',reason:'source_dates_disagree',conflicts:proposal.conflicts})
            data.detailEnrichmentStatus='pending'
          }
        } else { data.status='merged';data.mergedInto=proposal.primaryId }
        await tx.collection('events').doc(old._id).update({data})
      }
      for(const key of allKeys)await tx.collection('eventCandidates').doc(claimId(key)).set({data:{fingerprint:claimId(key),kind:'event_identity',status:'active',identityKey:key,targetEventId:proposal.primaryId,updatedAt:now}})
      return {applied:true,primaryId:proposal.primaryId,title:proposal.title,linkedRecords:ids.length-1,archiveId,conflicts:proposal.conflicts}
    })
    results.push(result)
  }
  return {ok:results.every(r=>r.applied),stage:'identity_repair',scanned:records.length,appliedGroups:results.filter(r=>r.applied).length,linkedRecords:results.reduce((n,r)=>n+(r.linkedRecords||0),0),remainingGroups:pending.length-results.filter(r=>r.applied).length,results}
}
module.exports={run,plan}
