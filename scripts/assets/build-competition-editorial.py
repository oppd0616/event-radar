from pathlib import Path
from html import escape
import json, shutil
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/competition/追踪事件簿-产品介绍设计版.pdf'
backup=OUT.with_name('追踪事件簿-产品介绍设计版-20261001存档.pdf')
if OUT.exists() and not backup.exists(): shutil.copy2(OUT,backup)
pdfmetrics.registerFont(TTFont('CN','C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('CNB','C:/Windows/Fonts/msyhbd.ttc',subfontIndex=0))
W,H=A4
C=canvas.Canvas(str(OUT),pagesize=A4)
C.setTitle('追踪事件簿 | 让兴趣有下一步'); C.setAuthor('宿炜')
INK='#19252F'; BLUE='#315AF4'; GRAY='#65717A'; LINE='#D9DFE3'; PAPER='#F5F4EF'; WHITE='#FFFFFF'; DARK='#152431'; LIME='#DDEEAA'; PALE='#EDF0FD'; SOFT='#BECAD3'
n=0
def col(v): return colors.HexColor(v)
def box(x,y,w,h,fill=WHITE,r=0):
    C.setFillColor(col(fill))
    if r:C.roundRect(x,H-y-h,w,h,r,fill=1,stroke=0)
    else:C.rect(x,H-y-h,w,h,fill=1,stroke=0)
def text(x,y,s,size=10,bold=False,fill=INK):
    font='CNB' if bold else 'CN'
    if x+pdfmetrics.stringWidth(s,font,size)>W-22: raise ValueError(f'Width p{n}: {s}')
    C.setFont(font,size);C.setFillColor(col(fill));C.drawString(x,H-y-size*.86,s)
def body(x,y,s,w=499,size=10.5,leading=18,fill=INK):
    p=Paragraph(escape(s).replace('\n','<br/>'),ParagraphStyle('p',fontName='CN',fontSize=size,leading=leading,wordWrap='CJK',textColor=col(fill)))
    _,h=p.wrap(w,900)
    if y+h>790: raise ValueError(f'Height p{n}: {s[:30]} -> {y+h}')
    p.drawOn(C,x,H-y-h);return y+h
def rule(x,y,x2,y2,fill=LINE,width=.8):
    C.setStrokeColor(col(fill));C.setLineWidth(width);C.line(x,H-y,x2,H-y2)
def dot(x,y,r=4,fill=BLUE):
    C.setFillColor(col(fill));C.circle(x,H-y,r,stroke=0,fill=1)
def page(label,bg=WHITE,dark=False):
    global n
    n+=1;box(0,0,W,H,bg)
    fg=WHITE if dark else INK; soft=SOFT if dark else GRAY
    text(48,29,'追踪事件簿',8.3,True,fg);text(337,30,label,8,fill=soft)
    rule(48,54,547,54,'#3B4954' if dark else LINE)
    rule(48,809,136,809,soft);dot(48+8*(n-1),809,3,LIME if dark else BLUE)
    text(157,803,'2026微信小程序开发大赛 · 产品介绍',7.3,fill=soft);text(530,800,f'{n:02}',10,True,fg)
    C.bookmarkPage(f'p{n}');C.addOutlineEntry(label,f'p{n}',0)
def end():C.showPage()
def title(kicker,lines,size=34,dark=False):
    text(48,85,kicker,8.5,True,LIME if dark else BLUE)
    for i,s in enumerate(lines):text(48,114+i*(size+10),s,size,True,WHITE if dark else INK)
def note(s,y=764,dark=False):body(48,y,s,499,7.5,11,SOFT if dark else GRAY)
def shot(kind,x,y,w,crop=None):
    im=ImageReader(str(ROOT/f'output/competition/screenshots/{kind}.png'))
    iw,ih=im.getSize();left,top,cw,ch=crop or (0,0,iw,ih)
    scale=w/cw;h=ch*scale
    C.saveState();p=C.beginPath();p.roundRect(x,H-y-h,w,h,12);C.clipPath(p,stroke=0)
    C.drawImage(im,x-left*scale,H-y-(ih-top)*scale,iw*scale,ih*scale,mask='auto');C.restoreState()
    return h
def step(x,y,num,heading,desc,w=222,dark=False):
    text(x,y,num,10,True,LIME if dark else BLUE);text(x+28,y-1,heading,13,True,WHITE if dark else INK)
    body(x+28,y+27,desc,w-28,10,17,SOFT if dark else GRAY)
def link(y,label,url):
    bottom=body(48,y,label,499,8,12,BLUE);C.linkURL(url,(48,H-bottom,547,H-y),relative=0,thickness=0);return bottom

report=json.loads((ROOT/'docs/recommendation-ranking-comparison-20260930.json').read_text(encoding='utf-8-sig'))
after={p['name']:p for p in report['after']['profiles']}
before={p['name']:p for p in report['before']['profiles']}

page('01 / PRODUCT MANIFESTO',PAPER)
text(48,89,'把注意力，留给值得投入的事。',11,True,BLUE)
text(48,130,'让兴趣',55,True);text(48,202,'有下一步。',55,True)
body(48,283,'发现适合你的活动，\n跟进值得投入的机会。',255,15,25)
box(318,347,278,409,DARK)
shot('home',338,320,195)
rule(57,402,57,611,BLUE,1.2)
for yy,heading,desc in [(402,'与我有关吗？','从自己的兴趣出发'),(499,'我能参与吗？','找到时间、地点与入口'),(596,'之后怎么看？','把关注留到真正行动时')]:
    dot(57,yy+6,5);text(78,yy,heading,16,True);text(78,yy+30,desc,10,fill=GRAY)
text(48,696,'成长机会 × 兴趣体验',14,True,BLUE)
note('界面为 2026-10-01 开发者工具真实截图；非概念稿。文档更新：2026-10-07。')
end()

page('02 / THE HUMAN NEED',DARK,True)
title('时代背景', ['机会很多，','注意力却只有一份。'],dark=True)
text(48,262,'“报名昨天截止了。”',30,True,LIME)
body(48,312,'情境示例：本想参加一场黑客松，却在刷到招募信息时错过了报名。信息并不稀缺，及时遇见适合自己的机会才稀缺。',470,12,22,SOFT)
rule(48,396,547,396,'#3B4954')
step(48,427,'01','想成长，也想找到自己','升学与就业压力下，竞赛、开发者活动和实践机会帮助年轻人探索能力边界。',235,True)
step(314,427,'02','想充实，也想保持热爱','演出、展览、赛事与快闪，为日常生活提供情绪价值、文化体验与线下连接。',233,True)
box(48,587,499,130,'#243744',12)
text(68,609,'让合适的人，看见合适的活动。',21,True,WHITE)
body(68,653,'对用户，是更少筛选成本；对活动方，是更相关的触达机会。产品连接供需，但不以制造更多信息噪声为目标。',455,11,19,SOFT)
note('以上为产品洞察与设计目标，不代表已验证的用户规模、商业转化或主办方投放能力。',dark=True)
end()

page('03 / PERSONAL RELEVANCE',PAPER)
title('创新设计一 · 从热度导向到兴趣相关',['不是给所有人，','看同一张活动榜。'])
body(48,224,'把“我喜欢什么”变成排序依据，让首页成为个人的机会入口。',499,12,20)
for x,name,label in [(48,'AI 与大模型','AI / 大模型'),(307,'艺术展览','艺术展览')]:
    box(x,290,240,397,WHITE,14);text(x+20,313,label,20,True,BLUE)
    text(x+20,350,'离线推荐结果 · 前三项',8.5,fill=GRAY)
    for i,event in enumerate(after[name]['top10'][:3]):
        yy=394+i*90;text(x+20,yy,f'0{i+1}',10,True,BLUE)
        body(x+49,yy-2,event['title'],170,11,18)
        if i<2:rule(x+20,yy+69,x+220,yy+69)
body(48,717,'解释推荐理由，同时允许用户调整偏好，让推荐保持可理解、可控制。',499,10.5,18)
note('数据图，非界面截图。来源：2026-09-30 离线回放，110 条活动、5 组构造兴趣画像。')
end()

page('04 / MEASURED IMPROVEMENT')
title('先看可验证的变化',['让推荐更贴近兴趣。'])
text(48,215,'3 → 10',74,True,BLUE);text(358,257,'/ 10 条',21,True)
body(48,311,'“演唱会”画像的前十条精确兴趣匹配数\n优化前 3 条，优化后 10 条。',499,13,22)
text(48,391,'前十条精确兴趣匹配数',11,True)
text(377,393,'浅色：优化前   蓝色：优化后',8,fill=GRAY)
for i,name in enumerate(['AI 与大模型','演唱会','艺术展览','黑客松','无畏契约']):
    yy=433+i*49;a=before[name]['matchedTop10'];b=after[name]['matchedTop10']
    text(48,yy,name,10);box(174,yy,255,8,PALE,4);box(174,yy,25.5*a,8,'#B4C2F8',4)
    box(174,yy+13,25.5*b,8,BLUE,4);text(450,yy+3,f'{a} → {b}',12,True,BLUE)
body(48,705,'少，不等于失败：样本池中黑客松仅 6 条、无畏契约仅 2 条精确匹配，不应靠无关热门内容凑满。',499,10,17)
note('同一活动池的离线测试，不是线上点击率或用户满意度。来源：recommendation-ranking-comparison-20260930.json。')
end()

page('05 / THE FIRST SCREEN',PAPER)
title('功能一 · 发现',['先回答：这与我有关吗？'],size=29)
shot('home',48,213,240)
step(323,254,'01','识别活动','领域与标题帮助用户快速判断：这是机会、体验，还是自己不关心的信息。',222)
step(323,406,'02','看清下一步','日期、参与入口和来源集中呈现，减少在信息流与搜索页面之间反复跳转。',222)
step(323,576,'03','持续校准','通过偏好设置与交互反馈改善排序，不把“全网很热”直接等同于“适合你”。',222)
note('真实首页截图（2026-10-01），展示当时未设置兴趣的状态；右侧说明为功能设计说明。')
end()

page('06 / A REAL OPPORTUNITY')
title('功能二 · 从发现到参与',['从线上兴趣，','走到线下现场。'])
body(48,223,'无畏契约 × 巴黎世家概念网吧 · 上海站',499,15,23)
text(48,271,'真实关注记录局部',8,fill=GRAY)
shot('follows',48,297,499,(22,578,501,236))
step(48,559,'01','发现跨界活动','游戏兴趣不止指向赛事，也能连接联名空间与线下体验。',239)
step(313,559,'02','核对时间与地点','官号公布 9/24 至 10/18；上海静安报道确认永源路活动空间。[S1][S2]',234)
step(48,665,'03','前往官方参与','“一日网管”专属时段可在无畏契约官方助手预约，余量以官方为准。[S3]',239)
step(313,665,'04','留住下一步','关注后回到自己的列表，继续查看活动；关注本身不会完成预约。',234)
note('截图为 2026-10-01 历史记录；来源于 2026-10-07 复核。场景不代表真实到访或预约成功，来源见第 11 页。')
end()

page('07 / EVENT CONTINUITY',DARK,True)
title('创新设计二 · 从碎片公告到活动进程',['一个活动，','不止一个时间点。'],dark=True)
body(48,229,'把报名、开票、阶段赛程与结束节点放回同一个活动，避免用户在相似标题之间拼凑信息。',480,12,21,SOFT)
text(48,318,'零散的信息',12,True,SOFT);text(313,318,'连续的活动',12,True,LIME)
for i,s in enumerate(['报名公告','开票信息','阶段赛程','活动结束']):
    box(48,366+i*66,204,48,'#243744',9);text(66,382+i*66,s,12,fill=WHITE)
box(294,355,253,293,'#243744',14)
text(316,378,'同一活动 · 统一详情',16,True,WHITE)
rule(320,430,320,604,'#627377',1)
for i,s in enumerate(['报名 / 开票','即将开始','当前阶段','结束与收藏']):
    yy=432+i*53;dot(320,yy,5,LIME if i==2 else SOFT);text(339,yy-6,s,12,True if i==2 else False,LIME if i==2 else WHITE)
text(48,690,'合并的是信息，不是差异。',18,True,LIME)
body(48,725,'不同城市、不同届次与独立场次保留身份边界；缺少可靠日期时，不生成看似精确的赛程。',499,10,17,SOFT)
note('结构示意，非实际活动赛程。线上参与保留必要时刻；线下展示按已确认信息的精度呈现。',dark=True)
end()

page('08 / KEEP WHAT MATTERS',PAPER)
title('功能四 · 关注与回看',['把“以后再看”，','变成找得到的下一步。'],size=29)
shot('follows',307,223,240)
step(48,282,'01','近期优先','把临近、进行中的关注活动放在容易找到的位置，减少遗忘。',222)
step(48,431,'02','结束后仍可回看','“全部关注 / 收藏（已结束）”区分当前机会与过去的兴趣记录。',222)
step(48,587,'03','提醒单独授权','关注与订阅提醒分开。提醒需要微信授权及可用配置，不自动报名或订阅。',222)
note('真实关注页截图（2026-10-01）。列表反映截图时刻，不代表文档阅读当天的活动状态。')
end()

page('09 / BUILT FOR TRUST',DARK,True)
title('技术开发方案 · 创新设计三：证据约束的 AI 信息整理',['AI 整理信息，','证据约束结论。'],dark=True)
rows=[('01','发现活动','活动线索 → 候选队列 → WSA 检索与正文收集','按主题、活动身份与缺失信息组织检索，减少摘要截断带来的信息损失。'),('02','结构化核验','DeepSeek 抽取 → 证据核验 → 去重与阶段归并','保留来源与字段对应关系，检查届次、城市、时间和阶段，冲突信息不直接变成确定事实。'),('03','呈现与跟进','活动库 → 兴趣排序 → 详情 / 关注 / 提醒','微信原生小程序与 TDesign 承载交互；CloudBase 云函数、数据库和定时任务支撑更新。')]
for i,(num,heading,flow,desc) in enumerate(rows):
    yy=255+i*153;box(48,yy,499,131,'#243744',12)
    text(67,yy+20,num,10,True,LIME);text(100,yy+17,heading,17,True,WHITE)
    text(67,yy+53,flow,11,True,WHITE);body(67,yy+79,desc,457,10,17,SOFT)
note('架构概览。搜索与生成负责提取候选事实，不能替代官方发布；字段缺失与冲突仍需持续治理。',dark=True)
end()

page('10 / ENGINEERING EVIDENCE')
title('技术验证与边界',['吸引人，也要经得起使用。'],size=30)
text(48,218,'81.1%',64,True,BLUE)
body(48,294,'一次受控对比中，首页响应体积降低',499,13,22)
for yy,label,length,value,fill in [(359,'完整响应',352,'102,341 B','#B4C2F8'),(416,'卡片响应',66.5,'19,324 B',BLUE)]:
    text(48,yy,label,10);box(145,yy, length,16,fill,6);text(145,yy+24,value,10,True,fill)
body(48,487,'相同 20 张卡片、89 个排序 ID；优化前后顺序一致。减小传输与解析负担，同时保留详情页按需加载。',499,11,19)
rule(48,557,547,557)
step(48,592,'01','已做的校验','推荐排序、活动身份、阶段状态、时间精度与缓存相关回归检查。',237)
step(313,592,'02','不夸大的边界','离线与云端测试不等于真实用户效果；真机速度、提醒和上线版本需独立验收。',234)
body(48,714,'交付状态：已有小程序与云端实现；本文不宣称正式上线、用户规模或商业转化。',499,10,17)
note('来源：docs/feed-performance-20261007.md。体积改善为该次样本结果，不等于端到端速度提升 81.1%。')
end()

page('11 / CREDITS & SOURCES',PAPER)
title('必要说明',['作品贡献与引用'],size=30)
body(48,182,'个人作品。宿炜，山东大学；开发周期：2026 年 9-10 月。独立负责产品设计、开发集成与验证；开发过程使用 AI 辅助。',499,10.5,18)
text(48,253,'第三方组件与服务',14,True)
body(48,286,'TDesign、Day.js、iconv-lite：MIT 许可；opencc-js 程序采用 MIT 许可，所含词典涉及 Apache-2.0。微信小程序、wx-server-sdk 与 CloudBase 提供平台能力。',499,9.5,16)
body(48,347,'信息检索与生成涉及腾讯 WSA、DeepSeek 等服务；项目亦含 Exa、Tavily、TokenHub 等适配。第三方服务与组件不作为个人原创成果。未采用他人完整参赛作品。',499,9.5,16)
text(48,419,'截图、数据与案例来源',14,True)
body(48,451,'页面截图为本项目 2026-10-01 开发者工具真实截图；第 3、4 页为 2026-09-30 离线回放数据图，第 7、9 页为结构示意。无模拟界面冒充实拍，无虚构用户评价。',499,9.5,16)
link(516,'[S1] 无畏契约手游官方微博（新浪承载）· 2026-09-23：活动日期','https://www.sina.cn/news/detail/5346265140298061.html')
link(546,'[S2] 上海静安融媒体中心（澎湃承载）· 2026-09-24：活动空间与参与','https://m.thepaper.cn/newsDetail_forward_34144667')
link(576,'[S3] 无畏契约手游官方资讯（17173 承载）· 2026-09-23：专属预约入口','https://news.17173.com/content/09232026/103914842.shtml')
body(48,619,'案例来源于 2026-10-07 复核。活动信息版权归发布方；文中仅作必要事实引用。内容范围依据《2026 微信小程序开发大赛赛事规程》。',499,9,15)
link(676,'版式参考：Miro 产品介绍的叙事层次；Notion 产品页的模块化呈现。','https://miro.com/product-overview/')
link(701,'Notion 产品页 · 仅作设计研究，未复制其界面、品牌素材或产品截图。','https://www.notion.com/product/notion')
note('引用与个人贡献集中披露于本页；正文聚焦产品价值、使用过程与可验证效果。')
end()

page('12 / YOUR NEXT STEP',PAPER)
title('体验指引',['下一件值得投入的事，','从你的兴趣开始。'],size=31)
body(48,229,'不必关注所有事。\n找到那些值得你参与的事。',499,14,24)
box(317,326,279,428,DARK);shot('follows',335,305,204)
step(48,352,'01','选一个兴趣','进入偏好页，选择自己真正关心的领域和细分方向。',235)
step(48,486,'02','打开一个活动','查看时间、地点、活动进程与来源，判断是否适合参与。',235)
step(48,620,'03','留一个下一步','加入关注，或前往官方入口；报名与购票以官方流程为准。',235)
note('体验者需先获得小程序体验版访问权限。本版未提供公开链接、演示视频或扫码入口。')
end()
C.save()
print(OUT)
