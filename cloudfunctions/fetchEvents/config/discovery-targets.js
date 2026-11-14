// Stable named anchors complement generic queries. Keep this data separate from
// scheduling and validation so adding a target cannot accidentally change them.
const NAMED_IP_ROSTER = {
  ent: {
    stadium_concert: ['周杰伦', '五月天', '薛之谦', '张杰', '林俊杰', '邓紫棋', '周深', '陈奕迅', '凤凰传奇', '许嵩', '华晨宇', '单依纯'],
    music_festival: ['草莓音乐节', '迷笛音乐节', '简单生活节', '泡泡岛音乐节', '阿那亚虾米音乐节', 'VAC电音节', 'EDC电音节'],
    comedy: ['单立人喜剧节', '上海国际喜剧节', '德云社开箱封箱'],
    film_festival: ['上海国际电影节', '北京国际电影节', 'FIRST青年电影展', '平遥国际电影展', '中国金鸡百花电影节'],
    theatre: ['乌镇戏剧节', '阿那亚戏剧节', '静安戏剧谷', '只此青绿', '新龙门客栈'],
    immersive_theatre: ['不眠之夜', '沉浸式戏剧'],
    western_music: ['LANY', 'Charlie Puth']
  },
  auto: {
    auto_show: ['上海国际汽车工业展览会', '北京国际汽车展览会', '广州国际汽车展览会', '成都国际汽车展览会', '粤港澳大湾区车展', '中国国际摩托车博览会'],
    motorsport: ['F1中国大奖赛']
  },
  game: {
    honor_of_kings: ['KPL总决赛', '王者荣耀世界冠军杯', '王者荣耀'],
    lol: ['LPL总决赛', '英雄联盟全球总决赛', '英雄联盟'],
    valorant: ['VCT CN总决赛', '无畏契约全球冠军赛', '无畏契约'],
    peace_elite: ['PEL总决赛', '和平精英全球总决赛', '和平精英'],
    game_expo: ['ChinaJoy', 'BilibiliWorld', '原神FES'],
    console: ['任天堂直面会', 'PlayStation发布会', 'Xbox发布会']
  },
  sports: {
    football: ['中国足球超级联赛', '中国足协杯', '中国国家男子足球队', '国际足联世界杯'],
    basketball: ['CBA总决赛', 'CUBAL全国总决赛', 'NBA中国赛'],
    badminton_pingpong: ['WTT中国大满贯', '苏迪曼杯', '中国羽毛球公开赛'],
    tennis: ['上海网球大师赛', '中国网球公开赛'],
    running: ['上海马拉松', '北京马拉松', '厦门马拉松', '无锡马拉松', '成都马拉松', '杭州马拉松', '香港100越野赛'],
    campus_sports: ['2026爱知名古屋亚运会']
  },
  anime: {
    anime_expo: ['中国国际动漫游戏博览会', '中国国际动漫节', 'CICF×AGF广州动漫游戏盛典', 'BilibiliWorld', 'IDO动漫游戏嘉年华', 'ComicLove动漫嘉年华'],
    doujin_only: ['ComicQuest'],
    ip_popup: ['恋与深空', '光与夜之恋', '恋与制作人', '原神', '崩坏星穹铁道'],
    tcg: ['宝可梦卡牌赛事', '游戏王决斗者杯', '万智牌赛事'],
    goods_figures: ['Wonder Festival上海', 'BJD娃展'],
    anime_music: ['明日方舟音律联觉', '洛天依演唱会', '初音未来演唱会']
  },
  culture: {
    art_exhibition: ['上海博物馆特展', '中国国家博物馆特展', '故宫博物院特展', '三星堆博物馆特展', '敦煌艺术展'],
    design_market: ['上海书展', 'abC艺术书展', '做書市集'],
    immersive_event: ['teamLab无界美术馆', '博物馆奇妙夜']
  },
  tech: {
    robotics: ['世界机器人大会', '世界人形机器人运动会', 'RoboMaster机甲大师赛'],
    developer: ['苹果全球开发者大会', 'Google I/O', '微软Build开发者大会', '华为全联接大会', 'NVIDIA中国开发者日', 'Intel Connection', 'GOSIM', 'PyCon China', '微信开发者日', '微信开发者创新工坊', 'Google DevFest', 'ROSCon China'],
    hackathon: ['腾讯云黑客松', 'MoonBit黑客松']
  },
  finance: {
    fintech: ['香港金融科技周', '外滩大会', 'Money20/20'],
    investment: ['中国投资年会', '中国股权投资年度论坛']
  },
  academic: {
    language_exam: ['全国大学英语四、六级考试', '普通话水平测试', 'CATTI翻译专业资格考试'],
    qualification_exam: ['中小学教师资格考试', '全国计算机等级考试', '国家统一法律职业资格考试'],
    postgraduate_public_exam: ['全国硕士研究生招生考试', '中央机关及其直属机构公务员招考', '各省选调生招录'],
    campus_recruitment: ['国家大学生就业服务平台招聘会', '高校毕业生秋季校园招聘', '大学生实习提前批'],
    computer_data: ['CCF大学生计算机系统与程序设计竞赛'],
    research_program: ['北京协和医学院推荐免试研究生预报名']
  }
}

const CRITICAL_DISCOVERY_TARGET_NAMES = [
  '华为全联接大会', 'NVIDIA中国开发者日', 'Intel Connection', 'GOSIM', 'PyCon China',
  '香港金融科技周', '外滩大会', 'LANY', 'Charlie Puth', '广州国际汽车展览会',
  '中国网球公开赛', 'WTT中国大满贯', '北京马拉松', '2026爱知名古屋亚运会',
  'IDO动漫游戏嘉年华', 'ComicLove动漫嘉年华', 'CICF×AGF广州动漫游戏盛典', 'ComicQuest', '全国大学英语四、六级考试',
  'CCF大学生计算机系统与程序设计竞赛'
]

module.exports = { NAMED_IP_ROSTER, CRITICAL_DISCOVERY_TARGET_NAMES }
