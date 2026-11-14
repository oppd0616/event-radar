const https = require('https')
const http = require('http')
let iconv = null
try { iconv = require('iconv-lite') } catch (error) {}

function responseCharset(buffer, contentType) {
  const headerMatch = String(contentType || '').match(/charset\s*=\s*["']?([^;\s"']+)/i)
  if (headerMatch) return headerMatch[1].toLowerCase()
  const head = buffer.slice(0, 4096).toString('latin1')
  const metaMatch = head.match(/charset\s*=\s*["']?([^;\s"'/>]+)/i)
  return metaMatch ? metaMatch[1].toLowerCase() : 'utf-8'
}

function decodeResponseBuffer(buffer, contentType) {
  const charset = responseCharset(buffer, contentType).replace(/^gb2312$/, 'gbk')
  if (iconv && iconv.encodingExists(charset)) return iconv.decode(buffer, charset)
  return buffer.toString('utf8')
}

function postJson(url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const deadlineMs = timeoutMs || 20000
    let settled = false
    let deadline
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      callback(value)
    }
    const request = https.request({
      hostname: target.hostname,
      path: target.pathname + target.search,
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers)
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)) })
      response.on('aborted', () => finish(reject, new Error('llm response aborted')))
      response.on('error', (error) => finish(reject, error))
      response.on('end', () => {
        const buffer = Buffer.concat(chunks).toString('utf8')
        try {
          const parsed = JSON.parse(buffer)
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const detail = parsed && parsed.error && parsed.error.message
              ? parsed.error.message
              : (parsed && parsed.detail && parsed.detail.error ? parsed.detail.error : buffer.slice(0, 200))
            finish(reject, new Error('llm http ' + response.statusCode + ': ' + detail))
            return
          }
          finish(resolve, parsed)
        } catch (error) {
          finish(reject, new Error('llm response not json: ' + buffer.slice(0, 200)))
        }
      })
    })
    request.on('error', (error) => finish(reject, error))
    request.setTimeout(deadlineMs, () => {
      const error = new Error('llm connection timeout')
      finish(reject, error)
      request.destroy(error)
    })
    deadline = setTimeout(() => {
      const error = new Error('llm total timeout after ' + deadlineMs + 'ms')
      finish(reject, error)
      request.destroy(error)
    }, deadlineMs)
    request.write(JSON.stringify(body))
    request.end()
  })
}

function getText(url, options) {
  const settings = Object.assign({ timeoutMs: 6000, maxBytes: 700000, redirects: 3 }, options || {})
  return new Promise((resolve, reject) => {
    let target
    try { target = new URL(url) } catch (error) { reject(new Error('invalid url')); return }
    if (target.protocol !== 'https:' && target.protocol !== 'http:') {
      reject(new Error('unsupported protocol'))
      return
    }
    const allowedHosts = Array.isArray(settings.allowedHosts) ? settings.allowedHosts : []
    const targetHost = target.hostname.toLowerCase().replace(/^www\./, '')
    if (allowedHosts.length && !allowedHosts.some((host) => {
      const expected = String(host || '').toLowerCase().replace(/^www\./, '')
      return targetHost === expected || targetHost.endsWith('.' + expected)
    })) {
      reject(new Error('redirected outside allowed official hosts'))
      return
    }
    const transport = target.protocol === 'https:' ? https : http
    let settled = false
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      callback(value)
    }
    const request = transport.request({
      hostname: target.hostname,
      port: target.port || undefined,
      path: target.pathname + target.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventDiscoveryBot/1.0)',
        Accept: 'text/html,application/ld+json,application/json,text/plain;q=0.9,*/*;q=0.5',
        'Accept-Encoding': 'identity'
      }
    }, (response) => {
      const status = Number(response.statusCode) || 0
      if (status >= 300 && status < 400 && response.headers.location && settings.redirects > 0) {
        response.resume()
        const nextUrl = new URL(response.headers.location, target).toString()
        getText(nextUrl, Object.assign({}, settings, { redirects: settings.redirects - 1 }))
          .then((value) => finish(resolve, value), (error) => finish(reject, error))
        return
      }
      if (status < 200 || status >= 300) {
        response.resume()
        finish(reject, new Error('http ' + status))
        return
      }
      const contentType = String(response.headers['content-type'] || '').toLowerCase()
      if (!/(?:text|html|json|javascript|xml)/.test(contentType)) {
        response.resume()
        finish(reject, new Error('unsupported content type: ' + contentType))
        return
      }
      const chunks = []
      let size = 0
      response.on('data', (chunk) => {
        size += chunk.length
        if (size > settings.maxBytes) {
          request.destroy(new Error('response too large'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => finish(resolve, {
        url: target.toString(),
        contentType,
        etag: String(response.headers.etag || ''),
        lastModified: String(response.headers['last-modified'] || ''),
        text: decodeResponseBuffer(Buffer.concat(chunks), contentType)
      }))
      response.on('error', (error) => finish(reject, error))
    })
    request.on('error', (error) => finish(reject, error))
    request.setTimeout(settings.timeoutMs, () => request.destroy(new Error('get timeout')))
    request.end()
  })
}

module.exports = { postJson, getText, responseCharset, decodeResponseBuffer }
