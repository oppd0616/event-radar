// Session-only cache: no personalized feed is left on disk or shared by users.
const TTL = 90000
let epoch = 0
const entries = new Map()
function key(domain, sort, preferences) { return JSON.stringify([domain, sort, preferences]) }
function read(id, now = Date.now()) {
  const entry = entries.get(id)
  if (!entry || now - entry.at > TTL || now < entry.at) { entries.delete(id); return null }
  return entry.response
}
function write(id, response, version, now = Date.now()) {
  if (version !== epoch) return
  if (entries.size >= 8) entries.delete(entries.keys().next().value)
  entries.set(id, { response, at: now })
}
function invalidate() { epoch += 1; entries.clear() }
module.exports = { key, read, write, invalidate, version: () => epoch }
