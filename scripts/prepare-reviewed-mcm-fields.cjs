const fs=require('fs'),path=require('path');
function decode(x){if(Array.isArray(x))return x.map(decode);if(x&&typeof x==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in x)return Number(x[k]);return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]))}return x}
const old=decode(JSON.parse(fs.readFileSync('docs/old-data-audit-2026-09-28T03-00-24-600Z/backup.json'))).records.find(e=>e._id==='37138adf6a9963100136d4d7795c0b6e');
const evidence={url:'https://en.mcm.edu.cn/',rawTitle:'CUMCM-2026 official contest schedule',tier:'official',authority:100};
const set={endTime:Date.parse('2026-09-13T20:00:00+08:00'),endTimePrecision:'datetime',endTimeSource:evidence,
 'participationGuide.entryRules':'报名参赛、论文提交通过中国知网竞赛管理系统办理。',
 'participationGuide.entryRulesSource':{url:'https://www.mcm.edu.cn/',rawTitle:'全国大学生数学建模竞赛官网',tier:'official',authority:100},
 fieldReview:{reviewedAt:Date.now(),correctedFields:['endTime','participationGuide.entryRules'],sourceUrl:evidence.url,archivedEntryRules:old.participationGuide.entryRules,reason:'补充官方结束时刻，避免缺失结束时间；重新表述乱码规则，不推断新的报名截止。'}};
const dir=path.resolve('docs/mcm-field-repair-20260928');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify([{id:old._id,expectedUpdatedAt:old.updatedAt,evidence,set}],null,2));console.log(JSON.stringify({dir,set},null,2));
