// Routes run along the painted courtyard paths; no production is granted here.
const nodes={west:[31,45],north:[51,45],east:[77,45],left:[31,61],right:[77,65],southWest:[32,74],southEast:[76,74],south:[52,74],lowerLeft:[34,94],gate:[52,94],hall:[51,43],library:[85,44],meditation:[22,44],alchemy:[24,59],forge:[82,59],farm:[84,73],beast:[26,72],mine:[28,89],ward:[52,90],dormitory:[76,92]};
const edges=[['west','north'],['north','east'],['west','left'],['left','southWest'],['east','right'],['right','southEast'],['southWest','south'],['south','southEast'],['southWest','lowerLeft'],['lowerLeft','gate'],['north','hall'],['east','library'],['west','meditation'],['left','alchemy'],['right','forge'],['southEast','farm'],['southWest','beast'],['southWest','mine'],['gate','ward'],['gate','dormitory']];
const facilities=[['hall','hall'],['school','library'],['source_b153','meditation'],['source_b151','alchemy'],['source_b137','forge'],['source_b147','farm'],['fishpond','beast'],['source_b133','mine'],['source_b135','ward']];
function path(from,to){const q=[[from]],seen=new Set([from]);while(q.length){const p=q.shift(),n=p.at(-1);if(n===to)return p;for(const [a,b]of edges){const k=a===n?b:b===n?a:null;if(k&&!seen.has(k)){seen.add(k);q.push([...p,k]);}}}return[from];}
export function createDisciples(world,getState){
 const canvas=document.createElement('canvas');canvas.className='cave-disciples';canvas.setAttribute('aria-label','洞府弟子沿庭院行走，在建筑前行礼与劳作');world.append(canvas);
 const ctx=canvas.getContext('2d'),sheet=new Image();sheet.src='ui/assets/cave/disciples-seedance-v3/atlas.png';let meta,raf=0,last=0,elapsed=0,dead=false,people=[],refresh=0;
 fetch('ui/assets/cave/disciples-seedance-v3/frames.json').then(r=>r.json()).then(v=>meta=v).catch(()=>{});
 function targets(){const state=getState?.()||{};return facilities.filter(([type])=>(state.workers?.[type]||0)>0).map(([,id])=>id);}
 function depart(p){const options=targets();const list=options.length?options:['hall','meditation','library'];p.target=list[(p.index+p.trip++)%list.length];if(p.target===p.node)p.target=list[(p.index+p.trip++)%list.length];p.route=path(p.node,p.target).slice(1);p.state=p.route.length?'walk':'greet';p.age=0;p.wait=4+p.index*.7;}
 function sync(){const state=getState?.()||{},count=Math.min(6,Math.max(0,state.disciples??6));while(people.length<count){const i=people.length,node=['west','east','southWest','southEast','north','gate'][i];const p={index:i,node,pos:[...nodes[node]],target:node,route:[],state:'wait',age:0,trip:0,face:1,back:false,wait:i*1.1};people.push(p);}people.length=count;}
 function update(p,dt){p.age+=dt;if(p.state==='walk'){const next=p.route[0];if(!next){p.state='greet';p.age=0;return;}const dest=nodes[next],dx=dest[0]-p.pos[0],dy=dest[1]-p.pos[1],distance=Math.hypot(dx,dy),step=dt*(1.5+p.index*.055);if(Math.abs(dx)>.04)p.face=dx<0?-1:1;p.back=dy<-.03;if(distance<=step){p.pos=[...dest];p.node=next;p.route.shift();if(!p.route.length){p.state='greet';p.age=0;}}else{p.pos[0]+=dx/distance*step;p.pos[1]+=dy/distance*step;}}
 else if(p.state==='greet'&&p.age>=1.2){p.state=targets().includes(p.node)?'work':'wait';p.age=0;}
 else if(p.state==='work'&&p.age>=5+p.index*.35){p.state='wait';p.age=0;}
 else if(p.state==='wait'&&p.age>=p.wait)depart(p);}
 function draw(now){if(dead)return;raf=requestAnimationFrame(draw);const dt=Math.min(.06,last?(now-last)/1000:0);last=now;if(document.hidden)return;elapsed+=dt;if(elapsed>refresh){sync();refresh=elapsed+2;}people.forEach(p=>update(p,dt));
 const w=world.clientWidth,h=world.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(!meta||!sheet.complete||!sheet.naturalWidth)return;
 for(const p of [...people].sort((a,b)=>a.pos[1]-b.pos[1])){const row=p.state==='walk'?(p.back?1:0):p.state==='greet'?2:p.state==='work'?3:2;const frame=p.state==='wait'?0:p.state==='walk'?Math.floor(p.age*8)%5:Math.floor(p.age*5)%6;const f=meta.frames[row*6+frame],scale=w/912*.14,px=p.pos[0]/100*w,py=p.pos[1]/100*h;
 ctx.save();ctx.translate(px,py);ctx.scale(p.face,1);ctx.drawImage(sheet,f.rect[0],f.rect[1],f.rect[2],f.rect[3],-f.pivot[0]*scale,-f.pivot[1]*scale,f.rect[2]*scale,f.rect[3]*scale);ctx.restore();}
 canvas.dataset.actors=JSON.stringify(people.map(p=>({node:p.node,target:p.target,state:p.state,pos:p.pos})));}
 raf=requestAnimationFrame(draw);return{destroy(){dead=true;cancelAnimationFrame(raf);canvas.remove();}};
}




