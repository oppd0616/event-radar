// Local evaluation of explicitly human-reviewed evidence; not AI discovery output.
const fs=require('fs'),path=require('path'),assert=require('assert/strict')
const {normalizeTitle:norm}=require('../../cloudfunctions/fetchEvents/lib/event-identity')
const identity=require('../../cloudfunctions/fetchEvents/lib/stable-event-identity')
const out=path.resolve(__dirname,'../../output/shanghai-youth-pilot-20261028')
const sources={
 popup:'https://www1.meet-in-shanghai.net/cn/news/shanghais-super-popular-popup-gathering-in-october-wuthering-waves-outcast-ruyuan-xiaoyu-dali-temple-log-043155/',
 market:'https://www1.meet-in-shanghai.net/cn/news/new-ways-to-enjoy-autumn-the-city-ranch-themed-market-and-latin-american-style-week-are-%E2%86%92-365337/',
 wild:'https://www.bagevent.com/event/ticket/9285937',
 xintiandi:'https://www.xintiandi.com/en/events/',
 jingan:'https://www.shanghai.gov.cn/nw15343/20261009/9fb2c288d2ca4257946c246c3c7a8868.html',
 qiancase:'https://www.swireproperties.com/zh-cn/portfolio/current-developments/taikoo-li-qiantan/'
}
const samples=[]
function add(id,title,domain,form,venue,end,source,extra={}){samples.push({id,title,domain,form,city:'上海',venue,start:null,end,source:sources[source],permission:'unconfirmed',provenance:'manual_web_review',...extra})}
add('p1','鸣潮×GLOBALWORK联名快闪','game','快闪','静安大悦城北座3F','2026-10-25','popup')
add('p2','微博×如鸢联动快闪','game','快闪','静安大悦城南座3F','2026-10-18','popup')
add('p3','无畏契约全球冠军赛主题快闪','game','快闪','静安大悦城南座1F','2026-10-18','popup')
add('p4','繁花与他花艺快闪','game','快闪','鑫耀光环Live南区B1','2026-10-18','popup')
add('p5','野有上秋个人艺术展及限定快闪','culture','艺术展','静安大悦城北座2F N204','2026-11-25','popup',{aliases:['野有上秋']})
add('p6','小玉×Parlid快闪','culture','快闪','嘉善路123号','2026-11-15','popup',{aliases:['小玉','Parlid']})
add('p7','一人之下十周年漫画原画展','anime','IP展','新世界城11F e展空间','2026-11-15','popup',{aliases:['一人之下']})
add('p8','逆水寒×网易乐谷主题快闪','game','快闪','百联ZX造趣场五角场店L1','2026-10-31','popup',{aliases:['逆水寒','网易乐谷']})
add('p9','阴阳师×GOODSLOVE上海联动快闪','game','快闪','五角场万达广场C馆2F','2026-10-29','popup',{aliases:['阴阳师','GOODSLOVE']})
add('p10','环球金融中心斗破苍穹主题IP展','anime','IP展','上海环球金融中心','2026-11-30','popup',{aliases:['斗破苍穹']})
add('p11','THE FIRST FAN限时快闪','culture','快闪','锦沧文华广场','2026-10-25','popup')
add('p12','Molynk莫尼莫尼甜心派对','culture','潮玩体验','宏伊国际广场一楼','2026-11-17','popup',{aliases:['Molynk','莫尼莫尼']})
add('x1','最近太阳宫L2怎么这么闪','culture','未知',null,null,'xintiandi',{reason:'detail_redirect_outside_allowlist'})
add('x2','艺游未尽街巷即舞台','culture','未知',null,null,'xintiandi',{reason:'listing_only_no_event_dates'})
add('x3','秋冬风尚季时髦启幕','culture','未知',null,null,'xintiandi',{reason:'listing_only_no_event_dates'})
add('x4','重庆新天地国庆节处处有戏','ent','演出',null,null,'xintiandi',{city:'重庆'})
add('s1','VERA WANG柔结之旅限时空间','culture','快闪','兴业太古汇',null,'jingan',{reason:'retrospective_no_exhibition_dates',aliases:['柔结之旅','VERAWANG']})
add('s2','前滩太古里项目介绍','culture','门店介绍','前滩太古里',null,'qiancase',{promotion:true})
add('m1','城市游牧场主题市集','culture','市集','豫园商城方浜中路265号','2026-11-01','market',{aliases:['城市游牧场']})
add('m2','BFC拉美风情周','culture','市集','BFC中山东二路600号','2026-11-01','market',{aliases:['拉美风情周','拉美文化周']})
add('m3','第二届墨西哥怪诞嘉年华','culture','嘉年华','BFC中山东二路600号','2026-10-25','market',{start:'2026-10-24',parentId:'m2'})
add('m4','野作市集','culture','市集','利园商场B2静安区新闸路668号','2026-11-01','wild',{start:'2026-10-30',times:['09:30','17:00'],participationUrl:sources.wild,aliases:['野作'],platformId:'bagevent:9285937'})
add('m5','牡丹亭外沉浸式舞剧','ent','演出','豫园商城','2026-11-01','market',{start:'2026-11-01',parentId:'m1',reason:'exact_venue_and_participation_missing'})
add('m6','走西域去游牧主题巡游','ent','巡游','豫园黄金广场至九曲桥',null,'market',{sessionTimes:['17:30','20:00'],reason:'no_explicit_run_dates',parentId:'m1'})
function classify(s){if(s.city!=='上海')return 'outside_city';if(s.promotion)return 'promotion';if(s.end&&s.end<'2026-10-28')return 'expired';if(!s.venue||!s.end||s.reason)return 'needs_detail';if(!s.start)return 'active_end_only';return 'dated_sample'}
function canonicalUrl(raw){try{const u=new URL(raw);u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^qd$|^bag_track$/.test(k))u.searchParams.delete(k);return u.toString()}catch{return ''}}
function same(a,b){if(a.platformId&&b.platformId)return a.platformId===b.platformId;if(a.city!==b.city)return false;if(a.sessionKey&&b.sessionKey&&a.sessionKey!==b.sessionKey)return false;return norm(a.title)===norm(b.title)&&a.start===b.start&&a.end===b.end&&norm(a.venue)===norm(b.venue)}
const records=['events','eventCandidates'].flatMap(table=>JSON.parse(fs.readFileSync(path.join(out,table+'-snapshot.json'))).map(r=>({...r,table})))
for(const s of samples){s.assessment=classify(s);s.missing=['start','end','venue','participationUrl'].filter(k=>!s[k]);const aliases=[s.title,...(s.aliases||[])].map(norm);s.possibleMatches=records.filter(r=>{const text=norm(r.title+' '+JSON.stringify(r.aliases||[]));return aliases.some(a=>a.length>=2&&text.includes(a))||identity.compare({...s,startTime:s.start?Date.parse(s.start+'T00:00:00+08:00'):undefined},r)==='same'}).map(r=>({id:r._id,title:r.title,city:r.city,status:r.status,table:r.table}));s.novelty=s.possibleMatches.length?'review_matches':'no_match_in_snapshot_not_proof';s.publishable=false}
const rounds=[{round:1,ids:samples.slice(0,12).map(x=>x.id),purpose:'快闪公开网页人工复核'}, {round:2,ids:['p5','p6','p7','p8','x1','x2','x3','x4','s1','s2'],purpose:'缓存重放与场地方补充'}, {round:3,ids:['m1','m2','m3','m4','m5','m6'],purpose:'改换市集、展演类型'}]
const seen=new Set();for(const r of rounds){assert(r.ids.length<=20);r.repeated=r.ids.filter(x=>seen.has(x)).length;r.ids.forEach(x=>seen.add(x));r.assessments={};for(const id of r.ids){const s=samples.find(x=>x.id===id);r.assessments[s.assessment]=(r.assessments[s.assessment]||0)+1}}
const tests=[];function test(name,fn){fn();tests.push({name,passed:true})}
test('跨城不作为上海活动',()=>assert.equal(classify(samples.find(x=>x.id==='x4')),'outside_city'))
test('发布日期不填充开始时间',()=>assert.equal(samples.find(x=>x.id==='p5').start,null))
test('报名截止不代替活动日期',()=>assert.equal(classify({city:'上海',venue:'场地',registrationEnd:'2026-11-01'}),'needs_detail'))
test('详情恢复完整标题并按平台ID去重',()=>assert(same({platformId:'b:1',title:'标题...'},{platformId:'b:1',title:'标题完整'})))
test('不同场次保持独立',()=>assert(!same({title:'巡游',city:'上海',sessionKey:'17:30'},{title:'巡游',city:'上海',sessionKey:'20:00'})))
test('父活动和子活动不合并',()=>assert(!same(samples.find(x=>x.id==='m2'),samples.find(x=>x.id==='m3'))))
test('跟踪参数不改变链接身份',()=>assert.equal(canonicalUrl(sources.wild+'?utm_source=a'),canonicalUrl(sources.wild)))
test('到期样本过滤且未授权不发布',()=>{assert.equal(classify(samples[0]),'expired');assert(samples.every(x=>!x.publishable))})
const stats={};samples.forEach(x=>stats[x.assessment]=(stats[x.assessment]||0)+1)
const report={checkedAt:new Date().toISOString(),mode:'local_manual_review_not_system_search',databaseSnapshotRecords:records.length,rounds,samples,stats,tests,confirmedPublished:0,confirmedNew:0,notes:['无匹配仅为潜在新增，缺失字段与授权尚未解决。','三轮系统搜索另见round-1/2/3.json，未成功，不与人工复核混算。','所有样本publishable=false；未取得再展示授权。']}
fs.writeFileSync(path.join(out,'manual-review.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify({stats,rounds,tests,possibleMatches:samples.filter(x=>x.possibleMatches.length).map(x=>({title:x.title,matches:x.possibleMatches}))}))
