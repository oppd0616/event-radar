// Search intents, not event facts. Festival windows must never become event dates.
const cities = ['北京', '上海', '广州', '深圳', '成都', '杭州', '南京', '武汉', '重庆', '西安', '香港']
const queries = {
  seasonal_event: '节庆限定活动 灯光节 巡游 主题乐园特别夜场 圣诞市集 文旅局或主办方官方日期 场次 地址 预约购票',
  venue_experience: '博物馆夜游 艺术空间特别活动 乐园限定体验 建筑开放日 工作室开放日 场馆官方活动公告 日期 地点 预约',
  creative_workshop: '独立放映 手作工作坊 陶艺体验 城市漫步 创作体验 主办方官方报名 明确场次日期地址 非常年体验套餐'
}
const patterns = {
  seasonal_event: /万圣|萬聖|halloween|哈啰喂|哈囉喂|圣诞|聖誕|christmas|跨年|灯光节|灯会|巡游|巡遊|节庆|乐园|樂園|海洋公园|海洋公園|迪士尼/i,
  venue_experience: /博物馆|博物館|美术馆|美術館|艺术空间|艺术中心|夜游|夜遊|夜宿|乐园|樂園|开放日|開放日|工作室|幕后|幕後/i,
  creative_workshop: /放映|工作坊|手作|陶艺|陶藝|城市漫步|city\s*walk|workshop|创作体验/i
}
function seasonalTerms(now) {
  const month = new Date(now + 8 * 3600000).getUTCMonth() + 1
  if (month === 9 || month === 10) return '万圣节 萬聖節 Halloween 哈囉喂'
  if (month === 11 || month === 12) return '圣诞 聖誕 Christmas 跨年 限定市集'
  if (month <= 2) return '春节 新春 元宵 灯会'
  if (month <= 4) return '春季 花展 赏花 夜游'
  if (month <= 6) return '端午 夏日 限定体验'
  return '夏季 夜游 夜间特别开放'
}
function queryFor(key, city, now) {
  return (queries[key] || '') +
    (key === 'seasonal_event' ? ' 本期重点 ' + seasonalTerms(now) : '') +
    (city === '香港' ? ' 香港 Hong Kong 接受繁体中文及英文官方来源 discoverhongkong.com 场馆官方网站' : '') +
    '；只找有具体日期与公众参与方式的独立活动，不要全年景点门票、普通商户介绍、常年套餐；城市节庆汇总仅用于发现具体活动，不作为一场活动'
}
function matchesCity(text, city) {
  return !city || String(text).includes(city) || (city === '香港' && /\bhong\s*kong\b/i.test(text))
}
module.exports = { cities, queries, patterns, seasonalTerms, queryFor, matchesCity }
