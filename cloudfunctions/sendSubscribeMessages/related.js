const DOMAIN_NEIGHBORS = {
  tech: ['auto', 'finance', 'game', 'academic'],
  auto: ['tech', 'finance', 'sports'],
  finance: ['tech', 'auto', 'academic'],
  ent: ['culture', 'game', 'anime'],
  culture: ['ent', 'game', 'anime'],
  game: ['tech', 'ent', 'culture', 'anime', 'academic'],
  sports: ['auto', 'culture', 'academic'],
  anime: ['game', 'ent', 'culture'],
  academic: ['tech', 'finance', 'game', 'sports']
}

const TOPIC_AXES = {
  ai_data: ['人工智能', 'ai', '大模型', '机器学习', '数据科学', '算法'],
  smart_mobility: ['自动驾驶', '智能驾驶', 'robotaxi', '新能源', '换电'],
  digital_finance: ['金融科技', '数字资产', '区块链', '比特币', 'bitcoin', 'web3', '加密支付'],
  innovation: ['创新创业', '创业', '开发者', '黑客松'],
  gaming: ['游戏展', '电竞', '新游', '实机', '游戏'],
  live_music: ['演唱会', '巡演', '音乐节', '乐队', '歌手'],
  film_theatre: ['电影节', '影展', '展映', '首映', '路演', '点映', '话剧', '音乐剧', '舞剧', '戏剧节', '沉浸式戏剧'],
  city_culture: ['艺术展', '画展', '快闪', '首店', '咖啡', '甜品', '酒吧', '夜生活', '市集', '沉浸体验'],
  sports: ['足球', '篮球', '羽毛球', '乒乓球', '网球', '马拉松', '路跑', '骑行', '滑雪', '高校联赛'],
  anime: ['漫展', '动漫', '二次元', 'ip快闪', '谷子', '手办', 'cosplay', '卡牌', 'tcg', '声优', '同人展'],
  growth_deadline: ['四六级', '普通话', '教师资格', '计算机等级', '考研', '国考', '选调生', '校招', '秋招', '实习', '宣讲会', '双选会']
}

function axesOf(title, summary, tags) {
  const text = [title, summary].concat(tags || []).join(' ').toLowerCase()
  return Object.keys(TOPIC_AXES).filter((axis) => TOPIC_AXES[axis].some((term) => text.indexOf(term) >= 0))
}

function matchRadar(radar, event) {
  const anchorTags = (radar.anchorTags || []).map((tag) => String(tag).toLowerCase())
  const eventTags = (event.tags || []).map((tag) => String(tag).toLowerCase())
  const shared = anchorTags.filter((tag) => eventTags.indexOf(tag) >= 0)
  const anchorAxes = radar.anchorAxes || axesOf(radar.anchorEventTitle, radar.anchorSummary, radar.anchorTags)
  const sharedAxes = anchorAxes.filter((axis) => axesOf(event.title, event.summary, event.tags).indexOf(axis) >= 0)
  const sameDomain = radar.anchorDomain === event.domain
  const adjacent = (DOMAIN_NEIGHBORS[radar.anchorDomain] || []).indexOf(event.domain) >= 0
  if (!sameDomain && !shared.length && !sharedAxes.length) return null
  let score = sameDomain ? 0.55 : (adjacent ? 0.12 : 0)
  score += Math.min(0.36, shared.length * 0.18)
  score += Math.min(0.3, sharedAxes.length * 0.3)
  if (radar.anchorParticipationType && radar.anchorParticipationType === (event.participation || {}).type) score += 0.06
  score += Math.min(0.1, Number(event.confidence) || 0)
  if (event.isHot) score += 0.03
  const threshold = radar.discoveryMode === 'precise' ? 0.55 : 0.28
  if (score < threshold) return null
  if (shared.length) return '与你关注的“' + shared[0] + '”相关'
  if (sameDomain) return '与你关注的活动同领域'
  return '由共同主题拓展到相邻领域'
}

module.exports = { matchRadar }
