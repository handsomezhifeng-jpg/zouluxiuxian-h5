/* Presentation only: real snapshots and native actions remain the authority. */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number.isFinite(v)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0}).format(v):'—';
  const ratio=(v,m)=>m>0?Math.max(0,Math.min(100,v/m*100)):0;
  const order=t=>(t?.order??[]).map((who,i)=>`<span class="turn-token ${who} ${i===0?'is-next':''}">${who==='player'?'我':'敌'}</span>`).join('');
  const turnLog=t=>(t?.events??[]).slice(-3).reverse().map(e=>`<p>第 ${e.seq} 手 · ${e.who==='player'?'你':'妖兽'}出手，造成 ${num(e.damage)} 伤害${e.lethal?(e.who==='player'?' · 击败目标':' · 你已败退'):''}</p>`).join('');
  const bar=(kind,v,m,live=true)=>`<div class="duel-hp"><span ${live?`data-battle-value="${kind}Qi"`:""}>${num(v)}</span> / <span ${live?`data-battle-value="max${kind[0].toUpperCase()+kind.slice(1)}Qi"`:""}>${num(m)}</span></div><div class="progress-track"><div class="progress-fill ${kind==='enemy'?'enemy-fill':''}" data-progress="${live?kind:kind+'-preview'}" style="width:${ratio(v,m)}%"></div></div>`;
  function render(a,s={}){
    const b=a.battle,selected=a.enemies.find(e=>e.id===a.selectedEnemy);
    const t=b.active?(a.enemies.find(e=>e.id===b.enemyId)||{id:b.enemyId,name:b.name,artId:b.artId,known:true}):selected;
    const name=b.active?b.name:t?.name,region=a.regions.find(r=>r.id===(b.active?b.regionId:a.selectedRegion));
    const stage=a.stage,recovery=a.recovery;
    const farming=stage?.mode==='farm';
    const mainAction=farming?(stage?.bossReady?'battle-boss':'battle-resume'):b.active?'battle-stop':'battle-start';
    const mainLabel=farming?(stage?.bossReady?'挑战首领':'继续冲关'):b.active?'停止历练':stage?.complete?'已全部通关':'开始历练';
    const enemyLevel=b.active?b.level:t?.level;
    const stageCount=farming?stage.farmWave+1:(stage?.kills??0);
    const stageText=farming?`循环战斗 ${stage.farmStage}-${stage.farmWave+1}`:stage?.boss?'首领挑战':`${stageCount} / 20`;
    const drops=recovery?.cooling?`<section class="battle-reward-play" role="status" aria-label="本场战斗结算"><strong>${recovery.won?'战斗胜利':'历练败退'}</strong><div>${recovery.rewards.map((r,i)=>`<span class="battle-drop" style="--drop-order:${i}"><i aria-hidden="true">${/灵石/.test(r)?'◆':/参悟/.test(r)?'◇':'✦'}</i>${esc(r)}</span>`).join('')}</div><small><b data-respawn-seconds>${Math.ceil(recovery.remaining/1000)}</b>秒后${b.active?'继续历练':'可再次挑战'}</small></section>`:'';
    const turn=b.turnCombat,enemySpeed=b.active?turn?.enemySpeed:t?.stats?.speed;
    const fallbackBeast=/野猪/.test(name||'')?'<img src="mobile/assets/combat/boar.webp" alt="" draggable="false">':t?.known&&Number.isInteger(t.artId)&&t.artId>=1&&t.artId<=30?`<img class="native-beast" src="mobile/assets/enemies/${t.artId}.webp" alt="" draggable="false">`:`<span class="quiet-beast-seal">${esc(name||'寻踪')}</span>`;
    const art=window.MobileEnemyArt?.[t?.id];
    const beast=art&&t?.known?`<img class="roster-beast" data-enemy-id="${art.id}" src="mobile/assets/combat/${art.idle}" alt="" draggable="false">`:fallbackBeast;
    return `<section class="quiet-combat duel-arena ${recovery?.cooling?'is-settling':recovery?'is-spawning':''}" data-enemy-attack="${art?.attack||(/猪|牛|象|熊|龟/.test(name||'')?'ram':'claw')}" aria-label="历练战斗"><div class="quiet-background"></div><div class="quiet-shade"></div><header class="quiet-location stage-header"><div><strong>${stage?.boss?`第 ${num(stage?.fightingStage??1)} 关 · 首领`:`第 ${num(stage?.fightingStage??stage?.stage??1)}-${num((stage?.fightingWave??0)+1)} 场`}</strong><span>${stage?.complete?'已通关':esc(stageText)}</span></div><div class="stage-progress" role="progressbar" aria-label="本关小怪击杀进度" aria-valuemin="0" aria-valuemax="20" aria-valuenow="${stageCount}"><i style="width:${stageCount*5}%"></i></div></header><div class="duel-actor duel-fighter"><div class="quiet-health"><strong>${esc(s.playerName||'道友')}</strong>${bar('player',b.playerQi,b.maxPlayerQi)}</div><img src="mobile/assets/combat/fighter-idle-v4.webp" alt="持剑修士" draggable="false"></div><div class="duel-actor duel-monster quiet-target"><div class="quiet-health"><strong>${esc(name||'暂无目标')}${enemyLevel!=null?` · Lv.${num(enemyLevel)}`:''}</strong>${bar('enemy',b.active?b.enemyQi:t?.stats?.qi,b.active?b.maxEnemyQi:t?.stats?.qi,b.active)}</div>${beast}</div><div class="duel-effects" aria-hidden="true"></div>${drops}<section class="quiet-bottom"><button class="quiet-start" data-action="${mainAction}" data-id="${t?.id??''}" ${!b.active&&!a.canStart?'disabled':''}>${mainLabel}</button>${farming&&b.active?'<button class="stage-farm-stop" data-action="battle-stop">停止历练</button>':''}</section></section>`;
  }

  let overlay,last=null,lastEventKey=null,sheetSignature='',timers=new Set(),stageProgress=null,pendingHealth=null,lastView=null,victoryHold=null;
  const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);};
  function sheet(a,kind){
    if(!overlay){overlay=document.createElement('section');overlay.id='combatSheet';overlay.className='dialogue-overlay combat-sheet';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','历练详情');document.body.append(overlay);}
    if(!kind||!a){overlay.hidden=true;sheetSignature='';return;}
    const signature=JSON.stringify([kind,a.selectedRegion,a.selectedEnemy,a.enemies.map(e=>[e.id,e.known,e.selectable]),a.battle.active,a.regions,kind==='log'?a.messages:null]);
    overlay.hidden=false;if(signature===sheetSignature)return;sheetSignature=signature;
    overlay.innerHTML=`<article class="dialogue-card"><div class="section-heading"><h2>${kind==='targets'?'切换妖兽':'历练见闻'}</h2><button class="secondary-button" data-action="combat-close">收起</button></div>${kind==='targets'?`<p class="muted">${a.battle.active?'切换其他目标会先停止当前历练。':'选择目标后，点击开始历练。'}</p><div class="quiet-region-list">${a.regions.map(r=>`<button class="secondary-button" data-action="adventure-region" data-id="${r.id}" ${r.unlocked?'':'disabled'}>${esc(r.name)}</button>`).join('')}</div><div class="enemy-list">${a.enemies.map(e=>`<button class="enemy-option ${e.id===a.selectedEnemy?'is-selected':''}" data-action="adventure-enemy" data-id="${e.id}" ${e.selectable?'':'disabled'}><span class="enemy-mark">${e.known?'兽':'?'}</span><span><strong>${esc(e.known?e.name:'未知妖兽')}</strong><small>${e.known?`真气 ${num(e.stats.qi)} · 攻 ${num(e.stats.attack)} · 防 ${num(e.stats.defense)} · 速 ${num(e.stats.speed)}`:'继续历练，发现踪迹'}</small></span></button>`).join('')}</div>`:a.messages.length?`<ol class="battle-log">${a.messages.map(m=>`<li>${esc(m.text)}</li>`).join('')}</ol>`:'<p>暂无历练见闻。</p>'}</article>`;
  }
  function animate(scene,who,amount){
    const player=who==='enemy';
    const actor=scene.querySelector(player?'.duel-fighter':'.duel-monster'),victim=scene.querySelector(player?'.duel-monster':'.duel-fighter');
    const layer=scene.querySelector('.duel-effects');if(!actor||!victim||!layer)return;
    // Animate the illustration only: health and speed stay readable above it.
    const mover=window.MobileCombatSprites?.visual(actor)||actor.querySelector(':scope > img')||actor,target=window.MobileCombatSprites?.visual(victim)||victim.querySelector(':scope > img')||victim;
    mover.getAnimations().forEach(a=>a.cancel());target.getAnimations().forEach(a=>a.cancel());
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startTime=document.timeline?.currentTime;
    const schedule=(el,frames,options)=>{const animation=el.animate(frames,options);if(Number.isFinite(startTime))animation.startTime=startTime;return animation;};
    const bounds=scene.getBoundingClientRect?.(),ar=actor.getBoundingClientRect?.(),vr=victim.getBoundingClientRect?.();
    const direction=player?1:-1;
    const duration=reduced?120:430,pose=window.MobileCombatSprites?.play(actor,duration),impact=reduced?0:pose?.hitMs??155;
    if(pose?.animation&&Number.isFinite(startTime))pose.animation.startTime=startTime;
    const contact=pose?.hitOffset??.46;
    const tr=target.getBoundingClientRect?.(),mr=mover.getBoundingClientRect?.();
    const x=tr&&bounds?tr.x-bounds.x+tr.width*(player?.30:.55):vr&&bounds?vr.x-bounds.x+vr.width*.5:player?260:80;
    const y=tr&&bounds?tr.y-bounds.y+tr.height*(player?.44:.53):vr&&bounds?vr.y-bounds.y+vr.height*.56:300;
    const tip=pose?.tip??(player?[.88,.47]:[.14,.55]);
    const travelX=mr&&bounds?x-(mr.x-bounds.x+mr.width*tip[0]):direction*75;
    const travelY=mr&&bounds?y-(mr.y-bounds.y+mr.height*tip[1]):player?-7:-15;
    scene.dataset.impactMs=String(impact);scene.dataset.hitX=String(x);scene.dataset.hitY=String(y);
    schedule(mover,reduced?[{opacity:.75},{opacity:1}]:[
      {transform:'translate(0,0) rotate(0deg) scale(1)'},
      {transform:`translate(${-direction*6}px,2px) rotate(${-direction*3}deg) scale(${player?1:1.04},.96)`,offset:.18},
      {transform:`translate(${travelX}px,${travelY}px) rotate(0deg) scale(1)`,offset:contact},
      {transform:`translate(${travelX*.85}px,${travelY*.85}px) rotate(0deg)`,offset:.66},
      {transform:'translate(0,0) rotate(0deg) scale(1)'}
    ],{duration,easing:'linear'});
    schedule(target,reduced?[{opacity:.7},{opacity:1}]:[
      {transform:'translateX(0)',filter:'brightness(1)'},
      {transform:`translateX(${direction*11}px) rotate(${direction*3}deg)`,filter:player?'brightness(1.65) saturate(.65)':'brightness(1.35) sepia(.25)',offset:.12},
      {transform:`translateX(${-direction*4}px)`,filter:'brightness(1.1)',offset:.55},
      {transform:'translateX(0)',filter:'brightness(1)'}
    ],{duration:reduced?120:235,delay:impact});
    const spawn=(className,frames,options={},position={left:`${x}px`,top:`${y}px`})=>{
      const el=document.createElement('i');el.className=className;Object.assign(el.style,{opacity:'0',...position});layer.append(el);
      const animation=schedule(el,frames,{duration:reduced?120:280,delay:impact,fill:'forwards',...options});
      animation.onfinish=animation.oncancel=()=>el.remove();return el;
    };
    if(!reduced){
      if(player){
        spawn('duel-sword-arc',[
          {opacity:0,transform:'translate(-65%,-55%) rotate(-65deg) scale(.45)'},
          {opacity:1,transform:'translate(-50%,-50%) rotate(-20deg) scale(1)',offset:.28},
          {opacity:0,transform:'translate(-35%,-45%) rotate(25deg) scale(1.2)'}
        ],{duration:245});
        spawn('duel-sword-line',[
          {opacity:0,transform:'translate(-50%,-50%) rotate(-32deg) scaleX(.1)'},
          {opacity:1,transform:'translate(-50%,-50%) rotate(-32deg) scaleX(1)',offset:.3},
          {opacity:0,transform:'translate(-40%,-50%) rotate(-32deg) scaleX(1.2)'}
        ],{duration:210});
      }else if(scene.dataset.enemyAttack==='ram'){
        spawn('duel-ram-wave',[
          {opacity:0,transform:'translate(-10%,-50%) scale(.35,.7)'},
          {opacity:.9,transform:'translate(-50%,-50%) scale(1)',offset:.25},
          {opacity:0,transform:'translate(-80%,-50%) scale(1.45,1.2)'}
        ],{duration:270});
      }else if(scene.dataset.enemyAttack==='claw'){
        for(let i=0;i<3;i++)spawn('duel-claw',[
          {opacity:0,transform:'translate(-50%,-75%) rotate(28deg) scaleY(.15)'},
          {opacity:.9,transform:'translate(-50%,-50%) rotate(28deg) scaleY(1)',offset:.3},
          {opacity:0,transform:'translate(-50%,-30%) rotate(28deg) scaleY(1.15)'}
        ],{duration:240,delay:impact+i*20},{left:`${x+(i-1)*13}px`,top:`${y}px`});
      }
      spawn('duel-impact-ring '+(player?'sword':'beast'),[
        {opacity:.85,transform:'translate(-50%,-50%) scale(.15)'},
        {opacity:.5,offset:.3},{opacity:0,transform:'translate(-50%,-50%) scale(1.25)'}
      ]);
      for(let i=0;i<6;i++){
        const angle=i*Math.PI/3,dx=Math.cos(angle)*(24+i%2*13),dy=Math.sin(angle)*25;
        spawn('duel-hit-spark '+(player?'sword':'beast'),[
          {opacity:0,transform:'translate(-50%,-50%) scale(.3)'},
          {opacity:1,offset:.12},{opacity:0,transform:`translate(${dx}px,${dy}px) scale(.1)`}
        ],{duration:260+i*12});
      }
      if(ar&&bounds)spawn('duel-step-dust',[
        {opacity:0,transform:'translate(-50%,-50%) scale(.3)'},
        {opacity:.4,offset:.25},{opacity:0,transform:`translate(${-direction*28}px,-5px) scale(1.7)`}
      ],{delay:50,duration:320},{left:`${ar.x-bounds.x+ar.width*.5}px`,top:`${ar.bottom-bounds.y-4}px`});
    }
    const effect=document.createElement('span');effect.className='duel-damage '+who;effect.textContent='−'+num(amount);
    Object.assign(effect.style,{opacity:'0',left:`${x}px`,right:'auto',top:`${y}px`});layer.append(effect);
    const anim=schedule(effect,[{opacity:1,transform:'translate(-50%,0px) scale(1)'},{opacity:1,transform:'translate(-50%,-8px) scale(1.12)',offset:.2},{opacity:0,transform:'translate(-50%,-42px) scale(1)'}],{duration:reduced?180:620,delay:impact,fill:'forwards'});
    anim.onfinish=anim.oncancel=()=>effect.remove();
    return impact;
  }
  function update(a,kind){
    sheet(a,kind);
    const scene=document.querySelector('.duel-arena'),b=a?.battle;
    if(scene&&b){
      if(a.stage){
        const fill=scene.querySelector('.stage-progress i'),next=(a.stage.mode==='farm'?a.stage.farmWave+1:a.stage.kills)*5;
        if(fill?.style&&stageProgress?.stage===a.stage.stage&&stageProgress.value!==next){fill.style.width=stageProgress.value+'%';fill.getBoundingClientRect();fill.style.width=next+'%';}
        stageProgress={stage:a.stage.stage,value:next};
      }
      window.MobileCombatSprites?.mount(scene);
      const countdown=scene.querySelector('[data-respawn-seconds]');if(countdown&&a.recovery)countdown.textContent=Math.ceil(a.recovery.remaining/1000);
      const turn=b.turnCombat;
      const status=scene.querySelector('[data-turn-status]');if(status)status.textContent=b.active?`第 ${num(turn?.turn??0)} 手`:'待战';
      const queue=scene.querySelector('[data-turn-order]');if(queue)queue.innerHTML=order(turn);
      const log=scene.querySelector('[data-turn-log]');if(log&&turn?.events?.length)log.innerHTML=turnLog(turn);
      for(const who of ['player','enemy']){const el=scene.querySelector(`[data-turn-${who}-speed]`);if(el&&turn?.[who+'Speed']!=null)el.textContent=num(turn[who+'Speed']);}
      const event=turn?.events?.at(-1),key=event?`${event.session}:${event.seq}`:null;
      if(event&&key!==lastEventKey&&(last?.active||b.active)){
        const victim=event.who==='player'?'enemy':'player';
        const before=last&&last.enemyId===b.enemyId&&last.kills===b.kills?last[victim+'Qi']:Math.min(b['max'+victim[0].toUpperCase()+victim.slice(1)+'Qi']??Infinity,(b[victim+'Qi']??0)+event.damage);
        const token={enemyId:b.enemyId,kills:b.kills,victim,before,after:b[victim+'Qi'],hit:false};pendingHealth=token;paintHealth(scene,displayBattle(b));
        const impact=animate(scene,victim,event.damage)??0;
        window.MobileAudio?.effect(event.who==='player'?'attack':'enemyAttack',.7);
        later(()=>{if(pendingHealth===token)window.MobileAudio?.effect(event.lethal?(event.who==='player'?'victory':'defeat'):'hit',.65);},impact);
        later(()=>{if(pendingHealth!==token)return;token.hit=true;if(victoryHold?.key===key)victoryHold.wait=false;const current=document.querySelector('.duel-arena');if(current){paintHealth(current,displayBattle(last??b));current.dataset.lastImpact=key;}},impact);
        scene.dataset.acting=event.who;
      }
      if(key)lastEventKey=key;
    }
    if(!a){timers.forEach(clearTimeout);timers.clear();}
    if(!a){lastEventKey=null;pendingHealth=null;lastView=null;victoryHold=null;}
    last=b?{...b}:null;lastView=a??null;
  }
  function summary(b,mode){
    const t=b?.turnCombat;
    return `<section class="turn-system-summary" data-turn-mode="${mode}"><div class="turn-summary">速度 ${num(t?.playerSpeed)} / ${num(t?.enemySpeed)} · 第 ${num(t?.turn??0)} 手</div><div class="turn-system-order">${order(t)}</div><div class="turn-live-log">${turnLog(t).replace(/妖兽/g,'对手')||'<p>按速度依次出手</p>'}</div></section>`;
  }
  function updateSystems(s){
    const battles={challenge:s?.challenge?.battle,capture:s?.capture?.battle,expedition:s?.expedition?.battle,reincarnation:s?.reincarnationFlow?.trial};
    document.querySelectorAll('[data-turn-mode]').forEach(el=>{const mode=el.dataset.turnMode,b=battles[mode];if(!b)return;window.MobileAudio?.systemBattle(mode,b);const container=document.createElement('div');container.innerHTML=summary(b,mode);el.innerHTML=container.firstElementChild.innerHTML;});
  }
  function displayBattle(b){if(!b||!pendingHealth||pendingHealth.hit||pendingHealth.enemyId!==b.enemyId||pendingHealth.kills!==b.kills)return b;return {...b,[pendingHealth.victim+'Qi']:pendingHealth.before};}
  function paintHealth(scene,b){if(!b)return;scene.querySelectorAll?.('[data-battle-value]').forEach(el=>el.textContent=num(b[el.dataset.battleValue]));for(const who of ['player','enemy']){const el=scene.querySelector(`[data-progress="${who}"]`);if(el?.style){const value=ratio(b[who+'Qi'],b['max'+who[0].toUpperCase()+who.slice(1)+'Qi']);if(window.MobileProgress)window.MobileProgress.set(el,value,{snap:true});else el.style.width=value+'%';}}}
  function prepare(a){
    const b=a?.battle,event=b?.turnCombat?.events?.at(-1),key=event?`${event.session}:${event.seq}`:null;
    if(victoryHold?.key===key)return victoryHold.wait?victoryHold.view:a;
    if(event?.lethal&&key!==lastEventKey&&lastView?.battle?.active&&(b.enemyId!==lastView.battle.enemyId||b.kills!==lastView.battle.kills||!b.active)){
      const old=lastView.battle,view={...lastView,battle:{...old,turnCombat:b.turnCombat,enemyQi:event.who==='player'?0:old.enemyQi,playerQi:event.who==='enemy'?0:b.playerQi}};
      victoryHold={key,wait:true,view};return view;
    }return a;
  }
  window.MobileCombat={render,update,summary,updateSystems,displayBattle,prepare};
})();
