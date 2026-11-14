// One-time, audited migration of reviewed preview fields; never replace whole events.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const assert = require('assert/strict');
const cli = 'C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb';
const sourceDir = 'docs/detail-quality-v35-1790514595313';
const rows = JSON.parse(fs.readFileSync(path.join(sourceDir, 'summary.json')));
const decode = x => Array.isArray(x) ? x.map(decode) : x && typeof x === 'object' ? ('$numberLong' in x ? Number(x.$numberLong) : '$numberInt' in x ? Number(x.$numberInt) : '$numberDouble' in x ? Number(x.$numberDouble) : Object.fromEntries(Object.entries(x).map(([k,v]) => [k,decode(v)]))) : x;
function execute(type, command) {
  const p = spawnSync(process.execPath, [cli, '-e', 'cloud1-d3gm0lbv1392513d1', 'db', 'nosql', 'execute', '--command', JSON.stringify([{TableName:'events',CommandType:type,Command:JSON.stringify(command)}]), '--json'], {encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
  if (p.status !== 0) throw Error((p.stderr || p.stdout).slice(0,800));
  const result = JSON.parse(p.stdout.slice(p.stdout.indexOf('{')));
  if (!result.data?.results) throw Error('Unexpected database response: '+JSON.stringify(result).slice(0,800));
  return result;
}
const read = () => decode(execute('QUERY', {find:'events',filter:{_id:{$in:rows.map(r=>r.id)}},limit:100}).data.results[0]);
const save = (dir,name,value) => fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2));
if (process.argv[2] === 'prepare') {
  const dir = path.resolve('docs/field-refresh-v35-'+Date.now()); fs.mkdirSync(dir);
  const before = read(); assert.equal(before.length,4); save(dir,'before.json',before);
  const plans = rows.map((row,i) => {
    const old = before.find(e=>e._id===row.id), next = JSON.parse(fs.readFileSync(row.file)).result.validated[0];
    const set = {}, held = [];
    if (i===0) {
      const addition = next.participationGuide.entryRules;
      assert.equal(addition,'VIP票入场时间9:00，普通票入场时间10:00。');
      if (!(old.participationGuide.entryRules||'').includes(addition)) set['participationGuide.entryRules'] = (old.participationGuide.entryRules||'')+'；'+addition;
      held.push('保留原 H3 馆、会员购主入口、票价、实名及退票规则，不覆盖整条记录');
    } else if(i===1) {
      const options = [...(old.participationOptions||[])];
      for(const opt of next.participationOptions) {
        assert.ok(/^https:\/\/store\.(steamchina|steampowered)\.com\/sale\/steamchinamultiplayerweek$/.test(opt.url));
        if(!options.some(x=>x.url===opt.url)) options.push(opt);
      }
      if(JSON.stringify(options)!==JSON.stringify(old.participationOptions||[])) set.participationOptions = options;
      held.push('报名截止时间及适用对象未明确，本次不覆盖；原报名规则和主入口暂保留');
    } else if(i===2) held.push('新来源为创业企业展示页面，不能据此确认开发者日整体持续开放注册；暂不覆盖');
    else held.push('已有场馆和免费实名预约信息保留；新增预约 URL 缺少独立证据，本次不写入');
    return {id:row.id,title:old.title,source:row.file,expectedUpdatedAt:old.updatedAt,set,held};
  });
  save(dir,'plan.json',plans); console.log(JSON.stringify({dir,plans},null,2));
} else if(process.argv[2]==='apply') {
  const dir = path.resolve(process.argv[3]), before=JSON.parse(fs.readFileSync(path.join(dir,'before.json'))), plans=JSON.parse(fs.readFileSync(path.join(dir,'plan.json')));
  const current=read(), results=[];
  for(const p of plans) {
    const old=before.find(e=>e._id===p.id), now=current.find(e=>e._id===p.id);
    assert.deepEqual(now,old,'Record changed since preparation; prepare a new plan');
    if(!Object.keys(p.set).length) { results.push({id:p.id,status:'held',held:p.held}); continue; }
    assert.ok(old.updatedAt,'CAS timestamp required');
    for(const key of Object.keys(p.set)) assert.ok(['participationGuide.entryRules','participationOptions'].includes(key),'Unreviewed field');
    const patch={...p.set,updatedAt:Date.now()};
    const response=execute('UPDATE',{update:'events',updates:[{q:{_id:p.id,updatedAt:p.expectedUpdatedAt},u:{$set:patch},multi:false,upsert:false}]});
    results.push({id:p.id,status:'submitted',patch,response}); save(dir,'writes.json',results);
  }
  const after=read(); save(dir,'after.json',after);
  for(const r of results.filter(r=>r.patch)) {
    const expected=structuredClone(before.find(e=>e._id===r.id));
    for(const [key,value] of Object.entries(r.patch)) { const parts=key.split('.'); let obj=expected; while(parts.length>1)obj=obj[parts.shift()]; obj[parts[0]]=value; }
    assert.deepEqual(after.find(e=>e._id===r.id),expected,'Readback mismatch, inspect saved backup and writes'); r.status='verified';
  }
  for(const r of results.filter(r=>!r.patch)) assert.deepEqual(after.find(e=>e._id===r.id),before.find(e=>e._id===r.id));
  save(dir,'verification.json',results.map(({response,...r})=>r));
  console.log(JSON.stringify({dir,updated:results.filter(r=>r.status==='verified').length,held:results.filter(r=>r.status==='held').length,allUntouchedFieldsPreserved:true}));
} else throw Error('Usage: prepare | apply <prepared-directory>');
