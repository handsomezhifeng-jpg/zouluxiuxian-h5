/* One audio owner for the portrait UI; playback never affects simulation. */
(() => {
  'use strict';
  const base = new URL('../media/', document.currentScript.src);
  const files = { click:'click', attack:'我方攻击', enemyAttack:'敌方攻击', hit:'受击', victory:'击杀', defeat:'死亡', layer:'升级', insight:'能量', equip:'装备', sell:'出售', heal:'加血', thunder:'落雷' };
  const defaults = { music:true, effects:true, musicVolume:.24, effectsVolume:.55 };
  let prefs = { ...defaults }, unlocked = false, suspended = false;
  try { const saved=JSON.parse(localStorage.getItem('xian-audio-v1')||'{}'); for(const k of ['music','effects'])if(typeof saved[k]==='boolean')prefs[k]=saved[k];for(const k of ['musicVolume','effectsVolume'])if(Number.isFinite(saved[k]))prefs[k]=Math.max(0,Math.min(1,saved[k])); } catch {}
  const music = new Audio(new URL('主界面.webm',base).href);
  music.loop = true; music.preload = 'none'; music.volume = prefs.musicVolume;
  const pool = new Map(), last = new Map(), sessions = new Map();
  const audible = () => unlocked && !suspended && !document.hidden;
  function syncMusic() {
    music.volume=prefs.musicVolume;
    if(audible() && prefs.music && prefs.musicVolume>0) { if(music.paused)music.play().catch(()=>{}); }
    else music.pause();
  }
  function effect(kind, volume=1) {
    if(!audible()||!prefs.effects||prefs.effectsVolume<=0||!files[kind])return;
    const now=performance.now();if(now-(last.get(kind)??-Infinity)<65)return;last.set(kind,now);
    let items=pool.get(kind);if(!items){items=[];pool.set(kind,items);}
    let audio=items.find(item=>item.paused||item.ended);
    if(!audio&&items.length<3){audio=new Audio(new URL(files[kind]+'.webm',base).href);audio.preload='none';items.push(audio);}
    if(!audio)return;
    audio.volume=Math.max(0,Math.min(1,prefs.effectsVolume*volume));audio.currentTime=0;audio.play().catch(()=>{});
  }
  function stopEffects(){for(const items of pool.values())for(const audio of items)audio.pause();}
  function controls() {
    document.querySelectorAll('[data-audio-pref]').forEach(input=>{const key=input.dataset.audioPref;if(input.type==='checkbox')input.checked=prefs[key];else input.value=Math.round(prefs[key]*100);});
  }
  function set(key,value) {
    if(!(key in defaults))return;
    prefs[key]=typeof defaults[key]==='boolean'?Boolean(value):Math.max(0,Math.min(1,Number(value)||0));
    try{localStorage.setItem('xian-audio-v1',JSON.stringify(prefs));}catch{}
    if(!prefs.effects||prefs.effectsVolume===0)stopEffects();
    for(const items of pool.values())for(const audio of items)audio.volume=prefs.effectsVolume;
    syncMusic();controls();
  }
  function suspend(value){suspended=Boolean(value);if(suspended)stopEffects();syncMusic();}
  function attach(adapter) {
    // The shipped engine has its own audio. Silence it so switches and volumes
    // govern all portrait sounds, and one attack cannot play twice.
    try{const sdk=adapter._engine().GetObjectClassByName('Audio').GetSingleGlobalInstance().GetSdkInstance();adapter.engineWindow.C3.Plugins.Audio.Acts.SetSilent.call(sdk,0);}catch{}
  }
  function systemBattle(mode,battle){
    const event=battle?.turnCombat?.events?.at(-1);if(!event)return;
    const key=`${event.session}:${event.seq}`;if(sessions.get(mode)===key)return;sessions.set(mode,key);
    effect(event.who==='player'?'attack':'enemyAttack',.7);effect(event.lethal?(event.who==='player'?'victory':'defeat'):'hit',.55);
  }
  document.addEventListener('click',event=>{
    if(!event.isTrusted)return;
    unlocked=true;syncMusic();
    const button=event.target.closest('button,summary');
    if(button&&!button.disabled&&!button.closest('[inert]'))effect('click',.4);
  },true);
  document.addEventListener('keydown',event=>{if(event.isTrusted&&(event.key==='Enter'||event.key===' ')){unlocked=true;syncMusic();}},true);
  document.addEventListener('input',event=>{const input=event.target;if(input.dataset?.audioPref)set(input.dataset.audioPref,input.type==='checkbox'?input.checked:Number(input.value)/100);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopEffects();syncMusic();});
  addEventListener('pagehide',()=>suspend(true));addEventListener('pageshow',()=>suspend(false));
  addEventListener('DOMContentLoaded',controls);
  window.MobileAudio={ effect,attach,suspend,systemBattle,set,get preferences(){return {...prefs};},get status(){return {unlocked,suspended,musicPlaying:!music.paused,nativeAudioOwner:'portrait'};} };
})();
