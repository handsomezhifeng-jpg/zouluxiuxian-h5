from PIL import Image,ImageOps
from pathlib import Path
import json
root=Path(__file__).resolve().parent
source=root/'source/B-silk-ink-clean-v3.png'
im=Image.open(source).convert('RGBA')
w,h=im.size
print('source',w,h)
# Coordinates use the approved 941 x 1672 design; scale if a source export changes.
sx,sy=w/941,h/1672
manifest={'source':str(source),'source_size':[w,h],'assets':{}}
def crop(name,box):
    out=im.crop(tuple(round(v*(sx if i%2==0 else sy)) for i,v in enumerate(box)))
    out.save(root/'assets'/name)
    manifest['assets'][name]={'source_box':box,'size':list(out.size),'operation':'crop'}
    return out
crop('cultivation-scene.png',(0,311,941,1129))
crop('avatar.png',(22,8,220,206))
crop('paper.png',(415,48,510,96))
crop('scene-mist.png',(200,312,780,354))
crop('quest-frame.png',(22,226,921,308))
crop('practice-frame.png',(14,1130,925,1476))
crop('navigation-frame.png',(0,1472,941,1672))
crop('quest-scroll.png',(75,235,139,297))
crop('method-scroll.png',(89,1148,190,1258))
# Derive a reusable frame by mirroring the source's unobstructed right corners.
corner=crop('_frame-corner-top.png',(883,20,925,62))
bottom=crop('_frame-corner-bottom.png',(883,156,925,198))
frame=Image.new('RGBA',(126,126))
frame.paste(ImageOps.mirror(corner),(0,0));frame.paste(corner,(84,0))
frame.paste(ImageOps.mirror(bottom),(0,84));frame.paste(bottom,(84,84))
frame.paste(im.crop((round(400*sx),round(20*sy),round(510*sx),round(62*sy))).resize((42,42)),(42,0))
bottom_edge=im.crop((round(400*sx),round(190*sy),round(510*sx),round(198*sy))).resize((42,8))
frame.paste(im.crop((round(415*sx),round(48*sy),round(510*sx),round(96*sy))).resize((42,42)),(42,84));frame.paste(bottom_edge,(42,118))
edge=im.crop((round(883*sx),round(68*sy),round(925*sx),round(144*sy))).resize((42,42))
frame.paste(edge,(84,42));frame.paste(ImageOps.mirror(edge),(0,42))
frame.save(root/'assets/panel-frame.png')
manifest['assets']['panel-frame.png']={'operation':'source corner and edge assembly; transparent center','slice':42}
# Keep original caps and repeat a clean original texture strip where the baked label was.
def blank_button(name,box,cap,strip):
    raw=im.crop(tuple(round(v*(sx if i%2==0 else sy)) for i,v in enumerate(box)))
    raw=raw.resize((box[2]-box[0],box[3]-box[1]))
    out=raw.copy();mid=raw.crop((strip,0,strip+4,raw.height)).resize((raw.width-2*cap,raw.height))
    out.paste(mid,(cap,0));out.save(root/'assets'/name)
    manifest['assets'][name]={'source_box':box,'operation':'preserve end caps; repeat blank source strip to remove label','cap':cap,'strip':strip}
blank_button('button-gold.png',(114,1338,521,1447),110,108)
blank_button('button-ivory.png',(548,1348,832,1442),46,39)
# A clean empty progress trough is reconstructed solely from its source right end.
track=crop('_track-right.png',(561,1282,755,1310)).resize((194,28))
out=Image.new('RGBA',(520,28));out.paste(track.crop((10,0,165,28)).resize((480,28)),(20,0));out.paste(track.crop((174,0,194,28)),(500,0));out.paste(ImageOps.mirror(track.crop((174,0,194,28))),(0,0));out.save(root/'assets/progress-track.png')
manifest['assets']['progress-track.png']={'operation':'source empty trough and mirrored end cap','source_box':[561,1282,755,1310]}
crop('progress-fill.png',(267,1289,480,1303))
centers=[78,213,345,480,612,745,875]
for name,x in zip(['cultivation','realm','character','adventure','inventory','arts','settings'],centers):crop('nav-'+name+'.png',(max(0,x-58),1493,min(941,x+58),1596))
(root/'assets/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
# Inspection sheet, not a product asset.
assets=[p for p in (root/'assets').glob('*.png') if not p.name.startswith('_')]
sheet=Image.new('RGB',(600,((len(assets)+2)//3)*160),'#ddd8ca')
from PIL import ImageDraw
D=ImageDraw.Draw(sheet)
for i,p in enumerate(assets):
    a=Image.open(p);a.thumbnail((190,125));x=(i%3)*200;y=(i//3)*160;sheet.paste(a,(x+(190-a.width)//2,y),a if a.mode=='RGBA' else None);D.text((x+3,y+132),p.name,fill='#272727')
sheet.save(root/'extraction-sheet.png')
