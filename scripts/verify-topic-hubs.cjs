const assert = require('node:assert/strict')
const fs = require('node:fs')
const hubs = require('../cloudfunctions/fetchEvents/lib/topic-hubs')
const schedule = require('../cloudfunctions/fetchEvents/lib/opening-schedule')
const follow = require('../cloudfunctions/manageFollows/model')
const at = value => Date.parse(value + 'T12:00:00+08:00')
async function main() {
  const tree=[{title:'全城专题',isUmbrella:true},{title:'街区庆典',parentTitle:'全城专题'},{title:'开幕祭',parentTitle:'街区庆典'}]
  assert.equal(hubs.independent(tree[0],tree),false)
  assert.equal(hubs.independent(tree[1],tree),true)
  assert.equal(hubs.independent(tree[2],tree),false)
  const section=hubs.sectionItem({description:'目录 兰桂坊派对 其他庆典 正文 兰桂坊派对 三大主题 日期：2026年10月17日 日期：2026年10月24日 日期：2026年10月31日 其他庆典 每日开放'},'兰桂坊派对',[{title:'兰桂坊派对'},{title:'其他庆典'}],at('2026-10-20'))
  assert.equal(section.verifiedOpeningDates.length,1)
  assert.equal(section.verifiedOpeningDates[0].dates.length,3)
  const quote = '日期：2026年10月17日、24日及31日'
  const source = [{link:'https://example.org/event', description:'兰桂坊派对 ' + quote}]
  const groups = schedule.normalize([{label:'派对日期',scope:'event',complete:true,
    dates:['2026-10-17','2026-10-24','2026-10-31'], evidenceIndex:0,quote}], source, at('2026-10-17'), at('2026-10-31'))
  assert.equal(groups.length, 1)
  assert.equal(schedule.state(groups, at('2026-10-20')).text, '下一场 10月24日')
  assert.equal(schedule.state(groups, at('2026-10-24')).text, '今日举行')
  assert.equal(schedule.state(groups, at('2026-11-01')).key, 'ended')
  assert.equal(schedule.state([{...groups[0], scope:'component'}], at('2026-10-20')), null)
  assert.equal(schedule.normalize([{...groups[0], evidenceIndex:0, quote, dates:['2026-10-25']}], source, at('2026-10-17'), at('2026-10-31')).length, 0)
  assert.equal(schedule.normalize([{...groups[0], evidenceIndex:0, quote:'日期：2026年10月20日'}], source, at('2026-10-17'), at('2026-10-31')).length, 0)
  const event = {status:'published',startTime:at('2026-10-17'),endTime:at('2026-10-31'),openingState:schedule.state(groups,at('2026-10-20'))}
  assert.equal(follow.plan(event,at('2026-10-20')).key, 'soon')
  assert.equal(new Date(follow.plan(event,at('2026-10-20')).at + 28800000).getUTCDate(), 24)
  assert.equal(follow.agenda(event,at('2026-10-20')).key, 'week')
  const cache = new Map(), seen = new Set(['活动0'])
  let parsed = 0, fetched = 0
  const deps = {read:async id=>cache.get(id),write:async(id,data)=>cache.set(id,data),
    fetch:async()=>{fetched++;return {text:'<main><h1>香港万圣节专题</h1><a href="/event">活动详情</a></main>'}},
    extract:async()=>{parsed++;return Array.from({length:12},(_,i)=>({title:'活动'+i,domain:'culture',city:'香港',evidenceIndex:0,confidence:0.9}))},
    known:async row=>seen.has(row.title)}
  const context={domain:'culture',city:'香港',topicKey:'seasonal_event'}
  const first=await hubs.discover([],context,at('2026-10-20'),deps)
  assert.equal(first.identities.length,5)
  assert.ok(!first.identities.some(x=>x.title==='活动0'))
  first.identities.forEach(x=>seen.add(x.title))
  const second=await hubs.discover([],context,at('2026-10-20')+1000,deps)
  assert.equal(second.identities.length,5)
  assert.ok(second.identities.every(x=>!seen.has(x.title)))
  assert.equal(parsed,1);assert.equal(fetched,1)
  assert.equal(hubs.urlsFor([{title:'calendar',link:'https://evil.example/x'}],{domain:'culture',city:'北京'},at('2026-10-20')).length,0)
  const canonical=fs.readFileSync('cloudfunctions/fetchEvents/lib/opening-schedule.js','utf8')
  for(const file of ['cloudfunctions/getEvents/opening-schedule.js','miniprogram/utils/opening-schedule.js']) assert.equal(fs.readFileSync(file,'utf8'),canonical)
  console.log('PASS: hub continuation/cache/trusted sources; explicit dates, quoted evidence, next occurrence, follow agenda and component isolation')
}
main().catch(error=>{console.error(error);process.exitCode=1})
