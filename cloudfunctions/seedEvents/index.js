const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const SEEDS = [
  { title: '苹果秋季新品发布会', summary: 'iPhone 18 系列与新一代 Apple Watch 预计亮相，官网全程直播。', domain: 'tech', tags: ['苹果', 'iPhone'], startInHours: 13 * 24, durationHours: 2, participation: { type: 'livestream', url: 'https://www.apple.com.cn/apple-events/', note: 'Apple 官网直播' }, source: { name: 'Apple Newsroom', url: 'https://www.apple.com.cn/newsroom/' }, confidence: 0.95, isHot: true },
  { title: '华为 Mate 80 系列新品发布会', summary: '华为年度旗舰发布会，预计搭载新一代麒麟芯片与鸿蒙新特性。', domain: 'tech', tags: ['华为', 'Mate'], startInHours: 20 * 24, durationHours: 2, participation: { type: 'livestream', url: 'https://consumer.huawei.com/cn/', note: '华为官网及视频号直播' }, source: { name: '华为终端', url: 'https://consumer.huawei.com/cn/' }, confidence: 0.88, isHot: true },
  { title: '特斯拉 Robotaxi 发布会', summary: '无人驾驶出租车量产版发布，得州工厂现场直播。', domain: 'auto', tags: ['特斯拉', '自动驾驶'], startInHours: 9 * 24, durationHours: 1.5, participation: { type: 'livestream', url: 'https://www.tesla.com', note: 'Tesla 官网直播' }, source: { name: 'Tesla', url: 'https://www.tesla.com' }, confidence: 0.85, isHot: true },
  { title: '广州国际汽车展览会 2026', summary: '年度收官 A 级车展，覆盖整车、新能源与智能驾驶全链路。', domain: 'auto', tags: ['车展', '新能源'], startInHours: 86 * 24, durationHours: 72, participation: { type: 'offline', url: 'https://www.autoguangzhou.com.cn/', note: '广交会展馆，官网预约入场' }, source: { name: '广州车展官网', url: 'https://www.autoguangzhou.com.cn/' }, confidence: 0.9, isHot: false },
  { title: '香港金融科技周 2026', summary: '亚洲旗舰金融科技会议，覆盖数字资产、支付与监管科技议题。', domain: 'finance', tags: ['金融科技', '香港'], startInHours: 63 * 24, durationHours: 40, participation: { type: 'registration', url: 'https://www.fintechweek.hk/', note: '官网注册参会' }, source: { name: 'InvestHK', url: 'https://www.fintechweek.hk/' }, confidence: 0.9, isHot: false },
  { title: '巴菲特股东大会（伯克希尔年会）', summary: '投资界年度盛会，奥马哈现场 + 全球网络直播。', domain: 'finance', tags: ['巴菲特', '投资'], startInHours: 250 * 24, durationHours: 8, participation: { type: 'livestream', url: 'https://www.berkshirehathaway.com/', note: '官网直播' }, source: { name: 'Berkshire Hathaway', url: 'https://www.berkshirehathaway.com/' }, confidence: 0.85, isHot: false },
  { title: '邓紫棋 I AM GLORIA 巡回演唱会 · 上海站', summary: '体育场级舞美制作，新专辑曲目首唱。', domain: 'ent', tags: ['邓紫棋', '巡演'], startInHours: 22 * 24, durationHours: 3, participation: { type: 'registration', url: 'https://www.damai.cn/', note: '大麦预约抢票提醒' }, source: { name: '大麦网', url: 'https://www.damai.cn/' }, confidence: 0.92, isHot: true },
  { title: '五月天 5525 回到那一天 巡回演唱会 · 北京站', summary: '鸟巢连开三场，出道周年纪念特别企划。', domain: 'ent', tags: ['五月天', '演唱会'], startInHours: 35 * 24, durationHours: 3.5, participation: { type: 'registration', url: 'https://www.damai.cn/', note: '大麦预约抢票提醒' }, source: { name: '相信音乐', url: 'https://www.bin-music.com/' }, confidence: 0.86, isHot: false },
  { title: 'ChinaJoy 2027 中国国际数码互动娱乐展览会', summary: '全球游戏厂商年度大秀，新游试玩与电竞表演赛。', domain: 'game', tags: ['ChinaJoy', '游戏展'], startInHours: 330 * 24, durationHours: 96, participation: { type: 'registration', url: 'https://www.chinajoy.net/', note: '官网购票预约' }, source: { name: 'ChinaJoy 官网', url: 'https://www.chinajoy.net/' }, confidence: 0.88, isHot: true },
  { title: '英雄联盟 S16 全球总决赛', summary: '年度最高荣誉赛事，决赛阶段落地成都。', domain: 'game', tags: ['英雄联盟', '电竞'], startInHours: 70 * 24, durationHours: 6, participation: { type: 'livestream', url: 'https://lol.qq.com/', note: '官方赛事直播' }, source: { name: '英雄联盟赛事', url: 'https://lol.qq.com/' }, confidence: 0.84, isHot: true },
  { title: '中国大学生数学建模竞赛（国赛）', summary: '全国高校规模最大的基础性学科竞赛，赛题 72 小时限时完成。', domain: 'academic', tags: ['数学建模', '国赛'], startInHours: 8 * 24, durationHours: 72, participation: { type: 'registration', url: 'http://www.mcm.edu.cn/', note: '官网报名（通过学校组队）' }, source: { name: '全国大学生数学建模竞赛组委会', url: 'http://www.mcm.edu.cn/' }, confidence: 0.93, isHot: true },
  { title: '中国国际大学生创新大赛总决赛', summary: '覆盖新工科、新医科等赛道，全国总决赛现场路演。', domain: 'academic', tags: ['创新创业', '总决赛'], startInHours: 42 * 24, durationHours: 48, participation: { type: 'registration', url: 'https://cy.ncss.cn/', note: '全国大学生创业服务网报名' }, source: { name: '大赛组委会', url: 'https://cy.ncss.cn/' }, confidence: 0.87, isHot: false },
  { title: '任天堂直面会（Nintendo Direct）', summary: 'Switch 2 新作阵容公开，全球同步直播。', domain: 'game', tags: ['任天堂', '直面会'], startInHours: 30, durationHours: 1, participation: { type: 'livestream', url: 'https://www.nintendo.com/nintendo-direct/', note: '官方频道直播' }, source: { name: 'Nintendo', url: 'https://www.nintendo.com/' }, confidence: 0.9, isHot: false },
  { title: '世界人工智能大会 WAIC 2027 筹备发布会', summary: '公布明年大会主题与首批演讲嘉宾名单。', domain: 'tech', tags: ['WAIC', '人工智能'], startInHours: 90, durationHours: 2, participation: { type: 'livestream', url: 'https://www.worldaic.com.cn/', note: '官网直播' }, source: { name: 'WAIC 组委会', url: 'https://www.worldaic.com.cn/' }, confidence: 0.7, isHot: false }
]

const NEW_ARRIVAL = {
  title: '突发：苹果官宣特别活动（Apple Event）',
  summary: 'Apple 刚刚向媒体发出邀请函，特别活动定档两周后，官网直播。',
  domain: 'tech',
  tags: ['苹果', '突发'],
  startInHours: 13 * 24,
  durationHours: 2,
  participation: { type: 'livestream', url: 'https://www.apple.com.cn/apple-events/', note: 'Apple 官网直播' },
  source: { name: 'Apple Newsroom', url: 'https://www.apple.com.cn/newsroom/' },
  confidence: 0.94,
  isHot: true
}

function normalizeTitle(t) {
  return String(t || '').toLowerCase().replace(/[\s\W_]+/g, '')
}

function dayOf(ts) {
  const d = new Date(ts)
  return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate()
}

function hashOf(title, domain, startTime) {
  return crypto.createHash('md5').update(normalizeTitle(title) + '|' + domain + '|' + dayOf(startTime)).digest('hex')
}

function toEvent(seed, now) {
  const startTime = now + Math.round(seed.startInHours * 3600000)
  const ev = {
    title: seed.title,
    summary: seed.summary,
    domain: seed.domain,
    tags: seed.tags,
    startTime,
    endTime: seed.durationHours ? startTime + Math.round(seed.durationHours * 3600000) : undefined,
    participation: seed.participation,
    source: Object.assign({ fetchedAt: now }, seed.source),
    confidence: seed.confidence,
    status: 'published',
    isHot: !!seed.isHot,
    createdAt: now,
    updatedAt: now
  }
  ev.hash = hashOf(ev.title, ev.domain, ev.startTime)
  return ev
}

async function upsert(ev) {
  const existing = await db.collection('events').where({ hash: ev.hash }).limit(1).get()
  if (existing.data.length) {
    await db.collection('events').doc(existing.data[0]._id).update({
      data: { 'source.fetchedAt': ev.source.fetchedAt, updatedAt: ev.updatedAt }
    })
    return 'updated'
  }
  await db.collection('events').add({ data: ev })
  return 'inserted'
}

async function clearAll() {
  const res = await db.collection('events').limit(100).get()
  for (const doc of res.data) {
    await db.collection('events').doc(doc._id).remove()
  }
  return res.data.length
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (OPENID) return { ok: false, error: 'client invocation is not allowed' }
  if (process.env.ALLOW_SEED_EVENTS !== 'true') {
    return { ok: false, error: 'seed function is disabled in production' }
  }
  const now = Date.now()
  const scenario = (event && event.scenario) || 'full'
  let removed = 0

  if (event && event.reset) {
    removed = await clearAll()
  }

  if (scenario === 'new_arrival') {
    const ev = toEvent(NEW_ARRIVAL, now)
    const r = await upsert(ev)
    return { ok: true, scenario, result: r, removed, eventId: ev.hash }
  }

  const stats = { inserted: 0, updated: 0 }
  for (const seed of SEEDS) {
    const r = await upsert(toEvent(seed, now))
    stats[r] += 1
  }
  return Object.assign({ ok: true, scenario, removed }, stats)
}
