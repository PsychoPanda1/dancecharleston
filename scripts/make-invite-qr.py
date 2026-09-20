"""Generate first-party QR assets. Run with the bundled Python runtime."""
from pathlib import Path
import json
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderSVG

base=Path(__file__).resolve().parents[1]/'go'
config=json.loads((base/'featured.json').read_text())
for relative,url in [('qr.svg','https://dancecharleston.com/go/')]+[(i['id']+'/qr.svg','https://dancecharleston.com/go/'+i['id']+'/') for i in config['invites']]:
    qr=QrCodeWidget(url,barLevel='M',barBorder=4)
    x,y,w,h=qr.getBounds()
    drawing=Drawing(600,600,transform=[600/w,0,0,600/h,0,0]);drawing.add(qr)
    target=base/relative;target.parent.mkdir(parents=True,exist_ok=True)
    renderSVG.drawToFile(drawing,str(target))
    print(target,url)
