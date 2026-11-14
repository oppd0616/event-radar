const fs=require('fs'),path=require('path'),vm=require('vm');
const {scopeUpdateRisks}=require('../cloudfunctions/fetchEvents/lib/detail-update-policy');
const dir=path.resolve(process.argv[2]);
function decode(x){if(Array.isArray(x))return x.map(decode);if(x&&typeof x==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in x)return Number(x[k]);return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]))}return x}
const backup=decode(JSON.parse(fs.readFileSync(path.join(dir,'backup.json'))));
const filename=path.join(__dirname,'../cloudfunctions/fetchEvents/index.js'),mod={exports:{}};
vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.audit={missingDetailReasons};',{
 module:mod,exports:mod.exports,require:n=>n==='wx-server-sdk'?{init(){},database:()=>({command:{}})}:n.startsWith('.')?require(path.resolve(path.dirname(filename),n)):require(n),process:{env:{}},console,Buffer,URL,setTimeout,clearTimeout
},{filename});
const now=Date.parse(backup.at);
const rows=backup.records.map(e=>{
 const issues=[...mod.exports.audit.missingDetailReasons(e),...scopeUpdateRisks(e,e)];
 if(e.accessAudienceReview?.status==='pending')issues.push('access_audience_pending_review');
 if(e.fieldReview?.remaining?.length)issues.push('manual_review_remaining');
 return {id:e._id,title:e.title,domain:e.domain,status:e.status,ended:!!(e.endTime&&e.endTime<now),within90Days:!e.startTime||e.startTime<=now+90*86400000,issues:[...new Set(issues)],pipelineVersion:e.detailVerificationPipelineVersion||0,startTime:e.startTime,endTime:e.endTime,location:e.participationGuide?.location||'',accessStartTime:e.participationGuide?.accessStartTime||0,accessEndTime:e.participationGuide?.accessEndTime||0,accessStartSource:e.participationGuide?.accessStartSource||null,accessEndSource:e.participationGuide?.accessEndSource||null,source:e.source?.url||''};
});
const active=rows.filter(r=>!r.ended&&r.within90Days),counts={};
for(const r of active)for(const issue of r.issues)counts[issue]=(counts[issue]||0)+1;
const report={at:backup.at,scope:'published and pending records; active means not explicitly ended and starting within 90 days',readOnly:true,total:rows.length,eligible:active.length,eligibleWithIssues:active.filter(r=>r.issues.length).length,counts,domains:[...new Set(active.map(r=>r.domain))].map(domain=>({domain,total:active.filter(r=>r.domain===domain).length,withIssues:active.filter(r=>r.domain===domain&&r.issues.length).length})),rows};
fs.writeFileSync(path.join(dir,'field-quality.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,rows:undefined,report:path.join(dir,'field-quality.json'),audienceReviewRecords:active.filter(r=>r.issues.some(x=>x.includes('audience'))).length},null,2));
