from io import BytesIO
from pathlib import Path
import argparse
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

parser = argparse.ArgumentParser()
parser.add_argument('--identity', default='')
parser.add_argument('--phone', default='')
parser.add_argument('--email', default='')
args = parser.parse_args()
source = Path('C:/Users/oppd_/Desktop/【2026 微信小程序开发大赛】参赛授权书Participation Authorization Letter.pdf')
target = Path('C:/Users/oppd_/Desktop/vedio/output/pdf/追踪事件簿-参赛授权书-待补充签署.pdf')
pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
buf = BytesIO()
c = canvas.Canvas(buf, pagesize=(612, 792))
c.setFont('STSong-Light', 12)
c.drawString(131, 792 - 176, '宿炜')
c.drawString(346, 792 - 323.5, '追踪事件簿')
c.setFont('Helvetica', 10)
c.drawString(197, 792 - 351.4, 'wxa6d531ebd8691279')
c.drawString(200, 792 - 239.8, args.identity)
c.drawString(154, 792 - 267.9, args.phone)
c.drawString(154, 792 - 295.7, args.email)
c.save()
reader = PdfReader(source)
overlay = PdfReader(buf)
reader.pages[0].merge_page(overlay.pages[0])
writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)
target.parent.mkdir(parents=True, exist_ok=True)
with target.open('wb') as out:
    writer.write(out)
check = PdfReader(target)
assert len(check.pages) == len(reader.pages)
assert 'wxa6d531ebd8691279' in check.pages[0].extract_text()
for value in [args.identity, args.phone, args.email]:
    assert value in check.pages[0].extract_text()
print(target)
