// Stable source families, never edition-specific event URLs. This registry is
// used for ranking and confidence only; unknown sources remain discoverable.
const { OFFICIAL_HOSTS_BY_DOMAIN } = require('./official-sources')

const OFFICIAL_PATH_HOSTS = ['gov.cn', 'edu.cn']
const TICKETING_HOSTS = ['damai.cn', 'maoyan.com', 'showstart.com', 'piaoxingqiu.com',
  'mall.bilibili.com', 'show.bilibili.com']
const PLATFORM_HOSTS = ['bilibili.com']
const VERTICAL_PLATFORM_AUTHORITY = {
  // Registration/organizer infrastructure: strongest non-official evidence.
  'cc.moocollege.com': 74,
  'mararun.com': 72,
  // High-coverage vertical discovery and detail platforms.
  'saikr.com': 68, 'huodongxing.com': 68, 'huodongjia.com': 68, 'bagevent.com': 68,
  'events.waytoagi.com': 68, 'segmentfault.com': 68, 'luma.com': 68,
  'zuicool.com': 68, 'chinamarathon.com': 68, 'wanplus.cn': 68,
  'nyato.com': 68, 'yunmanzhan.com': 68, 'bitauto.com': 68, 'autohome.com.cn': 68,
  'museum.cn': 68, 'damcaanet.cn': 68, 'zhanwei.cn': 68,
  // Useful aggregators, deliberately below the platforms above.
  'vart.cc': 66, '51sai.com': 65, '52jingsai.com': 60
}
const LOW_TRUST_HOSTS = [
  'wikipedia.org', 'baike.baidu.com', 'huanghepiao.com', 'sershow.com',
  'douyin.com', 'weibo.com', 'xiaohongshu.com'
]

function hostnameOf(url) {
  try { return new URL(String(url || '')).hostname.toLowerCase().replace(/^www\./, '') }
  catch (error) { return '' }
}

function hostMatches(host, expected) {
  return host === expected || host.endsWith('.' + expected)
}

function classifySource(url, domain) {
  const host = hostnameOf(url)
  if (!host) return { tier: 'unknown', authority: 0 }
  const officialHosts = OFFICIAL_HOSTS_BY_DOMAIN[domain] || []
  if (TICKETING_HOSTS.some((item) => hostMatches(host, item))) {
    return { tier: 'ticketing', authority: 78 }
  }
  if (PLATFORM_HOSTS.some((item) => hostMatches(host, item))) {
    return { tier: 'platform', authority: 65 }
  }
  const verticalHost = Object.keys(VERTICAL_PLATFORM_AUTHORITY).find((item) => hostMatches(host, item))
  if (verticalHost) {
    return { tier: 'vertical', authority: VERTICAL_PLATFORM_AUTHORITY[verticalHost] }
  }
  if (officialHosts.some((item) => hostMatches(host, item))) {
    return { tier: 'official', authority: 100 }
  }
  if (OFFICIAL_PATH_HOSTS.some((item) => hostMatches(host, item))) {
    return { tier: 'institutional', authority: 90 }
  }
  if (LOW_TRUST_HOSTS.some((item) => hostMatches(host, item))) {
    return { tier: 'aggregator', authority: 20 }
  }
  return { tier: 'web', authority: 50 }
}

function rankSources(items, domain) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const quality = classifySource(item && item.link, domain)
    return Object.assign({}, item, {
      sourceTier: quality.tier,
      sourceAuthority: quality.authority,
      _sourceOrder: index
    })
  }).sort((left, right) =>
    Number(right.sourceAuthority || 0) - Number(left.sourceAuthority || 0) ||
    Number(right.searchScore || 0) - Number(left.searchScore || 0) ||
    Number(left._sourceOrder || 0) - Number(right._sourceOrder || 0)
  ).map((item) => {
    const clean = Object.assign({}, item)
    delete clean._sourceOrder
    return clean
  })
}

module.exports = { OFFICIAL_HOSTS_BY_DOMAIN, classifySource, rankSources }
