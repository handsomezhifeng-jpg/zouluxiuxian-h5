/* Pose presentation only. This player cannot advance combat or change HP/saves. */
(()=>{'use strict';
 const url=new URL('assets/tactical/court/attack-poses-v1.webp',document.currentScript.src).href;
 const stateURL=new URL('assets/tactical/court/state-poses-v1.webp',document.currentScript.src).href;
 const heroRoot=new URL('assets/tactical/hero-v9/',document.currentScript.src);let heroClips=null;const heroImages={};
 const heroReady=fetch(new URL('motions.json',heroRoot)).then(r=>r.json()).then(async data=>{await Promise.all([...new Set(Object.values(data.clips).flat().map(f=>f.src))].map(async src=>{const img=new Image();img.src=new URL(src,heroRoot);await img.decode();heroImages[src]=img;}));heroClips=data.clips;return true;}).catch(()=>false);
 const rows={hero:0,blade:1,caster:2,golem:3},active=new Map();let decoded=false,statesDecoded=false;
 const image=new Image();image.src=url;const states=new Image();states.src=stateURL;
 const ready=Promise.all([heroReady,image.decode().then(()=>decoded=true).catch(()=>false),states.decode().then(()=>statesDecoded=true).catch(()=>false)]).then(a=>a.every(Boolean));
 function clear(n){const current=active.get(n);if(current){current.animation.cancel();active.delete(n);}n.querySelector('.t-pose')?.remove();n.querySelector('.t-hero-v9')?.remove();n.classList.remove('has-t-poses');delete n.dataset.deathPose;}
 const allowed=(unit,loaded)=>loaded&&!unit.externalArt&&rows[unit.art]!==undefined&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const position=(unit,frame)=>`${frame/3*100}% ${rows[unit.art]/3*100}%`;
 function mount(n,unit,source,keyframes,duration,age=0,death=false){
  if(age>=duration)return true;clear(n);const span=document.createElement('span');span.className='t-pose';span.setAttribute('aria-hidden','true');span.style.backgroundImage=`url("${source}")`;n.append(span);n.classList.add('has-t-poses');if(death)n.dataset.deathPose='true';
  const animation=span.animate(keyframes,{duration,fill:'none'}),record={animation};active.set(n,record);animation.currentTime=age;
  const finish=()=>{if(active.get(n)!==record)return;active.delete(n);span.remove();n.classList.remove('has-t-poses');delete n.dataset.deathPose;};animation.onfinish=animation.oncancel=finish;animation.finished.then(finish).catch(()=>{});return true;
 }
 function heroAttack(n,timing,age,clip='attack',loop=false){
  if(!heroClips)return false;
  const frames=clip==='hit'?heroClips.state.slice(4,8):heroClips[clip];
  clear(n);const canvas=document.createElement('canvas');canvas.className='t-hero-v9';canvas.dataset.clip=clip;canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'absolute',left:'50%',bottom:'6%',width:'320%',height:'200%',maxWidth:'none',pointerEvents:'none',transform:'translateX(-50%)',transformOrigin:'50% 100%'});
  n.append(canvas);
  const duration=Math.max(1,timing.durationMs||720),start=performance.now()-age;let stopped=false;
  const record={clip,animation:{get playState(){return stopped?'finished':'running';},cancel(){stopped=true;canvas.remove();n.classList.remove('has-t-poses');}}};active.set(n,record);
  const paint=now=>{if(stopped||!n.isConnected)return;const elapsed=Math.max(0,(now-start)/duration),p=loop?elapsed%1:Math.min(1,elapsed),index=clip==='idle'?0:clip==='run'?Math.floor(Math.max(0,now-start)/640*frames.length)%frames.length:Math.min(frames.length-1,Math.floor(p*frames.length)),f=frames[index],w=n.offsetWidth,h=n.offsetHeight*.94,dpr=2;
   canvas.width=Math.round(w*3.2*dpr);canvas.height=Math.round(n.offsetHeight*2*dpr);const c=canvas.getContext('2d');c.scale(dpr,dpr);if(Number(getComputedStyle(n).getPropertyValue('--t-face'))<0){c.translate(canvas.width/dpr,0);c.scale(-1,1);}const scale=h/f.referenceHeight,u=Math.max(0,Math.min(1,(p-.20)/.33)),travel=clip!=='attack'||index===frames.length-1?0:h*.20*u*u*(3-2*u);
   const img=heroImages[f.src],dx=canvas.width/dpr/2+travel-f.pivot[0]*scale,dy=canvas.height/dpr-f.pivot[1]*scale;
   if(clip==='idle'){const breath=(1-Math.cos(p*Math.PI*2))*.5;for(let sy=0;sy<img.height;sy+=2){const sh=Math.min(2,img.height-sy),weight=Math.max(0,Math.min(1,(f.pivot[1]-sy-52)/100));c.drawImage(img,0,sy,img.width,sh,dx,dy+(sy-breath*5.5*weight)*scale,img.width*scale,(sh+.3)*scale);}}
   else c.drawImage(img,dx,dy,img.width*scale,img.height*scale);
   n.classList.add('has-t-poses');

   if(loop||p<1)requestAnimationFrame(paint);else{record.animation.cancel();if(active.get(n)===record)active.delete(n);}
  };paint(performance.now());return true;
 }
 function play(n,event,unit,timing,age=0){
  if(unit.art==='hero'&&!unit.externalArt&&!matchMedia('(prefers-reduced-motion: reduce)').matches)return heroAttack(n,timing,age,event.skill==='attack'?'attack':'cast');
  if(!allowed(unit,decoded))return false;
  // These are actual different body poses. The caster's bad fourth atlas cell is
  // deliberately excluded; the full staff-extension pose is its contact pose.
  const contact=unit.art==='hero'?3:2,windup=1;
  const contacts=event.skill==='array'?timing.hitDelaysMs:[timing.windupMs??timing.impactMs];
  const points=[{at:0,frame:0}];
  for(const hit of contacts){points.push({at:Math.max(0,hit-130),frame:windup},{at:hit,frame:contact},{at:hit+100,frame:unit.art==='caster'?1:3},{at:hit+220,frame:0});}
  points.sort((a,b)=>a.at-b.at);const duration=Math.max(1,points.at(-1).at),keyframes=points.map(p=>({backgroundPosition:position(unit,p.frame),offset:p.at/duration,easing:'steps(1,end)'}));
  return mount(n,unit,url,keyframes,duration,age);
 }
 function move(n,event,unit,timing,age=0){if(unit.art==='hero'&&!unit.externalArt&&heroClips)return heroAttack(n,{durationMs:timing.moveMs},age,'run');if(!allowed(unit,statesDecoded))return false;const count=Math.max(2,(event.path?.length||1)*2),frames=Array.from({length:count+1},(_,i)=>({backgroundPosition:position(unit,i%2),offset:i/count,easing:'steps(1,end)'}));return mount(n,unit,stateURL,frames,timing.moveMs,age);}
 function receive(n,hit,unit){if(!allowed(unit,statesDecoded)||hit.miss||(!hit.amount&&!hit.dead)||active.get(n)?.clip!=='idle'&&['running','paused'].includes(active.get(n)?.animation.playState)&&!hit.dead)return false;if(unit.art==='hero'&&!unit.externalArt&&!hit.dead&&heroClips)return heroAttack(n,{durationMs:520},0,'hit');const death=!!hit.dead,frame=death?3:2,duration=death?420:190,frames=[{backgroundPosition:position(unit,frame),opacity:1,offset:0},{backgroundPosition:position(unit,frame),opacity:1,offset:death?.55:1}];if(death)frames.push({backgroundPosition:position(unit,frame),opacity:0,offset:1});return mount(n,unit,stateURL,frames,duration,0,death);}
 function idle(n,unit){if(unit.art!=='hero'||unit.externalArt||unit.qi<=0||active.has(n)||!heroClips)return;heroAttack(n,{durationMs:2400},0,'idle',true);}
 function reset(){for(const n of [...active.keys()])clear(n);}
 window.MobileTacticalMotion={ready,play,move,receive,idle,clear,reset,stats:()=>({decoded,statesDecoded,heroDecoded:!!heroClips,active:active.size})};
})();


