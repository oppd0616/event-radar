const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {assessAccessAudience}=require('../cloudfunctions/fetchEvents/lib/access-audience');
const {scopeUpdateRisks}=require('../cloudfunctions/fetchEvents/lib/detail-update-policy');
const tokens=['9月8日'];
const check=(title,description,sourceTitle='活动通知')=>assessAccessAudience({title},{title:sourceTitle,description,link:'https://example.org'},tokens);
assert.equal(check('多人游戏嘉年华','报名截止9月8日').status,'unknown');
assert.equal(check('多人游戏嘉年华','游戏开发商参展报名截止9月8日').status,'mismatch');
assert.equal(check('展会参展商报名','展商报名截止9月8日').status,'verified');
assert.equal(check('动漫展','观众购票截止9月8日').status,'verified');
assert.equal(check('技术大会','讲者招募截止9月8日').status,'mismatch');
assert.equal(check('技术大会','参会报名截止9月8日').status,'verified');
assert.equal(check('大学生竞赛','参赛报名截止9月8日').status,'verified');
assert.equal(check('英语四六级考试','考生报名截止9月8日').status,'verified');
assert.equal(check('马拉松','跑者报名截止9月8日').status,'verified');
assert.equal(check('论文征稿','投稿截止9月8日').status,'verified');
assert.equal(check('动漫展','观众购票9月8日截止；展商申请9月2日截止').status,'verified');
assert.equal(check('动漫展','观众购票9月8日截止；展商申请9月8日截止').status,'unknown');
assert.equal(check('动漫展','观众入口见下方。报名9月8日截止').status,'unknown');
assert.equal(check('动漫展','展商报名9月8日截止','官方观众活动').status,'mismatch');
const saved=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/v21-validation/1790519575217-detail-pipeline-preview.json'))).result.validated[0];
assert(scopeUpdateRisks(saved,saved).includes('accessEndTime_audience_unverified'),'Real saved Steam deadline must no longer silently pass');
const filename=path.join(__dirname,'../cloudfunctions/fetchEvents/index.js'),mod={exports:{}};
vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.test={missingDetailReasons,normalizeExtractedStages};',{
  module:mod,exports:mod.exports,require:n=>n==='wx-server-sdk'?{init(){},database:()=>({command:{}})}:n.startsWith('.')?require(path.resolve(path.dirname(filename),n)):require(n),
  process:{env:{}},console,Buffer,URL,setTimeout,clearTimeout
},{filename});
assert(mod.exports.test.missingDetailReasons({...saved,participationGuide:{accessAudienceIssues:[{reason:'access_audience_unknown'}]}}).includes('access_audience'));
const issues=[];
const stages=mod.exports.test.normalizeExtractedStages([{phaseKey:'registration',sourceLabel:'报名',startTime:'2026-09-08T00:00:00+08:00',evidenceIndex:0}],
  [{title:'测试游戏嘉年华报名',description:'测试游戏嘉年华报名开始时间为2026年9月8日。',link:'https://example.org'}],
  '测试游戏嘉年华','game',Date.parse('2026-09-01T00:00:00+08:00'),issues);
assert.equal(stages.length,0);
assert.equal(issues.length,1,'Unknown audience must be reported rather than silently dropped');
console.log('Access audience: normal, ambiguous, conflicting, legacy Steam and stage integration checks passed');
