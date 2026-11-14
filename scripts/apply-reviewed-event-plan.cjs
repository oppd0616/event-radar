// Apply an explicitly reviewed plan with full snapshots and compare-and-swap protection.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawnSync}=require('child_process');
const dir=path.resolve(process.argv[2]),plans=JSON.parse(fs.readFileSync(path.join(dir,'plan.json')));
const cli=require('./dashboard-cloudbase-cli.cjs').resolveCli();
function decode(x){if(Array.isArray(x))return x.map(decode);if(x&&typeof x==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in x)return Number(x[k]);return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]))}return x}
function execute(type,command){const p=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','db','nosql','execute','--command',JSON.stringify([{TableName:'events',CommandType:type,Command:JSON.stringify(command)}]),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});if(p.status!==0)throw Error((p.stderr||p.stdout).slice(0,600));const r=JSON.parse(p.stdout.slice(p.stdout.indexOf('{')));assert(r.data?.results);return r;}
const read=()=>decode(execute('QUERY',{find:'events',filter:{_id:{$in:plans.map(p=>p.id)}},limit:100}).data.results[0]);
const before=read();assert.equal(before.length,plans.length);const save=(name,x)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(x,null,2));
assert(!fs.existsSync(path.join(dir,'before.json')),'Already applied/prepared: inspect saved state before retrying');save('before.json',before);
const writes=[];
for(const plan of plans){
 const old=before.find(e=>e._id===plan.id);assert.equal(old.updatedAt,plan.expectedUpdatedAt,'Concurrent update: rebuild plan');assert(plan.evidence&&plan.evidence.url);
 for(const key of Object.keys(plan.set))assert(!/^(?:_id|hash|canonicalKey|createdAt)(?:\.|$)/.test(key),'Identity modification forbidden');
 const patch={...plan.set,updatedAt:Date.now()};
 const result=execute('UPDATE',{update:'events',updates:[{q:{_id:plan.id,updatedAt:old.updatedAt},u:{$set:patch},multi:false,upsert:false}]});
 writes.push({id:plan.id,patch,result});save('writes.json',writes);
}
const after=read();save('after.json',after);
for(const w of writes){const expected=structuredClone(before.find(e=>e._id===w.id));for(const [key,value]of Object.entries(w.patch)){const parts=key.split('.');let target=expected;while(parts.length>1)target=target[parts.shift()];target[parts[0]]=value;}assert.deepEqual(after.find(e=>e._id===w.id),expected,'Readback mismatch');}
save('verification.json',{updated:writes.length,verified:true,otherFieldsUnchanged:true});console.log(JSON.stringify({dir,updated:writes.length,verified:true}));
