/* Real pose frames; transforms and impact effects remain in adventure-combat.js. */
(()=>{
  'use strict';
  const base='mobile/assets/combat/',ready=new Set(),pending=new Map();
  const specs={fighter:{sheet:'fighter-attack-v4.webp',frames:5,offsets:[0,.15,.42,.64,.82],hitOffset:.42,tip:[.974,.373]},boar:{sheet:'boar-attack-v1.webp',frames:8,hitOffset:.5,tip:[.14,.55]}};
  for(const entry of Object.values(window.MobileEnemyArt||{}))specs['enemy-'+entry.id]=entry;
  function preload(name){
    if(pending.has(name)||!specs[name])return pending.get(name);
    const img=new Image();img.src=base+specs[name].sheet;
    const promise=img.decode().then(()=>ready.add(name)).catch(()=>{});pending.set(name,promise);return promise;
  }
  preload('fighter');preload('boar');
  const kind=actor=>{
    if(actor?.classList.contains('duel-fighter'))return 'fighter';
    const img=actor?.querySelector(':scope > img'),id=img?.dataset?.enemyId;
    if(id&&specs['enemy-'+id])return 'enemy-'+id;
    return img?.getAttribute('src')?.endsWith('/boar.webp')?'boar':null;
  };
  function attach(actor){
    const name=kind(actor);if(!name)return null;
    if(!ready.has(name)){preload(name)?.then(()=>{if(actor.isConnected&&ready.has(name))attach(actor);});return null;}
    let sprite=actor.querySelector(':scope > .duel-sprite');
    if(sprite&&sprite.dataset.sprite!==name){sprite.remove();sprite=null;}
    if(!sprite){sprite=document.createElement('span');sprite.className=`duel-sprite ${name.startsWith('enemy-')?'enemy-roster-frames':name+'-frames'}`;sprite.setAttribute('aria-hidden','true');sprite.dataset.sprite=name;
      if(name.startsWith('enemy-')){sprite.style.backgroundImage=`url("${base+specs[name].sheet}")`;sprite.style.backgroundSize=`${specs[name].frames*100}% 100%`;}
      actor.append(sprite);actor.classList.add('has-pose-frames');}
    return sprite;
  }
  function visual(actor){return attach(actor)||actor?.querySelector(':scope > img')||actor;}
  function play(actor,duration=430){
    const sprite=attach(actor);if(!sprite||matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
    const spec=specs[sprite.dataset.sprite],count=spec.frames;
    const offsets=spec.offsets||(count===4?[0,.18,.46,.75]:Array.from({length:count},(_,i)=>i/count));
    const frames=offsets.map((offset,i)=>({backgroundPosition:`${i/(count-1)*100}% 0%`,offset,easing:'steps(1,end)'}));
    frames.push({backgroundPosition:'0% 0%',offset:1});
    const animation=sprite.animate(frames,{duration,fill:'none'});
    sprite.dataset.playing='attack';
    const finish=()=>{delete sprite.dataset.playing;};animation.onfinish=animation.oncancel=finish;
    return {animation,hitMs:duration*spec.hitOffset,hitOffset:spec.hitOffset,tip:spec.tip};
  }
  function mount(scene){scene?.querySelectorAll('.duel-actor').forEach(attach);}
  window.MobileCombatSprites={visual,play,mount};
})();
