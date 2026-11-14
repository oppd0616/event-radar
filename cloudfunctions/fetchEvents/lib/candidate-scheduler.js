// New discoveries and maintenance get alternating slots; neither can starve.
const admission = require('./discovery-admission')
async function loadQueue(db, status) {
  const rows = []
  for (let skip = 0; skip < 5000; skip += 100) {
    const page = await db.collection('eventCandidates').where({ status })
      .orderBy('_id', 'asc').skip(skip).limit(100).get()
    rows.push(...(page.data || []))
    if (!page.data || page.data.length < 100) return rows
  }
  throw new Error('candidate queue exceeds scan limit; refusing incomplete selection')
}
function select(rows, now) {
  const due = rows.filter(x => !admission.expired(x, now) && ['waiting', 'ready_to_extract'].includes(x.status) && Number(x.nextCheckAt || 0) <= now)
  const discovery = x => x.kind === 'discovery_detail' || !x.targetEventId && x.kind === 'candidate'
  const discoverySlot = Math.floor(now / 1200000) % 2 === 0
  const preferred = due.filter(x => discovery(x) === discoverySlot)
  const pool = preferred.length ? preferred : due
  return pool.slice().sort((a,b) =>
    Number(b.status === 'ready_to_extract') - Number(a.status === 'ready_to_extract') ||
    Number(a.nextCheckAt || 0) - Number(b.nextCheckAt || 0) ||
    Number(a.createdAt || 0) - Number(b.createdAt || 0) || String(a._id).localeCompare(String(b._id)))[0] || null
}
async function inspect(db, now, archiveExpired = false) {
  const rows = (await loadQueue(db, 'waiting')).concat(await loadQueue(db, 'ready_to_extract'))
  if (archiveExpired) {
    for (const item of rows.filter(x => admission.expired(x, now))) {
      await db.runTransaction(async tx => {
        const doc = tx.collection('eventCandidates').doc(item._id)
        const current = await admission.read(doc)
        if (current && admission.expired(current, now) && ['waiting', 'ready_to_extract'].includes(current.status)) {
          await doc.update({ data: { status: 'archived', lastReason: 'discovery_candidate_expired', updatedAt: now } })
        }
      })
    }
  }
  return { rows, selected: select(rows, now) }
}
module.exports = { loadQueue, select, inspect }
