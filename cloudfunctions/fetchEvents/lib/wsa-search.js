const http = require('./http')
const crypto = require('crypto')

const WSA_HOST = 'wsa.tencentcloudapi.com'
const WSA_SERVICE = 'wsa'
const WSA_ACTION = 'SearchPro'
const WSA_VERSION = '2025-05-08'
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding)
}

function utcDate(timestamp) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

function buildTc3Headers(payload, secretId, secretKey, timestamp) {
  const requestTimestamp = Number(timestamp) || Math.floor(Date.now() / 1000)
  const date = utcDate(requestTimestamp)
  const canonicalHeaders = 'content-type:' + JSON_CONTENT_TYPE + '\n' + 'host:' + WSA_HOST + '\n'
  const signedHeaders = 'content-type;host'
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256(payload)
  ].join('\n')
  const credentialScope = date + '/' + WSA_SERVICE + '/tc3_request'
  const stringToSign = [
    'TC3-HMAC-SHA256',
    requestTimestamp,
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n')
  const secretDate = hmac('TC3' + secretKey, date)
  const secretService = hmac(secretDate, WSA_SERVICE)
  const secretSigning = hmac(secretService, 'tc3_request')
  const signature = hmac(secretSigning, stringToSign, 'hex')
  return {
    Authorization: 'TC3-HMAC-SHA256 Credential=' + secretId + '/' + credentialScope +
      ', SignedHeaders=' + signedHeaders + ', Signature=' + signature,
    'Content-Type': JSON_CONTENT_TYPE,
    Host: WSA_HOST,
    'X-TC-Action': WSA_ACTION,
    'X-TC-Version': WSA_VERSION,
    'X-TC-Timestamp': String(requestTimestamp),
    'X-TC-Language': 'zh-CN'
  }
}

function authMode() {
  if (process.env.WSA_SECRET_ID && process.env.WSA_SECRET_KEY) return 'ak_sk'
  if (process.env.WSA_API_KEY) return 'service_api_key'
  return ''
}

function parseResponse(response) {
  const result = response && (response.Response || response)
  if (!result || result.Error) {
    const error = result && result.Error
    const details = error ? [error.Code, error.Message].filter(Boolean).join(': ') : 'invalid response'
    const requestId = result && result.RequestId ? ' [' + result.RequestId + ']' : ''
    throw new Error('WSA: ' + details + requestId)
  }
  if (!Array.isArray(result.Pages)) throw new Error('WSA: missing Pages')
  const seen = new Set()
  const items = []
  for (const page of result.Pages) {
    let row
    try { row = typeof page === 'string' ? JSON.parse(page) : page } catch (_) { continue }
    if (!row || !row.title || !/^https?:\/\//i.test(row.url || '')) continue
    const key = row.url.replace(/#.*$/, '')
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ title: String(row.title).replace(/\uFFFD+/g, ' ').slice(0, 200), link: row.url,
      description: Array.from(new Set([row.content, row.passage].filter(Boolean))).join('\n').replace(/\uFFFD+/g, ' ').replace(/<[^>]*>/g, ' ').slice(0, 12000),
      pubDate: row.date || '', sourceName: row.site || new URL(row.url).hostname,
      searchScore: Number(row.score) || 0, searchProvider: 'tencent_wsa' })
  }
  return { items, provider: 'tencent_wsa', version: result.Version || '', requestId: result.RequestId || '' }
}

async function search(query, site) {
  const body = { Query: String(query).slice(0, 500), Mode: 0 }
  if (site) body.Site = site
  const mode = authMode()
  let response
  if (mode === 'ak_sk') {
    const payload = JSON.stringify(body)
    const headers = buildTc3Headers(payload, process.env.WSA_SECRET_ID, process.env.WSA_SECRET_KEY)
    response = await http.postJson('https://' + WSA_HOST + '/', headers, body, 15000)
  } else if (mode === 'service_api_key') {
    response = await http.postJson('https://api.wsa.cloud.tencent.com/SearchPro',
      { Authorization: 'Bearer ' + process.env.WSA_API_KEY }, body, 15000)
  } else {
    throw new Error('WSA credentials are missing')
  }
  return Object.assign(parseResponse(response), { authMode: mode })
}

async function probe(target) {
  const queries = [target + ' 赛程 开始日期 结束日期 场馆', target + ' 开票时间 官方售票 票价']
  const results = await Promise.allSettled(queries.map((query) => search(query)))
  return { ok: results.every((r) => r.status === 'fulfilled'), stage: 'wsa_search_probe',
    authMode: authMode() || 'missing', writes: 0,
    results: results.map((r, i) => r.status === 'fulfilled'
      ? Object.assign({ query: queries[i], retrieved: r.value.items.length }, r.value)
      : { query: queries[i], error: r.reason.message }) }
}

module.exports = { search, probe, parseResponse, authMode, buildTc3Headers }
