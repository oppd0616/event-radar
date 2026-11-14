const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm')
const {identityKeys,demandRoutes,discoveryQuery}=require('../shared/interest-expansion')
const learning=require('../shared/recommendation-learning')
const h=require('./audit-recommendation-ranking.cjs').loadHelpers()
const now=Date.parse('2026-10-13T12:00:00+08:00')
function helpers(name,names){const filename=path.resolve(__dirname,'../cloudfunctions',name,'index.js'),m={exports:{}},r=require('module').createRequire(filename);vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.test={'+names+'}',{module:m,exports:m.exports,require:n=>n==='wx-server-sdk'?{init(){},database:()=>({command:{}})}:n==='opencc-js'?{Converter:()=>x=>x}:r(n),console,process,Date,Set,Map,URL},{filename});return m.exports.test}
const recorder=helpers('recordSignal','topicKeysOf,buildLearningUpdate')
const search=helpers('fetchEvents','buildSearchPlan,selectDemandTarget,selectDiscoveryWork')
const common={city:'上海',startTime:now+86400000,endTime:now+3*86400000,confidence:.95,tags:[],participation:{type:'offline'}}
// Synthetic fixtures: no claim these events actually exist.
const events=[
 {_id:'cafe',title:'无畏契约联名茶餐厅快闪',domain:'culture'},
 {_id:'gaming',title:'瓦洛兰特概念网吧',domain:'culture'},
 {_id:'hack',title:'开源开发者黑客松',domain:'tech',topicKeys:['hackathon']},
 {_id:'car',title:'新能源汽车展',domain:'auto',topicKeys:['auto_show']},
 {_id:'generic-cafe',title:'港式茶餐厅开业',domain:'culture'}
].map(e=>({...common,...e}))
const initial={learningVersion:2,learningUpdatedAt:now,preferredTopics:[],preferredDomains:[],preferredCities:['上海'],recentSignals:[]}
const follow=(target)=>({...initial,...recorder.buildLearningUpdate(initial,target,'followed','follow',0,now).data})
const gamers=follow({title:'无畏契约冠军赛',domain:'game'})
const coders=follow({title:'计算机程序设计竞赛',domain:'academic'})
const drivers=follow({title:'新能源汽车展',domain:'auto'})
const ranked=u=>events.map(e=>({id:e._id,score:+h.computeScore(e,h.prepare(u,now),now).toFixed(4),reason:h.recommendReason(e,h.prepare(u,now))})).sort((a,b)=>b.score-a.score)
const game=ranked(gamers),code=ranked(coders),car=ranked(drivers)
assert.deepEqual(game.slice(0,2).map(e=>e.id).sort(),['cafe','gaming'])
assert.equal(code[0].id,'hack')
assert.equal(car[0].id,'car')
assert(game.find(e=>e.id==='cafe').reason.includes('无畏契约'))
assert(code[0].reason.includes('相关'))
assert.deepEqual(identityKeys(events[4]),[],'generic restaurants are not IP matches')
assert(recorder.topicKeysOf(events[0]).includes('valorant'),'cross-domain follow recognizes the IP')
assert(demandRoutes('academic',['computer_data']).some(r=>r.domain==='tech'&&r.topicKey==='hackathon'&&r.factor===.5))
assert(!demandRoutes('tech',['mobile']).some(r=>r.topicKey==='hackathon'),'phone launch is not programming interest')
assert(demandRoutes('culture',['valorant','brand_popup']).some(r=>r.domain==='game'&&r.topicKey==='valorant'))
const queries=[0,1,2].map(day=>search.buildSearchPlan('game',now+day*86400000,'valorant','',{valorant:5},false,false,'web',false))
assert(queries.every(p=>!p.namedTarget&&p.query.includes('无畏契约')))
assert(queries.some(p=>p.query.includes('茶餐厅')))
assert(queries.some(p=>p.query.includes('概念网吧')))
assert(search.buildSearchPlan('game',now,'valorant','',{},false,false,'web',false).query.includes('无畏契约'),'cold open search retains the selected IP')
assert(queries.every(p=>!p.query.includes('优先全球总决赛')),'experience queries do not inherit tournament deepening instructions')
assert(search.buildSearchPlan('game',now,'valorant','',{valorant:5},false,false,'web','无畏契约全球冠军赛').needsStructuredSchedule,'explicit tracking keeps tournament query')
assert.equal(search.selectDemandTarget({game:{valorant:{score:5,lastSearchedAt:now}}},now),undefined,'cooldown enforced')
const distant={...events[0],city:'北京'}
assert(h.computeScore(events[0],h.prepare(gamers,now),now)>h.computeScore(distant,h.prepare(gamers,now),now))
const disliked={...gamers,...learning.updateLearning(gamers,{eventId:'cafe',action:'dislike',domain:'culture',topicKeys:['valorant'],tags:[]},now+1000).data}
assert(h.computeScore(events[0],h.prepare(disliked,now+1000),now+1000)<h.computeScore(events[0],h.prepare(gamers,now),now))
const report={fixtureType:'synthetic - not published or verified events',game,computer:code,unrelated:car,queries:queries.map(p=>p.query)}
fs.writeFileSync(path.resolve(__dirname,'../docs/interest-expansion-test-20261013.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
