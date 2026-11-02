import {createDisciples} from './disciples.js';
// Approved painted scene. Geometry is normalized to the original square artwork.
export const landmarks=[
 {
  "id": "hall",
  "type": "hall",
  "name": "宗门主殿",
  "label": [
   40.899,
   23.821
  ],
  "area": [
   [
    31,
    22
   ],
   [
    69,
    22
   ],
   [
    69,
    43
   ],
   [
    31,
    43
   ]
  ]
 },
 {
  "id": "library",
  "type": "school",
  "name": "藏经阁",
  "label": [
   81.14,
   31.626
  ],
  "area": [
   [
    78,
    27
   ],
   [
    100,
    27
   ],
   [
    100,
    44
   ],
   [
    78,
    44
   ]
  ]
 },
 {
  "id": "meditation",
  "type": "source_b153",
  "name": "修室",
  "label": [
   8.553,
   31.707
  ],
  "area": [
   [
    2,
    27
   ],
   [
    31,
    27
   ],
   [
    31,
    44
   ],
   [
    2,
    44
   ]
  ]
 },
 {
  "id": "ward",
  "type": "source_b135",
  "name": "护派大阵",
  "label": [
   42.763,
   78.049
  ],
  "area": [
   [
    37,
    73
   ],
   [
    65,
    73
   ],
   [
    65,
    91
   ],
   [
    37,
    91
   ]
  ]
 },
 {
  "id": "forge",
  "type": "source_b137",
  "name": "炼器房",
  "label": [
   74.232,
   47.561
  ],
  "area": [
   [
    72,
    44
   ],
   [
    100,
    44
   ],
   [
    100,
    59
   ],
   [
    72,
    59
   ]
  ]
 },
 {
  "id": "alchemy",
  "type": "source_b151",
  "name": "炼丹房",
  "label": [
   8.553,
   47.561
  ],
  "area": [
   [
    2,
    44
   ],
   [
    30,
    44
   ],
   [
    30,
    59
   ],
   [
    2,
    59
   ]
  ]
 },
 {
  "id": "beast",
  "type": "fishpond",
  "name": "御兽坊",
  "label": [
   7.675,
   65.528
  ],
  "area": [
   [
    2,
    61
   ],
   [
    32,
    61
   ],
   [
    32,
    73
   ],
   [
    2,
    73
   ]
  ]
 },
 {
  "id": "mine",
  "type": "source_b133",
  "name": "灵矿",
  "label": [
   9.978,
   79.187
  ],
  "area": [
   [
    0,
    76
   ],
   [
    32,
    76
   ],
   [
    32,
    92
   ],
   [
    0,
    92
   ]
  ]
 },
 {
  "id": "farm",
  "type": "source_b147",
  "name": "灵田",
  "label": [
   83.553,
   64.878
  ],
  "area": [
   [
    76,
    62
   ],
   [
    100,
    62
   ],
   [
    100,
    75
   ],
   [
    76,
    75
   ]
  ]
 },
 {
  "id": "dormitory",
  "type": null,
  "name": "弟子房",
  "label": [
   80.811,
   84.146
  ],
  "area": [
   [
    68,
    82
   ],
   [
    100,
    82
   ],
   [
    100,
    97
   ],
   [
    68,
    97
   ]
  ]
 }
];
export function createScenicMap(container,{onSelect,getDisciples}){
 const abort=new AbortController(),options={signal:abort.signal};let width=0,x=0,y=0,start=null,loaded=false;let ratio=1230/912;
 container.innerHTML=`<div class="cave-scenic-world"><img class="cave-scenic-art" src="ui/assets/cave/approved-c-courtyard-airy.png" alt="云归洞府，点击建筑区域查看详情" draggable="false"><svg class="cave-scenic-regions" viewBox="0 0 100 100" aria-hidden="true">${landmarks.map(l=>`<polygon data-landmark="${l.id}" points="${l.area.map(p=>p.join(',')).join(' ')}"/>`).join('')}</svg>${landmarks.map(l=>`<button class="cave-plaque" data-landmark="${l.id}" aria-label="查看${l.name}详情" aria-pressed="false" style="left:${l.label[0]}%;top:${l.label[1]}%">${l.name}</button>`).join('')}</div>`;
 const world=container.firstElementChild,img=world.querySelector('img');
 const disciples=createDisciples(world,getDisciples);
 function paint(){const w=container.clientWidth,h=container.clientHeight;if(!loaded||!w||!h)return;ratio=h/w;width=Math.max(width,w);world.style.height=(width*ratio)+'px';x=width<=w?(w-width)/2:Math.max(w-width,Math.min(0,x));y=width*ratio<=h?(h-width*ratio)/2:Math.max(h-width*ratio,Math.min(0,y));world.style.width=width+'px';world.style.transform=`translate(${x}px,${y}px)`;container.dataset.camera=JSON.stringify({x,y,width,w,h});}
 function reset(){if(!loaded)return;ratio=container.clientHeight/container.clientWidth;width=container.clientWidth;x=(container.clientWidth-width)/2;y=(container.clientHeight-width*ratio)/2;paint();}
 function zoom(factor){if(!loaded)return;const old=width;width=Math.max(Math.min(container.clientWidth,container.clientHeight/ratio),Math.min(3000,width*factor));x=container.clientWidth/2-(container.clientWidth/2-x)*width/old;y=container.clientHeight/2-(container.clientHeight/2-y)*width/old;paint();}
 function select(id){const l=landmarks.find(l=>l.id===id);if(!l)return;world.querySelectorAll('.cave-plaque').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.landmark===id)));container.dataset.selected=id;onSelect(l);}
 function focus(id){const l=landmarks.find(l=>l.id===id);if(!l)return;x=container.clientWidth/2-l.label[0]/100*width;y=container.clientHeight*.42-l.label[1]/100*width*ratio;paint();}
 img.addEventListener('load',()=>{loaded=true;reset();},options);img.addEventListener('error',()=>{container.classList.add('art-failed');container.setAttribute('aria-label','场景载入失败，请刷新重试');},options);if(img.complete&&img.naturalWidth){loaded=true;reset();}
 const resize=new ResizeObserver(()=>{if(loaded)paint();});resize.observe(container);
 container.addEventListener('pointerdown',e=>{if(e.button!==0)return;start={id:e.pointerId,x,y,px:e.clientX,py:e.clientY,moved:false};container.setPointerCapture(e.pointerId);},options);
 container.addEventListener('pointermove',e=>{if(!start||e.pointerId!==start.id)return;const dx=e.clientX-start.px,dy=e.clientY-start.py;if(Math.hypot(dx,dy)>7)start.moved=true;if(start.moved){x=start.x+dx;y=start.y+dy;paint();}},options);
 container.addEventListener('pointerup',e=>{if(!start||e.pointerId!==start.id)return;const moved=start.moved;start=null;if(moved)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-landmark]');if(target&&container.contains(target)){select(target.dataset.landmark);return;}const rect=container.getBoundingClientRect(),px=(e.clientX-rect.left-x)/width*100,py=(e.clientY-rect.top-y)/(width*ratio)*100;const hit=landmarks.find(l=>{let inside=false;for(let i=0,j=l.area.length-1;i<l.area.length;j=i++){const [ax,ay]=l.area[i],[bx,by]=l.area[j];if((ay>py)!==(by>py)&&px<(bx-ax)*(py-ay)/(by-ay)+ax)inside=!inside;}return inside;});if(hit)select(hit.id);},options);
 for(const name of ['pointercancel','lostpointercapture'])container.addEventListener(name,()=>{start=null;},options);
 container.addEventListener('keydown',e=>{const b=e.target.closest('button[data-landmark]');if(b&&(e.key==='Enter'||e.key===' ')){e.preventDefault();select(b.dataset.landmark);}},options);
 container.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?.9:1.1);},{...options,passive:false});
 return {reset,zoom,focus,select,destroy(){disciples.destroy();resize.disconnect();abort.abort();container.innerHTML='';}};
}





