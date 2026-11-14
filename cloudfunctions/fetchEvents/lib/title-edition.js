const { normalizeTitle } = require('./event-identity')
const { detailSearchText } = require('./detail-script')
function chineseNumber(text) {
  if (/^\d+$/.test(text)) return Number(text)
  const digits = {零:0,一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,两:2}
  if (text === '十') return 10
  if (text.includes('十')) { const [a,b] = text.split('十'); return (a ? digits[a] : 1)*10 + (b ? digits[b] : 0) }
  return digits[text]
}
// Matching only: never change displayed titles or existing database hashes.
function titleEdition(value) {
  let text = detailSearchText(value).normalize('NFKC').toLowerCase()
  const editions = []
  text = text.replace(/第([零一二三四五六七八九十两\d]{1,3})届/g, (all,n) => {
    const edition = chineseNumber(n)
    if (!Number.isFinite(edition)) return all
    editions.push(String(edition)); return ' '
  })
  // Numbered conventions/events only, not arbitrary products, dates or times.
  if (/交流|同人|漫展|展览|嘉年华|黑客松|hackathon|festival|con\b|quest|expo|meetup|summit|devfest|大会/i.test(text)) {
    text = text.replace(/\b([a-z][a-z-]{4,})\s*(\d{1,2}(?:\.\d+)?)\b/g, (all,series,n) => {
      editions.push(String(Number(n))); return series + ' '
    })
  }
  return { text: normalizeTitle(text), editions: [...new Set(editions)] }
}
function editionConflict(left, right) {
  return left.editions.length > 1 || right.editions.length > 1 ||
    left.editions.length && right.editions.length && left.editions[0] !== right.editions[0]
}
module.exports = { titleEdition, editionConflict }
