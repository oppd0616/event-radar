// Standalone one-shot Tencent TokenHub web-search runner.
//
// Mirrors cloudfunctions/fetchEvents/lib/tencent-search-model.js exactly:
//   - same endpoint (TENCENT_TOKENHUB_BASE_URL or https://tokenhub.tencentmaas.com/v1)
//   - same model (TENCENT_TOKENHUB_MODEL or deepseek-v4-flash)
//   - same web_search_options { enable:true, search_source, user_location }
//   - only message.search_results are emitted as evidence items; the model
//     answer is shown as a diagnostic preview only (never used as evidence).
//
// The API key is read from process.env.TENCENT_TOKENHUB_API_KEY, or from a
// local .env file at the project root (KEY=VALUE per line). The key is NEVER
// printed to output.
//
// Usage:
//   node scripts/search-once.js "KPL 2026 年度总决赛 赛程 时间 场馆"
//   node scripts/search-once.js --access "无畏契约 上海冠军赛 2026 门票 票价"
//
// Options:
//   --access      treat the query as an access/ticketing query
//   --source lite|standard   search source (default lite)
//   --city <name>            user location city hint

const fs = require('fs')
const path = require('path')

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

const apiKey = process.env.TENCENT_TOKENHUB_API_KEY
const base = String(process.env.TENCENT_TOKENHUB_BASE_URL || 'https://tokenhub.tencentmaas.com/v1').replace(/\/$/, '')
const model = process.env.TENCENT_TOKENHUB_MODEL || 'deepseek-v4-flash'

// Parse args
const positional = []
const opts = { access: false, source: 'lite', city: '' }
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a === '--access') opts.access = true
  else if (a === '--source') opts.source = process.argv[++i] || 'lite'
  else if (a === '--city') opts.city = process.argv[++i] || ''
  else positional.push(a)
}
const query = positional.join(' ').trim()

function fail(msg) {
  console.error('✗ ' + msg)
  process.exit(1)
}

if (!apiKey) {
  fail('未检测到 TENCENT_TOKENHUB_API_KEY。\n' +
    '  方式一：在本项目根目录创建 .env 写入 TENCENT_TOKENHUB_API_KEY=你的key\n' +
    '  方式二：运行前 export TENCENT_TOKENHUB_API_KEY=你的key （PowerShell: $env:TENCENT_TOKENHUB_API_KEY="你的key"）')
}
if (!query) fail('缺少查询词。例：node scripts/search-once.js "KPL 2026 总决赛 赛程"')

const searchSource = /^(lite|standard)$/.test(opts.source) ? opts.source : 'lite'
const location = { type: 'approximate', country: 'CN', timezone: 'Asia/Shanghai' }
if (opts.city) { location.region = opts.city; location.city = opts.city }

const systemContent = opts.access
  ? ['你是活动信息检索助手，必须联网搜索后回答',
     '重点核对售票平台、票价、购票入口、开票/预售时间',
     '所有事实必须引用搜索来源，不确定明确说明未知',
     '按事实逐项回答，每项后紧跟引用编号如[1]'].join('；')
  : ['你是活动信息检索助手，必须联网搜索后回答',
     '优先查找主办方官网、赛事官网、官方售票平台和官方认证账号',
     '分别核对活动日期、具体时分、场馆、售票时间以及每个赛程阶段',
     '不要把文章发布日期、开票时间或直播预约时间当作活动开始时间',
     '所有事实都必须引用搜索来源，不确定的信息明确说明未知',
     '按活动阶段逐项回答日期、时分、城市和场馆，每项事实后紧跟引用编号如[1]',
     '数据库候选日期可能错误，不得把用户提供的日期当作来源证据'].join('；')

const body = {
  model,
  stream: false,
  reasoning_effort: 'low',
  messages: [
    { role: 'system', content: systemContent },
    { role: 'user', content: query.slice(0, 500) }
  ],
  web_search_options: { enable: true, search_source: searchSource, user_location: location },
  max_tokens: 900
}

console.error('→ TokenHub 请求')
console.error('  endpoint : ' + base + '/chat/completions')
console.error('  model    : ' + model)
console.error('  source   : ' + searchSource + (opts.access ? '  [access/ticketing mode]' : ''))
console.error('  query    : ' + query)
console.error('  key      : ' + (apiKey ? '****' + apiKey.slice(-4) : '(none)'))
console.error('')

;(async () => {
  try {
    const resp = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify(body)
    })
    const data = await resp.json().catch(() => null)
    if (!resp.ok || !data) {
      fail('HTTP ' + resp.status + ' — ' + (data && JSON.stringify(data)).slice(0, 400))
    }
    const choice = Array.isArray(data.choices) ? data.choices[0] : null
    const message = (choice && choice.message) || {}
    const results = Array.isArray(message.search_results) ? message.search_results : []
    const answer = String(message.content || '')
    const seen = new Set()
    const items = []
    for (const item of results) {
      const link = item && (item.url || item.link)
      const title = item && (item.name || item.title)
      if (!title || !/^https?:\/\//i.test(String(link || ''))) continue
      const key = String(link).replace(/#.*$/, '').replace(/\/$/, '')
      if (seen.has(key)) continue
      seen.add(key)
      items.push({
        title: String(title).replace(/\s+/g, ' ').trim().slice(0, 120),
        description: String(item.snippet || item.content || '').replace(/\s+/g, ' ').trim().slice(0, 1800),
        link,
        sourceName: String(item.site || item.media || 'Tencent TokenHub').slice(0, 40),
        citationIndex: Number(item.index) || items.length + 1
      })
      if (items.length >= 8) break
    }

    console.error('✓ 返回 ' + items.length + ' 条证据 (search_calls=' +
      (data.usage && data.usage.tool_usage && data.usage.tool_usage.web_search_call) + ', request_id=' +
      (data.id || data.request_id || '-') + ')')
    console.error('')
    console.log('===== EVIDENCE ITEMS (search_results) =====')
    for (const it of items) {
      console.log('[' + it.citationIndex + '] ' + it.title)
      console.log('    链接: ' + it.link)
      console.log('    来源: ' + it.sourceName)
      console.log('    摘要: ' + it.description)
      console.log('')
    }
    console.error('===== ANSWER PREVIEW (diagnostic only, NOT evidence) =====')
    console.error(answer.slice(0, 800) || '(empty)')
  } catch (e) {
    fail('请求异常: ' + (e && e.message))
  }
})()
