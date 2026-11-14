// Cache only public raw records. Preferences, lifecycle and ranking stay per request.
function createPublicPoolCache(loader, { ttl = 20000, maxEntries = 12, clock = Date.now } = {}) {
  const entries = new Map()
  return async function load(domain) {
    const key = domain || 'all', now = clock()
    const current = entries.get(key)
    if (current && current.pending) return current.pending
    if (current && now >= current.at && now - current.at < ttl) return current.value
    const entry = {}
    const pending = Promise.resolve().then(() => loader(key)).then(value => {
      // Do not let a temporary failure in an optional query become a cached omission.
      if (value.cacheable === false) {
        if (entries.get(key) === entry) entries.delete(key)
      } else {
        entry.value = value
        entry.at = clock()
        delete entry.pending
      }
      return value
    }, error => {
      if (entries.get(key) === entry) entries.delete(key)
      throw error
    })
    entry.pending = pending
    entries.delete(key)
    if (entries.size >= maxEntries) entries.delete(entries.keys().next().value)
    entries.set(key, entry)
    return pending
  }
}

// Read the first page before scheduling the remaining pages in parallel.
// A short first page still costs one query; a full pool costs at most two rounds.
async function fetchPages(query, maxItems) {
  const limit = Math.max(100, Math.min(600, Number(maxItems) || 300))
  const first = await query(0, Math.min(100, limit))
  const rows = first.data || []
  if (rows.length < 100 || limit <= 100) return { data: rows }
  const pending = []
  for (let offset = 100; offset < limit; offset += 100) pending.push(query(offset, Math.min(100, limit - offset)))
  const pages = await Promise.all(pending)
  const data = rows.slice()
  for (const page of pages) {
    data.push(...(page.data || []))
    if ((page.data || []).length < 100) break
  }
  return { data }
}
module.exports = { createPublicPoolCache, fetchPages }
