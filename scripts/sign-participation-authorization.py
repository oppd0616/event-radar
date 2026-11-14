from io import BytesIO
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

root = Path('C:/Users/oppd_/Desktop/vedio')
source = root / 'output/pdf/追踪事件簿-参赛授权书-待补充签署.pdf'
target = root / 'output/pdf/追踪事件簿-参赛授权书-已签署.pdf'
signature = 'C:/Users/oppd_/AppData/Local/Temp/codex-clipboard-93a7ff50-38a0-4db8-9e6c-e3b013cc8945.jpg'
buf = BytesIO()
c = canvas.Canvas(buf, pagesize=(612, 792))
# Place the supplied photograph without recreating or altering the handwriting.
c.drawImage(signature, 188, 792 - 275, width=95, height=57, preserveAspectRatio=True)
c.setFont('Helvetica', 12)
c.drawString(132, 792 - 324.5, '2026')
c.drawString(196, 792 - 324.5, '10')
c.drawString(256, 792 - 324.5, '10')
c.save()
r = PdfReader(source)
r.pages[2].merge_page(PdfReader(buf).pages[0])
w = PdfWriter()
for page in r.pages:
    w.add_page(page)
with target.open('wb') as out:
    w.write(out)
check = PdfReader(target)
assert len(check.pages) == 7
assert '2026' in check.pages[2].extract_text()
assert len(check.pages[2].images) > 0
print('Signed PDF created and verified.')
