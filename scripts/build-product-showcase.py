"""Product-story edition. Original screenshots, vector diagrams, audited metrics."""
from pathlib import Path
from html import escape
import json
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader
from reportlab.lib.pagesizes import A4

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf/追踪事件簿-产品介绍-清爽多领域版.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
for name,file in [('S','msyh.ttc'),('B','msyhbd.ttc')]:
    pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+file))
W,H=A4
C=canvas.Canvas(str(OUT),pagesize=A4)
C.setTitle('追踪事件簿 / 产品介绍');C.setAuthor('宿炜')
BG='#FFFFFF';INK='#171A20';GRAY='#68717D';BLUE='#325CF0';LINE='#E5E8ED';MINT='#CFDCF8';PALE='#F3F5F9';WHITE='#FFFFFF'
N=0
def rect(x,y,w,h,fill,r=0):
    C.setFillColor(HexColor(fill))
    if r:C.roundRect(x,H-y-h,w,h,r,stroke=0,fill=1)
    else:C.rect(x,H-y-h,w,h,stroke=0,fill=1)
def line(x,y,x2,y2,color=LINE,width=.7):
    C.setStrokeColor(HexColor(color));C.setLineWidth(width);C.line(x,H-y,x2,H-y2)
def dot(x,y,r=3,color=BLUE):
    C.setFillColor(HexColor(color));C.circle(x,H-y,r,stroke=0,fill=1)
def text(x,y,s,size=11,font='S',color=INK):
    assert x+pdfmetrics.stringWidth(s,font,size)<W-23,(N,s)
    C.setFillColor(HexColor(color));C.setFont(font,size);C.drawString(x,H-y-size*.88,s)
def p(x,y,s,w=507,size=11,leading=19,color=INK,font='S'):
    q=Paragraph(escape(s).replace('\n','<br/>'),ParagraphStyle('p',fontName=font,fontSize=size,leading=leading,wordWrap='CJK',textColor=HexColor(color)))
    _,h=q.wrap(w,900);assert y+h<796,(N,s[:25],y+h)
    q.drawOn(C,x,H-y-h);return y+h
def shot(name,x,y,w,crop):
    image=ImageReader(str(ROOT/f'output/competition/screenshots/{name}.png'))
    iw,ih=image.getSize();left,top,cw,ch=crop;scale=w/cw;h=ch*scale
    C.saveState();q=C.beginPath();q.roundRect(x,H-y-h,w,h,9);C.clipPath(q,stroke=0)
    C.drawImage(image,x-left*scale,H-y-(ih-top)*scale,iw*scale,ih*scale,mask='auto');C.restoreState()
    return h
def bookmark(x,y,color=BLUE,scale=1):
    C.setFillColor(HexColor(color));q=C.beginPath();q.moveTo(x,H-y);q.lineTo(x+12*scale,H-y);q.lineTo(x+12*scale,H-y-18*scale);q.lineTo(x+6*scale,H-y-14*scale);q.lineTo(x,H-y-18*scale);q.close();C.drawPath(q,fill=1,stroke=0)
def page(section,dark=False):
    global N
    N+=1;rect(0,0,W,H,INK if dark else BG)
    C.bookmarkPage(str(N));C.addOutlineEntry(section,str(N),0)
def end():C.showPage()
def title(k,t,sub=None):
    text(42,94,t,28,'B')
    if sub:p(42,157,sub,500,11,19,GRAY)
def note(s,y=766):p(42,y,s,511,7.5,11,GRAY)
def tickrail(y,labels,dark=False):
    fg=MINT if dark else BLUE;muted='#AAB5CB' if dark else GRAY
    line(42,y,553,y,'#3D485D' if dark else LINE)
    for i,label in enumerate(labels):
        x=42+i*(511/(len(labels)-1));dot(x,y,3,fg)
        text(min(x,491),y+13,label,8,'S',muted)
def link(x,y,label,url):
    text(x,y,label,8,'S',BLUE);C.linkURL(url,(x,H-y-12,x+pdfmetrics.stringWidth(label,'S',8),H-y+2),relative=0)

# Cover: genuine interface fragments, with a shared timeline/bookmark motif.
page('PRODUCT / 2026.10')
text(42,88,'追踪事件簿',49,'B')
p(43,155,'发现近期活动。\n给喜欢的事，留一个位置。',455,21,32,GRAY)
shot('home',42,298,319,(22,671,500,326))
shot('follows',235,527,318,(22,350,500,212))
text(42,717,'游戏赛事 · 现场演出 · 城市快闪 · 成长机会',11,'S',GRAY)
note('2026 微信小程序开发大赛 · 产品介绍',777)
end()

page('01 / 从生活出发')
title('问题与场景','机会很多，注意力只有一份。')
p(42,175,'升学和就业带来成长压力，也不妨碍年轻人继续探索爱好。难的不是再多看一条信息，而是在合适的时间，发现值得自己投入的事。',496,14,24)
text(42,288,'想让自己更进一步',20,'B')
text(322,288,'也想让生活更丰富',20,'B')
p(42,331,'竞赛、黑客松、开发者活动\n寻找实践机会，认识新的方向。',224,11,20,GRAY)
p(322,331,'演出、展览、赛事、快闪\n保持热爱，获得线下体验。',223,11,20,GRAY)
line(293,291,293,382)
rect(42,427,511,173,INK,12)
text(62,448,'一个常见的参与过程',9,'S',MINT)
p(62,481,'“想去看比赛。\n但在哪一站、哪一轮，什么时候能参与？”',458,20,31,WHITE,'B')
text(42,648,'追踪事件簿做的事',12,'B')
p(42,680,'把分散的活动信息组织成可浏览、可判断、可跟进的条目。对用户减少查找成本，也让活动方有机会触达更相关的兴趣人群。',498,12,21)
note('引号内为使用情境示例，不是用户访谈原话。产品不代报名，不保证名额或活动履约。')
end()

page('不同领域的真实内容')
title('','不止一种兴趣。')
p(42,152,'同一个产品里，保留不同活动的参与方式。',493,13,22,GRAY)
text(42,227,'游戏赛事',20,'B')
p(42,266,'跟进赛程，\n查找观赛与票务入口。',200,11,20,GRAY)
shot('home',278,211,275,(22,332,500,324))
text(42,430,'文娱快闪',20,'B')
p(42,469,'了解城市站点，\n判断是否方便到场。',200,11,20,GRAY)
shot('home',278,415,275,(22,671,500,326))
text(42,639,'现场演出',20,'B')
p(42,678,'保存演出，\n之后继续查看参与方式。',200,11,20,GRAY)
shot('follows',278,625,275,(22,350,500,212))
note('以上为真实活动卡片局部，统一拍摄于 2026-10-01；未改写截图中的标题、时间或地点。')
end()

page('兴趣选择')
title('','从喜欢的领域，找到具体方向。')
p(42,153,'从科技、游戏到演出与体育，先表达偏好，再逐步细化自己的兴趣。',494,12,21,GRAY)
shot('onboarding',42,229,299,(27,442,490,445))
text(377,242,'成长与探索',18,'B')
p(377,285,'关注开发者活动、\n竞赛与实践机会。',174,11,21,GRAY)
text(377,413,'体验与热爱',18,'B')
p(377,456,'也为演出、快闪\n和观赛留出空间。',174,11,21,GRAY)
line(42,577,553,577)
text(42,617,'兴趣可以调整',19,'B')
p(42,660,'领域只是起点。细分主题帮助缩小范围，偏好也可以随探索过程改变。\n不需要让所有人看到同一批热门活动。',497,12,23,GRAY)
note('真实首次进入页局部，2026-10-01。此处展示领域选择，不作为科技或竞赛活动的入库截图。')
end()

page('02 / 遇见与你有关的活动')
title('场景第一步 · 发现','先回答：这件事和我有关吗？')
p(42,160,'以关注赛事的用户为例：从兴趣出发，找到近期值得了解的活动。',493,11,19,GRAY)
shot('home',82,218,431,(15,172,516,488))
text(42,650,'01  从主题缩小范围',16,'B')
p(42,687,'领域与细分兴趣影响推荐；理由提示帮助用户理解为什么看到这条活动。',234,11,19,GRAY)
text(317,650,'02  随时主动查找',16,'B')
p(317,687,'已有目标时可搜索名称或关键词；也可切换时间、热度，或修改自己的偏好。',234,11,19,GRAY)
note('真实发现页局部：2026-10-01。该历史截图不含后来加入的搜索入口；搜索能力以文字说明。')
end()

page('03 / 看清一场活动的进程')
title('场景第二步 · 了解','关注整场赛事，也看清每一阶段。')
p(42,160,'同一届赛事保留一个活动主体，阶段各自关联日期、地点和参与方式。',500,11,19,GRAY)
# Vector hierarchy is an explanatory diagram, deliberately unlike a fabricated UI screenshot.
rect(42,225,511,73,INK,10)
text(62,245,'同一届赛事',22,'B',WHITE);text(400,253,'一个活动主体',10,'S',MINT)
line(297,298,297,337,BLUE,1)
line(117,337,477,337,BLUE,1)
for x,label in [(42,'小组赛'),(222,'淘汰赛'),(402,'总决赛')]:
    line(x+75,337,x+75,363,BLUE,1);dot(x+75,337,3)
    rect(x,363,151,122,PALE,10)
    text(x+17,382,label,17,'B')
    p(x+17,420,'阶段日期\n场馆与参与入口',121,10,18,GRAY)
text(42,525,'在详情里核实关键条件',17,'B')
shot('detail',42,566,276,(22,535,502,295))
p(348,568,'活动开始、阶段结束、开票或报名，不是同一个时间。',202,12,21)
p(348,644,'证据不足时保留待核实状态，不用推测日期填满界面。',202,10,18,GRAY)
note('上方为信息结构示意，无实际赛程日期。下方为 2026-10-01 真实详情局部，含历史待核实状态。')
end()

page('04 / 留给之后的自己')
title('场景第三步 · 关注','不用现在决定，也不必重新找。')
shot('follows',42,197,325,(17,155,512,662))
text(396,244,'留在列表里',17,'B')
p(396,283,'保存感兴趣的活动，之后继续查看参与方式与进程。',150,11,20,GRAY)
text(396,482,'结束后也保留',17,'B')
p(396,521,'全部关注：继续跟进。\n收藏（已结束）：\n保留历史记录。',150,11,20,GRAY)
line(42,666,553,666)
text(42,693,'关注 ≠ 报名 ≠ 提醒',19,'B')
p(316,688,'关注只保存活动。报名到官方渠道完成；提醒另行申请微信订阅消息授权。',236,10.5,18,GRAY)
note('真实关注页局部：2026-10-01。故事展示产品使用过程，不表示示例用户已完成实际报名。')
end()

page('使用案例 / 一次观赛计划')
title('','想去看比赛，还要查多少次？')
p(42,153,'情境：一位学生想去现场看 KPL。看到赛事名字之后，还要找到入口、分清开票与比赛时间，并记得回来跟进。',502,12,21,GRAY)
for yy,n,t,d in [(234,'01','看到赛事，还得找购票入口','从兴趣推荐发现 KPL，卡片把参与说明和购票入口放在一起。先判断能否到场，再到票务渠道办理。'),(420,'02','知道比赛日，却不知何时开票','在同一详情中区分比赛、阶段与购票时间。尚未核实的开票信息明确标出，用户继续查看官方通知。'),(606,'03','现在没决定，过几天又找不到','关注后把这场赛事留在自己的列表，再次查看时无需翻聊天记录或重新搜索。需要提醒时再授权。')]:
    text(42,yy-25,n,11,'Helvetica',BLUE)
    text(42,yy,t,16,'B')
    p(42,yy+34,d,260,11,19,GRAY)
shot('home',333,219,220,(22,332,500,324))
shot('detail',333,423,220,(22,597,500,202))
shot('detail',333,623,220,(18,1048,510,76))
text(333,675,'保存活动 / 按需授权提醒',9,'S',GRAY)
line(42,394,553,394)
line(42,578,553,578)
note('使用情境示例，非真实用户访谈。截图为同一赛事的 2026-10-01 历史界面，部分信息当时仍待核实。',770)
end()

page('产品定位 / 与现有渠道的分工')
title('','活动已经发布，为什么仍会错过？')
p(42,157,'通知在公众号，票在售票页，收藏散在聊天和浏览记录里。用户还要自己把“发现—判断—跟进”这几步接起来。',498,12,22,GRAY)
text(42,240,'参与中容易卡住的地方',10,'S',GRAY)
text(323,240,'追踪事件簿提供的帮助',10,'S',BLUE)
line(42,268,553,268)
for yy,t,d,answer in [(292,'知道时，报名已经截止','不熟悉主办方，也不知道该搜什么关键词，可能在截止之后才刷到活动。','按领域和细分兴趣组织近期活动，为尚未明确活动名称的用户提供发现入口。'),(419,'搜到几篇通知，信息对不上','预售日、活动日、不同城市和阶段混在一起，还要反复确认。','围绕同一活动整理阶段、时间与参与入口；待核实信息显式提示，并提供来源线索。'),(546,'先收藏，再也没打开','当时还没决定，后来忘了放在哪个平台，也没继续跟进。','把关注的活动放回同一列表，区分当前与已结束内容；提醒由用户单独授权。')]:
    text(42,yy,t,17,'B');p(42,yy+32,d,241,10.5,18,GRAY)
    p(323,yy+4,answer,229,11,20)
    line(42,yy+104,553,yy+104)
rect(42,687,511,72,PALE,9)
p(59,702,'产品补上的是“找到适合自己的机会，并持续跟进”这一段。\n规则和变更由主办方确认，报名与购票在相应官方渠道完成。',474,10.5,19)
end()

page('05 / 信息如何成为产品',True)
text(42,84,'不是一段生成的介绍，',28,'B',WHITE)
text(42,124,'而是一组有来源的字段。',28,'B',WHITE)
p(42,181,'微信小程序负责体验；云端负责发现、整理、核验、存储与推荐。',500,11,20,'#B5C1D6')
def node(x,y,w,k,t,d):
    rect(x,y,w,105,'#283247',10);text(x+17,y+15,k,8,'Helvetica',MINT);text(x+17,y+34,t,16,'B',WHITE);p(x+17,y+66,d,w-34,9,15,'#C4CDE0')
node(42,261,237,'01 / DISCOVER','搜索与正文','WSA 检索活动线索与详情材料')
node(316,261,237,'02 / EXTRACT','结构化抽取','DeepSeek 整理字段，关联来源证据')
line(279,314,309,314,MINT,1);text(292,300,'›',20,'S',MINT)
line(435,366,435,403,MINT,1)
node(316,411,237,'03 / VERIFY','核验、合并、更新','检查届次、阶段与冲突；整理活动主体')
node(42,411,237,'04 / STORE','CloudBase 数据层','保存活动、用户偏好与关注关系')
line(279,462,316,462,MINT,1);text(290,449,'‹',20,'S',MINT)
line(161,516,161,559,MINT,1)
rect(42,565,511,120,'#E5EBFA',10)
text(61,583,'推荐与前端呈现',19,'B')
p(61,620,'兴趣与排序 → 发现卡片 → 活动详情 → 关注与独立提醒\n列表只传必要字段，详情按需读取。',465,11,20,INK)
p(42,728,'核验不过的信息保留不确定性；来源可追溯并不意味着事实永远准确，仍需随官方更新复核。',507,9,16,'#B5C1D6')
end()

page('06 / 用数据检验')
title('离线对照','相关性提升，能具体到每组兴趣。')
report=json.loads((ROOT/'docs/recommendation-ranking-comparison-20260930.json').read_text(encoding='utf-8-sig'))
before={a['name']:a for a in report['before']['profiles']};after={a['name']:a for a in report['after']['profiles']}
text(42,171,'前 10 条中的主题匹配数',11)
dot(365,178,3,'#A9B3C8');text(375,172,'旧版',8,'S',GRAY)
dot(438,178,3,BLUE);text(448,172,'优化后',8,'S',GRAY)
for v in [0,2,4,6,8,10]:
    x=194+v*32;line(x,227,x,514,LINE,.6);text(x-3,209,str(v),8,'Helvetica',GRAY)
for i,name in enumerate(before):
    yy=255+i*58;b=before[name]['matchedTop10'];a=after[name]['matchedTop10']
    text(42,yy-6,name,11);line(194+b*32,yy,194+a*32,yy,BLUE,2)
    dot(194+b*32,yy,5,'#A9B3C8');dot(194+a*32,yy,4,BLUE)
    text(536,yy-7,str(a),11,'Helvetica',BLUE)
p(42,540,'同一批 110 个活动、5 组构造兴趣画像，2026-09-30 离线对比。不是用户点击率、满意度或线上转化率；匹配数也受可用活动数量限制。',507,9,16,GRAY)
end()

page('07 / 产品创新')
title('创新与外部成果','把发现、判断与后续关注接起来。')
p(42,154,'三个设计选择，让活动信息更贴近个人的参与过程。',500,12,20,GRAY)
for yy,n,t,d in [(224,'01','按兴趣组织跨领域内容','成长机会与生活体验共用一个入口。领域帮助浏览，细分主题进一步缩小范围，偏好可随探索调整。'),(414,'02','一个活动，保留阶段关系','同一届活动集中呈现，各阶段保留自己的时间与参与条件，让用户看清进程。'),(613,'03','关注与提醒分别选择','关注保存感兴趣的活动，订阅提醒另行授权。用户可以按自己的节奏跟进。')]:
    text(42,yy,n,13,'Helvetica',BLUE)
    text(42,yy+28,t,16,'B')
    p(42,yy+62,d,270,11,19,GRAY)
shot('onboarding',376,213,177,(27,442,490,445))
line(42,390,553,390)
rect(345,428,208,44,PALE,7)
text(398,441,'同一届活动',14,'B')
line(449,472,449,494,BLUE)
line(375,494,523,494,BLUE)
for xx,label in [(345,'小组赛'),(420,'淘汰赛'),(495,'总决赛')]:
    line(xx+28,494,xx+28,510,BLUE)
    rect(xx,510,58,42,PALE,5);text(xx+8,524,label,10)
text(345,568,'阶段关系示意',7.5,'S',GRAY)
line(42,591,553,591)
shot('preferences',345,627,208,(22,499,500,168))
note('界面局部来自 2026-10-01 真实截图；中间为信息结构示意。',774)
end()

page('08 / 开始体验')
text(42,86,'追踪事件簿',12,'B',BLUE)
text(42,130,'把注意力，',38,'B')
text(42,185,'留给真正喜欢的事。',34,'B',BLUE)
p(42,249,'一场演出，一次实践，一个想尝试的新方向。\n从发现它，到为它留出时间。',483,13,23,GRAY)
rect(42,329,511,216,PALE,14)
shot('follows',76,343,443,(22,350,500,212))
text(42,560,'真实关注记录局部 · 2026-10-01 历史界面',7.5,'S',GRAY)
for x,t,d in [(42,'发现','选择自己的兴趣'),(222,'了解','看清参与方式'),(402,'关注','留待下一次行动')]:
    text(x,610,t,17,'B');text(x,641,d,10,'S',GRAY)
line(42,684,553,684)
text(42,701,'作品说明',9,'B',GRAY)
credit_end=p(42,722,'宿炜 · 山东大学 · 2026 年 9-10 月。独立完成产品设计、开发集成与测试，使用 AI 辅助开发。未引用其他团队的完整作品。',511,9,14,GRAY)
p(42,credit_end+10,'第三方组件与服务：微信小程序、CloudBase、TDesign、Day.js、opencc-js、iconv-lite、WSA、DeepSeek。平台能力、开源代码及公开活动内容的版权与授权归原权利方。',511,8.5,13,GRAY)
end()
C.save();print(OUT)
