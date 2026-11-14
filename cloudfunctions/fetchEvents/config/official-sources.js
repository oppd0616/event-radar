// Series-level official sources. Keep stable hosts here, never one-off edition
// URLs. A missing profile falls back to open-web discovery rather than guessing.
const PROFILES = [
  { domain: 'culture', aliases: ['香港迪士尼', 'Hong Kong Disneyland'], hosts: ['hongkongdisneyland.com'] },
  { domain: 'culture', aliases: ['香港海洋公园', '海洋公園', 'Ocean Park'], hosts: ['oceanpark.com.hk'] },
  { domain: 'culture', aliases: ['香港旅游发展局', '香港旅發局'], hosts: ['discoverhongkong.com'] },
  { domain: 'game', aliases: ['LPL', '英雄联盟职业联赛'], hosts: ['lpl.qq.com', 'lol.qq.com'] },
  { domain: 'game', aliases: ['英雄联盟全球总决赛', 'League of Legends Worlds'], hosts: ['lolesports.com', 'lol.qq.com'] },
  { domain: 'game', aliases: ['KPL', '王者荣耀职业联赛', '王者荣耀世界冠军杯'], hosts: ['pvp.qq.com', 'esports.qq.com'] },
  { domain: 'game', aliases: ['无畏契约', 'VCT', 'VALORANT Champions'], hosts: ['valorantesports.com', 'val.qq.com'] },
  { domain: 'game', aliases: ['PEL', '和平精英职业联赛'], hosts: ['gp.qq.com'] },
  { domain: 'game', aliases: ['和平精英全球总决赛', 'PUBG Mobile Global Championship', 'PMGC'], hosts: ['esports.pubgmobile.com'] },
  { domain: 'game', aliases: ['ChinaJoy', '中国国际数码互动娱乐展览会'], hosts: ['chinajoy.net'] },
  { domain: 'game', aliases: ['BilibiliWorld', 'BW'], hosts: ['bilibili.com'] },
  { domain: 'game', aliases: ['原神FES'], hosts: ['ys.mihoyo.com', 'mihoyo.com'] },

  { domain: 'sports', aliases: ['F1', '世界一级方程式锦标赛', '中国大奖赛'], hosts: ['formula1.com', 'fia.com'] },
  { domain: 'sports', aliases: ['上海网球大师赛', '上海大师赛'], hosts: ['atptour.com'] },
  { domain: 'sports', aliases: ['中国网球公开赛', '中网'], hosts: ['atptour.com', 'wtatennis.com'] },
  { domain: 'sports', aliases: ['WTT', '世界乒乓球职业大联盟'], hosts: ['worldtabletennis.com'] },
  { domain: 'sports', aliases: ['苏迪曼杯', '中国羽毛球公开赛'], hosts: ['bwfbadminton.com'] },
  { domain: 'sports', aliases: ['中国足球超级联赛', '中国足协杯', '中国国家男子足球队'], hosts: ['thecfa.cn'] },
  { domain: 'sports', aliases: ['CBA'], hosts: ['cba.net.cn'] },
  { domain: 'sports', aliases: ['CUBAL'], hosts: ['cubalsports.com'] },
  { domain: 'sports', aliases: ['奥运会', '亚运会'], hosts: ['olympics.com', 'ocasia.org'] },
  { domain: 'sports', aliases: ['国际足联世界杯', 'FIFA世界杯'], hosts: ['fifa.com'] },
  { domain: 'sports', aliases: ['NBA中国赛'], hosts: ['nba.com'] },
  { domain: 'sports', aliases: ['马拉松', '越野赛'], hosts: ['worldathletics.org', 'athletics.org.cn'] },

  { domain: 'academic', aliases: ['全国大学英语四、六级考试', 'CET4', 'CET6'], hosts: ['cet.neea.edu.cn', 'neea.edu.cn'] },
  { domain: 'academic', aliases: ['全国计算机等级考试', 'NCRE'], hosts: ['ncre.neea.edu.cn', 'neea.edu.cn'] },
  { domain: 'academic', aliases: ['中小学教师资格考试', '教师资格考试'], hosts: ['ntce.neea.edu.cn', 'neea.edu.cn'] },
  { domain: 'academic', aliases: ['全国硕士研究生招生考试', '考研'], hosts: ['yz.chsi.com.cn', 'chsi.com.cn'] },
  { domain: 'academic', aliases: ['国家公务员考试', '国考'], hosts: ['scs.gov.cn'] },
  { domain: 'academic', aliases: ['CATTI', '翻译专业资格考试'], hosts: ['catticenter.com', 'cpta.com.cn'] },
  { domain: 'academic', aliases: ['普通话水平测试'], hosts: ['cltt.org', 'pthceshi.cn'] },
  { domain: 'academic', aliases: ['国家大学生就业服务平台'], hosts: ['ncss.cn'] },
  { domain: 'academic', aliases: ['全国大学生数学建模竞赛'], hosts: ['mcm.edu.cn'] },
  { domain: 'academic', aliases: ['全国大学生计算机系统能力大赛'], hosts: ['educg.net', 'nscscc.com'] },
  { domain: 'academic', aliases: ['RoboMaster'], hosts: ['robomaster.com'] },
  { domain: 'academic', aliases: ['国家统一法律职业资格考试', '法律职业资格考试'], hosts: ['moj.gov.cn', 'chinalaw.gov.cn'] },
  { domain: 'academic', aliases: ['中央机关及其直属机构公务员招考'], hosts: ['scs.gov.cn'] },
  { domain: 'academic', aliases: ['CCF大学生计算机系统与程序设计竞赛'], hosts: ['ccf.org.cn', 'educg.net', 'nscscc.com'] },

  { domain: 'ent', aliases: ['上海国际电影节', 'SIFF'], hosts: ['siff.com'] },
  { domain: 'ent', aliases: ['北京国际电影节', 'BJIFF'], hosts: ['bjiff.com'] },
  { domain: 'ent', aliases: ['FIRST青年电影展'], hosts: ['firstfilm.org.cn'] },
  { domain: 'ent', aliases: ['平遥国际电影展'], hosts: ['pyiffestival.com'] },
  { domain: 'ent', aliases: ['乌镇戏剧节'], hosts: ['wuzhenfestival.com'] },
  { domain: 'ent', aliases: ['中国金鸡百花电影节', '金鸡百花电影节'], hosts: ['cgrhfff.com'] },
  { domain: 'ent', aliases: ['大麦'], hosts: ['damai.cn'] },

  { domain: 'culture', aliases: ['上海博物馆'], hosts: ['shanghaimuseum.net'] },
  { domain: 'culture', aliases: ['中国国家博物馆', '国博'], hosts: ['chnmuseum.cn'] },
  { domain: 'culture', aliases: ['故宫博物院', '故宫'], hosts: ['dpm.org.cn'] },
  { domain: 'culture', aliases: ['三星堆博物馆'], hosts: ['sxd.cn'] },
  { domain: 'culture', aliases: ['敦煌研究院', '敦煌艺术展'], hosts: ['dha.ac.cn'] },
  { domain: 'culture', aliases: ['teamLab无界美术馆', 'teamLab'], hosts: ['art.team-lab.cn'] },
  { domain: 'culture', aliases: ['上海书展'], hosts: ['shbookfair.cn', 'shanghai.gov.cn'] },
  { domain: 'culture', aliases: ['UCCA', '尤伦斯当代艺术中心'], hosts: ['ucca.org.cn', 'ucca-group.com'] },
  { domain: 'culture', aliases: ['名创优品', 'MINISO'], hosts: ['miniso.com'] },

  { domain: 'tech', aliases: ['苹果', 'Apple', 'WWDC'], hosts: ['apple.com', 'apple.com.cn'] },
  { domain: 'tech', aliases: ['Google I/O', '谷歌'], hosts: ['google.com'] },
  { domain: 'tech', aliases: ['Microsoft Build', '微软Build'], hosts: ['microsoft.com'] },
  { domain: 'tech', aliases: ['微信开发者日', '微信开发者创新工坊'], hosts: ['developers.weixin.qq.com'] },
  { domain: 'tech', aliases: ['腾讯云黑客松'], hosts: ['tch.cloud.tencent.com'] },
  { domain: 'tech', aliases: ['MoonBit黑客松', 'MoonBit'], hosts: ['moonbitlang.github.io', 'moonbitlang.com'] },
  { domain: 'tech', aliases: ['ROSCon China'], hosts: ['roscon.cn'] },
  { domain: 'tech', aliases: ['NVIDIA'], hosts: ['nvidia.com'] },
  { domain: 'tech', aliases: ['华为'], hosts: ['huawei.com'] },
  { domain: 'tech', aliases: ['世界机器人大会'], hosts: ['worldrobotconference.com'] },
  { domain: 'tech', aliases: ['世界人形机器人运动会'], hosts: ['whrgoc.com'] },
  { domain: 'tech', aliases: ['RoboMaster机甲大师赛', 'RoboMaster'], hosts: ['robomaster.com'] },
  { domain: 'tech', aliases: ['Intel Connection', '英特尔'], hosts: ['intel.cn', 'intel.com'] },
  { domain: 'tech', aliases: ['GOSIM'], hosts: ['gosim.org'] },
  { domain: 'tech', aliases: ['PyCon China'], hosts: ['cn.pycon.org'] },
  { domain: 'tech', aliases: ['embedded world'], hosts: ['embedded-world.de', 'embedded-world-na.com'] },

  { domain: 'auto', aliases: ['特斯拉', 'Tesla'], hosts: ['tesla.cn', 'tesla.com'] },
  { domain: 'auto', aliases: ['比亚迪', 'BYD'], hosts: ['byd.com'] },
  { domain: 'auto', aliases: ['蔚来', 'NIO'], hosts: ['nio.cn'] },
  { domain: 'auto', aliases: ['小鹏', 'XPENG'], hosts: ['xpeng.com'] },
  { domain: 'auto', aliases: ['小米汽车'], hosts: ['mi.com'] },
  { domain: 'auto', aliases: ['上海国际汽车工业展览会', '上海车展'], hosts: ['autoshanghai.org'] },
  { domain: 'auto', aliases: ['北京国际汽车展览会', '北京车展'], hosts: ['autobeijing.org.cn'] },
  { domain: 'auto', aliases: ['广州国际汽车展览会', '广州车展'], hosts: ['autoguangzhou.com.cn', 'autoguangzhou.org.cn'] },
  { domain: 'auto', aliases: ['粤港澳大湾区车展'], hosts: ['szautoshow.com'] },
  { domain: 'auto', aliases: ['中国国际摩托车博览会', '中国摩博会'], hosts: ['cimamotor.com'] },
  { domain: 'auto', aliases: ['世界新能源汽车大会', 'WNEVC'], hosts: ['wnevc.org.cn'] },
  { domain: 'auto', aliases: ['武汉国际汽车制造技术暨智能装备博览会', '武汉工博会'], hosts: ['whciame.com'] },
  { domain: 'auto', aliases: ['F1中国大奖赛', 'F1'], hosts: ['formula1.com', 'fia.com'] },

  { domain: 'anime', aliases: ['BilibiliWorld', 'BML'], hosts: ['bilibili.com'] },
  { domain: 'anime', aliases: ['原神', '崩坏星穹铁道'], hosts: ['hoyolab.com', 'mihoyo.com'] },
  { domain: 'anime', aliases: ['原神FES'], hosts: ['ys.mihoyo.com', 'mihoyo.com'] },
  { domain: 'anime', aliases: ['宝可梦卡牌', 'PTCG'], hosts: ['pokemon.cn'] },
  { domain: 'anime', aliases: ['恋与深空'], hosts: ['deepspace.papegames.com', 'loveanddeepspace.infoldgames.com'] },
  { domain: 'anime', aliases: ['光与夜之恋'], hosts: ['love.qq.com'] },
  { domain: 'anime', aliases: ['恋与制作人'], hosts: ['evol.papegames.cn'] },
  { domain: 'anime', aliases: ['万智牌'], hosts: ['magic.wizards.com'] },
  { domain: 'anime', aliases: ['游戏王决斗者杯', '游戏王'], hosts: ['yugioh-card-cn.com'] },
  { domain: 'anime', aliases: ['中国国际动漫游戏博览会', 'CCG EXPO'], hosts: ['ccgexpo.cn'] },
  { domain: 'anime', aliases: ['中国国际动漫节', 'CICAF'], hosts: ['cicaf.hzxcw.gov.cn', 'cicaf.com'] },
  { domain: 'anime', aliases: ['CICF×AGF', 'CICF', '广州动漫游戏盛典', '中国国际漫画节动漫游戏展'], hosts: ['cicfexpo.com'] },
  { domain: 'anime', aliases: ['ComicQuest', 'CQ5.0'], hosts: ['comicquest.cn'] },
  { domain: 'anime', aliases: ['IDO动漫游戏嘉年华', 'IDO漫展'], hosts: ['idoacg.com'] },
  { domain: 'anime', aliases: ['ComicLove动漫嘉年华', 'ComicLove'], hosts: ['comiclove.cn'] },
  { domain: 'anime', aliases: ['明日方舟音律联觉', '明日方舟'], hosts: ['ak.hypergryph.com', 'hypergryph.com'] },
  { domain: 'anime', aliases: ['洛天依演唱会', '洛天依'], hosts: ['vsinger.com'] },
  { domain: 'anime', aliases: ['初音未来演唱会', '初音未来'], hosts: ['piapro.net', 'miku-expo.com'] },

  { domain: 'finance', aliases: ['香港金融科技周'], hosts: ['fintechweek.hk'] },
  { domain: 'finance', aliases: ['外滩大会'], hosts: ['inclusionconf.com'] },
  { domain: 'finance', aliases: ['Money20/20'], hosts: ['asia.money2020.com', 'money2020.com'] },
  { domain: 'finance', aliases: ['中国投资年会', '中国股权投资年度论坛'], hosts: ['events.pedaily.cn', 'zero2ipo.com.cn'] },

  { domain: 'academic', aliases: ['北京协和医学院推荐免试研究生预报名'], hosts: ['graduate.pumc.edu.cn'] },

  { domain: 'game', aliases: ['任天堂直面会', 'Nintendo Direct'], hosts: ['nintendo.com'] },
  { domain: 'game', aliases: ['PlayStation发布会', 'State of Play'], hosts: ['playstation.com', 'blog.playstation.com'] },
  { domain: 'game', aliases: ['Xbox发布会', 'Xbox Games Showcase'], hosts: ['xbox.com', 'news.xbox.com'] }
]

// Topic-level authoritative fallbacks cover targets whose official presence is
// an account rather than a stable website. An open-web retry still follows when
// these hosts have no current result.
const TOPIC_FALLBACK_HOSTS = {
  ent: {
    stadium_concert: ['damai.cn', 'maoyan.com'],
    music_festival: ['damai.cn', 'maoyan.com', 'showstart.com'],
    comedy: ['damai.cn', 'maoyan.com', 'showstart.com'],
    theatre: ['damai.cn', 'maoyan.com'],
    immersive_theatre: ['damai.cn', 'maoyan.com'],
    western_music: ['damai.cn', 'maoyan.com', 'showstart.com'],
    film_festival: ['siff.com', 'bjiff.com', 'firstfilm.org.cn', 'pyiffestival.com', 'cgrhfff.com']
  },
  auto: {
    auto_show: ['autoshanghai.org', 'autobeijing.org.cn', 'autoguangzhou.com.cn', 'szautoshow.com', 'cimamotor.com', 'bitauto.com', 'autohome.com.cn'],
    motorsport: ['formula1.com', 'fia.com']
  },
  game: {
    honor_of_kings: ['pvp.qq.com', 'esports.qq.com', 'wanplus.cn'], lol: ['lpl.qq.com', 'lol.qq.com', 'lolesports.com', 'wanplus.cn'],
    valorant: ['valorantesports.com', 'val.qq.com', 'wanplus.cn'], peace_elite: ['gp.qq.com', 'wanplus.cn'],
    game_expo: ['chinajoy.net', 'bilibili.com'],
    console: ['nintendo.com', 'playstation.com', 'xbox.com']
  },
  sports: {
    football: ['thecfa.cn'], basketball: ['cba.net.cn', 'cubalsports.com'],
    badminton_pingpong: ['worldtabletennis.com', 'bwfbadminton.com'],
    tennis: ['atptour.com', 'wtatennis.com'], running: ['chinamarathon.com', 'mararun.com', '51sai.com', 'zuicool.com', 'worldathletics.org', 'athletics.org.cn'],
    campus_sports: ['olympics.com', 'ocasia.org']
  },
  academic: {
    language_exam: ['neea.edu.cn', 'catticenter.com', 'cltt.org', 'pthceshi.cn'],
    qualification_exam: ['neea.edu.cn', 'cpta.com.cn'],
    postgraduate_public_exam: ['chsi.com.cn', 'scs.gov.cn'],
    campus_recruitment: ['ncss.cn'], computer_data: ['saikr.com', 'cc.moocollege.com', '52jingsai.com', 'educg.net', 'nscscc.com'],
    electronic_engineering: ['saikr.com', 'cc.moocollege.com', '52jingsai.com'], mechanical_engineering: ['saikr.com', '52jingsai.com'],
    civil_architecture: ['saikr.com', '52jingsai.com'], business_economics: ['saikr.com', '52jingsai.com'],
    design_media: ['saikr.com', '52jingsai.com'], humanities_law: ['saikr.com', '52jingsai.com'], medicine_life: ['saikr.com', '52jingsai.com'],
    agriculture_environment: ['saikr.com', '52jingsai.com'], language_education: ['saikr.com', '52jingsai.com'],
    math_modeling: ['saikr.com', '52jingsai.com', 'mcm.edu.cn'], programming: ['saikr.com', 'cc.moocollege.com', '52jingsai.com'],
    ai_competition: ['saikr.com', 'cc.moocollege.com', '52jingsai.com'], innovation: ['saikr.com', '52jingsai.com', 'cc.moocollege.com'], robot_competition: ['saikr.com', 'cc.moocollege.com', '52jingsai.com'],
    hackathon: ['saikr.com', 'huodongxing.com', '52jingsai.com'], design_competition: ['saikr.com', '52jingsai.com'],
    academic_conference: ['huodongjia.com', 'bagevent.com', 'huodongxing.com'], industry_challenge: ['saikr.com', 'cc.moocollege.com', '52jingsai.com'],
    research_program: ['graduate.pumc.edu.cn']
  },
  anime: {
    anime_expo: ['bilibili.com', 'damai.cn', 'nyato.com', 'yunmanzhan.com'],
    anime_music: ['bilibili.com', 'damai.cn', 'showstart.com'],
    ip_popup: ['deepspace.papegames.com', 'love.qq.com', 'evol.papegames.cn', 'hoyolab.com', 'mihoyo.com'],
    tcg: ['pokemon.cn', 'magic.wizards.com'],
    goods_figures: ['bilibili.com', 'damai.cn'],
    cosplay: ['nyato.com', 'yunmanzhan.com'], doujin_only: ['nyato.com', 'yunmanzhan.com']
  },
  culture: {
    art_exhibition: ['museum.cn', 'vart.cc', 'damcaanet.cn', 'chnmuseum.cn', 'dpm.org.cn', 'shanghaimuseum.net', 'sxd.cn', 'dha.ac.cn'],
    immersive_event: ['art.team-lab.cn', 'chnmuseum.cn', 'dpm.org.cn'],
    design_market: ['shanghai.gov.cn']
  },
  tech: {
    developer: ['huodongjia.com', 'bagevent.com', 'huodongxing.com', 'segmentfault.com', 'events.waytoagi.com', 'apple.com', 'google.com', 'microsoft.com', 'nvidia.com', 'huawei.com', 'intel.cn', 'gosim.org', 'cn.pycon.org'],
    hackathon: ['tch.cloud.tencent.com', 'moonbitlang.github.io', 'events.waytoagi.com', 'huodongxing.com', 'luma.com'],
    robotics: ['worldrobotconference.com', 'whrgoc.com', 'robomaster.com'],
    ai: ['huodongjia.com', 'bagevent.com', 'huodongxing.com', 'events.waytoagi.com'], open_source: ['huodongxing.com', 'bagevent.com', 'segmentfault.com', 'events.waytoagi.com'],
    chips_pc: ['zhanwei.cn'], smart_device: ['zhanwei.cn']
  },
  finance: {
    fintech: ['huodongjia.com', 'bagevent.com', 'huodongxing.com', 'fintechweek.hk', 'inclusionconf.com', 'asia.money2020.com'],
    investment: ['huodongjia.com', 'bagevent.com', 'huodongxing.com', 'events.pedaily.cn', 'zero2ipo.com.cn'],
    startup: ['huodongxing.com', 'huodongjia.com', 'bagevent.com'], business_summit: ['huodongjia.com', 'bagevent.com'],
    quant: ['huodongjia.com', 'bagevent.com'], macro: ['huodongjia.com', 'bagevent.com']
  }
}

function normalized(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function officialHostsFor(domain, topicKey, namedTarget) {
  const target = normalized(namedTarget)
  if (!target) return []
  const matches = PROFILES.filter((profile) => profile.domain === domain && profile.aliases.some((alias) => {
    const key = normalized(alias)
    return key && (target.indexOf(key) >= 0 || key.indexOf(target) >= 0)
  }))
  const direct = Array.from(new Set(matches.reduce((all, profile) => all.concat(profile.hosts), [])))
  const fallback = Array.from(new Set(TOPIC_FALLBACK_HOSTS[domain] && TOPIC_FALLBACK_HOSTS[domain][topicKey] || []))
  if (direct.length) {
    // One stable series host plus topic hubs is enough. Avoid paying to query
    // several equivalent official domains before trying a high-coverage hub.
    return Array.from(new Set([direct[0]].concat(fallback.filter(host => direct.indexOf(host) < 0))))
  }
  return fallback
}

function officialSearchAliasesFor(domain, namedTarget) {
  const target = normalized(namedTarget)
  if (!target) return []
  const aliases = PROFILES.filter((profile) => profile.domain === domain && profile.aliases.some((alias) => {
    const key = normalized(alias)
    return key && (target.indexOf(key) >= 0 || key.indexOf(target) >= 0)
  })).reduce((all, profile) => all.concat(profile.aliases), [])
  return Array.from(new Set(aliases.filter((alias) => {
    const key = normalized(alias)
    return key && key !== target && key.length >= 5
  }))).slice(0, 4)
}

const OFFICIAL_HOSTS_BY_DOMAIN = PROFILES.reduce((result, profile) => {
  if (!result[profile.domain]) result[profile.domain] = []
  profile.hosts.forEach((host) => {
    if (result[profile.domain].indexOf(host) < 0) result[profile.domain].push(host)
  })
  return result
}, {})

function sourceCoverageForRoster(roster) {
  const items = []
  Object.keys(roster || {}).forEach((domain) => {
    Object.keys(roster[domain] || {}).forEach((topicKey) => {
      ;(roster[domain][topicKey] || []).forEach((name) => {
        const hosts = officialHostsFor(domain, topicKey, name)
        const direct = PROFILES.some((profile) => profile.domain === domain && profile.aliases.some((alias) => {
          const target = normalized(name)
          const key = normalized(alias)
          return key && (target.indexOf(key) >= 0 || key.indexOf(target) >= 0)
        }))
        items.push({ domain, topicKey, name, hosts, coverage: direct ? 'series' : (hosts.length ? 'topic' : 'open_web') })
      })
    })
  })
  return items
}

module.exports = { PROFILES, TOPIC_FALLBACK_HOSTS, OFFICIAL_HOSTS_BY_DOMAIN, officialHostsFor, officialSearchAliasesFor, sourceCoverageForRoster }
