// Optional domestic web-search provider used as a final detail fallback so that
// long-tail and China-only events are covered WITHOUT hand-curating per-event
// sources. It behaves like Exa/Tavily — it returns rawItems-shaped results that
// flow through the unchanged DeepSeek extraction and evidence validation, so the
// evidence chain (evidenceIndex) stays intact.
//
// Enabled only when ZHIPU_API_KEY is set; otherwise every call is a safe no-op.
// Zhipu Web Search API: POST {base}/web_search, returns search_result[] with
// { title, link, content, media, publish_date }. Docs:
// https://docs.bigmodel.cn/api-reference/工具-api/网络搜索
const httpClient = require('./http')

function postJson(url, headers, body, timeoutMs) {
  return httpClient.postJson(url, headers, body, timeoutMs)
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''))
}

function domesticSearchConfigured() {
  return !!process.env.ZHIPU_API_KEY
}

// Returns rawItems-shaped results:
// { title, description, link, pubDate, sourceName, searchScore }
async function callZhipuWebSearch(query, options) {
  const apiKey = process.env.ZHIPU_API_KEY
  if (!apiKey) return []
  const base = String(process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/$/, '')
  const settings = options || {}
  const body = {
    // Zhipu recommends a query of at most 70 characters.
    search_query: String(query || '').replace(/\s+/g, ' ').trim().slice(0, 70),
    search_engine: process.env.ZHIPU_SEARCH_ENGINE || 'search_pro',
    search_intent: false,
    count: Math.max(1, Math.min(50, Number(settings.count) || 10)),
    search_recency_filter: settings.recency || 'noLimit',
    content_size: 'high'
  }
  if (settings.domainFilter) body.search_domain_filter = settings.domainFilter
  const resp = await postJson(base + '/web_search', { Authorization: 'Bearer ' + apiKey }, body, Number(settings.timeoutMs) || 8000)
  const list = resp && Array.isArray(resp.search_result) ? resp.search_result : []
  return list.map((item) => ({
    title: String(item && item.title || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    description: String(item && item.content || '').replace(/\s+/g, ' ').trim().slice(0, Number(settings.maxDescription) || 1600),
    link: item && item.link,
    pubDate: item && item.publish_date || '',
    sourceName: String(item && item.media || '').trim().slice(0, 40),
    searchScore: 0
  })).filter((item) => item.title && isHttpUrl(item.link))
}

module.exports = { callZhipuWebSearch, domesticSearchConfigured }
