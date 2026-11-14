const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const filename = path.join(__dirname, '../cloudfunctions/fetchEvents/index.js')
const records = new Map()
const operations = []
const wsaQueries = []
const op = (type) => (value) => ({ type, value })
const db = {
  command: { lte: op('lte'), gt: op('gt'), in: op('in') },
  runTransaction: async (fn) => fn(db),
  collection(name) {
    return {
      async add({ data }) {
        const id = 'test-' + records.size
        records.set(name + ':' + id, { ...data })
        return { _id: id }
      },
      doc(id) {
        const key = name + ':' + id
        return {
          async get() { return { data: records.has(key) ? { ...records.get(key), _id: id } : null } },
          async set({ data }) {
            if (name === 'eventCandidates') {
              assert.ok(data.fingerprint, 'production candidate unique index requires a fingerprint on metadata too')
              assert.ok(!Array.from(records.entries()).some(([other, row]) => other.startsWith('eventCandidates:') && other !== key && row.fingerprint === data.fingerprint), 'candidate fingerprint must be unique')
            }
            records.set(key, { ...data }); operations.push(['set', key])
          },
          async update({ data }) {
            assert.ok(records.has(key), 'must not update a missing document')
            records.set(key, { ...records.get(key), ...data })
          }
        }
      },
      where(filter) {
        let rows = Array.from(records.entries()).filter(([key, row]) => key.startsWith(name + ':') &&
          Object.entries(filter).every(([field, value]) => {
            if (!value || !value.type) return row[field] === value
            if (value.type === 'lte') return row[field] <= value.value
            if (value.type === 'gt') return row[field] > value.value
            return value.value.includes(row[field])
          })).map(([key, row]) => ({ ...row, _id: key.slice(name.length + 1) }))
        return {
          orderBy(field) { rows.sort((a, b) => a[field] - b[field]); return this },
          skip(n) { rows = rows.slice(n); return this },
          limit(n) { rows = rows.slice(0, n); return this },
          async get() { return { data: rows } }
        }
      }
    }
  }
}
const cloud = { init() {}, database: () => db, getWXContext: () => ({}) }
const mod = { exports: {} }
vm.runInNewContext(fs.readFileSync(filename, 'utf8') + `
module.exports.helpers = { buildSearchPlan, resolveRequestedNamedTarget, discoverySlot,
  registerDiscoveryTarget, rankDiscoveryTargets, selectDiscoveryWork, finishDiscoverySearch, saveSearchCache,
  loadSearchCache, searchCacheDocId, initializeDiscoveryTargets, ensureDiscoverySeeds, callWebSearch,
  isCurrentDiscoveryEvidence, saveDiscoveryCandidates, detailIdentityAliases,
  evidenceTitleMatchesEvent, candidateCompetitionTarget, NAMED_IP_ROSTER,
  sameDiscoveredEvent, mergeDiscoveredEvent, mergeEventStages }
`, { module: mod, exports: mod.exports, require: (name) => name === 'wx-server-sdk'
    ? cloud
    : name === './lib/detail-script' ? { detailSearchText: (value) => String(value || '') }
      : name === './lib/wsa-search' ? {
        authMode: () => 'ak_sk',
        search: async (query) => {
          wsaQueries.push(query)
          return { requestId: 'test', items: [{ title: '2026年CICF×AGF广州动漫游戏盛典定档',
            description: '2026年10月2日至5日在广州保利世贸博览馆举行',
            link: 'https://www.cicfexpo.com/index.php?a=show&id=1198' }] }
        }
      }
      : (name.startsWith('.') ? require(path.resolve(path.dirname(filename), name)) : require(name)),
  process, console, Buffer, URL, setTimeout, clearTimeout }, { filename })
const h = mod.exports.helpers
const now = Date.parse('2026-09-12T05:00:00+08:00')

async function main() {
  const dynamicNow = Date.now()
  for (const name of ['2026新品牌航空黑客松', '2026全新品牌AI挑战赛', '2026新IP联名概念网吧']) {
    const game = name.includes('网吧')
    const domain = game ? 'game' : 'tech', topicKey = game ? 'valorant' : 'hackathon'
    const evidence = [{title:name,link:'https://example.org/'+encodeURIComponent(name),description:'新活动报名公告'}]
    const identities = [{title:name,domain,evidenceIndex:0}]
    const context = {domain,topicKey,city:'',namedTarget:''}
    const first = await h.saveDiscoveryCandidates(identities,evidence,context,dynamicNow)
    assert.equal(first.trackedTargets,0,'unverified identity must not become a recurring target')
    assert.equal(first.discoveredCandidates,1)
    assert.equal(Array.from(records.entries()).some(([key,row])=>key.startsWith('discoveryTargets:')&&row.name===name),false)
    const entry = Array.from(records.entries()).find(([key,row])=>key.startsWith('eventCandidates:')&&row.title===name)
    for (const status of ['waiting','ready_to_extract','published','rejected']) {
      records.set(entry[0],{...entry[1],status,retryCount:3,nextCheckAt:dynamicNow+1000,lastReason:'verification_in_progress',verificationCachedAt:123,verificationRawItems:[{title:'cached'}]})
      const repeated = await h.saveDiscoveryCandidates(identities,evidence,context,dynamicNow+1)
      assert.equal(repeated.discoveredCandidates,0)
      const current=records.get(entry[0])
      assert.equal(current.status,status);assert.equal(current.retryCount,3)
      assert.equal(current.nextCheckAt,dynamicNow+1000);assert.equal(current.verificationCachedAt,123)
      assert.equal(current.verificationRawItems[0].title,'cached')
      assert.equal(current.lastReason,'verification_in_progress')
    }
  }
  assert.equal(Array.from(records.keys()).filter(key=>key.startsWith('events:')).length,0,'tracking cannot publish unverified facts')
  records.clear();operations.length=0
  const admission = require('../cloudfunctions/fetchEvents/lib/discovery-admission')
  const english = { title: 'FORMULA 1 QATAR GRAND PRIX 2026', domain: 'auto', city: '卢塞尔', sources: [{url:'https://official.example/racing/2026/qatar'}] }
  const aliasContext = { title: '2026年F1卡塔尔大奖赛', domain: 'auto', city: '卢塞尔', evidence: { title: english.title, link: english.sources[0].url }, exclusive: true }
  assert.equal(admission.sourceAlias([english], aliasContext), english, 'exclusive primary-source title can link translated aliases')
  assert.equal(admission.sourceAlias([english], {...aliasContext, title:'2027年F1卡塔尔大奖赛'}), null)
  assert.equal(admission.sourceAlias([english], {...aliasContext, exclusive:false}), null, 'a shared roundup URL cannot merge unrelated events')
  assert.equal(admission.sourceAlias([english], {...aliasContext, city:'多哈'}), null, 'uncertain venue scope stays separate')
  const context = { domain: 'finance', topicKey: 'web3', namedTarget: '' }
  const source = [{ title: '官方新会议公告', link: 'https://example.org/official-announcement' }]
  for (let i = 0; i < admission.LIMIT; i++) {
    const result = await h.saveDiscoveryCandidates([{ title: '2026新会议' + i, domain: 'finance', evidenceIndex: 0 }], source, context, dynamicNow)
    assert.equal(result.discoveredCandidates, 1)
  }
  const overflow = await h.saveDiscoveryCandidates([{ title: '2026第六十一场会议', domain: 'finance', evidenceIndex: 0 }], source, context, dynamicNow)
  assert.equal(overflow.admissionDeferred, 1, 'new temporary pool has a hard per-domain bound')
  assert.equal(Array.from(records.keys()).filter(x => x.startsWith('discoveryTargets:')).length, 0)
  const expiredSample = Array.from(records.values()).find(x => x.discoveryAdmissionVersion)
  assert.equal(admission.expired(expiredSample, dynamicNow + admission.TTL), true)
  assert.equal(admission.expired({ status: 'waiting', createdAt: 1 }, dynamicNow), false, 'legacy candidates remain protected')
  assert.equal((await h.saveDiscoveryCandidates([{ title: '2026新的有效会议', domain: 'finance', evidenceIndex: 0 }], source, context, dynamicNow + admission.TTL)).discoveredCandidates, 1, 'expired reservations release capacity')
  await admission.release(db, 'finance', 'discovery-' + expiredSample.fingerprint)
  const quota = records.get('eventCandidates:discovery-capacity-candidate-finance')
  assert.ok(!quota.slots['discovery-' + expiredSample.fingerprint], 'release replaces the slot map instead of preserving deleted nested keys')
  for (let i = 0; i < 40; i++) assert.equal(await admission.reserve(db, 'finance', 'verified-' + i, dynamicNow, dynamicNow + admission.DAY, 'tracking', 40), true)
  assert.equal(await admission.reserve(db, 'finance', 'verified-overflow', dynamicNow, dynamicNow + admission.DAY, 'tracking', 40), false)
  assert.equal(await admission.reserve(db, 'finance', 'verified-overflow', dynamicNow + admission.DAY, dynamicNow + 2 * admission.DAY, 'tracking', 40), true)
  records.clear();operations.length=0
  await h.saveDiscoveryCandidates([{ title: '2026新的全球黑客松', domain: 'tech', evidenceIndex: 0 }], source, context, dynamicNow)
  const crossDomain = Array.from(records.values()).find(x => x.title === '2026新的全球黑客松')
  assert.equal(crossDomain.topicKey, 'hackathon', 'cross-domain candidates must have a valid verification topic')
  records.clear();operations.length=0
  const batch = Array.from({ length: 20 }, (_, i) => ({ title: '新活动' + i, domain: 'finance', evidenceIndex: 0 }))
  assert.equal((await h.saveDiscoveryCandidates(batch, source, context, dynamicNow)).discoveredCandidates, 3, 'oversized model output cannot flood the queue')
  records.clear();operations.length=0
  const knockout = {
    title: '2026KPL王者荣耀年度总决赛淘汰赛（长沙站）', domain: 'game', city: '长沙',
    startTime: Date.parse('2026-10-26T00:00:00+08:00'), timePrecision: 'date',
    stageEvidenceVerified: true, participation: {}, participationGuide: { location: '长沙七彩盒子' }
  }
  const final = {
    title: '2026KPL王者荣耀年度总决赛（成都站）', domain: 'game', city: '成都',
    startTime: Date.parse('2026-11-14T00:00:00+08:00'), timePrecision: 'date',
    stageEvidenceVerified: true, participation: {}, participationGuide: { location: '成都' }
  }
  assert.ok(h.sameDiscoveredEvent(knockout, final), 'distinct rounds in different cities form one series')
  const mergedTournament = h.mergeDiscoveredEvent(knockout, final)
  assert.deepEqual(Array.from(mergedTournament.stages, (stage) => stage.key), ['knockout', 'final'])
  assert.equal(mergedTournament.startTime, knockout.startTime)
  assert.equal(mergedTournament.endTime, Date.parse('2026-11-14T23:59:59.999+08:00'))
  const neutralParent = {
    title: '2026KPL王者荣耀年度', domain: 'game', city: '长沙',
    startTime: knockout.startTime, timePrecision: 'date', participation: {}, participationGuide: {},
    stages: [{ key: 'knockout', name: '淘汰赛', startTime: knockout.startTime, evidenceVerified: true }]
  }
  assert.ok(h.sameDiscoveredEvent(neutralParent, final), 'a neutral parent with verified rounds must accept a later phase in another city')
  assert.equal(h.mergeEventStages({ title: '2026KPL王者荣耀年度总决赛', startTime: knockout.startTime,
    stages: [{ key: 'knockout', startTime: knockout.startTime, evidenceVerified: true }] }, {}).length, 1,
    'parent title must not invent a final on the series start date')
  assert.equal(h.sameDiscoveredEvent(
    { title: 'LISA联名快闪北京站', domain: 'culture', city: '北京', startTime: knockout.startTime },
    { title: 'LISA联名快闪上海站', domain: 'culture', city: '上海', startTime: knockout.startTime }
  ), false, 'city-specific standalone events stay separate')
  assert.equal(h.resolveRequestedNamedTarget('ent', 'stadium_concert', '新加入歌手'), '新加入歌手')
  assert.equal(h.resolveRequestedNamedTarget('ent', 'missing', '单依纯'), '')
  assert.equal(h.resolveRequestedNamedTarget('ent', 'stadium_concert', '单依纯 site:spam.com'), '')
  assert.equal(h.resolveRequestedNamedTarget('tech','hackathon','莱森地平线：多智能体 AI 黑客松'),'莱森地平线:多智能体 AI 黑客松')
  assert.equal(h.resolveRequestedNamedTarget('ent', 'stadium_concert', '赔率'), '')
  const plan = h.buildSearchPlan('ent', now, 'stadium_concert', '', {}, false, false, 'web', '新加入歌手')
  assert.equal(plan.namedTarget, '新加入歌手')
  assert.ok(plan.query.includes('新加入歌手'))
  const cityPlan = h.buildSearchPlan('ent', now, 'stadium_concert', '成都', {}, false, false, 'web', '单依纯')
  assert.equal(cityPlan.selectedTopic.city, '成都')
  assert.ok(cityPlan.query.includes('单依纯” 成都'))
  const generic = h.buildSearchPlan('ent', now, 'stadium_concert', '', {}, false, false, 'web', false)
  assert.equal(generic.namedTarget, '')
  const scopes = Array.from({ length: 3 }, (_, i) => h.buildSearchPlan('finance', now + i * 86400000, 'web3', '', {}, false, false, 'web', false).query)
  assert.ok(scopes.some(x => x.includes('本轮开放发现范围为亚洲')))
  assert.ok(scopes.some(x => x.includes('本轮开放发现范围为全球')))
  assert.ok(scopes.every(x => x.includes('不强制要求中国大陆入口')))
  assert.ok(h.buildSearchPlan('culture', now, 'fashion_design', '', {}, false, false, 'web', false).query.includes('时装周'))
  assert.ok(generic.query.includes('大型演唱会'))
  const expo = h.buildSearchPlan('anime', now, 'anime_expo', '', {}, false, false, 'web', 'CICF×AGF广州动漫游戏盛典')
  const gameDiscovery = h.buildSearchPlan('game', now, 'valorant', '', {}, false, false, 'web', false)
  assert.ok(/概念网吧|茶餐厅|联名快闪/.test(gameDiscovery.query) && gameDiscovery.query.includes('无畏契约'), 'game discovery rotates actionable forms without losing the IP')
  const gameNamed = h.buildSearchPlan('game', now, 'valorant', '', {}, false, false, 'web', '无畏契约')
  assert.ok(gameNamed.query.includes('联名快闪') && gameNamed.query.includes('预约'))
  assert.ok(!gameNamed.query.includes('赛程 售票 直播'), 'IP experience queries must not be dominated by tournament query terms')
  assert.equal(gameNamed.needsStructuredSchedule, false, 'generic game IP discovery must not demand tournament phases')
  assert.equal(h.buildSearchPlan('game', now, 'valorant', '', {}, false, false, 'web', '无畏契约全球冠军赛').needsStructuredSchedule, true)
  const forms = require('../cloudfunctions/fetchEvents/lib/discovery-experience')
  for (const domain of ['tech', 'auto', 'finance', 'ent', 'culture', 'sports', 'anime']) {
    const cycle = Array.from({ length: 4 }, (_, day) => forms.experienceIntent(domain, 'generic', '', now + day * 86400000))
    assert.equal(cycle.filter(Boolean).length, 1, domain + ' reserves one existing rotation for experience discovery')
    assert.ok(forms.experienceQuery(domain).includes('联名快闪'))
  }
  assert.equal(forms.experienceIntent('academic', 'language_exam', '全国大学英语四、六级考试', now), false)
  assert.equal(forms.experienceIntent('ent', 'stadium_concert', '周杰伦演唱会', now), false)
  assert.equal(forms.experienceIntent('game', 'game_expo', 'ChinaJoy', now), false)
  assert.equal(forms.experienceIntent('game', 'console', '任天堂直面会', now), false)
  for (const topic of ['developer', 'hackathon', 'open_source']) {
    assert.equal(forms.experienceIntent('tech', topic, '', now), false)
  }
  const makerPlan = h.buildSearchPlan('tech', now, 'hackathon', '', {}, false, false, 'web', false)
  assert.ok(makerPlan.query.includes('Buildathon') && makerPlan.query.includes('组队'))
  assert.ok(h.buildSearchPlan('tech', now, 'developer', '', {}, false, false, 'web', false).query.includes('开发者日'))
  assert.ok(h.resolveRequestedNamedTarget('tech','hackathon','MoonBit黑客松'))
  assert.ok(h.buildSearchPlan('academic', now, 'hackathon', '', {}, false, false, 'web', false).query.includes('高校'))
  assert.ok(forms.isExperience({ title: '运动品牌球迷活动' }))
  const artistPopup = h.buildSearchPlan('culture', now, 'brand_popup', '北京', {}, false, false, 'web', 'LISA')
  assert.equal(artistPopup.experienceDiscovery, true)
  assert.ok(artistPopup.query.includes('“LISA”') && artistPopup.query.includes('艺人'), 'city popup query preserves the artist/brand identity')
  assert.equal(h.sameDiscoveredEvent(
    { title: '球队总决赛', domain: 'sports', startTime: now },
    { title: '球队联名快闪球迷活动', domain: 'sports', startTime: now }
  ), false)
  assert.equal(h.sameDiscoveredEvent(
    { title: '2026无畏契约上海全球冠军赛', domain: 'game', city: '上海', startTime: now },
    { title: '无畏契约×巴黎世家概念网吧', domain: 'game', city: '上海', startTime: now }
  ), false, 'IP experience must not merge into the tournament')
  assert.equal(expo.namedTarget, 'CICF×AGF广州动漫游戏盛典')
  assert.ok(expo.officialHosts.includes('cicfexpo.com'))
  const doujin = h.buildSearchPlan('anime', now, 'doujin_only', '', {}, false, false, 'web', 'ComicQuest')
  assert.equal(doujin.namedTarget, 'ComicQuest')
  assert.ok(h.buildSearchPlan('anime', now, 'doujin_only', '', {}, false, false, 'web', false).query.includes('综合同人展'))
  const openWindows = [now, now + 86400000].map((time) =>
    h.buildSearchPlan('auto', time, 'auto_show', '', {}, false, false, 'web', false).query)
  assert.ok(openWindows.some((query) => query.includes('至 2026-10')),
    'open discovery must periodically focus on the next 45 days')
  assert.ok(openWindows.some((query) => query.includes('至 2027-03')),
    'open discovery must retain the full 180-day horizon on alternate days')
  const recovered = await h.callWebSearch('anime', now, 'anime_expo', '', {}, false, false,
    false, 'web', 'CICF×AGF广州动漫游戏盛典', true)
  assert.equal(recovered.provider, 'tencent_wsa')
  assert.equal(recovered.items.length, 1)
  assert.equal(wsaQueries.length, 1, 'empty named discovery uses only one budgeted WSA call')
  assert.equal(h.isCurrentDiscoveryEvidence({ title: '第三届ComicQuest综合同人交流会',
    description: '2025-10-03 09:00 - 2025-10-04 17:00 上海世博展览馆' }, now), false,
  'a prior edition with no title year must not become a new identity')
  assert.equal(h.isCurrentDiscoveryEvidence({ title: 'ComicQuest 5.0',
    description: '2026年10月5日-10月6日 上海世博展览馆' }, now), true)
  const socialEvidence = [{ title: '上海 ComicQuest 5.0 摊位公告',
    description: '2026年10月5日 上海世博展览馆',
    link: 'https://weibo.com/123456789/abc' }]
  const socialIdentity = [{ title: '2026上海 ComicQuest 5.0', domain: 'anime',
    city: '上海', evidenceIndex: 0, confidence: 0.8 }]
  const untargeted = await h.saveDiscoveryCandidates(socialIdentity, socialEvidence,
    { domain: 'anime', topicKey: 'doujin_only', city: '上海' }, now)
  assert.equal(untargeted.discoveredCandidates, 0, 'broad social posts must not queue candidates')
  const targeted = await h.saveDiscoveryCandidates(socialIdentity, socialEvidence,
    { domain: 'anime', topicKey: 'doujin_only', city: '上海', namedTarget: 'ComicQuest' }, now)
  assert.equal(targeted.discoveredCandidates, 1,
    'a targeted social announcement may queue identity for mandatory verification')
  const editionAliases = h.detailIdentityAliases({ domain: 'anime', title: 'ComicQuest 05 上海综合同人交流会' })
  assert.ok(editionAliases.includes('ComicQuest5.0'))
  assert.ok(!editionAliases.includes('ComicQuest3.0'))
  const longConventionTitle = 'ComicQuest5.0综合同人交流会-第五届动漫艺术创作探索综合展览会'
  assert.ok(h.evidenceTitleMatchesEvent(longConventionTitle, {
    title: 'ComicQuest5.0', link: 'https://www.comicquest.cn/'
  }), 'official short edition title must support the same convention')
  assert.equal(h.evidenceTitleMatchesEvent(longConventionTitle, {
    title: 'ComicQuest3.0', link: 'https://www.comicquest.cn/'
  }), false, 'a different edition must not support event facts')
  assert.ok(h.evidenceTitleMatchesEvent(longConventionTitle, {
    title: '选择场次', description: '上海·ComicQuest5.0综合同人交流会 2026.10.05-10.06',
    link: 'https://mall.bilibili.com/neul-next/ticket-renovation/detail.html?id=1'
  }), 'a transaction page can support the exact edition despite a generic browser title')
  assert.equal(h.candidateCompetitionTarget({ domain: 'anime', kind: 'discovery_detail',
    title: 'ComicQuest 05 上海综合同人交流会' }), '')
  assert.equal(h.candidateCompetitionTarget({ domain: 'academic', kind: 'discovery_detail',
    title: '全国大学生数学建模竞赛' }), '全国大学生数学建模竞赛')

  records.clear();operations.length=0
  const counts = {}
  const times = {}
  for (let day = 0; day < 2; day++) for (let hour = 0; hour < 10; hour++) {
    const time = now + day * 86400000 + hour * 3600000
    const { lane } = h.discoverySlot(time)
    counts[lane] = (counts[lane] || 0) + 1
    times[lane] = time
  }
  assert.deepEqual(counts, { important: 6, interest: 7, fresh: 4, explore: 3 })

  const id = await h.registerDiscoveryTarget('ent', 'stadium_concert', '单依纯', '', now, 'manual')
  const key = 'discoveryTargets:' + id
  records.get(key).demandScore = 9
  await h.registerDiscoveryTarget('ent', 'stadium_concert', '单依纯', '', now + 1, 'manual')
  assert.equal(records.get(key).demandScore, 9)
  assert.equal(operations.filter(([op, k]) => k === key).length, 1)
  const otherCityId = await h.registerDiscoveryTarget('ent', 'stadium_concert', '单依纯', '上海', now, 'manual')
  assert.notEqual(id, otherCityId)
  let selected = await h.selectDiscoveryWork(times.interest)
  assert.equal(selected.target._id, id)
  const fallbackTarget = (await h.selectDiscoveryWork(times.interest)).target
  assert.equal(fallbackTarget._id, otherCityId, 'empty interest pool must cover other due targets')
  assert.equal((await h.selectDiscoveryWork(times.interest)).target, null, 'leased targets must not be selected twice')
  records.get('discoveryTargets:' + otherCityId).nextSearchAt = 0
  await h.finishDiscoverySearch(selected.target, times.interest, '')
  assert.equal(records.get(key).nextSearchAt, times.interest + 86400000)
  assert.ok((await h.selectDiscoveryWork(times.fresh)).target, 'new manual targets must be searched without clicks')

  const queue = [
    { _id: 'b', domain: 'ent', topicKey: 'stadium_concert', name: '周杰伦', status: 'active', sourceType: 'seed', createdAt: 1, lastSearchedAt: 0 },
    { _id: 'a', domain: 'ent', topicKey: 'stadium_concert', name: '单依纯', status: 'active', sourceType: 'critical', createdAt: 1, lastSearchedAt: 0 },
    { _id: 'c', domain: 'ent', topicKey: 'stadium_concert', name: '五月天', status: 'active', sourceType: 'critical', createdAt: 1, lastSearchedAt: 100 }
  ]
  const ids = (rows) => Array.from(rows, (row) => row._id)
  assert.deepEqual(ids(h.rankDiscoveryTargets(queue, 'fresh', now)), ['a', 'b', 'c'], 'unsearched ordinary targets precede repeated critical searches')
  assert.deepEqual(ids(h.rankDiscoveryTargets(queue.slice().reverse(), 'fresh', now)), ['a', 'b', 'c'], 'database return order must not affect ties')
  assert.deepEqual(ids(h.rankDiscoveryTargets(queue, 'important', now)), ['a', 'c'], 'important slots preserve critical priority')
  assert.deepEqual(ids(h.rankDiscoveryTargets(queue.map((row) => ({ ...row, nextSearchAt: now + 1 })), 'fresh', now)), [], 'cooling and leased targets stay excluded')
  const cycle = queue.map((row) => ({ ...row }))
  const visited = []
  for (let i = 0; i < cycle.length; i++) {
    const target = h.rankDiscoveryTargets(cycle, 'fresh', now)[0]
    visited.push(target._id)
    target.lastSearchedAt = now + i
    target.nextSearchAt = now + 86400000
  }
  assert.equal(new Set(visited).size, cycle.length, 'a full fair cycle searches every target before repeating')

  const meta = { topicKey: 'stadium_concert', channel: 'web', namedTarget: '单依纯', city: '' }
  await h.saveSearchCache('ent', meta, [{ title: '单依纯成都站' }], now)
  assert.ok(await h.loadSearchCache('ent', meta.topicKey, '', 'web', now, '单依纯'))
  assert.equal(await h.loadSearchCache('ent', meta.topicKey, '', 'web', now, '周杰伦'), null)
  assert.equal(await h.loadSearchCache('ent', meta.topicKey, '', 'web', now + 1800001, '单依纯'), null)
  assert.notEqual(h.searchCacheDocId('ent', meta.topicKey, '', 'web', '单依纯'), h.searchCacheDocId('ent', meta.topicKey, '上海', 'web', '单依纯'))
  const invalid = await mod.exports.main({ domain: 'ent', topicKey: 'stadium_concert', namedTarget: 'site:spam.com' })
  assert.equal(invalid.ok, false)
  for (const [domain, topics] of Object.entries(h.NAMED_IP_ROSTER)) {
    for (const [topic, names] of Object.entries(topics)) for (const name of names) {
      assert.ok(h.resolveRequestedNamedTarget(domain, topic, name), 'seed rejected: ' + name)
    }
  }
  let offset = 0
  let total = 0
  do {
    const batch = await h.initializeDiscoveryTargets(now, offset)
    total += batch.ensured
    offset = batch.nextOffset
    if (offset === null) assert.equal(total, batch.total)
  } while (offset !== null)
  const beforeRetry = records.size
  await h.initializeDiscoveryTargets(now, 100)
  assert.equal(records.size, beforeRetry, 'retrying a batch must not duplicate records')
  let bootstrap
  do { bootstrap = await h.ensureDiscoverySeeds(now) } while (!bootstrap.complete)
  const originalNames = h.NAMED_IP_ROSTER.auto.auto_show
  h.NAMED_IP_ROSTER.auto.auto_show = originalNames.concat('测试新增车展')
  try {
    do { bootstrap = await h.ensureDiscoverySeeds(now + 1) } while (!bootstrap.complete)
    assert.ok(Array.from(records.values()).some((row) => row.name === '测试新增车展'),
      'a changed roster must register new targets without a manual reset')
  } finally {
    h.NAMED_IP_ROSTER.auto.auto_show = originalNames
  }
  cloud.getWXContext = () => ({ OPENID: 'client' })
  const spoofedTimer = await mod.exports.main({ Type: 'Timer', mode: 'discovery-add', domain: 'ent', topicKey: 'stadium_concert', namedTarget: '单依纯' })
  assert.equal(spoofedTimer.error, 'client invocation is not allowed')
  console.log('Discovery verification passed: registration, quota, claim, new targets and isolated caches')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
