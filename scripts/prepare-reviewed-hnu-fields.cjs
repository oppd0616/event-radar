const fs=require('fs'),path=require('path');
function decode(x){if(Array.isArray(x))return x.map(decode);if(x&&typeof x==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in x)return Number(x[k]);return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]))}return x}
const all=decode(JSON.parse(fs.readFileSync('docs/old-data-audit-2026-09-28T03-00-24-600Z/backup.json'))).records;
const ids=['1ff5c9ea65d52c90bd3efc15af0a271b','f791c41956963085246df95208ed7647'];
const evidence={url:'https://csee.hnu.edu.cn/info/1062/14223.htm',rawTitle:'2026年全国大学生计算机系统能力大赛 智能计算创新设计赛（先导杯）湖南大学校赛启动',audience:'participant',quote:'请参赛同学填写报名信息表，于10月15日24：00前填写完成。',tier:'institutional',authority:90};
const end=Date.parse('2026-10-16T00:00:00+08:00');
const plans=ids.map(id=>{
 const old=all.find(e=>e._id===id),guide={...old.participationGuide,location:'',accessEndTime:end,accessEndTimePrecision:'datetime',accessEndSource:evidence};delete guide.locationSource;
 const stages=old.stages.map(s=>s.key==='registration'?{...s,endTime:end,endTimePrecision:'datetime',sourceUrl:evidence.url,audience:'participant',audienceQuote:evidence.quote}:s);
 return {id,expectedUpdatedAt:old.updatedAt,evidence,set:{participationGuide:guide,stages,detailEnrichmentStatus:'pending',fieldReview:{reviewedAt:Date.now(),sourceUrl:evidence.url,correctedFields:['participationGuide.location','participationGuide.accessEndTime','registration.endTime'],archivedLocation:{value:old.participationGuide.location,source:old.participationGuide.locationSource||null},reason:'计算机学院201仅为9月15日启动会地点，不是整个赛事地点；报名截止为10月15日24:00。',remaining:['相同赛事的两条记录需按父活动及阶段关系核实','比赛开始原文为10月20日前后，不能当作已确认的精确日期']}}};
});
const dir=path.resolve('docs/hnu-field-repair-20260928');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify(plans,null,2));console.log(JSON.stringify({dir,records:plans.length,deadline:new Date(end).toISOString(),identityAndEventDatesUnchanged:true}));
