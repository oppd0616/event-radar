const fs=require('fs'),{spawnSync}=require('child_process'),assert=require('assert/strict')
const cli=require('./dashboard-cloudbase-cli.cjs').resolveCli()
function invoke(fn,data){const p=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','fn','invoke',fn,'-d',JSON.stringify(data),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,windowsHide:true});if(p.status!==0)throw Error('Cloud verification failed; output withheld');const v=JSON.parse(p.stdout.slice(p.stdout.indexOf('{')));assert(!v.error&&v.data);return JSON.parse(v.data.RetMsg)}
const health=invoke('fetchEvents',{mode:'health'});assert.equal(health.productAudienceVersion,'2026-10-30.1')
const checks=invoke('fetchEvents',{mode:'write-quality-health'});assert.equal(checks.ok,true);assert.equal(checks.checks.familyAudienceReview,true)
const held=invoke('getEvents',{id:'e8ce8a5a45741c1400803849d86a3060'});assert(!held.event,'Held event must not be public')
const retained=invoke('getEvents',{id:'564d8c3992b06cae924cf8be8171c4ac'});assert.equal(retained.event?._id,'564d8c3992b06cae924cf8be8171c4ac')
const result={at:new Date().toISOString(),version:health.productAudienceVersion,checks:checks.checks,heldEventHidden:true,generalRaceStillReadable:true}
fs.writeFileSync('output/product-audience-20261030/cloud-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
