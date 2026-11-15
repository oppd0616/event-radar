// Scoped, backed-up cloud repair for the two verified records only.
const fs=require('fs'),assert=require('assert/strict'),{spawnSync}=require('child_process')
const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const ids=['e7870e9ec1a8545e2bc30f67c8f96dfa','69431252950bc8700ae4d26ef72a55cd']
function invoke(name,data){
  const r=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','fn','invoke',name,'-d',JSON.stringify(data),'--json'],{encoding:'utf8',timeout:180000,maxBuffer:16000000})
  if(r.status!==0)throw Error((r.stdout||r.stderr).slice(0,1000))
  return JSON.parse(JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))).data.RetMsg)
}
const dir='output/silk-repair-'+Date.now();fs.mkdirSync(dir,{recursive:true})
const save=(n,x)=>fs.writeFileSync(dir+'/'+n+'.json',JSON.stringify(x,null,2))
const audit=invoke('fetchEvents',{mode:'identity-audit',eventIds:ids});save('before',audit)
assert.equal(audit.ok,true);assert.equal(audit.duplicateGroups,1);assert.deepEqual([...audit.groups[0].ids].sort(),[...ids].sort());assert.equal(audit.groups[0].conflicts.length,0)
console.log('Scoped audit passed; one duplicate group, no date conflicts')
const result=invoke('fetchEvents',{mode:'identity-repair',eventIds:ids,limit:1});save('repair',result)
assert.equal(result.ok,true);assert.equal(result.linkedRecords,1)
const primary=result.results[0].primaryId
for(const id of ids){const detail=invoke('getEvents',{id});save('detail-'+id,detail);assert.equal(detail.event._id,primary)}
const search=invoke('getEvents',{search:true,query:'丝路有多长',pageSize:20});save('search',search)
assert.equal(search.list.filter(e=>/丝路有多长/.test(e.title||e.displayTitle)).length,1)
console.log(JSON.stringify({dir,primary,archiveId:result.results[0].archiveId,oldLinks:'both resolve',visibleMatches:1}))
