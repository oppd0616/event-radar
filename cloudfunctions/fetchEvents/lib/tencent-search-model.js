// Tencent Cloud TokenHub DeepSeek web-search adapter.
//
// The model answer is deliberately NOT treated as evidence. Only the URLs and
// snippets returned in message.search_results are converted into raw evidence
// items, so the existing extraction and evidenceIndex validation remain the
// authority for database writes.
const httpClient = require('./http')

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''))
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function tokenHubConfigured() {
  return !!process.env.TENCENT_TOKENHUB_API_KEY
}

function citedClaimsFor(answer, citationIndex) {
  const marker = Number(citationIndex)
  if (!marker || !answer) return []
  const pattern = new RegExp('(?:\\[' + marker + '\\]|【' + marker + '】)')
  return String(answer)
    .split(/(?<=[。！？!?；;])|\n+/)
    .map((part) => cleanText(part, 600))
    .filter((part) => part && pattern.test(part))
    .slice(0, 4)
}

async function callTencentWebSearch(query, options) {
  const apiKey = process.env.TENCENT_TOKENHUB_API_KEY
  if (!apiKey) return { items: [], provider: '', searchCalls: 0, requestId: '' }

  const settings = options || {}
  const base = String(process.env.TENCENT_TOKENHUB_BASE_URL || 'https://tokenhub.tencentmaas.com/v1').replace(/\/$/, '')
  const model = process.env.TENCENT_TOKENHUB_MODEL || 'deepseek-v4-flash'
  const requestedSearchSource = String(settings.searchSource || process.env.TENCENT_SEARCH_SOURCE || '')
  const searchSource = /^(lite|standard)$/.test(requestedSearchSource)
    ? requestedSearchSource
    : 'lite'
  // TokenHub's current DeepSeek Chat endpoint rejects `no_think` even though
  // parts of the generic web-search documentation mention it. Keep the value
  // inside the model endpoint's actual allow-list so a stale environment value
  // cannot make the whole fallback fail.
  const configuredEffort = String(process.env.TENCENT_REASONING_EFFORT || '').toLowerCase()
  const reasoningEffort = /^(low|medium|high|xhigh|max)$/.test(configuredEffort)
    ? configuredEffort
    : 'low'
  const location = {
    type: 'approximate',
    country: 'CN',
    region: cleanText(settings.region || settings.city || '', 40),
    city: cleanText(settings.city || '', 40),
    timezone: 'Asia/Shanghai'
  }
  if (!location.region) delete location.region
  if (!location.city) delete location.city

  const body = {
    model,
    stream: false,
    reasoning_effort: reasoningEffort,
    messages: [
      {
        role: 'system',
        content: [
          '你是活动信息检索助手，必须联网搜索后回答',
          '优先查找主办方官网、赛事官网、官方售票平台和官方认证账号',
          '分别核对活动日期、具体时分、场馆、售票时间以及每个赛程阶段',
          '不要把文章发布日期、开票时间或直播预约时间当作活动开始时间',
          '所有事实都必须引用搜索来源，不确定的信息明确说明未知',
          '按活动阶段逐项回答日期、时分、城市和场馆，每项事实后紧跟引用编号如[1]',
          '数据库候选日期可能错误，不得把用户提供的日期当作来源证据'
        ].join('；')
      },
      { role: 'user', content: cleanText(query, 500) }
    ],
    web_search_options: {
      enable: true,
      search_source: searchSource,
      user_location: location
    },
    max_tokens: Math.max(400, Math.min(1800, Number(settings.maxTokens) || 900))
  }

  const response = await httpClient.postJson(
    base + '/chat/completions',
    { Authorization: 'Bearer ' + apiKey },
    body,
    Math.max(8000, Math.min(50000, Number(settings.timeoutMs) || 40000))
  )
  const choice = response && Array.isArray(response.choices) ? response.choices[0] : null
  const message = choice && choice.message || {}
  const results = Array.isArray(message.search_results) ? message.search_results : []
  const answer = cleanText(message.content, 8000)
  const limit = Math.max(1, Math.min(12, Number(settings.count) || 8))
  const seen = new Set()
  const items = results.map((item, resultIndex) => ({
    title: cleanText(item && (item.name || item.title), 120),
    description: cleanText(item && (item.snippet || item.content), Number(settings.maxDescription) || 1800),
    link: item && (item.url || item.link),
    pubDate: item && (item.publish_date || item.published_date) || '',
    sourceName: cleanText(item && (item.site || item.media), 40) || 'Tencent TokenHub',
    searchScore: 0,
    citationIndex: Number(item && item.index) || resultIndex + 1,
    citedClaims: citedClaimsFor(answer, Number(item && item.index) || resultIndex + 1)
  })).filter((item) => {
    if (!item.title || !isHttpUrl(item.link)) return false
    const key = String(item.link).replace(/#.*$/, '').replace(/\/$/, '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, limit)

  return {
    items,
    provider: 'tencent_tokenhub',
    model,
    searchSource,
    searchCalls: Number(response && response.usage && response.usage.tool_usage && response.usage.tool_usage.web_search_call) || 0,
    requestId: String(response && (response.id || response.request_id) || ''),
    // Diagnostic only. Never pass this answer into the evidence extractor.
    answerReturned: !!answer,
    answerPreview: answer.slice(0, 1200),
    citedClaimCount: items.reduce((count, item) => count + item.citedClaims.length, 0)
  }
}

module.exports = { callTencentWebSearch, tokenHubConfigured }
