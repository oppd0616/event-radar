const cloud = require('wx-server-sdk')
const https = require('https')
const http = require('http')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MAX_HTML_BYTES = 600 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const RETRY_INTERVAL = 7 * 24 * 3600000
const RESOLVER_VERSION = 4
const MAX_SOURCE_PAGES = 5

const { isPublicHttpUrl, publicLookup } = require('./public-network')

function download(url, maxBytes, redirects) {
  return new Promise((resolve, reject) => {
    if (!isPublicHttpUrl(url)) return reject(new Error('unsafe url'))
    const client = String(url).indexOf('https:') === 0 ? https : http
    const request = client.get(url, {
      lookup: publicLookup,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 EventRadar/1.0',
        Accept: 'text/html,application/xhtml+xml,image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7'
      },
      timeout: 5000
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        if (redirects >= 3) return reject(new Error('too many redirects'))
        const nextUrl = new URL(response.headers.location, url).toString()
        download(nextUrl, maxBytes, redirects + 1).then(resolve, reject)
        return
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume()
        reject(new Error('http ' + response.statusCode))
        return
      }
      const chunks = []
      let size = 0
      response.on('data', (chunk) => {
        size += chunk.length
        if (size > maxBytes) {
          response.destroy(new Error('response too large'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: String(response.headers['content-type'] || '').toLowerCase()
      }))
      response.on('error', reject)
    })
    request.on('timeout', () => request.destroy(new Error('request timeout')))
    request.on('error', reject)
  })
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .trim()
}

function attribute(tag, names) {
  for (const name of names) {
    const quoted = tag.match(new RegExp('\\b' + name + '\\s*=\\s*["\\\']([^"\\\']+)["\\\']', 'i'))
    if (quoted) return decodeHtml(quoted[1])
    const plain = tag.match(new RegExp('\\b' + name + '\\s*=\\s*([^\\s>]+)', 'i'))
    if (plain) return decodeHtml(plain[1])
  }
  return ''
}

function absoluteImageUrl(value, pageUrl) {
  try {
    const imageUrl = new URL(decodeHtml(value), pageUrl).toString()
    return isPublicHttpUrl(imageUrl) ? imageUrl : ''
  } catch (e) {
    return ''
  }
}

function findOpenGraphImage(html, pageUrl) {
  const tags = String(html || '').match(/<meta\b[^>]*>/gi) || []
  for (const tag of tags) {
    const key = attribute(tag, ['property', 'name', 'itemprop']).toLowerCase()
    if (key !== 'og:image' && key !== 'og:image:url' && key !== 'twitter:image' &&
      key !== 'twitter:image:src' && key !== 'image' && key !== 'thumbnailurl') continue
    const imageUrl = absoluteImageUrl(attribute(tag, ['content']), pageUrl)
    if (imageUrl) return imageUrl
  }
  const links = String(html || '').match(/<link\b[^>]*>/gi) || []
  for (const link of links) {
    const rel = attribute(link, ['rel']).toLowerCase()
    if (rel !== 'image_src' && rel !== 'preload') continue
    if (rel === 'preload' && attribute(link, ['as']).toLowerCase() !== 'image') continue
    const imageUrl = absoluteImageUrl(attribute(link, ['href']), pageUrl)
    if (imageUrl) return imageUrl
  }
  const jsonImage = String(html || '').match(/["'](?:image|thumbnailUrl)["']\s*:\s*["'](https?:\\?\/\\?\/[^"']+)["']/i)
  if (jsonImage) return absoluteImageUrl(jsonImage[1].replace(/\\\//g, '/'), pageUrl)
  return ''
}

async function tempUrl(fileID) {
  const result = await cloud.getTempFileURL({ fileList: [fileID] })
  const item = result.fileList && result.fileList[0]
  return item && item.tempFileURL ? item.tempFileURL : ''
}

async function cacheFromPage(pageUrl, eventId, sourceType) {
  const page = await download(pageUrl, MAX_HTML_BYTES, 0)
  if (page.contentType && page.contentType.indexOf('text/html') < 0) return null
  const imageUrl = findOpenGraphImage(page.buffer.toString('utf8'), pageUrl)
  if (!imageUrl) return null
  const image = await download(imageUrl, MAX_IMAGE_BYTES, 0)
  if (image.contentType.indexOf('image/') !== 0) return null
  const ext = image.contentType.indexOf('png') >= 0
    ? 'png'
    : (image.contentType.indexOf('webp') >= 0 ? 'webp' : 'jpg')
  const upload = await cloud.uploadFile({
    cloudPath: 'event-covers/' + eventId + '.' + ext,
    fileContent: image.buffer
  })
  return { fileID: upload.fileID, sourceUrl: imageUrl, pageUrl, sourceType }
}

async function discoverRelatedSources(target) {
  try {
    const result = await cloud.callFunction({
      name: 'fetchEvents',
      data: {
        mode: 'cover-sources',
        title: target.title,
        tags: target.tags || [],
        domain: target.domain
      }
    })
    const payload = result && result.result
    if (!payload || !payload.ok || !Array.isArray(payload.sources)) return []
    return payload.sources.map((item) => ({
      url: item.url,
      sourceType: 'media',
      sourceName: item.sourceName || '相关资讯'
    }))
  } catch (e) {
    console.warn('[resolveEventCover] related source search failed', e.message)
    return []
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const eventId = event && String(event.eventId || '')
  if (!OPENID || !eventId) return { error: 'invalid request' }

  const result = await db.collection('events').doc(eventId).get().catch(() => null)
  if (!result || !result.data || result.data.status !== 'published') return { error: 'event unavailable' }
  const target = result.data
  if (target.cover && target.cover.fileID) {
    return {
      ok: true,
      coverUrl: await tempUrl(target.cover.fileID),
      sourceType: target.cover.sourceType || 'source',
      cached: true
    }
  }
  const now = Date.now()
  if (target.coverResolverVersion === RESOLVER_VERSION && target.coverCheckedAt && now - target.coverCheckedAt < RETRY_INTERVAL) {
    return { ok: true, coverUrl: '', cached: true }
  }

  let candidates = [
    { url: target.participation && target.participation.url, sourceType: 'official' },
    { url: target.source && target.source.url, sourceType: 'source' }
  ].filter((item, index, list) => isPublicHttpUrl(item.url) &&
    list.findIndex((candidate) => candidate.url === item.url) === index)
  let cover = null
  for (const candidate of candidates) {
    try {
      cover = await cacheFromPage(candidate.url, eventId, candidate.sourceType)
      if (cover) break
    } catch (e) {
      console.warn('[resolveEventCover] source failed', candidate.url, e.message)
    }
  }

  if (!cover) {
    const related = await discoverRelatedSources(target)
    const knownUrls = candidates.map((item) => item.url)
    candidates = related.filter((item) => isPublicHttpUrl(item.url) && knownUrls.indexOf(item.url) < 0)
    for (const candidate of candidates.slice(0, Math.max(0, MAX_SOURCE_PAGES - knownUrls.length))) {
      try {
        cover = await cacheFromPage(candidate.url, eventId, candidate.sourceType)
        if (cover) break
      } catch (e) {
        console.warn('[resolveEventCover] related source failed', candidate.url, e.message)
      }
    }
  }

  if (!cover) {
    await db.collection('events').doc(eventId).update({
      data: { coverCheckedAt: now, coverStatus: 'unavailable', coverResolverVersion: RESOLVER_VERSION }
    })
    return { ok: true, coverUrl: '', cached: false }
  }
  await db.collection('events').doc(eventId).update({
    data: {
      cover: {
        fileID: cover.fileID,
        sourceUrl: cover.sourceUrl,
        pageUrl: cover.pageUrl,
        sourceType: cover.sourceType,
        cachedAt: now
      },
      coverCheckedAt: now,
      coverStatus: 'ready',
      coverResolverVersion: RESOLVER_VERSION
    }
  })
  return {
    ok: true,
    coverUrl: await tempUrl(cover.fileID),
    sourceType: cover.sourceType,
    cached: false
  }
}
