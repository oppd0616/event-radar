const dayjs = require('dayjs')

const PHRASE_MAP = {
  '資訊': '信息',
  '軟體': '软件',
  '硬體': '硬件',
  '網頁': '网页',
  '影片': '视频',
  '直播間': '直播间',
  '售票資訊': '售票信息',
  '持續更新': '持续更新'
}

const CHAR_MAP = {
  '會': '会', '資': '资', '訊': '讯', '購': '购', '續': '续', '場': '场', '臺': '台',
  '灣': '湾', '國': '国', '際': '际', '門': '门', '開': '开', '間': '间', '長': '长',
  '專': '专', '業': '业', '網': '网', '頁': '页', '體': '体', '賽': '赛', '參': '参',
  '與': '与', '號': '号', '樂': '乐', '後': '后', '發': '发', '現': '现', '應': '应',
  '閱': '阅', '點': '点', '擊': '击', '從': '从', '過': '过', '還': '还', '個': '个',
  '為': '为', '這': '这', '張': '张', '圖': '图', '區': '区', '閉': '闭', '關': '关',
  '實': '实', '時': '时', '線': '线', '說': '说', '報': '报', '選': '选', '擇': '择',
  '熱': '热', '觀': '观', '術': '术', '學': '学', '競': '竞', '標': '标', '題': '题',
  '內': '内', '來': '来', '無': '无', '費': '费', '價': '价', '萬': '万', '預': '预',
  '備': '备', '導': '导', '歡': '欢', '處': '处', '經': '经', '華': '华', '車': '车',
  '電': '电', '腦': '脑', '貓': '猫', '舉': '举', '辦': '办', '組': '组', '織': '织',
  '總': '总', '結': '结', '隊': '队', '統': '统', '領': '领', '讓': '让', '獎': '奖',
  '項': '项', '曆': '历', '歷': '历', '確': '确', '認': '认', '聯': '联', '義': '义',
  '稱': '称', '錄': '录', '獲': '获', '優': '优', '壓': '压', '縮': '缩', '佈': '布',
  '週': '周', '啟': '启', '藝': '艺', '團': '团', '類': '类', '別': '别', '將': '将',
  '於': '于', '盃': '杯', '輪': '轮', '節': '节', '聲': '声', '眾': '众', '決': '决',
  '詳': '详', '詢': '询', '請': '请', '儘': '尽', '須': '须', '僅': '仅', '屆': '届',
  '廣': '广', '東': '东', '雲': '云', '獨': '独', '動': '动', '務': '务', '計': '计',
  '畫': '画', '歸': '归', '屬': '属', '規': '规', '則': '则', '驗': '验', '證': '证',
  '議': '议', '講': '讲', '創': '创', '課': '课', '覽': '览', '廳': '厅', '進': '进',
  '遠': '远', '視': '视', '頻': '频', '轉': '转', '傳': '传', '夢': '梦', '協': '协',
  '賓': '宾', '訪': '访', '約': '约', '階': '阶', '慶': '庆', '讀': '读'
}

function toSimplified(text) {
  let value = String(text == null ? '' : text)
  Object.keys(PHRASE_MAP).forEach((key) => { value = value.split(key).join(PHRASE_MAP[key]) })
  return value.replace(/[\u3400-\u9fff]/g, (char) => CHAR_MAP[char] || char)
}

const OFFICIAL_RULES = [
  { test: /英雄联盟|league of legends|\bLPL\b/i, url: 'https://lol.qq.com/' },
  { test: /无畏契约|valorant|\bVCT\b/i, url: 'https://val.qq.com/' },
  { test: /王者荣耀|\bKPL\b/i, url: 'https://pvp.qq.com/' },
  { test: /和平精英|\bPEL\b/i, url: 'https://gp.qq.com/' },
  { test: /苹果.*发布|Apple.*Event/i, url: 'https://www.apple.com.cn/apple-events/' },
  { test: /华为|Huawei/i, url: 'https://consumer.huawei.com/cn/' },
  { test: /小米|Xiaomi/i, url: 'https://www.mi.com/' },
  { test: /特斯拉|Tesla/i, url: 'https://www.tesla.cn/' },
  { test: /比亚迪|BYD/i, url: 'https://www.bydauto.com.cn/' },
  { test: /ChinaJoy|中国国际数码互动娱乐展览会/i, url: 'https://www.chinajoy.net/' }
]

const OFFICIAL_HOSTS = [
  'lol.qq.com', 'val.qq.com', 'pvp.qq.com', 'gp.qq.com',
  'apple.com.cn', 'consumer.huawei.com', 'mi.com', 'tesla.cn',
  'bydauto.com.cn', 'chinajoy.net'
]

const TICKET_HOSTS = ['damai.cn', 'maoyan.com', 'showstart.com', 'piaoxingqiu.com', 'show.bilibili.com']

function hostOf(url) {
  const match = String(url || '').match(/^https?:\/\/([^/?#]+)/i)
  return (match && match[1] ? match[1] : '').replace(/^www\./i, '').toLowerCase()
}

function matchesHost(host, allowed) {
  return allowed.some((item) => host === item || host.endsWith('.' + item))
}

function mainlandLinkType(url) {
  const host = hostOf(url)
  if (!host) return ''
  if (matchesHost(host, TICKET_HOSTS)) return 'ticket'
  if (matchesHost(host, OFFICIAL_HOSTS) || host.endsWith('.gov.cn') || host.endsWith('.edu.cn')) return 'official'
  return ''
}

function mainlandParticipationUrl(event) {
  const text = toSimplified([event && event.title, event && event.summary].filter(Boolean).join(' '))
  const rule = OFFICIAL_RULES.find((item) => item.test.test(text))
  if (rule) return rule.url
  const current = event && event.participation && event.participation.url
  return mainlandLinkType(current) ? current : String(current || '')
}

function simplifyEvent(event) {
  if (!event) return event
  const participation = Object.assign({}, event.participation || {})
  participation.note = toSimplified(participation.note)
  participation.url = mainlandParticipationUrl(event)
  const guide = Object.assign({}, event.participationGuide || {})
  guide.platform = toSimplified(guide.platform)
  guide.location = toSimplified(guide.location)
  guide.price = toSimplified(guide.price)
  guide.eligibility = toSimplified(guide.eligibility)
  guide.entryRules = toSimplified(guide.entryRules)
  guide.steps = Array.isArray(guide.steps) ? guide.steps.map(toSimplified) : []
  const participationOptions = (Array.isArray(event.participationOptions) ? event.participationOptions : [])
    .map((item) => Object.assign({}, item, {
      note: toSimplified(item && item.note),
      platform: toSimplified(item && item.platform)
    }))
    .filter((item) => item.url || item.note)
  const stages = (Array.isArray(event.stages) ? event.stages : []).map((stage) => Object.assign({}, stage, {
    name: toSimplified(stage && stage.name),
    venue: toSimplified(stage && stage.venue),
    sessionKey: toSimplified(stage && stage.sessionKey)
  })).filter((stage) => stage.key && Number(stage.startTime))
  return Object.assign({}, event, {
    title: toSimplified(event.title),
    summary: toSimplified(event.summary),
    city: toSimplified(event.city),
    tags: Array.isArray(event.tags) ? event.tags.map(toSimplified) : [],
    participation,
    participationOptions,
    stages,
    participationGuide: guide,
    source: Object.assign({}, event.source || {}, { name: toSimplified(event.source && event.source.name) })
  })
}

function isDateOnly(event) {
  if (event && event.timePrecision) return event.timePrecision === 'date'
  const value = dayjs(event && event.startTime)
  return value.hour() === 0 && value.minute() === 0
}

function normalizeEventIdentity(value) {
  return toSimplified(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u3000·•・,，。.!！?？:：;；'"“”‘’()（）\[\]【】{}《》<>〈〉_\-—–~～/\\|]+/g, '')
}

function chinaDateKey(value) {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return ''
  return new Date(timestamp + 8 * 3600000).toISOString().slice(0, 10)
}

const EVENT_CITIES = [
  '北京', '上海', '广州', '深圳', '成都', '重庆', '杭州', '南京', '武汉', '西安',
  '苏州', '天津', '长沙', '郑州', '青岛', '厦门', '宁波', '合肥', '济南', '昆明',
  '沈阳', '大连', '福州', '无锡', '佛山', '东莞', '珠海', '南宁', '南昌', '贵阳',
  '哈尔滨', '长春', '石家庄', '太原', '兰州', '海口', '三亚', '香港', '澳门', '台北'
]

function eventPhase(value) {
  const text = toSimplified(value)
  const phases = [
    ['final_weekend', /总决赛周末/], ['loser_final', /败者组决赛/],
    ['winner_final', /胜者组决赛/], ['semifinal', /半决赛/],
    ['quarterfinal', /四分之一决赛|八强赛/],
    ['group_knockout', /小组赛及淘汰赛/], ['knockout', /淘汰赛/], ['group', /小组赛/],
    ['final', /总决赛|决赛/],
    ['qualifier', /资格赛|预选赛/], ['oral_exam', /口试/],
    ['written_exam', /笔试/], ['preliminary', /初赛/], ['second_round', /复赛/],
    ['registration', /报名(?:启动|开启|截止)?/], ['lottery', /抽签(?:结果)?/],
    ['pickup', /领物|装备领取/], ['presale', /预售|优先购/],
    ['on_sale', /正式开票|开票/], ['application', /网申/],
    ['interview', /面试/], ['results', /成绩公布|结果公布|获奖名单/]
  ]
  const hit = phases.find((item) => item[1].test(text))
  return hit ? hit[0] : ''
}

function eventSeriesIdentity(value) {
  let title = toSimplified(value)
    .replace(/[（(][^（）()]{1,100}[）)]/g, ' ')
    .replace(/(?:总决赛周末|小组赛及淘汰赛|败者组决赛|胜者组决赛|四分之一决赛|八强赛|半决赛|总决赛|淘汰赛|决赛|小组赛|资格赛|预选赛|口试|笔试|初赛|复赛|报名启动|报名开启|报名截止|报名|抽签结果|抽签|装备领取|领物|预售|优先购|正式开票|开票|网申|面试|成绩公布|结果公布|获奖名单)/g, ' ')
  EVENT_CITIES.forEach((city) => { title = title.split(city).join(' ') })
  return normalizeEventIdentity(title)
    .replace(/kpl王者荣耀|王者荣耀kpl/g, 'kpl')
    .replace(/lpl英雄联盟|英雄联盟lpl/g, 'lpl')
    .replace(/vct无畏契约|无畏契约vct/g, 'vct')
}

function seriesTitlesMatch(left, right) {
  const a = eventSeriesIdentity(left)
  const b = eventSeriesIdentity(right)
  if (!a || !b) return false
  if (a === b) return true
  const shorter = a.length <= b.length ? a : b
  const longer = a.length > b.length ? a : b
  return shorter.length >= 8 && longer.indexOf(shorter) >= 0 && shorter.length / longer.length >= 0.62
}

function namedEventCities(event) {
  const text = toSimplified([event && event.title, event && event.city].filter(Boolean).join(' '))
  return EVENT_CITIES.filter((city) => text.indexOf(city) >= 0)
}

// The cloud function remains the source of truth for semantic merging. This
// client-side check is the final rendering boundary: it prevents an unstable
// recommendation page or an older deployed backend from appending the same
// visible event under two document IDs.
function sameVisibleEvent(left, right) {
  if (left && right && left.canonicalEventId && right.canonicalEventId) return left.canonicalEventId === right.canonicalEventId
  const identityDecision = require('./stable-event-identity').compare(left, right)
  if (identityDecision === 'same') return true
  if (identityDecision === 'review') return false
  if (!left || !right) return false
  if (left._id && right._id && left._id === right._id) return true
  if (left.canonicalKey && right.canonicalKey && left.canonicalKey === right.canonicalKey) return true
  if (left.domain !== right.domain) return false
  const leftCities = namedEventCities(left)
  const rightCities = namedEventCities(right)
  if (leftCities.length && rightCities.length && leftCities.join('|') !== rightCities.join('|')) return false
  if (!chinaDateKey(left.startTime) || chinaDateKey(left.startTime) !== chinaDateKey(right.startTime)) return false
  const bothExact = left.timePrecision === 'datetime' && right.timePrecision === 'datetime'
  if (bothExact && Number(left.startTime) !== Number(right.startTime)) return false
  if (normalizeEventIdentity(left.title) === normalizeEventIdentity(right.title)) return true
  if (!seriesTitlesMatch(left.title, right.title)) return false
  const leftPhase = eventPhase(left.title)
  const rightPhase = eventPhase(right.title)
  return !leftPhase || !rightPhase || leftPhase === rightPhase ||
    (leftPhase === 'final_weekend' && rightPhase === 'final') ||
    (leftPhase === 'final' && rightPhase === 'final_weekend')
}

function mergeUniqueEvents(current, incoming) {
  const result = []
  ;(current || []).concat(incoming || []).forEach((event) => {
    if (!result.some((item) => sameVisibleEvent(item, event))) result.push(event)
  })
  return result
}

module.exports = {
  chinaDateKey,
  hostOf,
  isDateOnly,
  mainlandLinkType,
  mainlandParticipationUrl,
  mergeUniqueEvents,
  normalizeEventIdentity,
  sameVisibleEvent,
  simplifyEvent,
  toSimplified
}
