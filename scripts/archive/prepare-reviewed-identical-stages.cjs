const fs=require('fs'),path=require('path'),assert=require('assert/strict');
// Review only an exact duplicate ceremony with matching source and timestamps.
const old=JSON.parse(fs.readFileSync('docs/hnu-field-repair-20260928/after.json')).find(x=>x._id==='f791c41956963085246df95208ed7647');
const final=old.stages.find(s=>s.key==='final'),closing=old.stages.find(s=>s.key==='closing');
assert(final&&closing&&final.evidenceVerified&&closing.evidenceVerified);
for(const key of ['sourceLabel','startTime','endTime','venue','sessionKey','sourceUrl'])assert.equal(final[key],closing[key],key+' differs: do not merge');
assert(/颁奖/.test(final.sourceLabel)&&!/决赛/.test(final.sourceLabel));
const set={stages:old.stages.filter(s=>s!==final),fieldReview:{...old.fieldReview,reviewedAt:Date.now(),correctedFields:[...(old.fieldReview.correctedFields||[]),'stages:duplicate_ceremony'],archivedDuplicateStages:[final],reason:old.fieldReview.reason+' 同名、同时间、同来源的颁奖阶段被重复标为final/closing，保留closing并归档重复项。'}};
const evidence={url:'https://csee.hnu.edu.cn/info/1062/14223.htm',rawTitle:'湖南大学先导杯校赛启动通知'};
const dir=path.resolve('docs/identical-stage-repair-20260928');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify([{id:old._id,expectedUpdatedAt:old.updatedAt,evidence,set}],null,2));console.log(JSON.stringify({dir,stagesBefore:old.stages.length,stagesAfter:set.stages.length}));
