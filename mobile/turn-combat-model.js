/* Shared combat rules: used by native settlement and every portrait preview. */
(()=>{
  'use strict';
  const positive=v=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,v):0;
  const scale=(v,base,start)=>v>0?Math.max(1,Math.round(start*Math.pow(v/base,.45))):0;
  function profile(raw){
    const maxQi=scale(positive(raw.maxQi??raw.qi),1000,500);
    return {maxQi,qi:Math.max(0,Math.ceil(maxQi*Math.min(1,positive(raw.qi)/Math.max(1,positive(raw.maxQi??raw.qi))))),
      attack:scale(positive(raw.attack),40,60),defense:scale(positive(raw.defense),20,30)};
  }
  // Growth reads existing saved progress, so older saves gain the new stat immediately.
  function growth(level,read,spirit){
    const parts={base:100,realm:Math.round(positive(level)*1.2),methods:0,arts:0,spirits:Math.min(25,Math.floor(Math.log1p(positive(spirit))*2))};
    return {...parts,total:Object.values(parts).reduce((a,b)=>a+b,0)};
  }
  function enemySpeed(name,id=1,tier=1,evolution=0){
    let base=/龟|象|熊|牛/.test(name)?72:/猪|蟾|鳄/.test(name)?86:/兔|貂|豹|狼|马|驹/.test(name)?125:/蝠|鸟|雀|鹏|凤|雕/.test(name)?138:/虎|狮|狐|猴/.test(name)?110:94+(positive(id)%7)*5;
    return Math.min(360,Math.round(base+Math.max(0,positive(tier)-1)*16+Math.min(40,positive(evolution)*2)));
  }
  const damage=(attack,defense)=>Math.max(1,Math.round(positive(attack)*1.6*(positive(attack)/Math.max(1,positive(attack)+positive(defense)*.85))));
  // Equipment uses integer ratings; opposed ratings have diminishing returns.
  function strike(attacker,defender,base,rng=Math.random){
    const rate=k=>positive(attacker[k]),resist=k=>positive(defender[k]);
    const ratingChance=v=>75*Math.max(0,v)/(100+Math.max(0,v));
    const miss=ratingChance(resist('dodge')-rate('accuracy'));
    if(miss>0&&rng()*100<miss)return {damage:0,heal:0,miss:true,critical:false};
    let amount=base;for(const element of ['metal','wood','water','fire','earth'])amount+=Math.max(0,rate(element+'Attack')-resist(element+'Resist'));
    const chance=ratingChance(rate('crit')-resist('critResist')),critical=chance>0&&rng()*100<chance;
    amount=Math.max(0,Math.round(amount*(critical?1.5:1)));
    const dealt=Math.min(positive(defender.qi),amount),heal=Math.min(Math.max(0,positive(attacker.maxQi)-positive(attacker.qi)),dealt,Math.floor(rate('lifesteal')));
    return {damage:dealt,heal,miss:false,critical};
  }
  function enemyProfile(raw,speed,baseSpeed=speed){
    const p=profile(raw),heavy=baseSpeed<100,swift=baseSpeed>=125;
    const health=heavy?1.15:swift?.85:1,armor=heavy?1.25:swift?.8:1;
    return {...p,maxQi:Math.max(1,Math.round(p.maxQi*health)),qi:Math.min(Math.max(1,Math.round(p.maxQi*health)),Math.ceil(p.qi*health)),
      attack:Math.round(p.attack*(heavy?1.1:1)),defense:Math.round(p.defense*armor),speed,archetype:heavy?'厚甲':swift?'迅捷':'均衡'};
  }
  class Timeline {
    constructor(){this.reset();}
    reset(){this.next={player:0,enemy:0};this.time=0;this.turn=0;this.events=[];this.pending=null;}
    act(player,enemy){
      const p=Math.max(1,player.speed),e=Math.max(1,enemy.speed);
      if(!this.turn){this.next.player=100/p;this.next.enemy=100/e;}
      const tie=Math.abs(this.next.player-this.next.enemy)<1e-9;
      const who=tie?'player':(this.next.player<this.next.enemy?'player':'enemy');
      this.time=this.next[who];this.next[who]+=100/(who==='player'?p:e);
      const attacker=who==='player'?player:enemy,defender=who==='player'?enemy:player;
      const result=strike(attacker,defender,damage(attacker.attack,defender.defense)),hit=result.damage;
      const event={seq:++this.turn,who,...result,damage:hit,time:this.time,lethal:hit>=defender.qi};
      this.events.push(event);if(this.events.length>24)this.events.shift();return event;
    }
    preview(playerSpeed,enemySpeed,count=6){
      const next={...this.next},result=[];
      if(!this.turn){next.player=100/Math.max(1,playerSpeed);next.enemy=100/Math.max(1,enemySpeed);}
      for(let i=0;i<count;i++){
        const tie=Math.abs(next.player-next.enemy)<1e-9;
        const who=tie?'player':(next.player<next.enemy?'player':'enemy');
        result.push(who);next[who]+=100/Math.max(1,who==='player'?playerSpeed:enemySpeed);
      }return result;
    }
  }
  const playerProfile=raw=>globalThis.MobileCultivationBalance?.profile(raw)??profile(raw);
  const api={version:1,profile,playerProfile,enemyProfile,growth,enemySpeed,damage,strike,Timeline};
  if(typeof module!=='undefined')module.exports=api;
  globalThis.MobileTurnCombat=api;
})();
