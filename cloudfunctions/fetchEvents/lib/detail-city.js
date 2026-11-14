const { normalizeTitle } = require('./event-identity')
const { detailSearchText } = require('./detail-script')

function normalizeCity(value) {
  return normalizeTitle(detailSearchText(value))
    .replace(/臺/g, '台')
    .replace(/愛/g, '爱')
    .replace(/縣/g, '县')
    .replace(/線上/g, '线上')
    .replace(/^(?:中华人民共和国|中国)(?=.{2,})/, '')
    .replace(/^.{2,12}(?:省|县|県|州)(?=.{2,})/, '')
    .replace(/^(.{2,12}?)市.+$/, '$1')
    .replace(/(?:特别行政区|市)$/, '')
}

function sameCity(left, right) {
  if (!left || !right) return true
  const a = normalizeCity(left)
  const b = normalizeCity(right)
  if (/^(待定|待公布|待官宣|未知|未公布|tbd)$/.test(a)) return true
  // Compare complete city sets, never just a shared city: a parent tournament
  // and one of its city stations must not become interchangeable.
  const cities=value=>[...new Set(String(value).split(/[、/，,;；|]/).map(normalizeCity).filter(Boolean))].sort()
  const leftCities=cities(left),rightCities=cities(right)
  if(leftCities.length>1 || rightCities.length>1)return leftCities.length===rightCities.length && leftCities.every((city,index)=>city===rightCities[index])
  return Boolean(a && b && a === b)
}

module.exports = { normalizeCity, sameCity }
