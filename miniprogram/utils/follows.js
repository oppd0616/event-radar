function isFollowed(event, records) {
  const ids = [event._id,event.canonicalEventId].concat(event.identityMembers || []).filter(Boolean)
  return (records || []).some(r => ids.some(id => (r.refs || [r.eventId]).indexOf(id) >= 0))
}
// Apply a confirmed write immediately; a second status request is unnecessary.
function updateFollowRecords(event, records, following, eventId) {
  const id = eventId || event._id
  const refs = [id, event._id, event.canonicalEventId].concat(event.identityMembers || []).filter(Boolean)
  const next = (records || []).filter(record => {
    const match = isFollowed(event, [record]) || (record.refs || [record.eventId]).includes(id)
    if (match) refs.push(...(record.refs || [record.eventId]).filter(Boolean))
    return !match
  })
  if (following) next.push({ eventId: id, refs: [...new Set(refs)] })
  return next
}
module.exports = { isFollowed, updateFollowRecords }
