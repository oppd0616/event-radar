const crypto = require('crypto')
const { getText } = require('./http')
const { classifySource } = require('../config/source-policy')
const opening = require('./opening-schedule')
const TOPIC = /专题|專題|活动日历|活動日曆|全城|万圣月|萬聖月|citywide|calendar/i
function independent(row, rows) {
  if (row.isUmbrella === true) return false
  if (!row.parentTitle) return true
  return rows.some(parent => parent.title === row.parentTitle && parent.isUmbrella === true)
}
function urlsFor(items, context, now) {
  const urls = (items || []).filter(x => TOPIC.test(x.title || '') &&
    ['official', 'institutional'].includes(classifySource(x.link, context.domain).tier)).map(x => x.link)
  const month = new Date(now + 28800000).getUTCMonth() + 1
  if (context.city === '香港' && context.topicKey === 'seasonal_event' && [9, 10].includes(month)) {
    urls.unshift('https://www.discoverhongkong.com/tc/events/halloween/citywide-halloween-cosplay-celebration.html')
  }
  return [...new Set(urls)].slice(0, 2)
}
function plain(html) {
  return String(html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}
function sectionItem(item, title, rows, now) {
  const text = String(item.description || '')
  const sections=[]
  for(let start=text.indexOf(title);start>=0;start=text.indexOf(title,start+title.length)) {
    const ends=rows.filter(row=>row.title!==title && independent(row,rows)).map(row=>text.indexOf(row.title,start+title.length)).filter(index=>index>=0)
    sections.push(text.slice(start,ends.length ? Math.min(...ends) : start+7000).slice(0,7000))
  }
  if(!sections.length)return null
  // Navigation repeats headings without dates. Prefer the actual body section.
  const section=sections.sort((a,b)=>(b.match(/日期|日期|Date|\d月/g)||[]).length-(a.match(/日期|日期|Date|\d月/g)||[]).length || b.length-a.length)[0]
  const dates = opening.datesIn(section, new Date(now + 28800000).getUTCFullYear())
  const countWords = {'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9}
  const count = (section.match(/([二三四五六七八九])大主[題题]/) || [])[1]
  const complete = !!count && countWords[count] === dates.length && dates.length > 1 &&
    !/每天|每日|daily|\d日?\s*(?:至|到|[-–—])\s*(?:\d月)?\d/i.test(section.replace(/https?:\/\/\S+/g,''))
  return {...item, title, description:section, topicHubSection:true,
    verifiedOpeningDates: complete ? [{label:'活动开放日',scope:'event',complete:true,dates,quote:section}] : []}
}
function pageItem(html, url, city) {
  const body = String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  const main = body ? body[1] : html
  const links = []
  for (const match of String(main).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const link = new URL(match[1].replace(/&amp;/g, '&'), url)
      if (link.protocol !== 'https:' || !plain(match[2])) continue
      links.push(plain(match[2]).slice(0, 100) + ' ' + link.href)
    } catch (_) {}
  }
  return {title: plain((String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [,'活动专题'])[1]),
    description: city + '\n' + plain(main).slice(0, 22000) + '\n详情链接：\n' + [...new Set(links)].slice(0, 60).join('\n'),
    link: url, sourceName: new URL(url).hostname, directFetched: true, topicHub: true}
}
async function discover(items, context, now, deps) {
  const identities = [], evidence = [], diagnostics = []
  for (const url of urlsFor(items, context, now)) {
    try {
      const id = 'topic-hub-' + crypto.createHash('sha256').update(url).digest('hex').slice(0, 28)
      let cached = await deps.read(id)
      let item, rows, fetched = false
      if (cached && cached.version === 2 && now - Number(cached.fetchedAt) < 6 * 3600000 && cached.item && Array.isArray(cached.identities)) {
        item = cached.item; rows = cached.identities
      } else {
        const host = new URL(url).hostname
        if (cached && cached.item && now - Number(cached.fetchedAt) < 6 * 3600000) {
          item = cached.item
        } else try {
          const page = await (deps.fetch || getText)(url, {allowedHosts: [host], timeoutMs: 10000, maxBytes: 1000000})
          item = pageItem(page.text, url, context.city)
        } catch (error) {
          if (!deps.indexedPage) throw error
          item = await deps.indexedPage(url)
          if (!item || !item.description) throw error
          item = {...item, topicHub:true, directFetched:false, indexedPage:true, link:url}
        }
        const hash = crypto.createHash('sha256').update(item.description).digest('hex')
        rows = cached && cached.version === 2 && cached.contentHash === hash && Array.isArray(cached.identities) ? cached.identities :
          await deps.extract([item], {topicKey: context.topicKey, city: context.city, hub: true, maxItems: 20})
        // An empty or failed extraction is not a successful cached directory.
        if (rows.length) await deps.write(id, {fingerprint: id, kind: 'topic_hub_cache', status: 'meta', version:2, url,
          contentHash: hash, fetchedAt: now, item, identities: rows})
        fetched = true
      }
      if (deps.reconcile) await deps.reconcile(rows, item)
      const index = evidence.push(item) - 1
      for (const row of rows) {
        if (Number(row.evidenceIndex) !== 0 || !row.title || !row.city || !row.domain) continue
        if (!independent(row, rows) || item.title.split(/[|｜]/)[0].trim() === row.title.trim()) continue
        if (await deps.known(row)) continue
        if (identities.length >= 5) break
        const key = String(row.title).normalize('NFKC').toLowerCase().replace(/\s/g, '')
        if (identities.some(x => x.key === key)) continue
        const detailUrl = typeof row.detailUrl === 'string' && /^https:\/\//i.test(row.detailUrl) && item.description.includes(row.detailUrl)
          ? row.detailUrl : ''
        identities.push({...row, detailUrl, evidenceIndex: index, key})
      }
      diagnostics.push({url, fetched, parsed: rows.length})
    } catch (error) { diagnostics.push({url, error: String(error.message).slice(0, 180)}) }
  }
  return {identities, evidence, diagnostics}
}
module.exports = { urlsFor, pageItem, discover, independent, sectionItem }
