"""Editorial product folio; all UI imagery is dated, real capture."""
from pathlib import Path
from html import escape
import json, sys
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader
from reportlab.lib.pagesizes import A4

ROOT=Path(__file__).resolve().parents[1]
MODERN='--modern' in sys.argv
OUT=ROOT/('output/pdf/追踪事件簿-产品介绍-现代科技版.pdf' if MODERN else 'output/pdf/追踪事件簿-产品介绍-编辑设计版.pdf')
OUT.parent.mkdir(parents=True,exist_ok=True)
for name,file in [('sans','msyh.ttc'),('bold','msyhbd.ttc'),('serif','msyh.ttc' if MODERN else 'STSONG.TTF')]:
    pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+file))
W,H=A4
c=canvas.Canvas(str(OUT),pagesize=A4)
c.setTitle('追踪事件簿｜产品介绍');c.setAuthor('宿炜')
PAPER='#F3F0E8';INK='#243C34';MUTED='#72756C';RED='#AB4934';LINE='#C9CEC1';SAGE='#DDE2D4'
if MODERN:
    PAPER='#F7F8FB';INK='#171C29';MUTED='#667184';RED='#4163DC';LINE='#DCE2EC';SAGE='#E6ECFA'
num=0
def rect(x,y,w,h,color):
    c.setFillColor(HexColor(color));c.rect(x,H-y-h,w,h,stroke=0,fill=1)
def txt(x,y,s,size=10,font='sans',color=INK):
    assert x+pdfmetrics.stringWidth(s,font,size)<W-20,(num,s)
    c.setFont(font,size);c.setFillColor(HexColor(color));c.drawString(x,H-y-size*.88,s)
def line(x,y,x2,y2,color=LINE,width=.6):
    c.setStrokeColor(HexColor(color));c.setLineWidth(width);c.line(x,H-y,x2,H-y2)
def para(x,y,s,w=491,size=11,leading=19,color=INK,font='sans'):
    p=Paragraph(escape(s).replace('\n','<br/>'),ParagraphStyle('p',fontName=font,fontSize=size,leading=leading,textColor=HexColor(color),wordWrap='CJK'))
    _,h=p.wrap(w,900);assert y+h<797,(num,s[:20],h)
    p.drawOn(c,x,H-y-h);return y+h
def page(label,dark=False):
    global num
    num+=1;rect(0,0,W,H,INK if dark else PAPER)
    fg=PAPER if dark else INK
    txt(42,28,'追踪事件簿',9,'sans',fg);txt(360,29,label,8,'sans',fg)
    if MODERN:
        rect(42,51,24,3,'#A9E4DC' if dark else RED)
        line(77,52,553,52,'#364154' if dark else LINE)
    else:line(42,52,553,52,SAGE if dark else LINE)
    txt(42,811,'产品介绍 / 2026 微信小程序开发大赛',7,'sans',fg)
    txt(530,807,f'{num:02}',12,'serif',fg)
    c.bookmarkPage(str(num));c.addOutlineEntry(label,str(num),0)
def end():c.showPage()
def heading(k,title,sub=None):
    txt(42,82,k,9,'sans',RED);txt(42,113,title,28 if MODERN else 32,'bold' if MODERN else 'serif')
    if sub:para(42,162,sub,490,11,19,MUTED)
def shot(name,x,y,w,crop=None):
    im=ImageReader(str(ROOT/f'output/competition/screenshots/{name}.png'))
    iw,ih=im.getSize();left,top,cw,ch=crop or (0,0,iw,ih);s=w/cw
    c.saveState();p=c.beginPath();p.rect(x,H-y-ch*s,w,ch*s);c.clipPath(p,stroke=0)
    c.drawImage(im,x-left*s,H-y-(ih-top)*s,iw*s,ih*s,mask='auto');c.restoreState()
def caption(s,y=772):para(42,y,s,511,7.5,11,MUTED)
def block(x,y,k,title,body,w=220):
    txt(x,y,k,9,'sans',RED)
    bottom=para(x,y+23,title,w,18,25,font='serif')
    para(x,bottom+12,body,w,10.5,18)
def url(x,y,label,target):
    txt(x,y,label,8,'sans',RED);c.linkURL(target,(x,H-y-12,x+pdfmetrics.stringWidth(label,'sans',8),H-y+2),relative=0)

page('作品介绍 · OCTOBER 2026')
if MODERN:
    txt(42,86,'PERSONAL EVENT DISCOVERY',9,'sans',RED)
    txt(38,121,'追踪事件簿',54,'bold')
    para(42,199,'发现近期活动，留下自己的关注。',500,17,26,MUTED)
    rect(42,263,511,467,'#E9EDF5')
    rect(42,263,229,467,INK)
    txt(64,291,'INTEREST → ACTION',8,'sans','#A9E4DC')
    para(64,335,'从一场黑客松，\n到一场演出。',184,23,36,PAPER,'bold')
    para(64,444,'成长的机会，\n生活的兴趣。\n在同一个入口发现。',169,12,23,'#B9C4D7')
    for yy,n,t in [(579,'01','发现与你有关的活动'),(621,'02','看清时间与参与方式'),(663,'03','保存并持续关注')]:
        txt(64,yy,n,9,'sans','#A9E4DC');txt(91,yy,t,10,'sans',PAPER)
    rect(292,286,241,426,'#D8DFEB')
    shot('follows',282,277,241,(0,143,546,972))
else:
    txt(42,91,'一本关于机会、兴趣与行动的事件簿',11)
    txt(37,139,'追踪',76,'serif');txt(37,226,'事件簿',76,'serif')
    line(42,333,553,333,INK,1)
    para(43,359,'从一场黑客松，到一场演出。\n发现近期活动，留下自己的关注。',267,16,27,font='serif')
    txt(43,458,'微信小程序 / 个性化活动发现',9,'sans',RED)
    rect(325,358,228,367,SAGE)
    shot('follows',337,379,204,(16,145,514,822))
    line(42,536,278,536)
    for yy,a,b in [(557,'发现','根据兴趣遇见活动'),(608,'了解','查看阶段、时间与参与入口'),(659,'关注','把感兴趣的事留在自己的列表里')]:
        txt(42,yy,a,18,'serif');para(103,yy+1,b,180,9.5,15,MUTED)
caption('右图为真实界面局部，拍摄于 2026-10-01。文档修订于 2026-10-10。')
end()

# 02 — problem and positioning.
page('01 / 为什么做这件事')
heading('产品出发点','年轻人的日程，不只有任务。')
para(42,182,'升学与就业让自我提升变得紧迫。竞赛、黑客松和开发者活动，是认识行业、尝试实践的入口；演出、展览与快闪，则让人有机会继续探索喜欢什么。',473,14,25,font='serif')
line(42,302,553,302)
block(42,327,'用户一侧','找到适合自己的机会','活动信息散落在公众号、票务平台和主办方网站。知道一场活动的名字，往往还要继续找日期、地点、报名入口，并判断是否适合自己。',235)
block(316,327,'活动一侧','让感兴趣的人看见','主办方需要接触真正感兴趣的人。追踪事件簿尝试把推荐建立在兴趣与参与条件上，而不是让所有用户看到同一批热门活动。',237)
rect(42,533,511,155,SAGE)
txt(60,554,'产品定位',9,'sans',RED)
para(60,583,'一个轻量的活动发现与关注工具。\n把分散的信息整理成可以判断、可以跟进的活动条目。',471,18,29,font='serif')
caption('边界：不替代官方报名或票务平台，不承诺获得名额；活动变更与参与要求仍以主办方通知为准。',735)
end()

# 03 — discovery with large genuine screenshot.
page('02 / 从兴趣开始')
heading('发现与偏好','首页，是每个人不同的起点。')
shot('home',42,193,247,(0,126,546,1005))
block(324,208,'01','先表达兴趣','通过领域与细分兴趣表达偏好。科技、游戏、演出等领域承担导航，具体主题进一步缩小范围。',222)
block(324,386,'02','再判断相关性','推荐结合兴趣信号组织候选活动，并给出推荐理由。用户仍可按时间、热度切换查看方式。',222)
block(324,563,'03','保留选择权','偏好可以调整；关注用来保存活动，提醒需要另外授权。一次兴趣选择，不应成为永久标签。',222)
caption('真实发现页截图，2026-10-01；截图中的活动状态是拍摄时的历史状态，不代表当前赛程。')
end()

# 04 — concrete user journey, no invented UI screenshot.
page('03 / 从名字找到活动')
heading('主动搜索','已经有目标，就直接找。','推荐适合尚未决定的时刻；搜索承接明确的活动名称、主题或关键词。')
rect(42,228,511,91,INK)
txt(62,244,'示例查询',8,'sans',SAGE);txt(62,270,'黑客松',25,'serif',PAPER)
txt(418,278,'搜索 →',12,'sans',PAPER)
for yy,no,title,desc in [(365,'1','输入名称或关键词','从发现页的搜索入口进入，表达这次想找什么。'),(460,'2','浏览已有活动','查看匹配结果，再根据活动名称和时间判断是否值得进一步了解。'),(555,'3','进入详情并关注','了解参与方式，把想继续跟进的活动留在关注列表。')]:
    txt(44,yy,no,31,'serif',RED);txt(91,yy+1,title,18,'serif');para(91,yy+33,desc,437,11,18,MUTED);line(91,yy+75,553,yy+75)
caption('本页为搜索交互说明图，不是小程序截图；示例查询不表示当时一定存在可报名的结果。',721)
end()

# 05 — event hierarchy, no fabricated stage dates.
page('04 / 看清参与方式')
heading('活动详情','一场活动，可以有多个阶段。','用户需要知道的是“现在进行到哪里”，而不是看到多个像重复内容的活动。')
shot('detail',42,214,238,(0,123,546,1056))
txt(316,233,'赛事信息的组织方式',17,'serif')
para(316,272,'同一届赛事作为一个活动保留。小组赛、淘汰赛和总决赛放在阶段中，各自关联时间与场地，避免把决赛日期套用到整场赛事。',234,11,19)
line(326,398,326,556,RED,1)
for yy,label,desc in [(395,'小组赛','阶段自己的起止日期'),(460,'淘汰赛','阶段自己的场馆信息'),(525,'总决赛','阶段自己的参与入口')]:
    rect(322,yy+5,8,8,RED);txt(346,yy,label,15,'serif');txt(346,yy+25,desc,9,'sans',MUTED)
para(316,621,'开票、报名与活动开始是不同时间。未核实的信息明确保留不确定性，不用推测值补齐。',230,11,19)
caption('左：真实详情页，2026-10-01，含当时的待核实提示。右：阶段结构示意，不构成实际赛程。')
end()

# 06 — saved events, giant actual crop.
page('05 / 把关注留下来')
heading('关注与提醒','想看的事，之后还能找到。')
shot('follows',42,190,511,(0,149,546,415))
line(42,633,553,633)
para(42,662,'全部关注 / 收藏（已结束）',247,15,22,font='serif')
para(316,659,'关注保存选择；已结束的活动仍可回看。提醒单独申请微信订阅消息授权，不因关注而自动开启。',237,10,17)
caption('真实关注页局部，2026-10-01。活动信息仅用于展示产品的历史界面。')
end()

# 07 — system explanation, no glossy architecture-card wall.
page('06 / 产品如何实现',True)
txt(42,87,'从公开信息，到一条可用的活动。',30,'serif',PAPER)
para(42,146,'微信小程序承载发现、详情、关注和提醒；云端完成信息处理、存储与推荐。',490,12,21,SAGE)
rows=[('01','发现线索','以活动名称、主题与来源发现候选；利用 WSA 检索与正文材料补充详情。'),('02','整理与核验','模型抽取结构化字段，关联来源证据；检查届次、阶段、时间与地点关系。'),('03','合并与更新','辨认同一活动与不同阶段，保留需要区分的城市站点；对不确定信息作显式处理。'),('04','推荐与呈现','云端排序与数据查询；前端展示轻量卡片，详情按需加载，关注与提醒独立。')]
for i,(n,t,d) in enumerate(rows):
    yy=229+i*116;line(42,yy-15,553,yy-15,'#62766A');txt(42,yy,n,25,'serif',SAGE);txt(106,yy,t,20,'serif',PAPER);para(106,yy+36,d,440,11,19,SAGE)
para(42,721,'技术组合：微信小程序 · 腾讯云 CloudBase · WSA 搜索 · DeepSeek 抽取\n实现重点是字段与证据的对应关系，而非让模型直接生成一段看似完整的介绍。',505,9,16,SAGE)
end()

# 08 — actual evidence, scoped accurately.
page('07 / 如何验证')
heading('离线验证','用可复查的结果，而不是口号。')
report=json.loads((ROOT/'docs/recommendation-ranking-comparison-20260930.json').read_text(encoding='utf-8-sig'))
before={p['name']:p for p in report['before']['profiles']};after={p['name']:p for p in report['after']['profiles']}
txt(42,187,'推荐相关性 / 前 10 条中的主题匹配数',13,'serif')
txt(380,190,'旧版',9,'sans',MUTED);txt(464,190,'优化后',9,'sans',RED)
for i,name in enumerate(before):
    yy=228+i*61;line(42,yy-8,553,yy-8);txt(42,yy+9,name,12)
    txt(386,yy+5,str(before[name]['matchedTop10']),22,'serif',MUTED);txt(480,yy+5,str(after[name]['matchedTop10']),22,'serif',RED)
para(42,550,'同一批 110 个活动、5 组构造兴趣画像的离线对比，记录于 2026-09-30。这里的“匹配”按测试主题判断，不等同于真实用户点击率、满意度或线上转化率。',505,9,16,MUTED)
line(42,625,553,625,INK)
txt(42,648,'81.1%',37,'serif',RED)
para(213,643,'同一组首页数据，响应体由 102,341 字节降至 19,324 字节。\n卡片保留必要字段，详情按需读取。',336,11,19)
caption('性能记录：2026-10-07，20 张卡片、89 个排序 ID 的对照。响应体缩减不等于真机加载时间缩短同样比例。',744)
end()

# 09 — contribution and citations, small personal presence.
page('08 / 作品说明')
heading('创新与边界','把发现、判断与后续关注连起来。')
block(42,187,'产品组合','成长与兴趣放在同一个入口','竞赛、开发者活动与文化体验共用发现方式，通过个人兴趣分流；不要求用户先决定自己属于哪类人。',235)
block(316,187,'信息表达','活动是主体，阶段是进程','围绕一个活动组织多个阶段，区分活动时间和参与入口时间，让列表更清晰、详情更便于判断。',235)
line(42,366,553,366)
txt(42,389,'开发与外部成果说明',19,'serif')
para(42,428,'个人作品：宿炜，山东大学；开发时间为 2026 年 9–10 月。个人完成产品设计、开发集成与测试，开发过程中使用 AI 辅助。未引用其他团队的完整作品。',511,10,18)
para(42,500,'第三方组件与服务：微信小程序与 CloudBase、TDesign、Day.js、opencc-js、iconv-lite，以及 WSA、DeepSeek 等服务。其平台能力、开源代码与授权归原权利方，不作为个人原创成果。活动事实来自公开来源，须尊重原发布方的版权与使用条件。',511,10,18)
txt(42,597,'本版编辑设计参考',12,'serif')
para(42,622,'参考编辑设计中的字体对比、留白与图片编排方法；未复制第三方版面、摄影或插画。',511,9,16,MUTED)
url(42,665,'PORTO ROCHA / QUILO', 'https://www.portorocha.com/quilo')
url(316,665,'Pentagram / Typography','https://www.pentagram.com/typography')
caption('验证依据：项目内 recommendation-ranking-comparison-20260930.json 与 feed-performance-20261007.md。\n截图为 2026-10-01 实际开发界面；部分旧界面使用“活动雷达”名称，作品正式名称为“追踪事件簿”。',724)
end()

# 10 — quiet closing, no fabricated QR.
page('09 / 体验指引')
txt(42,118,'从一件你感兴趣的事开始。',32,'serif')
para(42,190,'可以是一场比赛、一场演出，\n也可以是还没尝试过的黑客松。',450,19,32,font='serif')
for yy,n,title,desc in [(330,'01','选一项兴趣','进入偏好，添加一个领域或细分主题。'),(441,'02','看一条活动','回到发现，查看推荐理由、阶段和参与方式。'),(552,'03','留下一次关注','保存感兴趣的活动；需要提醒时，再单独授权。')]:
    line(42,yy-17,553,yy-17);txt(42,yy,n,28,'serif',RED);txt(118,yy,title,21,'serif');para(118,yy+36,desc,429,11,18,MUTED)
txt(42,714,'追踪事件簿',24,'serif');txt(42,753,'当前无公开体验链接；体验入口由开发者另行提供。',9,'sans',MUTED)
end()
c.save()
print(OUT)
