// Local review metadata only. Never enrolls sources or writes cloud records.
const fs=require('fs'),path=require('path'),assert=require('assert/strict')
const dir=path.resolve(__dirname,'../output/shanghai-youth-pilot-20261029-retry')
const file=path.join(dir,'reviewed-five.json'),data=JSON.parse(fs.readFileSync(file,'utf8'))
const snapshot=path.join(dir,'reviewed-five-before-followup.json')
if(!fs.existsSync(snapshot))fs.copyFileSync(file,snapshot)
const e=data.events.find(x=>x.id==='enhypen-shanghai')
const notice='https://m.weibo.cn/2/detail/5356064708495419'
e.accessStart='2026-10-26T12:00:00+08:00'
e.accessStartEvidence=notice
e.guideUrl=notice
e.guideLabel='查看官方预约指引'
e.directBookingUrl=null
e.note='上海站线上预约于10月26日12:00开放；首周不开放现场预约。查看一直娱官方预约公告，按预约时段入场。'
e.review='已确认上海站预约开放时间；公告正文未提供可核验的直接预约网址，配图访问返回403，已停止该图片请求。公告链接仅作指引，不标为直接预约入口。'
if(!e.sources.includes(notice))e.sources.push(notice)
const rabbit=data.events.find(x=>x.id==='runrun-rabbit')
rabbit.dateClaims=[{end:'2026-11-08',source:rabbit.sources[0],scope:'公共艺术生活空间展',evidenceKind:'场地方9月公告'},{end:'2026-11-10',source:rabbit.sources[2],scope:'公共艺术生活空间展',evidenceKind:'10月清单搜索缓存，未能重新读取'}]
rabbit.nextEvidenceNeeded='场地方明确写出完整活动名及最终结束日期的公告，或明确延期通知。'
const panlong=data.events.find(x=>x.id==='panlong')
panlong.dateClaims=[{end:'2026-11-08',source:'https://www.jfdaily.com/sgh/detail?id=4052034',scope:'蟠龙天地·新焺游园',evidenceKind:'旅游节活动清单'},{end:'2026-10-18',source:'https://www.shobserver.com/wx/detail.do?id=1183757',scope:'新焺游园·月满蟠龙',evidenceKind:'主题游园报道'}]
panlong.nextEvidenceNeeded='主办方对整体游园与月满蟠龙的关系、10月29日后仍开放的具体体验及日期作出明确说明。'
for(const s of panlong.dateClaims.map(x=>x.source))if(!panlong.sources.includes(s))panlong.sources.push(s)
data.followupAt=new Date().toISOString()
data.releaseReview={cloudWrites:0,deployments:0,externalMessages:0,approvedAutomaticSources:0,decision:'继续只读研究；本轮不触发发布',permissionReview:'所检查的公开主页及条款页面未给出可确认的自动采集与再展示授权；这不是认定内容一律禁止使用。'}
for(const event of data.events){
 event.releaseBlockers=['source_permission_unconfirmed']
 if(event.conflict)event.releaseBlockers.push('date_or_scope_unresolved')
 if(event.id==='enhypen-shanghai')event.releaseBlockers.push('direct_booking_entry_unverified')
 event.publishable=false
}
assert(e.accessStart<e.start)
assert.equal(e.directBookingUrl,null)
assert(data.events.filter(x=>x.conflict).every(x=>x.end===null&&x.dateClaims.length===2))
assert(data.events.every(x=>x.releaseBlockers.length>0&&!x.publishable))
fs.writeFileSync(file,JSON.stringify(data,null,2))
console.log('PASS: booking date separate from event date; guide is not booking URL; conflicts retained; all local publish flags remain false')
