// Activity forms are independent of interest domains. This selects a query
// intent, not a publication exemption: dates, venue and access still need evidence.
const DOMAIN_SUBJECTS = {
  tech: '科技数码品牌 产品互动体验',
  auto: '汽车品牌 主题体验 试驾',
  finance: '金融科技品牌 公众互动体验',
  ent: '艺人 音乐 影视IP 主题活动',
  culture: '消费品牌 文创IP 城市主题活动',
  game: '游戏IP 玩家活动',
  sports: '体育赛事 球队 运动品牌 球迷活动',
  anime: '动漫IP 谷子 潮玩 主题活动',
  academic: '高校 校园 科技文化 公众体验'
}
const EXPERIENCE_PATTERN = /(快闪|概念网吧|概念游戏网吧|主题网吧|体验空间|联名空间|主题空间|主题店|限时体验|联名体验|玩家派对|玩家活动|球迷活动|主题体验|gaming\s*caf[eé]|pop[- ]?up)/i
function isExperience(event) { return EXPERIENCE_PATTERN.test(String(event && event.title || '')) }
function experienceIntent(domain, topic, target, now) {
  if (!DOMAIN_SUBJECTS[domain]) return false
  if (topic === 'fashion_design') return false
  if (domain === 'tech' && ['developer', 'hackathon', 'open_source'].includes(topic)) return false
  if (['ip_popup', 'brand_popup'].includes(topic)) return true
  if (target && isExperience({ title: target })) return false // Already a specific event: keep its identity query.
  // Do not replace exam/competition, specific festival, tournament or show queries.
  if (domain === 'academic' || (target && /(赛|考试|展览会|音乐节|电影节|戏剧节|演唱会|发布会|大会|论坛|巡演|marathon|champions|masters)/i.test(target))) return false
  if (domain === 'game' && target && ['game_expo', 'console'].includes(topic)) return false
  if (domain === 'game' && target) return true
  const day = Math.floor((now + 8 * 3600000) / 86400000)
  const offset = Object.keys(DOMAIN_SUBJECTS).indexOf(domain)
  return (day + offset) % 4 === 0
}
function experienceQuery(domain) {
  return (DOMAIN_SUBJECTS[domain] || '') + ' 联名快闪 限时体验 概念店 ' +
    (domain === 'game' ? '概念网吧 ' : '') + '主题空间 官方活动日期 地点 预约 到店参与'
}
module.exports = { isExperience, experienceIntent, experienceQuery }
