from pathlib import Path
import numpy as np,json
from PIL import Image
from scipy import ndimage as ndi
root=Path(__file__).parent/'assets/v3'
manifest={'version':14,'variants':{},'qa':[]}
def gap_center(counts,lo,hi):
 lo,hi=max(0,int(lo)),min(len(counts),int(hi));empty=counts[lo:hi]<=3;labels,n=ndi.label(empty)
 if not n:return (lo+hi)//2
 sizes=np.bincount(labels);sizes[0]=0;idx=np.where(labels==sizes.argmax())[0];return lo+int((idx[0]+idx[-1])/2)
annotations=json.loads((root/'pivot-annotations.json').read_text(encoding='utf-8'))
for variant in 'abcdefghijklm':
 clips={};variant_frames=[]
 for action in (['attack'] if variant in ['d','e','f','g','h','i','j','k','l','m'] else ['state','run','attack','cast'] if variant=='c' else ['state','run','attack','cast','idle']):
  im=Image.open(root/'raw'/f'{variant}-{action}.png').convert('RGBA');arr=np.array(im);h,w=arr.shape[:2];frames=[]
  rows=4 if action=='idle' or variant in ['d','e','f','g','h','i','j','k','l','m'] else 2
  rowcounts=(arr[:,:,3]>20).sum(1);rowcuts=[0]+[gap_center(rowcounts,h*k/rows-h*.08,h*k/rows+h*.08) for k in range(1,rows)]+[h]
  colcuts=[]
  for row in range(rows):
   counts=(arr[rowcuts[row]:rowcuts[row+1],:,3]>20).sum(0);colcuts.append([0]+[gap_center(counts,w*k/4-w*.085,w*k/4+w*.085) for k in range(1,4)]+[w])
  for i in range(rows*4):
   row,col=divmod(i,4);x0,x1=colcuts[row][col:col+2];y0,y1=rowcuts[row:row+2]
   if variant in ['i','k','l','m']:
    counts=(arr[:,round(col*w/4):round((col+1)*w/4),3]>20).sum(1)
    cuts=[0]
    for k in range(1,4):
     lo,hi=int(h*k/4-h*.08),int(h*k/4+h*.08)
     cut=gap_center(counts,lo,hi) if np.any(counts[lo:hi]<=3) else lo+int(np.argmin(counts[lo:hi]))
     cuts.append(cut)
    cuts.append(h)
    y0,y1=cuts[row:row+2]
   cell=arr[y0:y1,x0:x1].copy();mask=cell[:,:,3]>20;labels,count=ndi.label(mask);sizes=np.bincount(labels.ravel());sizes[0]=0
   if count==0:raise RuntimeError('empty frame')
   main=labels==sizes.argmax();keep=main.copy()
   # Only preserve sizeable pieces immediately adjoining the character.
   near=ndi.binary_dilation(main,iterations=4)
   for j in range(1,count+1):
    part=labels==j
    if sizes[j]>=max(24,main.sum()*.001) and np.any(part&near):keep|=part
   support=ndi.binary_dilation(keep,iterations=1);cell[:,:,3][~support]=0
   ys,xs=np.where(keep);left,right,top,bottom=int(xs.min()),int(xs.max()+1),int(ys.min()),int(ys.max()+1)
   border=bool(np.any(keep[0]) or np.any(keep[-1]) or np.any(keep[:,0]) or np.any(keep[:,-1]))
   # Detect dark boot soles at the bottom; a silver sword tip cannot set the pivot.
   rgb=cell[:,:,:3].astype(float);dark=(rgb.mean(2)<110)&keep
   ycut=top+(bottom-top)*.72;dark[:int(ycut),:]=False
   dys,dxs=np.where(dark)
   if len(dys):
    boot_y=int(np.quantile(dys,.995));sole=dark[max(0,boot_y-3):boot_y+1].any(0);intervals,n=ndi.label(sole);parts=[np.where(intervals==j)[0] for j in range(1,n+1)];parts=[p for p in parts if len(p)>=3]
    # Rear boot stays planted during attack/cast; run uses the lowest contact sole.
    part=min(parts,key=lambda p:p.mean()) if action in ['attack','cast','state'] and parts else (max(parts,key=len) if parts else np.array([int(np.median(dxs))]))
    pivot_x=float(np.mean(part));pivot_y=float(boot_y+1)
    feet=[]
    if action in ['run','idle']:
     bootmask=dark.copy();bootmask[:int(top+(bottom-top)*.78),:]=False
     bootlabels,nboots=ndi.label(bootmask);bootparts=[]
     for bj in range(1,nboots+1):
      by,bx=np.where(bootlabels==bj)
      if len(bx)>=max(14,main.sum()*.001) and by.max()>=bottom-(bottom-top)*.18:bootparts.append((int(bx.min()),int(bx.max()),int(by.max())))
     if bootparts:
      # Midpoint of the entire two-leg footprint, never the lowest single sole.
      footleft=min(f[0] for f in bootparts);footright=max(f[1] for f in bootparts)
      pivot_x=(footleft+footright)/2;pivot_y=max(f[2] for f in bootparts)+1
      feet=bootparts
   else:pivot_x=(left+right)/2;pivot_y=bottom;feet=[]
   frames.append({'rgba':cell,'bounds':[left,top,right,bottom],'sourcePivot':[pivot_x,pivot_y],'height':pivot_y-top,'feet':feet,'border':border,'removedPixels':int((mask&~keep).sum())})
  # Fixed scale per clip, never normalize individual frames by their changing bounds.
  refs=frames if action=='idle' else frames[:4] if action=='state' else [frames[0],frames[-1]] if action in ['attack','cast'] else frames
  reference=float(np.median([f['height'] for f in refs]));scale=176/max(1,reference)
  if action=='run':scale*=.9
  clip=[]
  for i,f in enumerate(frames):
   l,t,r,b=f['bounds']
   if action=='run':f['sourcePivot'][1]=t+reference
   annotation=annotations.get(f'{variant}-{action}-{i:02}')
   if annotation:f['sourcePivot']=annotation['sourcePivot']
   crop=Image.fromarray(f['rgba']).crop((l,t,r,b));newsize=(max(1,round(crop.width*scale)),max(1,round(crop.height*scale)));crop=crop.resize(newsize,Image.Resampling.LANCZOS)
   px=(f['sourcePivot'][0]-l)*scale;py=(f['sourcePivot'][1]-t)*scale
   # A uniform generous canvas with a fixed support-foot pivot.
   out=Image.new('RGBA',(512,320));at=(round(208-px),round(286-py));out.alpha_composite(crop,at)
   name=f'{variant}-{action}-{i:02}.png';out.save(root/'frames'/name)
   item={'src':'assets/v3/frames/'+name,'pivot':[208,286],'referenceHeight':176,'sourcePivot':f['sourcePivot'],'pivotMode':'rear-foot-manual' if annotation else 'legs-midpoint' if action in ['run','idle'] else 'support-sole','sourceFeet':f['feet'],'sourceBounds':f['bounds'],'sourceScale':scale,'edgeTouch':f['border'],'removedPixels':f['removedPixels']}
   if variant in ['j','k','l','m'] and annotation:
    rendered=np.array(out);roi=rendered[270:306,175:235];sole=(roi[:,:,3]>180)&(roi[:,:,:3].mean(2)<100)
    sy,sx=np.where(sole)
    if len(sy):
     lowest=sy.max();sole_x=np.where(sole[max(0,lowest-1):lowest+1].any(0))[0]
     item['pivot']=[175+float(sole_x.mean()),270+int(lowest)+1]
     item['pivotRefinement']='Subpixel sole centroid within manually boot-only region'
   clip.append(item);manifest['qa'].append({'variant':variant,'action':action,'frame':i,'edgeTouch':f['border'],'cleanCanvasEdges':all(edge.max()==0 for edge in [np.array(out)[:,:,3][0],np.array(out)[:,:,3][-1],np.array(out)[:,:,3][:,0],np.array(out)[:,:,3][:,-1]]),'removedPixels':f['removedPixels']})
  if variant=='e' and action=='attack':
   clip=[f for j,f in enumerate(clip) if j!=11]
   for q in manifest['qa']:
    if q['variant']=='e' and q['action']=='attack' and q['frame']==11:q['excluded']='Sword reaches source image edge; never played'
  if variant=='g' and action=='attack':
   keep_indices=[0,1,2,3,5,6,7,9,10,11,12,14]
   clip=[f for j,f in enumerate(clip) if j in keep_indices]
   for q in manifest['qa']:
    if q['variant']=='g' and q['action']=='attack' and q['frame'] not in keep_indices:q['excluded']='Repeated anticipation/neutral or source-boundary contact; not played'
  if variant=='i' and action=='attack':
   clip[0]={**manifest['variants']['c']['state'][0]}
   for q in manifest['qa']:
    if q['variant']=='i' and q['action']=='attack' and q['frame']==0:q['excluded']='Boundary-contact source neutral replaced by clean shared standing frame'
   keep_indices=[0,1,2,4,5,6,8,9,10,11,13,15]
   clip=[f for j,f in enumerate(clip) if j in keep_indices]
   for q in manifest['qa']:
    if q['variant']=='i' and q['action']=='attack' and q['frame'] not in keep_indices:q['excluded']='Duplicate raised pose or straight-arm thrust omitted from chop'
  if variant=='j' and action=='attack':
   keep_indices=[0,3,4,7,8,9,10,11,12,13,15]
   clip=[f for k,f in enumerate(clip) if k in keep_indices]
   for q in manifest['qa']:
    if q['variant']=='j' and q['action']=='attack' and q['frame'] not in keep_indices:q['excluded']='Hidden blade, repeated anticipation or reverse blade angle omitted'
  if variant in ['k','l'] and action=='attack':
   keep_indices=([0,1,2,3,4,6,7,8,9,12,13,14,15] if variant=='k' else [0,1,5,6,7,9,10,11,14,15])
   if variant=='l':
    neutral={**manifest['variants']['c']['state'][0]};im=np.array(Image.open(root/'frames'/'c-state-00.png'));roi=im[270:306,175:235];mask=(roi[:,:,3]>180)&(roi[:,:,:3].mean(2)<100);yy,xx=np.where(mask);bottom=yy.max();sole_x=np.where(mask[max(0,bottom-1):bottom+1].any(0))[0];neutral['pivot']=[175+float(sole_x.mean()),270+int(bottom)+1];clip[0]=neutral
    for q in manifest['qa']:
     if q['variant']=='l' and q['frame']==0:q['excluded']='Source neutral touching row replaced by shared clean standing'
   clip=[f for z,f in enumerate(clip) if z in keep_indices]
   for q in manifest['qa']:
    if q['variant']==variant and q['action']=='attack' and q['frame'] not in keep_indices:q['excluded']='Duplicate windup, hidden/short blade or source-boundary overlap omitted'
  if variant=='m' and action=='attack':
   keep_indices=[0,1,2,3,4,5,7,8,9,12,13,14,15]
   clip=[f for z,f in enumerate(clip) if z in keep_indices]
   for q in manifest['qa']:
    if q['variant']=='m' and q['frame'] not in keep_indices:q['excluded']='Boundary contact or redundant followthrough omitted'
  clips[action]=clip
 if variant=='c':
  clips['idle']=[{**clips['state'][0],'proceduralIdle':True} for _ in range(16)]
 if variant in ['d','e','f','g','h','i','j','k','l','m']:clips={**manifest['variants']['c'],**clips}
 manifest['variants'][variant]=clips
(root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'frames':len(manifest['qa']),'sourceEdgeTouches':[q for q in manifest['qa'] if q['edgeTouch'] and not q.get('excluded')],'cleanCanvasEdges':all(q['cleanCanvasEdges'] for q in manifest['qa'])}))
