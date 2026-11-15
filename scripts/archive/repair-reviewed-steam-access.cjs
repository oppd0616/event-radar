// Reviewed migration: quarantine an unscoped deadline; do not invent its audience.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawnSync}=require('child_process');
const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb';
const id='053e4eb1a9ccee10329e8441fcd93898';
const decode=x=>Array.isArray(x)?x.map(decode):x&&typeof x==='object'?('$numberLong'in x?Number(x.$numberLong):'$numberInt'in x?Number(x.$numberInt):'$numberDouble'in x?Number(x.$numberDouble):Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]))):x;
function execute(type,command){const r=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','db','nosql','execute','--command',JSON.stringify([{TableName:'events',CommandType:type,Command:JSON.stringify(command)}]),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});if(r.status!==0)throw Error((r.stderr||r.stdout).slice(0,600));const data=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));if(!data.data?.results)throw Error('Unexpected DB response');return data;}
const read=()=>decode(execute('QUERY',{find:'events',filter:{_id:id},limit:1}).data.results[0][0]);
const dir=path.resolve('docs/steam-access-repair-20260928');fs.mkdirSync(dir,{recursive:true});
const save=(name,x)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(x,null,2));
if(process.argv[2]==='prepare'){
 const old=read();assert(old&&old.updatedAt);save('before.json',old);
 const url='https://store.steamchina.com/sale/steamchinamultiplayerweek';
 assert(old.participationOptions.some(o=>o.url===url),'Official player entrance must already exist');
 const guide={...old.participationGuide,entryRules:'',steps:['进入蒸汽平台或 Steam 活动专题页','浏览参展游戏，具体参与方式以各游戏页面为准']};
 for(const key of ['accessEndTime','accessEndTimePrecision','accessEndSource'])delete guide[key];
 const patch={participation:{type:'website',url,note:'通过蒸汽平台或 Steam 官方活动专区浏览参展游戏。'},participationOptions:old.participationOptions.filter(o=>o.url!=='https://act.steamchina.com/2026MPGF'&&o.url!==url),participationGuide:guide,
  accessAudienceReview:{status:'pending',reason:'registration_audience_unconfirmed',reviewedAt:Date.now(),sourceUrl:'https://act.steamchina.com/2026MPGF',notes:'官方页写明9月8日报名截止，但未取得报名对象的充分公开证据；不能将其当作玩家参与截止。',archived:{participation:old.participation,entryRules:old.participationGuide.entryRules,steps:old.participationGuide.steps,accessEndTime:old.participationGuide.accessEndTime,accessEndSource:old.participationGuide.accessEndSource}},detailEnrichmentStatus:'pending'};
 save('plan.json',{id,expectedUpdatedAt:old.updatedAt,patch});console.log(JSON.stringify({dir,patch},null,2));
}else if(process.argv[2]==='apply'){
 const old=JSON.parse(fs.readFileSync(path.join(dir,'before.json'))),p=JSON.parse(fs.readFileSync(path.join(dir,'plan.json')));assert.deepEqual(read(),old,'Record changed: prepare again');
 const patch={...p.patch,updatedAt:Date.now()};save('write.json',execute('UPDATE',{update:'events',updates:[{q:{_id:id,updatedAt:p.expectedUpdatedAt},u:{$set:patch},multi:false,upsert:false}]}));
 const after=read();save('after.json',after);assert.deepEqual(after,{...old,...patch},'Readback mismatch');save('verification.json',{updated:1,verified:true,unrelatedFieldsUnchanged:true,archived:true});console.log(JSON.stringify({dir,updated:1,verified:true}));
}else throw Error('Use prepare or apply');
