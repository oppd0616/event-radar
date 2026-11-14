const assert=require('assert/strict'),source=require('../cloudfunctions/fetchEvents/lib/game-news-source'),p=require('../cloudfunctions/fetchEvents/lib/publisher-sources')
const url='https://news.17173.com/tag/test',old='http://news.17173.com/content/07172026/150939992.shtml',recent='http://news.17173.com/content/09302026/115033634.shtml'
const html=`<a href="${old}">旧活动：人工智能体验工作坊</a><a href="${recent}">KPL荣耀之路快闪长沙站</a><a href="${recent}">[详细]</a>`
assert.equal(source.duplicateReview([{title:'寻仙之夜仙剑大型嘉年华合肥启幕',city:'合肥'},{title:'12月5日寻仙之夜仙剑大型嘉年华',city:'合肥'}]).length,1)
assert.equal(source.duplicateReview([{title:'寻仙之夜仙剑大型嘉年华',city:'合肥'},{title:'寻仙之夜仙剑大型嘉年华',city:'成都'}]).length,0)
assert.deepEqual(source.listing(html,url,p.pageItem).map(x=>x.url),[recent,old].map(x=>x.replace('http:','https:')))
for(const u of ['http://evil.com/content/09302026/115033634.shtml','https://user:pass@news.17173.com/content/09302026/115033634.shtml','https://news.17173.com:8443/content/09302026/115033634.shtml','javascript:alert(1)'])assert.equal(source.articleUrl(u,url),'')
assert.equal(p.safeUrl(old),'','generic security policy must stay unchanged')
const item=source.detail('<title>活动_游戏新闻_17173</title><p>活动在长沙举行。'.repeat(8)+'</p>【来源：公众号】今日热游 幻想快闪',recent,p.pageItem)
assert(!item.description.includes('幻想快闪'));assert.equal(item.links.length,1)
let requests=0;source.collect([url],{pageItem:p.pageItem,maxDetails:1,fetch:async x=>{requests++;return {text:x===url?html:'<title>KPL快闪_游戏新闻</title>'+('活动在长沙举行。'.repeat(30))}}}).then(r=>{assert.equal(r.documents.length,1);assert.equal(requests,2);assert.equal(r.selected[0],recent.replace('http:','https:'));console.log('PASS: same-host HTTPS, newest first, URL dedup, request cap, detail isolation; generic security unchanged')}).catch(e=>{console.error(e);process.exitCode=1})
source.collect([url,url+'2'],{pageItem:p.pageItem,maxDetails:2,fetch:async x=>({text:x===url?html:x===url+'2'?'<a href="https://news.17173.com/content/10272026/120217606.shtml">新嘉年华</a>':'<title>详情</title>'+('详情正文。'.repeat(40))})}).then(r=>{assert(r.selected.some(x=>x.includes('09302026')));assert(r.selected.some(x=>x.includes('10272026')));console.log('PASS: each source retains a detail slot; newer second source cannot starve the first')}).catch(e=>{console.error(e);process.exitCode=1})
