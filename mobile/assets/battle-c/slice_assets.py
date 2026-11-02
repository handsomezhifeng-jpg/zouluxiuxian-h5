from PIL import Image
import json
from pathlib import Path
out=Path(r'G:/aikaifa/zouluxiuxian/mobile-port/app/mobile/assets/battle-c')
im=Image.open(r'C:/Users/zhfzhang/.codex/generated_images/01a19bb3-e57c-7a80-9bbb-90a08513e3a1/exec-1231b8ac-1933-41de-8a21-8270bf73a84f.png')
# Explicitly annotated source rectangles and anatomical support shoe locations.
specs={'hero':((28,25,427,497),(195,482),(230,45,332,147)),'ally1':((554,25,960,497),(672,477),(723,45,825,147)),'ally2':((1146,28,1406,497),(1249,475),(1225,48,1331,154)),'enemy1':((20,550,544,972),(342,954),(75,590,181,696)),'enemy2':((510,540,993,976),(946,954),(683,560,789,666)),'enemy3':((1027,625,1535,973),(1257,949),(1045,717,1163,835))}
meta={}
for name,(box,foot,face) in specs.items():
    asset=im.crop(box);asset.save(out/(name+'.png'))
    im.crop(face).resize((128,128),Image.Resampling.LANCZOS).save(out/(name+'-portrait.png'))
    meta[name]={'sourceRect':box,'supportFootSource':foot,'pivot':[(foot[0]-box[0])/asset.width,(foot[1]-box[1])/asset.height],'runPivot':'horizontal midpoint of legs; fixed torso baseline','canvas':asset.size,'animation':'fixed canvas deformable mesh; independent world motion'}
(out/'pivots.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
