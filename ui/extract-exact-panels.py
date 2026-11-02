from PIL import Image,ImageFilter,ImageDraw
from pathlib import Path
import json,runpy
import cv2,numpy as np
root=Path(__file__).resolve().parent
runpy.run_path(str(root/'extract-components.py'))
im=Image.open(root/'source/B-silk-ink-clean-v3.png').convert('RGBA')
manifest=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
def clean(name,box,patches):
    out=im.crop(box)
    if name!='nav-sheet.png':
        pixels=np.array(out.convert('RGB'));gray=cv2.cvtColor(pixels,cv2.COLOR_RGB2GRAY);mask=np.zeros(gray.shape,dtype=np.uint8)
        for rect,sample in patches:
            x,y,r,b=rect;x-=box[0];r-=box[0];y-=box[1];b-=box[1]
            mask[y:b,x:r]=np.where(gray[y:b,x:r]<150,255,0)
        mask=cv2.dilate(mask,np.ones((3,3),np.uint8))
        out=Image.fromarray(cv2.inpaint(pixels,mask,5,cv2.INPAINT_TELEA)).convert('RGBA')
    else:
        for rect,sample in patches:
            x,y,r,b=rect;fill=im.crop(sample).resize((r-x,b-y),Image.Resampling.BICUBIC)
            out.paste(fill,(x-box[0],y-box[1]))
    out.save(root/'assets'/name)
    manifest['assets'][name]={'source_box':box,'operation':'complete original panel; deterministic local pixel repair of dynamic glyphs; preserve original texture and ornaments','patches':patches}
    return out
paper=(420,40,525,94)
clean('profile-sheet.png',(0,0,941,211),[
 ((239,48,394,116),paper),((329,120,441,178),paper),
 ((642,48,793,96),paper),((557,101,815,129),paper),((555,134,711,181),paper)])
clean('quest-sheet.png',(0,212,941,313),[
 ((153,237,453,290),(465,239,705,289)),((765,240,845,290),(675,240,754,290))])
clean('button-gold.png',(114,1338,521,1447),[((247,1348,381,1423),(383,1358,434,1416))])
clean('button-ivory.png',(548,1348,832,1442),[((590,1362,785,1418),(575,1361,592,1419))])
practice=clean('practice-sheet.png',(0,1125,941,1472),[
 ((233,1180,536,1234),(544,1178,665,1232)),((675,1180,845,1235),(544,1178,665,1232)),
 ((763,1273,846,1320),(840,1271,889,1320))])
# The original buttons remain at their original coordinates, with label-free
# versions covering only the baked example labels. No new artwork is created.
practice.paste(Image.open(root/'assets/button-gold.png'),(114,1338-1125))
practice.paste(Image.open(root/'assets/button-ivory.png'),(548,1348-1125))
# Remove the example progress fill; the live progress component covers the trough.
practice.paste(Image.open(root/'assets/progress-track.png'),(237,1282-1125))
practice.save(root/'assets/practice-sheet.png')
nav=clean('nav-sheet.png',(0,1472,941,1672),[((17,1478,924,1644),(425,42,521,97))])
for i,name in enumerate(['cultivation','realm','character','adventure','inventory','arts','settings']):
    x=round(17+912*i/7);right=round(17+912*(i+1)/7)
    im.crop((x,1478,right,1644)).save(root/'assets'/('nav-'+name+'-tile.png'))
    manifest['assets']['nav-'+name+'-tile.png']={'source_box':[x,1478,right,1644],'operation':'unaltered icon and caption tile'}
im.crop((0,311,941,1125)).save(root/'assets/cultivation-scene.png')
manifest['assets']['cultivation-scene.png'].update(source_box=[0,311,941,1125],size=[941,814])
generated=root/'assets/generated-assets.json'
if generated.exists(): manifest['assets'].update(json.loads(generated.read_text(encoding='utf-8')))
(root/'assets/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Exact-coordinate panel assets exported')
