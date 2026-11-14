const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm')
const {agenda,compareAgenda}=require('../cloudfunctions/manageFollows/model')
const now=Date.parse('2026-09-30T14:00:00+08:00'),DAY=86400000
const event={status:'published',timePrecision:'date',startTime:now+DAY}
assert.equal(agenda(event,now).key,'week')
assert.equal(agenda({...event,startTime:Date.parse('2026-10-05T00:00:00+08:00')},now).key,'later','Monday starts next week')
assert.equal(agenda({...event,startTime:now-DAY,endTime:now+DAY},now).key,'week','ongoing events stay relevant this week')
assert.equal(agenda({...event,timePrecision:'month_range'},now).key,'undated')
assert.equal(agenda(null,now).key,'unavailable')
assert.equal(agenda({...event,startTime:now-3*DAY,endTime:now-DAY},now).key,'archive')
const order=['archive','undated','later','week'].map(key=>({agenda:{key,at:1},record:{followedAt:1}})).sort(compareAgenda)
assert.deepEqual(order.map(row=>row.agenda.key),['week','later','undated','archive'])
const filename=path.resolve(__dirname,'../miniprogram/pages/follows/follows.js'),requests=[]
let page
let menu,modal
const wx={navigateTo(){},switchTab(){},showActionSheet(options){menu=options},showModal(options){modal=options}}
const dateFactory=value=>({format:fmt=>{const d=new Date(Number(value)+8*3600000),y=d.getUTCFullYear(),m=d.getUTCMonth()+1,day=d.getUTCDate();return {YYYY:String(y),'M月':m+'月','YYYY年M月':y+'年'+m+'月','M月D日':m+'月'+day+'日',DD:String(day).padStart(2,'0'),'YYYY-MM-DD':y+'-'+m+'-'+day}[fmt]}})
const rows=[{event:{...event,_id:'soon',title:'近期活动'},agenda:{key:'week'},plan:{key:'soon'}},{event:{...event,_id:'unknown',title:'月范围活动',timePrecision:'month_range'},agenda:{key:'undated'},plan:{key:'upcoming'}},{event:{...event,_id:'past',title:'已结束活动'},agenda:{key:'archive'},plan:{key:'ended'}}]
const api={getFollows:async input=>{requests.push(input);return {list:input.filter==='ended' ? [rows[2]] : rows,serverTime:now,total:3,nextCursor:null}}}
const pageContext={require:n=>n==='dayjs'?dateFactory:n.endsWith('/api')?api:{DOMAIN_MAP:{}},Page:p=>{page=p},wx,Date,console}
vm.runInNewContext(fs.readFileSync(filename,'utf8'),pageContext)
page.setData=data=>Object.assign(page.data,data)
async function main(){
 const examNow=Date.parse('2026-10-15T12:00:00+08:00')
 const oral={key:'oral',name:'英语四级口语考试（CET-SET4）',startTime:Date.parse('2026-11-21T00:00:00+08:00'),endTime:Date.parse('2026-11-21T23:59:59+08:00'),timePrecision:'date'}
 const written={key:'written',name:'笔试',startTime:Date.parse('2026-12-12T00:00:00+08:00'),timePrecision:'date'}
 const examRow={event:{...event,startTime:oral.startTime,endTime:written.startTime,currentStageName:oral.name,currentStageState:'upcoming',stages:[written,oral]},agenda:{key:'later'},plan:{key:'upcoming'}}
 const futureExam=pageContext.decorate(examRow,examNow)
 assert.equal(futureExam.phase,'','a future exam must not be labelled current')
 assert.equal(futureExam.next,'下一阶段：'+oral.name,'show the first future stage, not the later written exam')
 assert.equal(futureExam.status,'');assert.equal(futureExam.live,false)
 const activeExam=pageContext.decorate({...examRow,event:{...examRow.event,currentStageState:'active'}},oral.startTime+3600000)
 assert.equal(activeExam.phase,'当前：'+oral.name)
 assert.equal(activeExam.next,'下一阶段：笔试')
 const startedExam=pageContext.decorate({...examRow,event:{...examRow.event,currentStageState:'started'}},oral.endTime+1)
 assert.equal(startedExam.phase,'已开始：'+oral.name,'an unknown stage duration must not imply ongoing')
 const pastExam=pageContext.decorate({...examRow,event:{...examRow.event,currentStageState:'past'}},oral.endTime+1)
 assert.equal(pastExam.phase,'');assert.equal(pastExam.next,'下一阶段：笔试')
 const legacyExam=pageContext.decorate({...examRow,event:{...examRow.event,currentStageState:undefined}},examNow)
 assert.equal(legacyExam.phase,'阶段：'+oral.name,'missing stage state must not imply current')
 for(const override of [{agenda:{key:'archive'}},{unavailable:true}]){
   const hidden=pageContext.decorate({...examRow,...override},examNow)
   assert.equal(hidden.phase,'');assert.equal(hidden.next,'')
 }
 await page.load(true)
 assert.equal(requests[0].filter,'all');assert.equal(requests[0].intent,undefined)
 assert.deepEqual(Array.from(page.data.groups,g=>g.key),['week','undated','archive'])
 assert.equal(page.data.list[1].day,'—','month-level dates must not appear as precise days')
 assert.equal(page.data.archiveExpanded,false);page.onArchive();assert.equal(page.data.archiveExpanded,true)
 assert.equal(page.data.list[0].status,'明天开始')
 assert.equal(page.data.list[0].location,'地点待公布')
 assert.equal(page.data.summary,'本周有 1 场你关注的活动')
 const sameDay={...rows[0],event:{...rows[0].event,_id:'same-day'},hasUpdate:true,plan:{key:'deadline',at:now+DAY}}
 rows.push(sameDay)
 await page.load(true)
 const weekRows=page.data.groups[0].rows
 assert.equal(weekRows[0].showDate,true);assert.equal(weekRows[1].showDate,false)
 assert.equal(weekRows[1].listIndex,3,'same-date grouping retains the navigation index')
 assert.equal(weekRows[1].status,'参与入口明天截止','deadline wins over other status cues')
 assert.equal(page.data.summary,'有 1 场活动的参与入口即将截止')
 page.more({currentTarget:{dataset:{index:0}}})
 assert.deepEqual(Array.from(menu.itemList),['取消关注']);assert.equal(modal,undefined)
 menu.success({tapIndex:0});assert.equal(modal.title,'取消关注？')
 page.onFilter({currentTarget:{dataset:{filter:'ended'}}});await new Promise(resolve=>setImmediate(resolve))
 assert.equal(requests[2].filter,'ended');assert.equal(page.data.archiveExpanded,false)
 assert.equal(page.data.list[0].archiveNote,'10月已结束')
 assert.equal(page.data.groups[0].rows[0].listIndex,0,'grouped rows navigate with global list index')
 const template=fs.readFileSync(filename.replace('.js','.wxml'),'utf8')
 assert.equal((template.match(/class="filter-tab /g)||[]).length,2)
 assert(template.includes('收藏（已结束）'));assert(!/准备参加|想去|onIntent/.test(template))
 page.data.nextCursor=2
 const originalList=page.data.list,originalGroups=page.data.groups
 api.getFollows=async input=>{requests.push(input);throw Error('offline')}
 await page.load(false)
 assert.equal(page.data.list,originalList);assert.equal(page.data.groups,originalGroups)
 assert.equal(page.data.error,'');assert.equal(page.data.nextCursor,2)
 assert.equal(page.data.moreError,'加载更多失败，点击重试')
 const count=requests.length;page.onReachBottom();assert.equal(requests.length,count,'no automatic retry loop on weak networks')
 api.getFollows=async input=>{requests.push(input);return {list:[],total:3,nextCursor:null}}
 page.retryMore();await new Promise(resolve=>setImmediate(resolve))
 assert.equal(requests.at(-1).cursor,2);assert.equal(page.data.moreError,'')
 assert.equal(page.data.nextCursor,null);assert.equal(page.data.list.length,originalList.length)
 assert(template.includes('bindtap="retryMore"'))
 console.log('PASS: stage state labels, future exam next-stage selection, agenda week boundaries, two filters, grouping and pagination')
}
main().catch(error=>{console.error(error);process.exitCode=1})
