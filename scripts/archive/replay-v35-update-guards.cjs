// Replay saved real model outputs through production merge/guard code. No network or writes to DB.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const policy=require('../../cloudfunctions/fetchEvents/lib/detail-update-policy');
const source=fs.readFileSync(path.join(__dirname,'../../cloudfunctions/fetchEvents/index.js'),'utf8');
const context={preserveGuideValue:policy.preserveGuideValue,containsBrokenEncoding:s=>/\uFFFD/.test(String(s||''))};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function mergeParticipationGuide('),source.indexOf('function chinaDateLabel(')),context);
const root=path.join(__dirname,'../../docs/detail-quality-v35-1790514595313');
const current=JSON.parse(fs.readFileSync(path.join(__dirname,'../../docs/field-refresh-v35-1790515536676/after.json')));
const rows=JSON.parse(fs.readFileSync(path.join(root,'summary.json'))).map(row=>{
  const old=current.find(e=>e._id===row.id);
  const incoming=JSON.parse(fs.readFileSync(row.file)).result.validated[0];
  const guide=JSON.parse(JSON.stringify(context.mergeParticipationGuide(old.participationGuide,incoming.participationGuide)));
  const risks=policy.scopeUpdateRisks(old,incoming);
  assert.equal(guide.location,old.participationGuide.location,'Existing detailed venue lost');
  if(row.id==='081d938e59635d030053ea6773f15273') {
    assert(guide.location.includes('H3'));
    assert(guide.entryRules.includes('退票'));
    assert(guide.entryRules.includes('9:00'));
    assert.deepEqual(guide.steps,old.participationGuide.steps);
  }
  if(row.id==='37138adf6a9c12610164c3811293f677') assert(risks.includes('endTime_child_event_evidence'));
  return {id:row.id,title:old.title,scopeRisks:risks,venuePreserved:true,entryRulesPreserved:guide.entryRules===old.participationGuide.entryRules,stepsPreserved:JSON.stringify(guide.steps)===JSON.stringify(old.participationGuide.steps),limitations:row.id==='053e4eb1a9ccee10329e8441fcd93898'?['来源标题只写预约报名，不能由关键词判断其适用对象；仍需原始页面核实']:row.id==='37138adf6aa190a101bc2b7e57b01cb3'?['本回放仅检查合并及来源范围，不验证新增入口链接是否真实']:[]};
});
const report={kind:'offline_replay_of_saved_live_results',checkedAt:new Date().toISOString(),databaseWrites:0,searchCalls:0,rows};
const output=path.join(root,'guard-replay.json');fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({output,...report},null,2));
