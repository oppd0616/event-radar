// Source of truth. Distribute with scripts/sync-event-identity.cjs before deployment.
const VERSION = 2
const CITIES = '北京 上海 深圳 广州 成都 长沙 南京 杭州 武汉 郑州 苏州 天津 重庆 西安 厦门 青岛 大连 沈阳 济南 合肥 福州 宁波 无锡 南昌 南宁 昆明 贵阳 海口 三亚 珠海 佛山 东莞 香港 澳门 台北 台中 高雄 首尔 仁川 甘孜'.split(' ')
const PHASE = /小组赛及淘汰赛|总决赛周末|败者组决赛|胜者组决赛|四分之一决赛|半决赛|总决赛|淘汰赛|小组赛|资格赛|预选赛|口试|笔试|初赛|复赛|报名启动|报名开启|报名截止|抽签结果|装备领取|领物|开幕式|闭幕式/g
function norm(value) { return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') }
function day(value) { return Number(value)>0 ? new Date(Number(value)+28800000).toISOString().slice(0,10) : '' }
function kind(event) {
  const text=String(event.title || '')
  if(/快闪|联名|概念网吧|pop.?up/i.test(text)) return 'experience'
  if(/巡演|巡回演唱|演唱会|world\s*tour|单口|喜剧专场/i.test(text)) return 'show'
  if(/展览|展会|博览会|新品节|艺术节|音乐节|嘉年华/i.test(text)) return 'festival'
  if(/赛事|冠军赛|锦标赛|联赛|总决赛|大赛|挑战赛|马拉松|考试|四六级/i.test(text)) return 'competition'
  return 'other'
}
function describe(event) {
  const title=String(event.title || '').normalize('NFKC').toLowerCase()
  const year=(title.match(/20\d{2}\s*[-/–—]\s*20\d{2}/)||title.match(/20\d{2}/)||[])[0] || day(event.startTime).slice(0,4)
  const cities=CITIES.filter(city=>(title+' '+String(event.city || '')).includes(city)).sort()
  const city=cities.join(',') || norm(event.city).replace(/市$/,'')
  const type=kind(event)
  let core=title.replace(/20\d{2}\s*年?/g,'').replace(/world\s*tour/gi,'世界巡演')
    .replace(/(?:中国大陆)?(?:线上|官方|全程)?直播(?:间|入口)?/g,'')
  if(type==='competition') core=core.replace(PHASE,'')
  cities.forEach(value=>{core=core.split(value).join('')})
  core=core.replace(/(?:[（(]\s*[）)]|站\s*$)/g,'')
  // Quoted exhibition names can precede or follow the venue/edition text.
  // Keep the complete surrounding text: a shared article or name alone is not identity.
  const exhibitionName=core.match(/[“「《]([^”」》]{2,80})[”」》]/)
  if(exhibitionName && /年度大展|展览|特展/.test(core) &&
      (core.match(/[“「《]/g)||[]).length===1) {
    core=exhibitionName[1]+' '+core.replace(exhibitionName[0],'')
  }
  core=norm(core)
  const bounded=type!=='other' || /20\d{2}|第.{1,5}届|vol\.?\s*\d/i.test(title)
  // Non-edition recurring meetups retain their date; uncertainty must not collapse them.
  const scope=bounded ? year : day(event.startTime)
  return {core,year,city,type,scope,cities}
}
function identityKey(event) {
  const d=describe(event)
  const session=/下午场|晚场|上午场|第.{1,3}场|\d{1,2}月\d{1,2}日场/.test(String(event.sessionKey || '')) ? norm(event.sessionKey) : ''
  return d.core && d.scope ? [VERSION,d.core,d.scope,d.city,d.type,session].join('|') : ''
}
function compare(left,right) {
  if(!left || !right) return 'different'
  if(left.canonicalEventId && right.canonicalEventId && left.canonicalEventId===right.canonicalEventId) return 'same'
  const a=describe(left),b=describe(right)
  if(a.year && b.year && a.year!==b.year) return 'different'
  if(a.type!==b.type && (a.type==='experience'||b.type==='experience')) return 'different'
  if(a.city && b.city && a.city!==b.city) return 'different'
  if(!a.core || a.core!==b.core) return 'unknown'
  if(left.sessionKey && right.sessionKey && norm(left.sessionKey)!==norm(right.sessionKey))return 'different'
  if(a.scope!==b.scope) return 'different'
  if(!a.city || !b.city) { if(a.city!==b.city) return 'review' }
  const url=e=>String(e.source && e.source.url || '').replace(/^https?:\/\//,'').replace(/\/$/,'')
  if(left.timePrecision==='datetime' && right.timePrecision==='datetime' && Number(left.startTime)!==Number(right.startTime) &&
      (!url(left) || url(left)!==url(right)))return 'review'
  return a.type===b.type ? 'same' : 'review'
}
function groups(records) {
  const result=[]
  for(const event of records) {
    // Complete-link groups prevent A~B and B~C from incorrectly implying A~C.
    const group=result.find(items=>items.every(other=>compare(event,other)==='same'))
    if(group)group.push(event);else result.push([event])
  }
  return result
}
module.exports={VERSION,identityKey,compare,groups,describe}
