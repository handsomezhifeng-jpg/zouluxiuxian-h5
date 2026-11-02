/* The same tactical scene for native challenge/capture/expedition/trial battles. */
(()=>{'use strict';
 const C=window.MobileCombat,render=C.render,update=C.update,systems=C.updateSystems;
 let panel=null,collapsed='';
 const routes={capture:['捕兽交锋','capture-stop'],challenge:['修士试剑','challenge-stop'],expedition:['秘境遭遇','expedition-end'],reincarnation:['轮回试炼','rebirth-abandon']};
 C.update=function(a,...args){if(a||!panel)update(a,...args);};
 C.updateSystems=function(s){systems(s);const choices=[['reincarnation',s?.reincarnationFlow?.trial],['challenge',s?.challenge?.battle],['capture',s?.capture?.battle],['expedition',s?.expedition?.battle]],live=choices.find(([mode,b])=>b?.active&&b?.turnCombat?.tactical);
  if(!live||document.querySelector('#screen .tactical-battle')){panel?.remove();panel=null;return;}
  const [mode,battle]=live,session=`${mode}:${battle.turnCombat.session}`;if(collapsed===session)return;
  let battleView=battle;const artId=mode==='capture'?s.capture?.target?.artId:null;
  if(Number.isInteger(artId)&&artId>0&&artId<=30){battleView={...battle,turnCombat:{...battle.turnCombat,tactical:{...battle.turnCombat.tactical,units:battle.turnCombat.tactical.units.map(u=>u.team==='enemy'?{...u,externalArt:`mobile/assets/enemies/${artId}.webp`}:u)}}};}
  const a={battle:battleView,enemies:[],regions:[],selectedEnemy:battle.enemyId,canStart:true,messages:[],stage:{}};
  if(!panel){panel=document.createElement('div');panel.className='tactical-mode-overlay';panel.setAttribute('role','region');panel.setAttribute('aria-label',routes[mode][0]);panel.innerHTML=render(a,s);document.body.append(panel);}
  const scene=panel.querySelector('.tactical-battle');scene.dataset.mode=mode;update(a);
  scene.querySelector('.t-location strong').textContent=routes[mode][0];scene.querySelector('.t-location>span').textContent=battle.name||s[mode]?.target?.name||'';
  const back=scene.querySelector('.t-location button');delete back.dataset.action;delete back.dataset.route;back.dataset.tClose=session;back.setAttribute('aria-label','收起战场');
  const main=scene.querySelector('.t-main');main.textContent='停止';main.dataset.action=routes[mode][1];if(mode==='expedition')main.dataset.expeditionFingerprint=s.expedition.fingerprint;if(mode==='reincarnation'){main.textContent='放弃';main.dataset.token=s.reincarnationFlow.token;const abandon=s.reincarnationFlow.actions?.find(a=>a.id==='abandon');main.disabled=abandon?.enabled===false;}
 };
 document.addEventListener('click',e=>{const close=e.target.closest('[data-t-close]');if(close){collapsed=close.dataset.tClose;panel?.remove();panel=null;e.stopImmediatePropagation();}},true);
})();
