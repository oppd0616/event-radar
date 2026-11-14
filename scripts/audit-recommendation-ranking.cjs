const fs = require('fs'), path = require('path'), vm = require('vm'), { spawnSync } = require('child_process')
const root = path.resolve(__dirname, '..')
const fixtureFile = path.join(root, 'docs/recommendation-ranking-fixture-20260930.json')
const baselineFile = path.join(root, 'docs/recommendation-ranking-baseline-20260930.json')
function decode(v) {
  if (Array.isArray(v)) return v.map(decode)
  if (v && typeof v === 'object') {
    for (const k of ['$numberInt', '$numberLong', '$numberDouble']) if (k in v) return Number(v[k])
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)]))
  }
  return v
}
function loadHelpers() {
  const filename = path.join(root, 'cloudfunctions/getEvents/index.js'), mod = { exports: {} }
  const nativeRequire = require('module').createRequire(filename)
  const source = fs.readFileSync(filename, 'utf8') + '\nmodule.exports.audit = {simplifyEvent, visibleInFeed, dedupeFeedEvents, suppressCoveredSeriesSummaries, projectLifecycleCard, computeScore, interestScore, behaviorScore, timeScore, heatScore, eventValueScore, recommendReason, topicMatches, migrateCulturePreferences, multiRouteBlend, cityScore, feedbackPenalty, prepare: typeof prepareRecommendationPreferences === "function" ? prepareRecommendationPreferences : x => x};'
  vm.runInNewContext(source, { module: mod, exports: mod.exports, require: n => n === 'wx-server-sdk' ? { init() {}, database: () => ({ command: {} }) } : n === 'opencc-js' ? { Converter: () => x => x } : nativeRequire(n), console, URL, Date, Set, Map }, { filename })
  return mod.exports.audit
}
function profile(name, domain, key, city) {
  return { name, preferences: { personalizationEnabled: true, preferredDomains: [{domain, weight: 3}], preferredTopics: [{domain, key, label: key, weight: 3}], preferredCities: city ? [city] : ['全国'], preferredFormats: [], growthGoals: [], recentSignals: [], learnedTopicWeights: {}, learnedTopicKeyWeights: {}, learnedDomainWeights: {} } }
}
function report(fixture) {
  const h = loadHelpers(), now = fixture.now
  const events = h.suppressCoveredSeriesSummaries(h.dedupeFeedEvents(fixture.events.filter(e => h.visibleInFeed(e, now, now + 180 * 86400000)).map(h.simplifyEvent))).map(e => h.projectLifecycleCard(e, now))
  const profiles = [profile('无畏契约', 'game', 'valorant'), profile('AI 与大模型', 'tech', 'ai'), profile('演唱会', 'ent', 'stadium_concert'), profile('艺术展览', 'culture', 'art_exhibition', '上海'), profile('黑客松', 'tech', 'hackathon')]
  return { at: new Date().toISOString(), readOnly: true, eventPool: events.length, profiles: profiles.map(p => {
    const prefs = h.prepare(h.migrateCulturePreferences(p.preferences), now)
    const ranked = events.map(e => ({...e, _score:h.computeScore(e,prefs,now), _interestScore:h.interestScore(e,prefs,now), _behaviorScore:h.behaviorScore(e,prefs.learnedTopicWeights,prefs.learnedTopicKeyWeights,prefs.learnedDomainWeights,prefs.recentSignals,now), _urgencyScore:h.timeScore(e.startTime,now,e.endTime), _heatScore:h.heatScore(e), _exploreScore:h.eventValueScore(e), _qualityScore:(e.confidence||0)*0.58+h.eventValueScore(e)*0.42})).sort((a,b)=>b._score-a._score)
    const first = h.multiRouteBlend(ranked,prefs,now).slice(0,20)
    const availableMatches=events.filter(e=>h.topicMatches(e,prefs.preferredTopics[0])).length
    return {name:p.name,availableMatches,matchedTop10:first.slice(0,10).filter(e=>h.topicMatches(e,prefs.preferredTopics[0])).length,matchedTop20:first.filter(e=>h.topicMatches(e,prefs.preferredTopics[0])).length,top10:first.slice(0,10).map(e=>({title:e.title,domain:e.domain,city:e.city,matched:h.topicMatches(e,prefs.preferredTopics[0]),reason:h.recommendReason(e,prefs)}))}
  }) }
}
async function main() {
  if (process.argv.includes('--baseline')) {
    const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
    const command={find:'events',filter:{status:'published'},limit:600}
    const run=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','db','nosql','execute','--command',JSON.stringify([{TableName:'events',CommandType:'QUERY',Command:JSON.stringify(command)}]),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024})
    if(run.status!==0)throw Error((run.stderr||run.stdout).slice(0,500))
    const result=JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
    const fixture={now:Date.now(),events:decode(result.data.results[0])}
    fs.writeFileSync(fixtureFile,JSON.stringify(fixture,null,2))
    const before=report(fixture);fs.writeFileSync(baselineFile,JSON.stringify(before,null,2))
    console.log(JSON.stringify({baselineFile,eventPool:before.eventPool,profiles:before.profiles.map(({top10,...p})=>p)}))
  } else {
    const after=report(JSON.parse(fs.readFileSync(fixtureFile,'utf8'))),before=JSON.parse(fs.readFileSync(baselineFile,'utf8'))
    const file=path.join(root,'docs/recommendation-ranking-comparison-20260930.json')
    fs.writeFileSync(file,JSON.stringify({before,after},null,2))
    console.log(JSON.stringify({file,eventPool:after.eventPool,profiles:after.profiles.map((p,i)=>({name:p.name,availableMatches:p.availableMatches,beforeTop10:before.profiles[i].matchedTop10,afterTop10:p.matchedTop10,beforeTop20:before.profiles[i].matchedTop20,afterTop20:p.matchedTop20}))}))
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1})
module.exports={loadHelpers}
