from pathlib import Path
import re
from html import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'output' / 'competition'
TEXT = OUTPUT / '追踪事件簿作品介绍.md'
PDF = OUTPUT / '追踪事件簿作品介绍.pdf'
pdfmetrics.registerFont(TTFont('CNSong', 'C:/Windows/Fonts/simsun.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('CNHei', 'C:/Windows/Fonts/simhei.ttf'))
pdfmetrics.registerFontFamily('CNSong', normal='CNSong', bold='CNHei')

styles = {
    'title': ParagraphStyle('title', fontName='CNHei', fontSize=24, leading=32, spaceAfter=16, textColor=colors.black),
    'h1': ParagraphStyle('h1', fontName='CNHei', fontSize=16, leading=23, spaceBefore=0, spaceAfter=14, keepWithNext=True, textColor=colors.black),
    'h2': ParagraphStyle('h2', fontName='CNHei', fontSize=12, leading=18, spaceBefore=10, spaceAfter=7, keepWithNext=True, textColor=colors.black),
    'body': ParagraphStyle('body', fontName='CNSong', fontSize=10.5, leading=18, spaceAfter=9, wordWrap='CJK', textColor=colors.HexColor('#262626')),
    'meta': ParagraphStyle('meta', fontName='CNSong', fontSize=10, leading=17, spaceAfter=8, textColor=colors.HexColor('#555555')),
    'cell': ParagraphStyle('cell', fontName='CNSong', fontSize=10, leading=15, wordWrap='CJK'),
    'cellcenter': ParagraphStyle('cellcenter', fontName='CNSong', fontSize=10, leading=15, wordWrap='CJK', alignment=1),
}

def paragraph(text, style):
    text = escape(text)
    text = re.sub(r'https://[A-Za-z0-9./_\-]+', lambda m: '<link href="'+m[0]+'" color="#454545">'+m[0]+'</link>', text)
    return Paragraph(text, styles[style])

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('CNSong', 9)
    canvas.setFillColor(colors.HexColor('#666666'))
    canvas.drawString(54, 31, '追踪事件簿 作品介绍')
    canvas.drawRightString(A4[0]-54, 31, str(doc.page))
    canvas.restoreState()

lines=TEXT.read_text(encoding='utf-8').splitlines()
story=[]
i=0
while i<len(lines):
    line=lines[i].strip()
    if not line:
        i+=1;continue
    if line=='<!-- PAGEBREAK -->':
        story.append(PageBreak());i+=1;continue
    if line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            cells=[c.strip() for c in lines[i].strip().strip('|').split('|')]
            if not all(re.match(r'^:?-+:?$',c) for c in cells):
                rows.append([paragraph(c,'cell' if index==0 else 'cellcenter') for index,c in enumerate(cells)])
            i+=1
        table=Table(rows, colWidths=[163,162,162], repeatRows=1, hAlign='LEFT')
        table.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#EFEFEF')),
            ('GRID',(0,0),(-1,-1),.5,colors.HexColor('#D9D9D9')),
            ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
            ('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),
            ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
        ]))
        story.extend([table,Spacer(1,13)]);continue
    if line.startswith('# '):style='title';line=line[2:]
    elif line.startswith('## '):style='h1';line=line[3:]
    elif line.startswith('### '):style='h2';line=line[4:]
    else:style='meta' if i<12 else 'body'
    story.append(paragraph(line,style));i+=1

doc=SimpleDocTemplate(str(PDF),pagesize=A4,leftMargin=54,rightMargin=54,topMargin=49,bottomMargin=52,
                     title='追踪事件簿作品介绍',author='宿炜',subject='2026微信小程序开发大赛参赛作品介绍')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(PDF)
