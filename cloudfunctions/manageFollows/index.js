const cloud = require('wx-server-sdk'), crypto = require('crypto')
const { refs, matches, snapshot, ended, plan, agenda, compareAgenda } = require('./model')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
async function detail(id) {
  const res = await cloud.callFunction({ name: 'getEvents', data: { id } })
  return res.result && res.result.event
}
async function resolve(id) {
  const seen = new Set()
  while (id && !seen.has(id) && seen.size < 8) {
    seen.add(id)
    const r = await db.collection('events').doc(id).get().catch(error => {
      if (Number(error.errCode) === -502005 || /not exist|not found/i.test(error.message || '')) return null
      throw error
    })
    if (!r || !r.data) return null
    if (r.data.status !== 'merged') return r.data
    id = r.data.mergedInto
  }
  return null
}
async function mapLimit(rows, fn) {
  const result = []
  for (let i=0;i<rows.length;i+=5) result.push(...await Promise.all(rows.slice(i,i+5).map(fn)))
  return result
}
exports.main = async (input = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { error: 'login required' }
  const action = input.action || 'status'
  if (!['status','list','set','seen','intent'].includes(action)) return { error: 'invalid action' }
  const users = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
  const user = users.data[0]
  const records = user && Array.isArray(user.eventFollows) ? user.eventFollows : []
  if (action === 'status') return { records: await mapLimit(records, async r => {
    const current = await resolve(r.eventId)
    return { eventId:r.eventId,refs:[...new Set((r.refs || [r.eventId]).concat(current ? refs(current) : []))] }
  }) }
  if (action === 'list') {
    const now = Date.now(), filter = ['all','ended'].includes(input.filter) ? input.filter : 'active'
    const resolved = await mapLimit(records, async record => {
      const event=await resolve(record.eventId)
      return {record,event,agenda:agenda(event,now)}
    })
    const seen = new Set()
    const eligible = resolved.filter(row => {
      const e = row.event, key = e && (e.canonicalEventId || e._id)
      if (key && seen.has(key)) return false
      if (key) seen.add(key)
      if (input.intent === 'planned' && row.record.intent !== 'planned') return false
      return filter === 'all' || (filter === 'ended' ? e && ended(e,now) : !e || !ended(e,now))
    }).sort(compareAgenda)
    const cursor = Math.max(0,Math.floor(Number(input.cursor)||0)), size = 12
    const list = await mapLimit(eligible.slice(cursor,cursor+size), async ({record,event}) => {
      const current = event && event.status === 'published' ? await detail(event._id) : null
      return { event: current, eventId: record.eventId, title: record.title, intent:record.intent === 'planned' ? 'planned' : 'interested', plan:plan(current,now), agenda:agenda(current,now), unavailable: !current, hasUpdate: !!current && record.snapshot !== snapshot(current), snapshot: current ? snapshot(current) : '', followedAt: record.followedAt }
    })
    return { list, total: eligible.length, nextCursor: cursor+size<eligible.length ? cursor+size : null, serverTime: now }
  }
  if (typeof input.eventId !== 'string' || input.eventId.length > 128 || !input.eventId) return { error: 'invalid event' }
  if (action === 'set' && typeof input.following !== 'boolean') return { error: 'following must be boolean' }
  if (action === 'intent' && !['interested','planned'].includes(input.intent)) return {error:'invalid intent'}
  const event = await detail(input.eventId)
  if ((!event && ['seen','intent'].includes(action)) || (!event && input.following)) return { error: 'event unavailable' }
  const target = event || { _id: input.eventId }
  const equivalent = new Set([input.eventId])
  await mapLimit(records, async record => {
    if (matches(record,target)) { equivalent.add(record.eventId); return }
    const current = await resolve(record.eventId)
    if (current && refs(current).some(id => refs(target).includes(id))) equivalent.add(record.eventId)
  })
  const userId = user ? user._id : 'user-'+crypto.createHash('sha256').update(OPENID).digest('hex').slice(0,32)
  await db.runTransaction(async transaction => {
    const ref = transaction.collection('users').doc(userId)
    const existing = await ref.get().catch(error => {
      if (Number(error.errCode) === -502005 || /not exist|not found/i.test(error.message || '')) return null
      throw error
    })
    const data = existing && existing.data
    if (data && data._openid !== OPENID) throw Error('user mismatch')
    const current = data && Array.isArray(data.eventFollows) ? data.eventFollows : []
    const match = r => matches(r,target) || equivalent.has(r.eventId)
    const hit = current.find(match)
    let next = current.filter(r => !match(r))
    if (action === 'intent') {
      if (!hit) throw Error('请先关注这个活动')
      next.push(Object.assign({},hit,{eventId:event._id,intent:input.intent}))
    } else if (action === 'seen') {
      if (!hit) return
      // Only acknowledge the version actually rendered to the user.
      if (input.snapshot !== snapshot(event)) return
      next.push(Object.assign({},hit,{eventId:event._id,refs:[...new Set(refs(event).concat(hit.refs || [hit.eventId]))],snapshot:input.snapshot}))
    } else if (input.following) {
      if (next.length >= 100) throw Error('最多关注100个活动，请先取消部分关注')
      next.push({ eventId:event._id,refs:[...new Set(refs(event).concat(hit ? hit.refs || [hit.eventId] : [input.eventId]))],title:event.title,intent:hit && hit.intent === 'planned' ? 'planned' : 'interested',followedAt:hit ? hit.followedAt : Date.now(),snapshot:hit ? hit.snapshot : snapshot(event) })
    }
    if (data) await ref.update({ data:{eventFollows:next} })
    else await ref.set({ data:{_openid:OPENID,eventFollows:next,createdAt:Date.now()} })
  })
  return { ok:true, following:['seen','intent'].includes(action) ? true : input.following, ...(action === 'intent' ? {intent:input.intent} : {}),eventId:target._id }
}
