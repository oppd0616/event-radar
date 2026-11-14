from pathlib import Path
from html import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.pagesizes import A4

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/competition/追踪事件簿参赛介绍-时代背景增强版.pdf'
pdfmetrics.registerFont(TTFont('UI','C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('Bold','C:/Windows/Fonts/msyhbd.ttc',subfontIndex=0))
W,H=A4
INK=colors.HexColor('#153F3B'); ACC=colors.HexColor('#C6533D'); MUTED=colors.HexColor('#64746F')
PALE=colors.HexColor('#FAE7DF'); BG=colors.HexColor('#FAF7F0'); LINE=colors.HexColor('#DDDCD2'); GREEN=colors.HexColor('#34725F')
DARK=colors.HexColor('#113C38'); CORAL=colors.HexColor('#FF9B7D'); CREAM=colors.HexColor('#FFF4DC')
c=canvas.Canvas(str(OUT),pagesize=A4)
c.setTitle('追踪事件簿产品介绍册'); c.setAuthor('宿炜'); c.setSubject('2026微信小程序开发大赛参赛作品介绍')
page_no=0

def txt(x,y,text,size=10,bold=False,color=None):
    color=INK if color is None else color
    c.setFillColor(color);c.setFont('Bold' if bold else 'UI',size);c.drawString(x,y,text)

def para(x,y,text,width=487,size=10.5,leading=17,color=None):
    color=INK if color is None else color
    p=Paragraph(escape(text),ParagraphStyle('p',fontName='UI',fontSize=size,leading=leading,wordWrap='CJK',textColor=color))
    _,height=p.wrap(width,1000)
    if y-height<52: raise ValueError(f'Page {page_no}: paragraph below footer: {text[:30]}')
    p.drawOn(c,x,y-height)
    return y-height-11

def section(x,y,title,body,width=487):
    txt(x,y,title,12,True)
    return para(x,y-14,body,width)

def line(x1,y1,x2,y2,color=LINE,width=.7):
    c.setStrokeColor(color);c.setLineWidth(width);c.line(x1,y1,x2,y2)

def rect(x,y,w,h,fill=colors.white,r=12,stroke=LINE):
    c.setFillColor(fill);c.setStrokeColor(stroke);c.setLineWidth(.65);c.roundRect(x,y,w,h,r,fill=1,stroke=1)

def arrow(x1,y1,x2,y2):
    line(x1,y1,x2,y2,ACC,1)
    import math
    ang=math.atan2(y2-y1,x2-x1)
    for d in [-.5,.5]:line(x2,y2,x2-6*math.cos(ang+d),y2-6*math.sin(ang+d),ACC,1)

def page(kicker,title,subtitle=''):
    global page_no
    page_no+=1
    c.setFillColor(BG);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(DARK);c.rect(0,H-179,W,179,fill=1,stroke=0)
    c.setFillColor(CORAL);c.rect(46,H-66,24,3,fill=1,stroke=0)
    txt(46,H-41,'追踪事件簿  /  PRODUCT BOOK',8,True,CREAM)
    txt(407,H-41,'2026微信小程序开发大赛',8,color=CREAM)
    txt(46,H-89,kicker,9,color=CORAL)
    txt(46,H-123,title,24,True,CREAM)
    if subtitle:para(46,H-141,subtitle,503,10,16,CREAM)
    line(46,46,549,46,LINE)
    txt(46,29,'宿炜  /  山东大学  /  个人作品',8,color=MUTED)
    txt(W-64,29,f'{page_no:02d}',9,True,ACC)

def end():c.showPage()

def tag(x,y,label,w=None):
    w=w or pdfmetrics.stringWidth(label,'UI',8)+16
    rect(x,y,w,20,PALE,5,PALE);txt(x+8,y+6,label,8,color=ACC)

def phone(x,y,w=205,h=390,kind='home'):
    global ACC,PALE,BG,INK,MUTED,LINE
    palette=(ACC,PALE,BG,INK,MUTED,LINE)
    ACC=colors.HexColor('#727D9B');PALE=colors.HexColor('#EEF0F6');BG=colors.HexColor('#FAFAF7')
    INK=colors.HexColor('#252822');MUTED=colors.HexColor('#737970');LINE=colors.HexColor('#E2E5DE')
    rect(x,y,w,h,colors.white,24,LINE)
    rect(x+6,y+6,w-12,h-12,BG,20,BG)
    txt(x+15,y+h-20,'9:41',7,True)
    rect(x+w-46,y+h-21,29,10,colors.white,5,LINE)
    txt(x+w-40,y+h-18,'••  ○',6,color=MUTED)
    ix=x+16; iw=w-32; top=y+h-49
    if kind=='home':
        txt(ix,top,'近期值得关注',13,True)
        txt(ix,top-18,'推荐  科技  演出  游戏',8,color=MUTED)
        line(ix,top-25,ix+21,top-25,INK,1.5)
        for n,(title,domain,note) in enumerate([('AI共创工作坊','科技','因为你关注“AI / 大模型”'),('城市艺术展','文娱','根据你的兴趣推荐')]):
            cy=top-145-n*112
            rect(ix,cy,iw,105,colors.white,10)
            tag(ix+10,cy+76,domain)
            txt(ix+10,cy+58,title,10,True)
            txt(ix+10,cy+42,note,7,color=ACC)
            txt(ix+10,cy+25,'示例日期 · 查看参与方式',7,color=MUTED)
            txt(ix+10,cy+10,'来源页面',7,color=MUTED)
            txt(ix+iw-31,cy+10,'关注',7,color=ACC)
    elif kind=='prefs':
        txt(ix,top,'我的兴趣',13,True);txt(ix+iw-22,top,'编辑',7,color=ACC)
        txt(ix,top-18,'决定发现页更先出现什么',7,color=MUTED)
        rect(ix,top-80,iw,48);tag(ix+10,top-63,'科技');tag(ix+58,top-63,'游戏');tag(ix+105,top-63,'文娱')
        txt(ix,top-105,'细分兴趣',9,True)
        rect(ix,top-156,iw,38);tag(ix+9,top-146,'AI / 大模型');txt(ix+98,top-138,'＋ 添加',7,color=ACC)
        txt(ix,top-181,'提醒',9,True)
        rect(ix,top-257,iw,59)
        txt(ix+10,top-218,'开启新活动提醒',8);txt(ix+iw-14,top-218,'›',10,color=MUTED)
        line(ix+10,top-230,ix+iw-10,top-230)
        txt(ix+10,top-246,'提醒记录',8);txt(ix+iw-14,top-246,'›',10,color=MUTED)
        txt(ix,top-278,'关注不会自动开启消息提醒',7,color=MUTED)
    elif kind=='follows':
        txt(ix,top,'我的关注',13,True);txt(ix,top-18,'本周有 2 场你关注的活动',7,color=MUTED)
        txt(ix,top-42,'全部关注',8,True);txt(ix+76,top-42,'收藏（已结束）',8,color=MUTED)
        line(ix,top-49,ix+29,top-49,INK,1.5)
        txt(ix,top-70,'本周',8,color=MUTED)
        for n,title in enumerate(['AI共创工作坊','城市艺术展']):
            cy=top-169-n*90
            rect(ix,cy,iw,83,colors.white,9)
            if n==0:
                txt(ix+10,cy+61,'示例日期',6,color=MUTED);txt(ix+11,cy+36,'03',18,True)
            line(ix+43,cy+12,ix+43,cy+71)
            txt(ix+53,cy+58,title,9,True)
            txt(ix+53,cy+41,'明天开始' if n==0 else '地点待公布',7,color=GREEN if n==0 else MUTED)
            txt(ix+53,cy+24,'详情与参与方式',7,color=MUTED)
            txt(ix+iw-19,cy+11,'···',9,color=MUTED)
    else:
        tag(ix,top-10,'游戏');txt(ix,top-37,'示例赛事',15,True)
        txt(ix,top-55,'阶段信息统一放入详情',7,color=MUTED)
        rect(ix,top-131,iw,57)
        txt(ix+10,top-96,'活动日期',8,color=MUTED);txt(ix+79,top-96,'以公告为准',8)
        txt(ix+10,top-117,'举办地点',8,color=MUTED);txt(ix+79,top-117,'查看阶段场馆',8)
        txt(ix,top-155,'活动进程',10,True)
        for n,label in enumerate(['小组赛','淘汰赛','总决赛']):
            yy=top-179-n*33
            if n<2:line(ix+5,yy-3,ix+5,yy-30)
            c.setFillColor(ACC);c.circle(ix+5,yy,3,fill=1,stroke=0)
            txt(ix+17,yy-3,label,8);txt(ix+17,yy-16,'时间与来源分别核验',6,color=MUTED)
        txt(ix,top-289,'直播归入参与方式',7,color=MUTED)
    if kind!='detail':
        rect(ix,y+16,iw,29,colors.white,12)
        for dx,label in [(12,'发现'),(69,'关注'),(125,'偏好')]:txt(ix+dx,y+27,label,8,color=ACC if (kind=='home' and label=='发现') or (kind=='follows' and label=='关注') or (kind=='prefs' and label=='偏好') else MUTED)
    else:
        rect(ix,y+16,iw,32,colors.white,12)
        txt(ix+8,y+29,'关注   链接',7,color=MUTED);rect(ix+87,y+20,iw-92,24,INK,12,INK);txt(ix+101,y+28,'开启提醒',8,color=colors.white)
    ACC,PALE,BG,INK,MUTED,LINE=palette

page_no=1
c.setFillColor(DARK);c.rect(0,0,W,H,fill=1,stroke=0)
txt(46,799,'2026微信小程序开发大赛  /  与AI共生',9,color=CREAM)
txt(46,756,'追踪事件簿',35,True,CREAM)
txt(46,699,'让兴趣',42,True,CREAM)
txt(46,645,'有下一步。',42,True,CORAL)
para(48,611,'连接成长机会与兴趣体验，让有限的注意力有所归属。',485,13,21,CREAM)
# Original vector motif: scattered signals converge into one track.
for i in range(8):
    yy=555-i*16;line(48,yy,242,yy,CORAL if i in (1,4) else colors.HexColor('#35605A'),.6)
    c.setFillColor(CORAL if i in (1,4) else CREAM);c.circle(66+i*22,yy,2.5,fill=1,stroke=0)
phone(316,137,230,408,'home')
for y,title,body in [(398,'看见机会','九个领域连接公开活动信息。'),(302,'留住兴趣','推荐与关注围绕用户偏好。'),(206,'跟进变化','阶段、参与入口与提醒分开组织。')]:
    txt(48,y,title,17,True,CREAM);para(48,y-19,body,237,10,17,CREAM)
line(48,117,546,117,colors.HexColor('#35605A'))
txt(48,92,'宿炜  /  山东大学  /  个人作品',10,True,CREAM)
txt(48,70,'2026年9月至10月开发与完善',9,color=CREAM)
txt(48,47,'界面为原创结构示意，不是真机截图；示例活动不代表入库记录。',7.5,color=CREAM)
txt(48,29,'信息导航工具，不代替主办方报名、购票或预约。',7.5,color=CREAM)
txt(535,29,'01',9,True,CORAL)
end()

page('01 时代背景','成长之外，也要生活','升学与就业的现实需求，和探索兴趣、表达自我的愿望，可以同时被看见。')
rect(46,502,241,145,colors.white,12);rect(308,502,241,145,colors.white,12)
tag(62,608,'自我提升');tag(324,608,'兴趣体验')
txt(62,582,'寻找成长的机会',16,True);txt(324,582,'发现喜欢的生活',16,True)
para(62,561,'面对升学与就业选择，青年需要看见竞赛、黑客松与开发者活动等实践机会，了解如何参与。',208,10.5,17)
para(324,561,'展览、演出、体育与兴趣活动，为探索爱好、文化体验和自我表达提供不同入口。',208,10.5,17)
txt(46,461,'信息更多，不意味着机会更容易抵达',16,True)
para(46,443,'信息流不断扩张，用户的时间与注意力却有限。青年不仅需要知道“有什么”，还需要判断“适不适合我、是否来得及、如何参与”。活动方也需要让公开信息抵达潜在参与者，而不是止步于一条容易被淹没的消息。',503,11,18)
rect(46,253,503,88,DARK,12,DARK)
txt(65,311,'不是争夺更多注意力，',18,True,CREAM)
txt(65,282,'而是让注意力遇见值得投入的机会。',18,True,CORAL)
para(46,226,'产品立场：以用户明确兴趣为起点，把信息整理成可判断、可关注的活动。成长不等于不断加码，兴趣不等于无关消遣；推荐不以制造焦虑或延长停留为目的。',503,10,17)
para(46,153,'背景资料支持就业服务与青年体验需求的讨论；“有限注意力与机会匹配”是本作品的设计判断，不是已验证的社会效果。',503,8.5,14,MUTED)
for yy,label,url in [(103,'[1] 教育部：推进2026届高校毕业生就业工作（2026-06-15）','https://www.moe.gov.cn/jyb_xwfb/s5147/202606/t20260615_1440719.html'),(83,'[2] 更好满足青年群体消费需求（人民日报；浙江省经济信息中心转载，2025-05-22）','https://zjic.zj.gov.cn/ywdh/shjs/202505/t20250522_23462425.shtml')]:
    txt(46,yy,label,7.8,color=MUTED);c.linkURL(url,(46,yy-3,549,yy+10),relative=0,thickness=0)
end()

page('02 需求与价值','用户缺少的是连接','把分散的消息连接到明确的活动，让合适的机会被合适的人看见。')
for i,(title,body) in enumerate([('信息分散','不知道活动名称，就不知道从哪里开始搜索。'),('描述重复','全称、简称、阶段名和直播可能被当成多场活动。'),('节点混淆','公告、报名、开票与比赛日期容易混在一起。')]):
    x=46+i*174;txt(x,627,f'0{i+1}',23,True,ACC);txt(x,598,title,12,True);para(x,578,body,151,10,17)
txt(46,483,'从发现到参与',15,True)
for i,(title,desc) in enumerate([('选择兴趣','领域与细分主题'),('浏览推荐','时间与推荐理由'),('查看详情','阶段与官方入口'),('持续关注','回看或授权提醒')]):
    x=46+i*130;rect(x,393,111,61,colors.white,10);txt(x+12,428,title,11,True);txt(x+12,408,desc,8,color=MUTED)
    if i<3:arrow(x+115,424,x+127,424)
rect(46,178,241,188,colors.white,12);rect(308,178,241,188,colors.white,12)
txt(62,340,'对用户',15,True);txt(324,340,'对活动方',15,True)
para(62,320,'降低搜索与筛选成本，发现成长机会与兴趣体验。了解阶段、日期、条件与参与入口，判断是否适合、能否参加。',209,10,17)
para(62,229,'已实现：兴趣推荐、活动详情、持续关注与独立提醒授权。',209,9,15,MUTED)
para(324,320,'让公开活动信息有机会进入相关兴趣用户的视野。价值在于潜在相关性，而非无差别曝光或承诺报名数量。',209,10,17)
para(324,229,'当前为间接价值：未提供主办方发布后台、推广投放或曝光分析服务。',209,9,15,MUTED)
para(46,145,'价值验证方向：相关活动发现、关注与参与入口操作、用户筛选成本。后续用真实反馈检验，不将停留时长、浏览量或离线排序结果直接等同于成长收获与活动转化。',503,9.5,16)
end()

page('03 使用案例','一次寻找黑客松的旅程','以项目记录中的OAIC活动为例，说明从兴趣到判断的完整链路。')
rect(46,548,503,101,colors.white,14)
tag(63,612,'记录案例 · 非用户访谈')
txt(63,588,'2026 OAIC 智能体软件工厂',15,True)
txt(63,566,'国际黑客松和大奖赛系列',15,True)
steps=[('选好兴趣','选择“科技”，添加“AI / 大模型”与黑客松相关兴趣。','让搜索与推荐围绕目标，不靠泛热门填充。'),('发现活动','在推荐流中了解OAIC活动，再进入详情判断是否适合。','推荐只是候选机会，不等于系统替用户决定参加。'),('核实参与条件','查看研习营、初赛、大奖赛与颁奖等阶段，核对报名状态。','记录中报名已截止；活动进行中不等于仍可报名。'),('保留后续关注','用户可以关注并返回查看进展；提醒须单独授权。','关注不自动报名，也不自动开启微信消息。')]
for i,(title,body,value) in enumerate(steps):
    yy=508-i*96
    c.setFillColor(ACC);c.circle(61,yy-3,13,fill=1,stroke=0);txt(56,yy-7,str(i+1),11,True,colors.white)
    if i<3:line(61,yy-18,61,yy-78,LINE,1)
    txt(85,yy,title,12,True);para(85,yy-15,body,454,10,16);para(85,yy-53,value,454,9,15,MUTED)
para(46,108,'资料依据：项目2026年9月30日活动快照中的标题、阶段与参与指南。本页是使用场景演示，不代表真实用户操作、报名结果或对当前公告的再次核验。',503,8.5,14,MUTED)
end()

page('04 功能与界面','发现页与偏好页','以用户明确选择的兴趣为起点，不用无关热门内容强行填充推荐。')
phone(61,252,211,390,'home');phone(322,252,211,390,'prefs')
txt(61,227,'发现',13,True);txt(322,227,'偏好',13,True)
para(61,210,'查看推荐、筛选领域和翻页。说明推荐理由，减少推荐操作支持撤销。',211,10,17)
para(322,210,'领域设置推荐强度，细分主题单独编辑；可关闭个性化并清除学习记录。',211,10,17)
para(46,114,'交互原则：保留用户明确偏好，区分浏览与强意愿信号。首页固定一次浏览的活动顺序后分页，减少已浏览内容重复出现。',503,10,17)
para(46,68,'界面示意 · 根据当前WXML结构绘制 · 活动内容为示例',503,8,13,MUTED)
end()

page('05 功能与界面','关注页与活动详情','关注收藏事件，提醒单独授权；多阶段活动保留在一个详情中。')
phone(61,252,211,390,'follows');phone(322,252,211,390,'detail')
txt(61,227,'我的关注',13,True);txt(322,227,'阶段与参与方式',13,True)
para(61,210,'只保留全部关注与已结束收藏。同日共用日期，关键状态只突出一项；更新可提示，取消需确认。',211,10,17)
para(322,210,'活动起止、报名、开票与阶段分别核验。直播归入参与渠道，不另建重复实体活动。',211,10,17)
para(46,114,'只有日期就展示日期，未知地点明确提示。点击参与链接后由用户在官方渠道核实；开启提醒不代表报名成功，也不自动获得无限次消息。',503,10,17)
para(46,68,'界面示意 · 不是真机截图 · 日期与赛事名称仅用于说明交互',503,8,13,MUTED)
end()

page('06 产品变化','从消息堆叠，到一个事件','两组对比直接说明产品价值；左侧问题示意，右侧机制示意。')
txt(46,635,'分散信息的典型问题',12,True,MUTED);txt(313,635,'追踪事件簿的组织方式',12,True)
for i,label in enumerate(['冠军赛 · 小组赛消息','冠军赛 · 淘汰赛消息','冠军赛 · 总决赛消息','冠军赛 · 线上直播消息']):
    yy=577-i*46;rect(46,yy,223,35,colors.white,8);txt(58,yy+13,label,10,color=MUTED)
rect(313,439,236,173,colors.white,12)
txt(329,583,'一个赛事主活动',15,True)
for i,label in enumerate(['小组赛','淘汰赛','总决赛']):
    yy=555-i*31;c.setFillColor(ACC);c.circle(333,yy,3,fill=1,stroke=0)
    if i<2:line(333,yy-5,333,yy-26)
    txt(344,yy-3,label,10)
txt(329,458,'直播：归入参与渠道',9,color=MUTED)
arrow(278,520,302,520)
para(46,412,'收益：不用在多张卡片之间拼赛程。不同城市分站或独立场次仍保留差异，不因名称相似而全部合并。',503,10,17)
txt(46,332,'泛热门穿插',12,True,MUTED);txt(313,332,'围绕明确兴趣排序',12,True)
for x,labels in [(46,['AI活动','其他领域热门','无关演出','另一个AI活动']),(313,['AI工作坊','开发者会议','黑客松','模型技术交流'])]:
    for i,label in enumerate(labels):
        yy=277-i*34;rect(x,yy,236 if x==313 else 223,27,colors.white,6);txt(x+12,yy+9,label,9,color=INK if x==313 else MUTED)
arrow(278,239,302,239)
para(46,136,'收益：更快找到与自己相关的机会。此处为机制对比，并非真实首页截图；实际排序改进的离线数据与限制见附录A。',503,9,15,MUTED)
end()

page('07 技术方案','发现与核验分层','未经详情核验的搜索线索，只进入候选队列，不直接发布为活动。')
nodes=[(46,592,151,59,'身份发现','Exa / Tavily等检索'),(222,592,151,59,'候选队列','名称、来源与调度状态'),(398,592,151,59,'详情检索','WSA与类型化查询'),(398,492,151,59,'结构化抽取','DeepSeek整理字段'),(222,492,151,59,'证据与身份校验','日期、受众、阶段、冲突'),(46,492,151,59,'正式活动','推荐、详情与关注')]
for x,y,w,h,title,sub in nodes:rect(x,y,w,h,colors.white,11);txt(x+12,y+35,title,11,True);txt(x+12,y+16,sub,8,color=MUTED)
arrow(198,620,217,620);arrow(374,620,394,620);arrow(474,587,474,556);arrow(394,520,378,520);arrow(218,520,201,520)
para(46,464,'TokenHub联网模型可按配置补充引用。通道是否调用取决于命中与限额，模型回答成功不等于事实可以发布。',503,9.5,16,MUTED)
y=section(46,399,'前端','微信小程序原生JavaScript、WXML与WXSS，结合TDesign组件和图标；Day.js处理日期，页面涵盖发现、关注、偏好、详情与兴趣编辑。')
y=section(46,y-9,'云端','Node.js云函数与CloudBase数据库承接业务。fetchEvents负责发现和详情处理，getEvents负责展示与推荐，recordSignal记录反馈，manageFollows管理关注。')
y=section(46,y-9,'调度与状态','开放搜索可以发现新名称并登记追踪目标。重复发现保留候选进度和缓存，不重置重试状态；周期事件采用周期化调度。')
section(46,y-9,'身份与权限','以云端微信身份隔离个人记录，普通客户端不能直接调用后台采集和发送函数；搜索不传递用户微信身份字段。')
end()

page('08 创新机制','让事件保持完整','创新集中在信息组织与工程机制的组合，不将第三方模型宣称为个人研发。')
rect(46,450,503,202,colors.white,14)
txt(67,625,'一个主活动',15,True)
txt(67,602,'稳定身份关联标题别名，明确分站与独立场次保留差异。',10,color=MUTED)
for i,label in enumerate(['报名／开票','小组赛','淘汰赛','总决赛']):
    x=70+i*120;c.setFillColor(ACC);c.circle(x,551,4,fill=1,stroke=0)
    if i<3:arrow(x+9,551,x+109,551)
    txt(x-3,526,label,10,True)
txt(67,485,'直播与参与链接归入详情  ·  阶段时间分别关联来源证据',9,color=MUTED)
y=section(46,415,'稳定身份而非标题去重','名称主体、届次、城市与活动类型等形成身份候选；canonicalEventId保留稳定引用。事务写入和别名映射降低并发重复及历史链接失效风险。')
y=section(46,y-9,'证据约束而非模型自证','活动时间与阶段必须和目标证据关联，区分公告、报名和活动日期。冲突字段保留待核实状态，归并身份不能替代事实核验。')
y=section(46,y-9,'动态追踪而非永远固定名单','固定种子提供起点；开放搜索发现的新活动自动登记追踪。联名快闪或新黑客松可进入后续处理，但不能保证所有热门活动都被覆盖。')
section(46,y-9,'面向参与的展示','不同活动保留自己的参与差异。线下活动不强求小时分钟；直播、限时报名或抢票等敏感节点，在证据确认时提供精确时刻。')
end()

page('附录 A · 推荐验证','兴趣匹配的可测改进','110条真实可展示活动，5个合成画像；比较同一批供给的前10条精确兴趣匹配数。')
txt(419,651,'旧版',8,color=MUTED);txt(481,651,'新版',8,color=ACC)
for i,(label,old,new) in enumerate([('AI与大模型',7,10),('演唱会',3,10),('艺术展览',5,10),('黑客松',4,6),('无畏契约',2,2)]):
    y=606-i*47;txt(46,y+5,label,10,True)
    c.setFillColor(colors.HexColor('#D5D8D1'));c.roundRect(155,y+9,old*32,9,4,fill=1,stroke=0)
    c.setFillColor(ACC);c.roundRect(155,y-7,new*32,9,4,fill=1,stroke=0)
    txt(162+old*32,y+9,str(old),8,color=MUTED);txt(162+new*32,y-7,str(new),8,color=ACC)
para(46,349,'离线排序回放，不是线上点击率A/B测试，也不证明活动详情准确。黑客松供给为6条，无畏契约为2条；排序无法补足尚未发现的活动。',503,9.5,16,MUTED)
y=section(46,281,'明确兴趣决定方向','主动领域、细分主题及形式等偏好参与排序；没有固定领域配额强行穿插无关内容。推荐采用规则评分与行为学习，不声称复现抖音或小红书算法。')
y=section(46,y-9,'浏览和关注不是同一种信号','浏览、停留主要影响短期兴趣；关注、提醒和参与入口操作提供较强信号。页面记录实际可见曝光，详情停留不计后台时间。')
section(46,y-9,'反馈可以撤销','区分隐藏单个活动、少推荐主题和地点不合适。关闭个性化后停止相关学习，清除学习数据保留主动兴趣与关注。')
end()

page('附录 B · 开发与验收','个人开发与验证边界','宿炜 · 山东大学 · 2026年9月至10月开发与完善')
for x,n,title,sub in [(46,'35','离线回归通过','对应测试条件下的逻辑验证'),(224,'15','前端语法检查','JavaScript文件检查'),(402,'106','公开活动卡读取','一次迁移后连续4页无重复')]:
    txt(x,615,n,35,True,ACC);txt(x,583,title,11,True);para(x,563,sub,148,8.5,14,MUTED)
y=section(46,488,'本人负责的工作','产品方向、需求取舍、交互方案与功能验收由本人负责。在AI辅助下推进前端、云函数、数据处理、推荐规则和测试脚本实现；结合实际问题持续迭代。')
y=section(46,y-9,'验证覆盖','测试涉及发现、抽取、阶段、去重、编码、推荐与隐私等。异常路径包括重复点击授权、拒绝后恢复、保存失败、翻页失败保留已有记录，以及原游标重试。')
y=section(46,y-9,'数据迁移证据','9月29日的一次身份迁移将188条记录整理为182个主活动，6条原件保留为别名；连续4页106张公开卡片主ID无重复。该次结果不保证未知别名或后续新增数据永远无重复。')
y=section(46,y-9,'已实现与待验收','主要业务模块及云端部署已有记录；最新前端需要重新编译上传。真实授权、微信消息接收、弱网与不同手机排版仍需体验版真机验收，不把离线通过写成端到端通过。')
section(46,y-9,'正式上线与后续评估','当前不报告未经统计的日活、月活、留存或满意度。规程要求作品在10月17日前正式上线；体验版不能替代。上线后用真实反馈与参与入口操作继续评估；微信AI生态接入属于后续评估方向。')
end()

page('附录 C · 引用与原创边界','第三方成果说明','基础能力与个人业务方案分开披露，保留来源与许可说明。')
y=section(46,645,'开源组件','TDesign提供组件和图标，Day.js处理日期，iconv-lite处理编码转换，均采用MIT许可。opencc-js用于繁简转换，程序为MIT许可；内含opencc-data词典涉及Apache-2.0许可。项目保留相应第三方声明。')
for label,url in [('TDesign','https://github.com/Tencent/tdesign-miniprogram'),('Day.js','https://github.com/iamkun/dayjs'),('iconv-lite','https://github.com/pillarjs/iconv-lite'),('OpenCC JS','https://github.com/nk2028/opencc-js')]:
    txt(46,y,label,8.5,True,MUTED);txt(120,y,url,8,color=MUTED);c.linkURL(url,(120,y-2,535,y+10),relative=0,thickness=0);y-=18
y=section(46,y-16,'平台 搜索与模型','微信小程序能力、wx-server-sdk和CloudBase提供身份、云函数、数据库、调度及消息接口。Exa、Tavily、腾讯云WSA提供检索，DeepSeek负责识别与结构化抽取，TokenHub及代码中其他适配器按配置补充。不宣称自研搜索引擎、模型或训练数据。')
y=section(46,y-9,'AI辅助开发','使用OpenAI Codex及其他AI工具辅助方案讨论、代码生成、调试和测试编写。本人提出需求、判断功能方向并确认迭代结果。AI输出需检查、测试与核实；开发对话、工程文件、脚本和部署记录可用于过程溯源。')
y=section(46,y-9,'个人贡献与公开信息','个人贡献集中在事件模型、候选与正式数据分离、证据与冲突处理、身份与阶段组织、推荐反馈及关注体验的设计和集成实现。活动事实来自公开来源，不归个人所有；公开可访问不等于任意复制，需遵循来源条款和知识产权要求。')
para(46,y-8,'除上述组件、服务、公开信息与AI辅助外，未另行引用他人整套项目源码或其他外部开发成果。本册界面与机制图由当前项目内容绘制，活动示例不作为真实入库数据；未引用外部海报或他人界面截图。',503,9.5,16,MUTED)
end()

page('附录 D · 设计参考','从价值开始讲产品','借鉴公开产品资料的表达结构，不移植其他产品的功能、文案或视觉资产。')
for x,n,title,sub in [(46,'01','价值先行','先说明用户为何需要'),(224,'02','界面作证','用交互解释功能'),(402,'03','边界清楚','事实与规划分别表述')]:
    txt(x,616,n,34,True,ACC);txt(x,582,title,12,True);para(x,562,sub,148,9,15,MUTED)
y=section(46,487,'Meetup / 媒体介绍','公开资料以产品使命、真实场景、规模数据和常见问题组织介绍。本册借鉴“需求与场景先于技术”的阅读顺序，不采用其规模数据或品牌素材。')
y=section(46,y-9,'Notion / Media Kit','官方产品素材包区分产品截图、插画、标志和照片。本册将功能图与机制图区分，界面示意明确标注；未使用Notion截图、插画或标志。')
y=section(46,y-9,'Eventbrite / 产品与媒体介绍','活动平台公开介绍强调覆盖的活动场景与平台价值。本册据此突出“发现、关注、跟进”的产品链路，不将自身描述为票务或主办平台。')
refs=[('Meetup Media','https://www.meetup.com/media/'),('Notion Media Kit','https://notion.notion.site/Media-Kit-205535b1d9c4440497a3d7a2ac096286'),('Eventbrite Press','https://www.eventbrite.com/blog/press/')]
for label,url in refs:
    txt(46,y-7,label,9,True);y=para(46,y-20,url,503,8,13,MUTED);c.linkURL(url,(46,y+10,549,y+36),relative=0,thickness=0);y-=10
para(46,y-5,'设计说明：深墨绿承载章节与封面，珊瑚橙标注重点，暖白保证长文阅读；界面仍保留小程序原有配色。图表只呈现已记录的测试结果，未填入虚构的用户规模或增长指标。参考访问日期：2026年10月1日。',503,9,15,MUTED)
end()
c.save()
print(OUT)
