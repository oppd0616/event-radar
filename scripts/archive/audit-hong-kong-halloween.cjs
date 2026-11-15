// Read-only keyword audit of discovery and publication; does not start searches or publish records.
const { spawnSync } = require('child_process');
const cli = 'C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb';
const pattern = '万圣|萬聖|Halloween|哈啰喂|哈囉喂|迪士尼|Disney|海洋公园|海洋公園|Ocean Park|兰桂坊|蘭桂坊';
const details = process.argv.includes('--details') || process.argv.includes('--view');
const hubs = process.argv.includes('--hubs');
function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    for (const key of ['$numberLong', '$numberInt', '$numberDouble']) if (key in value) return Number(value[key]);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
  }
  return value;
}
for (const collection of hubs ? ['eventCandidates'] : details ? ['events', 'discoveryTargets'] : ['events', 'eventCandidates']) {
  const records = [];
  for (let skip = 0; skip < 1000; skip += 100) {
    const query = { find: collection,
      filter: { ...(details ? {city: '香港'} : {}), $or: ['title', 'summary', 'tags', ...(collection === 'discoveryTargets' ? ['name'] : [])].map(field => ({ [field]: { $regex: pattern, $options: 'i' } })) },
      projection: { _id: 1, title: 1, name: 1, domain: 1, city: 1, status: 1, topicKey: 1, sourceType: 1, trackingExpiresAt: 1, lastReason: 1, missingDetails: 1, startTime: 1, endTime: 1, nextCheckAt: 1, updatedAt: 1, ...(details ? {summary: 1, participationGuide: 1, participation: 1, stages: 1, source: 1, openingSchedule:1} : {}) },
      sort: { _id: 1 }, skip, limit: 100 };
    const request = [{ TableName: collection, CommandType: 'QUERY', Command: JSON.stringify(query) }];
    if (hubs) { query.filter = {kind:'topic_hub_cache'}; query.projection = {identities:1,version:1,url:1,fetchedAt:1,...(process.argv.includes('--section') ? {item:1} : {})}; request[0].Command = JSON.stringify(query); }
    const run = spawnSync(process.execPath, [cli, '-e', 'cloud1-d3gm0lbv1392513d1', 'db', 'nosql', 'execute', '--command', JSON.stringify(request), '--json'], { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    if (run.status !== 0) throw Error((run.stderr || run.stdout || String(run.error)).slice(0, 600));
    const data = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')));
    const rows = decode(data.data.results[0]);
    if (!Array.isArray(rows)) throw Error('Unexpected query response');
    records.push(...rows);
    if (rows.length < 100) break;
    if (skip === 900) throw Error('Audit limit reached');
  }
  const compact = process.argv.includes('--compact');
  if (hubs && process.argv.includes('--section')) {
    for(const row of records){const section=require('../../cloudfunctions/fetchEvents/lib/topic-hubs').sectionItem(row.item,'蘭桂坊怪物巡禮夜變裝派對',row.identities,Date.now());console.log(JSON.stringify({sectionFound:!!section,chars:section && section.description.length,dates:section && section.verifiedOpeningDates,preview:section && section.description.slice(0,300)}));}
    continue;
  }
  console.log(JSON.stringify({ collection, readOnly: true, keywordMatches: records.length, records: compact ? records.map(x=>({_id:x._id,title:x.title || x.name,status:x.status,openingSchedule:(x.openingSchedule || []).map(g=>({label:g.label,scope:g.scope,complete:g.complete,dates:g.dates}))})) : records }));
  if (collection === 'events' && process.argv.includes('--view')) for (const row of records.filter(x=>/兰桂坊|蘭桂坊|中环|中環/.test(x.title))) {
    const p=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','fn','invoke','getEvents','-d',JSON.stringify({id:row._id}),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
    if(p.status!==0)throw Error('getEvents readback failed');
    const envelope=JSON.parse(p.stdout.slice(p.stdout.indexOf('{'))),result=JSON.parse(envelope.data.RetMsg);
    const event=result.event || {};
    console.log(JSON.stringify({view:true,title:event.title,openingSchedule:compact ? (event.openingSchedule || []).map(g=>({label:g.label,scope:g.scope,complete:g.complete,dates:g.dates})) : event.openingSchedule,openingState:event.openingState}));
  }
}
