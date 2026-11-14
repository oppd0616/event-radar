// Public structured listing adapters. Manual evaluation only; not automatic seeds.
const sources={zuicool:{name:'最酷赛事',url:'https://reg.zuicool.com/',domain:'sports',topicKey:''}}
const plain=x=>String(x||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim()
function parse(html,source,now){
 const cards=String(html).split(/<div class="reg-race-block">/).slice(1,61).map(block=>{
  const heading=plain((block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/)||[])[1])
  const title=heading.replace(/报名中|已关闭/g,'').trim()
  const url=(block.match(/href="(https:\/\/reg\.zuicool\.com\/\d+)"/)||[])[1]||''
  const schedule=plain((block.match(/<p style="flex: 1;[\s\S]*?>([\s\S]*?)<\/p>/)||[])[1])
  const dates=[...schedule.matchAll(/(20\d\d)年(\d{1,2})月(\d{1,2})日/g)].map(m=>m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0')).filter(d=>Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d)
  const city=(schedule.match(/(上海|北京|天津|重庆|香港|澳门|[\u4e00-\u9fff]{2,8}市)/)||[])[1]||''
  return {title,url,schedule,dates,city,registrationClosed:/已关闭/.test(heading),online:/不限地点|线上/.test(schedule+' '+title)}
 }).filter(c=>c.url&&c.title)
 const unique=[...new Map(cards.map(c=>[c.url,c])).values()]
 const eligible=unique.filter(c=>!c.online&&c.city&&c.dates.length&&Date.parse(c.dates.slice(-1)[0]+'T23:59:59+08:00')>=now)
 // Keep registration-closed races as identities: watching may still be possible.
 const rows=eligible.map(c=>({title:c.title,domain:'sports',city:c.city,confidence:.96,evidenceIndex:0,detailUrl:c.url}))
 const links=eligible.map(c=>({title:c.title,url:c.url,dates:c.dates,context:c.schedule}))
 const description=unique.map(c=>c.title+' '+c.schedule+' '+(c.registrationClosed?'报名已关闭（不代表赛事结束）':'报名状态待核验')+' '+c.url).join('\n')
 return {item:{title:source.name,description,link:source.url,sourceName:source.name,searchProvider:'publisher_direct',publisherSource:true,directFetched:true,links,readable:unique.length>0},rows,audit:{cards:unique.length,eligible:eligible.length,online:unique.filter(c=>c.online).length,missing:unique.filter(c=>!c.city||!c.dates.length).length,expired:unique.filter(c=>c.dates.length&&Date.parse(c.dates.slice(-1)[0]+'T23:59:59+08:00')<now).length,registrationClosed:eligible.filter(c=>c.registrationClosed).length}}
}
module.exports={VERSION:'2026-10-30.1',sources,parse}
