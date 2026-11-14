const DOMAINS = [
  { key: 'tech', label: '科技', color: '#5F6FA8', bg: '#EEEFF6' },
  { key: 'auto', label: '汽车', color: '#5F7D6B', bg: '#EBF1ED' },
  { key: 'finance', label: '财经', color: '#8A6D4F', bg: '#F4EFE8' },
  { key: 'ent', label: '演出', color: '#96525F', bg: '#F7ECEE' },
  { key: 'culture', label: '文娱', color: '#7B657F', bg: '#F2EDF4' },
  { key: 'game', label: '游戏', color: '#4F7482', bg: '#EAF1F3' },
  { key: 'sports', label: '体育', color: '#39755C', bg: '#EAF3EE' },
  { key: 'anime', label: '次元', color: '#A65382', bg: '#F6EBF2' },
  { key: 'academic', label: '竞赛成长', color: '#6E5F8F', bg: '#F0EDF6' }
]

// 首次使用只展示兼具用户规模、活动供给、关注度与成长性的高价值兴趣。
// score 用于展示排序；tier=trend 的标签承担小众与潮流探索。
const INTEREST_TAXONOMY = {
  tech: [
    { key: 'ai', label: 'AI / 大模型', score: 96, tier: 'core' },
    { key: 'mobile', label: '手机新品', score: 91, tier: 'core' },
    { key: 'chips_pc', label: '电脑与芯片', score: 86, tier: 'core' },
    { key: 'robotics', label: '机器人', score: 84, tier: 'trend' },
    { key: 'developer', label: '开发者活动', score: 82, tier: 'core' },
    { key: 'hackathon', label: 'AI共创 / 黑客松', score: 78, tier: 'trend' },
    { key: 'imaging', label: '摄影影像', score: 77, tier: 'core' },
    { key: 'open_source', label: '开源社区', score: 74, tier: 'trend' },
    { key: 'smart_device', label: '智能硬件', score: 73, tier: 'trend' }
  ],
  auto: [
    { key: 'new_energy', label: '新能源汽车', score: 95, tier: 'core' },
    { key: 'new_car', label: '新车发布', score: 91, tier: 'core' },
    { key: 'autonomous', label: '智能驾驶', score: 89, tier: 'trend' },
    { key: 'auto_show', label: '国际车展', score: 84, tier: 'core' },
    { key: 'motorsport', label: 'F1 / 赛车', score: 80, tier: 'core' },
    { key: 'performance_car', label: '性能与改装', score: 72, tier: 'trend' },
    { key: 'motorcycle', label: '摩托车', score: 69, tier: 'trend' },
    { key: 'auto_tech', label: '汽车科技', score: 68, tier: 'trend' }
  ],
  finance: [
    { key: 'investment', label: '投资大会', score: 88, tier: 'core' },
    { key: 'fintech', label: '金融科技', score: 86, tier: 'core' },
    { key: 'bitcoin', label: '比特币', score: 84, tier: 'trend' },
    { key: 'web3', label: 'Web3', score: 80, tier: 'trend' },
    { key: 'startup', label: '创业融资', score: 79, tier: 'core' },
    { key: 'business_summit', label: '商业峰会', score: 77, tier: 'core' },
    { key: 'quant', label: '量化交易', score: 70, tier: 'trend' },
    { key: 'macro', label: '宏观经济', score: 68, tier: 'core' }
  ],
  ent: [
    { key: 'stadium_concert', label: '体育场演唱会', score: 97, tier: 'core' },
    { key: 'music_festival', label: '音乐节', score: 92, tier: 'core' },
    { key: 'c_pop', label: '华语流行', score: 90, tier: 'core' },
    { key: 'k_j_pop', label: '日韩音乐', score: 83, tier: 'core' },
    { key: 'western_music', label: '欧美音乐', score: 81, tier: 'core' },
    { key: 'livehouse', label: 'Livehouse', score: 78, tier: 'trend' },
    { key: 'comedy', label: '脱口秀 / 喜剧', score: 74, tier: 'trend' },
    { key: 'film_festival', label: '电影节 / 展映', score: 88, tier: 'core' },
    { key: 'premiere_roadshow', label: '首映 / 路演', score: 86, tier: 'trend' },
    { key: 'theatre', label: '话剧 / 音乐剧', score: 87, tier: 'core' },
    { key: 'immersive_theatre', label: '沉浸式戏剧', score: 79, tier: 'trend' }
  ],
  culture: [
    { key: 'art_exhibition', label: '国内艺术展', score: 86, tier: 'core' },
    { key: 'immersive_event', label: '沉浸体验', score: 83, tier: 'trend' },
    { key: 'japan_exhibition', label: '日本展览', score: 81, tier: 'trend' },
    { key: 'korea_exhibition', label: '韩国展览', score: 80, tier: 'trend' },
    { key: 'brand_popup', label: '首店快闪', score: 82, tier: 'trend' },
    { key: 'dessert_cafe', label: '甜品咖啡', score: 77, tier: 'trend' },
    { key: 'design_market', label: '设计市集', score: 75, tier: 'trend' },
    { key: 'nightlife', label: '酒吧夜生活', score: 71, tier: 'trend' }
  ],
  game: [
    { key: 'honor_of_kings', label: '王者荣耀', score: 97, tier: 'core' },
    { key: 'lol', label: '英雄联盟', score: 96, tier: 'core' },
    { key: 'valorant', label: '无畏契约', score: 91, tier: 'trend' },
    { key: 'peace_elite', label: '和平精英', score: 87, tier: 'core' },
    { key: 'console', label: '单机 / 主机', score: 86, tier: 'core' },
    { key: 'steam_pc', label: 'Steam / PC游戏', score: 83, tier: 'core' },
    { key: 'game_expo', label: '游戏展会', score: 81, tier: 'core' },
    { key: 'indie_game', label: '独立游戏', score: 75, tier: 'trend' }
  ],
  sports: [
    { key: 'football', label: '足球赛事', score: 96, tier: 'core' },
    { key: 'basketball', label: '篮球赛事', score: 94, tier: 'core' },
    { key: 'badminton_pingpong', label: '羽毛球 / 乒乓球', score: 91, tier: 'core' },
    { key: 'tennis', label: '网球赛事', score: 86, tier: 'core' },
    { key: 'running', label: '马拉松 / 路跑', score: 92, tier: 'core' },
    { key: 'cycling_outdoor', label: '骑行 / 徒步', score: 87, tier: 'trend' },
    { key: 'winter_extreme', label: '冰雪 / 攀岩', score: 80, tier: 'trend' },
    { key: 'campus_sports', label: '高校赛事', score: 82, tier: 'core' }
  ],
  anime: [
    { key: 'anime_expo', label: '漫展', score: 96, tier: 'core' },
    { key: 'ip_popup', label: '动漫IP快闪', score: 93, tier: 'core' },
    { key: 'goods_figures', label: '谷子 / 手办', score: 91, tier: 'trend' },
    { key: 'cosplay', label: 'Cosplay', score: 86, tier: 'trend' },
    { key: 'tcg', label: '卡牌赛事', score: 84, tier: 'core' },
    { key: 'voice_actor', label: '声优见面会', score: 81, tier: 'trend' },
    { key: 'anime_music', label: '动漫音乐会', score: 80, tier: 'core' },
    { key: 'doujin_only', label: 'Only / 同人展', score: 78, tier: 'trend' }
  ],
  academic: [
    { key: 'computer_data', label: '计算机 / 数据', score: 98, tier: 'core', group: 'major' },
    { key: 'electronic_engineering', label: '电子 / 自动化', score: 94, tier: 'core', group: 'major' },
    { key: 'mechanical_engineering', label: '机械 / 机器人', score: 90, tier: 'core', group: 'major' },
    { key: 'civil_architecture', label: '土木 / 建筑', score: 82, tier: 'core', group: 'major' },
    { key: 'business_economics', label: '经管 / 金融', score: 94, tier: 'core', group: 'major' },
    { key: 'design_media', label: '设计 / 传媒', score: 88, tier: 'core', group: 'major' },
    { key: 'humanities_law', label: '人文 / 法学', score: 82, tier: 'core', group: 'major' },
    { key: 'medicine_life', label: '医学 / 生命科学', score: 89, tier: 'core', group: 'major' },
    { key: 'agriculture_environment', label: '农林 / 环境', score: 80, tier: 'core', group: 'major' },
    { key: 'language_education', label: '语言 / 教育', score: 84, tier: 'core', group: 'major' },
    { key: 'math_modeling', label: '数学建模', score: 91, tier: 'core' },
    { key: 'programming', label: '程序设计', score: 89, tier: 'core' },
    { key: 'ai_competition', label: 'AI竞赛', score: 88, tier: 'trend' },
    { key: 'innovation', label: '创新创业', score: 85, tier: 'core' },
    { key: 'robot_competition', label: '机器人竞赛', score: 80, tier: 'trend' },
    { key: 'hackathon', label: '高校黑客松', score: 78, tier: 'trend' },
    { key: 'design_competition', label: '设计竞赛', score: 72, tier: 'core' },
    { key: 'academic_conference', label: '学术会议', score: 69, tier: 'core' },
    { key: 'research_program', label: '科研项目 / 夏令营', score: 90, tier: 'core' },
    { key: 'industry_challenge', label: '企业案例 / 项目赛', score: 87, tier: 'core' },
    { key: 'language_exam', label: '四六级 / 普通话', score: 99, tier: 'core' },
    { key: 'qualification_exam', label: '教资 / 计算机等级', score: 97, tier: 'core' },
    { key: 'postgraduate_public_exam', label: '考研 / 公考', score: 98, tier: 'core' },
    { key: 'campus_recruitment', label: '校招 / 实习', score: 98, tier: 'core' }
  ]
}

const GROWTH_GOALS = [
  { key: 'postgraduate', label: '保研 / 升学' },
  { key: 'employment', label: '求职 / 实习' },
  { key: 'scholarship', label: '评奖评优' },
  { key: 'research', label: '科研 / 论文' },
  { key: 'portfolio', label: '项目 / 作品集' },
  { key: 'entrepreneurship', label: '创新创业' }
]

const FORMAT_OPTIONS = [
  { key: 'livestream', label: '线上直播' },
  { key: 'esports', label: '电竞比赛' },
  { key: 'registration', label: '报名竞赛' },
  { key: 'offline', label: '线下活动' },
  { key: 'ticket', label: '购票入场' },
  { key: 'release', label: '新品发布' }
]

const CITY_OPTIONS = ['线上', '全国', '北京', '上海', '广州', '深圳', '成都', '杭州', '南京', '武汉', '重庆', '西安', '香港']

const DOMAIN_MAP = DOMAINS.reduce((acc, d) => {
  acc[d.key] = d
  return acc
}, {})

const SUBSCRIBE_TEMPLATE_ID = 'fhWKMrhFeJEnXj5lY1zxFZeK185MlvM7o8e_2-ASgh0'

const STORAGE_KEYS = {
  onboardingDone: 'onboardingDone',
  preferredDomains: 'preferredDomains',
  preferredTopics: 'preferredTopics',
  preferredFormats: 'preferredFormats',
  preferredCities: 'preferredCities',
  growthGoals: 'growthGoals',
  personalizationEnabled: 'personalizationEnabled',
  currentEvent: 'currentEvent',
  mockSubscriptions: 'mockSubscriptions'
}

module.exports = {
  DOMAINS,
  DOMAIN_MAP,
  INTEREST_TAXONOMY,
  FORMAT_OPTIONS,
  CITY_OPTIONS,
  GROWTH_GOALS,
  SUBSCRIBE_TEMPLATE_ID,
  STORAGE_KEYS
}
