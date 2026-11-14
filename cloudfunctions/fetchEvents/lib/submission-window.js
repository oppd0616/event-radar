function chinaDay(timestamp) {
  return new Date(Number(timestamp) + 8 * 3600000).toISOString().slice(0, 10)
}

function parseChineseDay(value, defaultYear) {
  const match = String(value || '').match(/(?:(20\d{2})年)?\s*(1[0-2]|[1-9])月\s*(3[01]|[12]\d|[1-9])日/)
  if (!match) return null
  const year = Number(match[1]) || Number(defaultYear)
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.parse(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+08:00`)
  if (!Number.isFinite(timestamp) || chinaDay(timestamp) !== `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`) return null
  return { year, timestamp }
}

function windowsFromText(text, defaultYear) {
  const clauses = String(text || '').normalize('NFKC').split(/[。｡；;\n]/)
  const windows = []
  const range = /((?:20\d{2}年)?\s*(?:1[0-2]|[1-9])月\s*(?:3[01]|[12]\d|[1-9])日)\s*(?:至|到|—|–|-|~|～)\s*((?:20\d{2}年)?\s*(?:1[0-2]|[1-9])月\s*(?:3[01]|[12]\d|[1-9])日)/g
  for (const clause of clauses) {
    if (!/征稿|投稿|作品提交|提交作品|提交期間|提交期间/.test(clause)) continue
    for (const match of clause.matchAll(range)) {
      const start = parseChineseDay(match[1], defaultYear)
      const end = parseChineseDay(match[2], start && start.year || defaultYear)
      if (!start || !end || end.timestamp < start.timestamp) continue
      const localContext = clause.slice(Math.max(0, match.index - 18), match.index)
      const seasons = Array.from(localContext.matchAll(/上赛季|下赛季|第一阶段|第二阶段|第[一二三四五六\d]+期/g))
      windows.push({
        startTime: start.timestamp,
        endTime: end.timestamp,
        season: seasons.length ? seasons[seasons.length - 1][0] : '',
        sourceText: clause.trim().slice(0, 180)
      })
    }
  }
  return windows
}

function windowEndingOn(windows, timestamp) {
  if (!Number.isFinite(Number(timestamp))) return null
  const day = chinaDay(timestamp)
  const matching = (windows || []).filter((item) => chinaDay(item.endTime) === day)
  const periods = new Set(matching.map((item) => item.startTime + '|' + item.endTime))
  if (periods.size !== 1) return null
  return matching.find((item) => item.season) || matching[0] || null
}

module.exports = { windowsFromText, windowEndingOn }
