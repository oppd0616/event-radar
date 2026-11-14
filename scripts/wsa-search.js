// Standalone Tencent Cloud WSA (联网搜索API) SearchPro runner.
//
// Uses the standard Tencent Cloud TC3-HMAC-SHA256 signature with your
// SecretId/SecretKey. Mirrors the documented SearchPro interface:
//   host    : wsa.tencentcloudapi.com
//   Action  : SearchPro
//   Version : 2025-05-08
//   params  : Query (req), Mode, Site, FromTime, ToTime
//
// Key is read from process.env.TENCENTCLOUD_SECRET_ID / _SECRET_KEY or a local
// .env file. The key is NEVER printed.

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function loadEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return
  const text = fs.readFileSync(envPath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnvFile()

const secretId = process.env.TENCENTCLOUD_SECRET_ID
const secretKey = process.env.TENCENTCLOUD_SECRET_KEY
const service = 'wsa'
const host = 'wsa.tencentcloudapi.com'
const action = 'SearchPro'
const version = '2025-05-08'

// Parse args
const positional = []
const opts = { mode: 0, site: '', from: '', to: '' }
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a === '--mode') opts.mode = Number(process.argv[++i]) || 0
  else if (a === '--site') opts.site = process.argv[++i] || ''
  else if (a === '--from') opts.from = process.argv[++i] || ''
  else if (a === '--to') opts.to = process.argv[++i] || ''
  else positional.push(a)
}
const query = positional.join(' ').trim()

function fail(msg) { console.error('✗ ' + msg); process.exit(1) }
if (!secretId || !secretKey) fail('未检测到 TENCENTCLOUD_SECRET_ID / _SECRET_KEY（写入项目根 .env）')
if (!query) fail('缺少查询词。例：node scripts/wsa-search.js "KPL 2026 总决赛 赛程"')

function sha256hex(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex') }
function hmac(key, s) { return crypto.createHmac('sha256', key).update(s, 'utf8').digest() }

function buildAuthorization(payload, timestamp) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10) // UTC YYYY-MM-DD
  const ct = 'application/json; charset=utf-8'
  const hashedPayload = sha256hex(payload)
  const canonicalHeaders =
    'content-type:' + ct + '\n' +
    'host:' + host + '\n' +
    'x-tc-action:' + action.toLowerCase() + '\n' +
    'x-tc-timestamp:' + timestamp + '\n'
  const signedHeaders = 'content-type;host;x-tc-action;x-tc-timestamp'
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, hashedPayload].join('\n')
  const credentialScope = date + '/' + service + '/tc3_request'
  const stringToSign = ['TC3-HMAC-SHA256', String(timestamp), credentialScope, sha256hex(canonicalRequest)].join('\n')
  const secretDate = hmac('TC3' + secretKey, date)
  const secretService = hmac(secretDate, service)
  const secretSigning = hmac(secretService, 'tc3_request')
  const signature = hmac(secretSigning, stringToSign).toString('hex')
  return 'TC3-HMAC-SHA256 Credential=' + secretId + '/' + credentialScope +
    ', SignedHeaders=' + signedHeaders + ', Signature=' + signature
}

const params = { Query: query, Mode: opts.mode }
if (opts.site) params.Site = opts.site
if (opts.from) params.FromTime = Number(opts.from)
if (opts.to) params.ToTime = Number(opts.to)
const payload = JSON.stringify(params)
const timestamp = Math.floor(Date.now() / 1000)
const authorization = buildAuthorization(payload, timestamp)

console.error('→ WSA SearchPro 请求')
console.error('  host   : ' + host)
console.error('  action : ' + action + '  v' + version)
console.error('  query  : ' + query + (opts.site ? '  [site=' + opts.site + ']' : ''))
console.error('  secretId: ' + secretId.slice(0, 8) + '****')
console.error('')

;(async () => {
  try {
    const resp = await fetch('https://' + host, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json; charset=utf-8',
        'Host': host,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Timestamp': String(timestamp)
      },
      body: payload
    })
    const raw = await resp.text()
    console.error('← HTTP ' + resp.status)
    let data
    try { data = JSON.parse(raw) } catch (e) { data = null }
    if (!resp.ok || !data || data.Response && data.Response.Error) {
      const err = data && data.Response && data.Response.Error
      fail('HTTP ' + resp.status + ' — ' + (err ? (err.Code + ': ' + err.Message) : raw.slice(0, 400)))
    }
    const r = data.Response || data
    const reqId = r.RequestId || '-'
    // WSA SearchPro returns Response.Pages = array of JSON *strings*.
    let items = []
    if (Array.isArray(r.Pages)) {
      items = r.Pages.map((s, i) => {
        try { return typeof s === 'string' ? JSON.parse(s) : s }
        catch (e) { return { title: '(unparsed #' + i + ')', passage: String(s) } }
      })
    } else {
      for (const k of ['Results', 'Data', 'Items', 'List']) {
        if (Array.isArray(r[k])) { items = r[k]; break }
      }
    }
    if (!items.length && Array.isArray(r)) items = r

    console.error('  RequestId: ' + reqId)
    console.error('  result count (heuristic): ' + items.length)
    console.error('')

    // Print raw (truncated) so we can confirm the real field names.
    console.error('===== RAW RESPONSE (first 2500 chars) =====')
    console.error(raw.slice(0, 2500))
    console.error('')

    if (items.length) {
      console.log('===== PARSED ITEMS =====')
      for (const it of items) {
        const title = it.Title || it.title || ''
        const url = it.Url || it.url || it.Href || it.href || ''
        const snippet = it.Content || it.content || it.Passage || it.passage || it.Snippet || it.snippet || ''
        const site = it.Site || it.site || ''
        const date = it.PublishTime || it.publishTime || it.Date || it.date || ''
        console.log('• ' + title)
        console.log('  链接: ' + url)
        if (site) console.log('  来源: ' + site)
        if (date) console.log('  时间: ' + date)
        console.log('  摘要: ' + String(snippet).replace(/\s+/g, ' ').trim().slice(0, 300))
        console.log('')
      }
    }
  } catch (e) {
    fail('请求异常: ' + (e && e.message))
  }
})()
