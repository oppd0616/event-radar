const assert = require('assert')
const path = require('path')
const policy = require(path.join(__dirname, '..', 'cloudfunctions', 'fetchEvents', 'config', 'source-policy'))
const official = require(path.join(__dirname, '..', 'cloudfunctions', 'fetchEvents', 'config', 'official-sources'))
const { NAMED_IP_ROSTER } = require(path.join(__dirname, '..', 'cloudfunctions', 'fetchEvents', 'config', 'discovery-targets'))
const hubs = require(path.join(__dirname, '..', 'cloudfunctions', 'fetchEvents', 'config', 'schedule-hubs'))
const http = require(path.join(__dirname, '..', 'cloudfunctions', 'fetchEvents', 'lib', 'http'))

assert.strictEqual(policy.classifySource('https://valorantesports.com/news/schedule', 'game').tier, 'official')
assert.strictEqual(policy.classifySource('https://jwc.example.edu.cn/notice', 'academic').tier, 'institutional')
assert.strictEqual(policy.classifySource('https://www.damai.cn/event/1', 'ent').tier, 'ticketing')
assert.strictEqual(policy.classifySource('https://www.bilibili.com/video/test', 'anime').tier, 'platform')
assert.strictEqual(policy.classifySource('https://mall.bilibili.com/neul-next/ticket-renovation/detail.html?id=1', 'anime').tier, 'ticketing')
assert.strictEqual(policy.classifySource('https://zh.wikipedia.org/wiki/test', 'game').tier, 'aggregator')

const ranked = policy.rankSources([
  { title: '聚合页', link: 'https://zh.wikipedia.org/wiki/test', searchScore: 0.99 },
  { title: '官网', link: 'https://valorantesports.com/news/schedule', searchScore: 0.5 }
], 'game')
assert.strictEqual(ranked[0].title, '官网')
assert.strictEqual(ranked[0].sourceTier, 'official')
assert.ok(official.officialHostsFor('game', 'valorant', '2026无畏契约全球冠军赛').includes('valorantesports.com'))
assert.ok(official.officialHostsFor('anime', 'anime_expo', 'CICF×AGF广州动漫游戏盛典').includes('cicfexpo.com'))
assert.ok(official.officialHostsFor('anime', 'doujin_only', 'ComicQuest').includes('comicquest.cn'))
assert.strictEqual(policy.classifySource('https://www.cicfexpo.com/index.php?a=show&id=1198', 'anime').tier, 'official')
assert.deepStrictEqual(official.officialSearchAliasesFor('game', '无畏契约全球冠军赛'), ['VALORANT Champions'])
assert.ok(official.officialHostsFor('academic', 'language_exam', '全国大学英语四、六级考试')
  .some((host) => host === 'neea.edu.cn' || host.endsWith('.neea.edu.cn')))
assert.deepStrictEqual(official.officialHostsFor('ent', 'stadium_concert', '未知歌手巡演'), ['damai.cn', 'maoyan.com'])
const coverage = official.sourceCoverageForRoster({ ent: { stadium_concert: ['周杰伦'] }, game: { valorant: ['无畏契约全球冠军赛'] } })
assert.strictEqual(coverage.find((item) => item.name === '周杰伦').coverage, 'topic')
assert.strictEqual(coverage.find((item) => item.name === '无畏契约全球冠军赛').coverage, 'series')

const fullCoverage = official.sourceCoverageForRoster(NAMED_IP_ROSTER)
assert.ok(fullCoverage.length >= 100)
assert.deepStrictEqual(fullCoverage.filter((item) => item.coverage === 'open_web'), [])
assert.ok(fullCoverage.filter((item) => item.coverage === 'series').length >= 75)
assert.strictEqual(http.responseCharset(Buffer.from('<meta charset="gb2312">'), 'text/html'), 'gb2312')
assert.strictEqual(http.responseCharset(Buffer.from('{}'), 'application/json; charset=utf-8'), 'utf-8')

// Schedule hubs: SPA official sources (e.g. VALORANT) must fall back to real
// schedule pages for the detail pass. Hubs enrich detail only and stay 'web'
// tier so they never outrank or impersonate an official source.
assert.deepStrictEqual(hubs.scheduleHubHostsFor('game', 'valorant', '无畏契约全球冠军赛'), ['liquipedia.net', 'vlr.gg'])
assert.deepStrictEqual(hubs.scheduleHubHostsFor('game', 'lol', 'LPL总决赛'), ['liquipedia.net', 'lolesports.com'])
assert.deepStrictEqual(hubs.scheduleHubHostsFor('sports', 'tennis', '上海网球大师赛'), [])
assert.strictEqual(policy.classifySource('https://liquipedia.net/valorant/VALORANT_Champions', 'game').tier, 'web')
// Every schedule-driven game topic in the roster resolves to at least one hub.
Object.keys(NAMED_IP_ROSTER.game || {}).forEach((topicKey) => {
  ;(NAMED_IP_ROSTER.game[topicKey] || []).forEach((name) => {
    assert.ok(hubs.scheduleHubHostsFor('game', topicKey, name).length >= 1, 'missing schedule hub for game/' + topicKey)
  })
})

console.log('source policy verification passed')
