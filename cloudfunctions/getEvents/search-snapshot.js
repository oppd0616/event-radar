// Public records only. Cache raw/normalized records, not time-dependent stages.
function createSnapshot(loader, ttl = 20000, clock = Date.now) {
  let snapshot, expires = 0, pending
  return async function getSnapshot() {
    if (snapshot && clock() < expires) return snapshot
    if (pending) return pending
    pending = Promise.resolve().then(loader).then(value => {
      snapshot = value
      expires = clock() + ttl
      return value
    }).finally(() => { pending = null })
    return pending
  }
}
module.exports = { createSnapshot }
