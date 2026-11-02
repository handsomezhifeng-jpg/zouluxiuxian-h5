/* Side turns share one authoritative clock. Damage resolves at contact, not cast. */
(()=>{'use strict';
const T=globalThis.MobileTactical||(typeof require==='function'?require('./tactical-model.js'):null),previous=T.restore;
const defs=[['hero','白衣剑修','hero','melee','front'],['ally1','青萝仙子','ally1','ranged','strongest'],['ally2','灵药仙子','ally2','ranged','weakest'],['enemy0','山魈','enemy1','melee','strongest'],['enemy1','影煞客','enemy2','melee','weakest'],['enemy2','苍山狼','enemy3','melee','rear']];
const copy=v=>JSON.parse(JSON.stringify(v));
class Battle3v3{
 constructor(o={}){
  const p=o.player||{qi:1000,maxQi:1000,attack:60,defense:20},e=o.enemy||{maxQi:1000,attack:30,defense:10};
  Object.assign(this,{version:3,combatStyle:'battle-b-3v3',executionMode:'timeline-v2',clockMs:0,seq:0,events:[],phase:'combat',runWave:1,round:1,turn:0,outcome:null,paused:false,playbackSpeed:1,enemyDamage:0,enemyTemplate:e,totalWaves:20,maxEnemyQi:Math.max(3,e.maxQi||e.qi||1000),loadout:T.normalizeLoadout(o.loadout),side:'hero',tasks:[],taskSerial:0,activation:0});
  this.units=defs.slice(0,3).map((d,i)=>({id:d[0],name:d[1],art:d[2],range:d[3],strategy:d[4],team:'hero',qi:i?Math.max(1,(p.maxQi||p.qi)*(.85+i*.05)):Math.max(1,p.qi),maxQi:i?Math.max(1,(p.maxQi||p.qi)*(.85+i*.05)):p.maxQi||p.qi,attack:(p.attack||1)*(i?.7:1),defense:(p.defense||0)*(i?.75:1),cooldowns:{},acts:0,skillCursor:0,loadout:i?[i===1?'waterdragon':'summon']:this.loadout}));
  this.spawnWave();this.beginSide('hero',0);
 }
 get hero(){return this.units[0]}
 get enemyQi(){return this.outcome==='victory'?0:Math.max(1,this.maxEnemyQi-this.enemyDamage)}
 add(type,at,data={}){this.tasks.push({type,at,order:++this.taskSerial,...data});this.tasks.sort((a,b)=>a.at-b.at||a.order-b.order)}
 spawnWave(){this.units=this.units.filter(u=>u.team==='hero');defs.slice(3).forEach((d,i)=>this.units.push({id:d[0],name:d[1],art:d[2],range:d[3],strategy:d[4],team:'enemy',qi:this.maxEnemyQi/3,maxQi:this.maxEnemyQi/3,attack:Math.max(1,(this.enemyTemplate.attack||30)*(.7+this.runWave*.015)),defense:this.enemyTemplate.defense||0,cooldowns:{},acts:0,skillCursor:0,loadout:[['array','sword','wind'][i]]}));}
 beginSide(side,at){this.side=side;const alive=this.units.filter(u=>u.team===side&&u.qi>0);alive.forEach((u,i)=>this.add('cast',at+i*100,{actor:u.id}));this.add('handoff',at+1800,{side});}
 syncPlayer(p){Object.assign(this.hero,{maxQi:p.maxQi,qi:Math.min(p.maxQi,Number.isFinite(p.qi)?p.qi:this.hero.qi),attack:p.attack,defense:p.defense})}
 command(c){if(c.type==='pause'){this.paused=!this.paused;return true}if(c.type==='speed'){this.playbackSpeed=[1,1.5,2].includes(c.speed)?c.speed:1;return true}return false}
 selectTarget(actor){const a=this.units.filter(u=>u.team!==actor.team&&u.qi>0);if(actor.strategy==='weakest')a.sort((x,y)=>x.qi/x.maxQi-y.qi/y.maxQi);if(actor.strategy==='strongest')a.sort((x,y)=>y.attack-x.attack);return actor.strategy==='rear'?a.at(-1):a[0]}
 chooseSkill(actor){actor.acts++;for(const k in actor.cooldowns)actor.cooldowns[k]=Math.max(0,actor.cooldowns[k]-1);if(actor.acts%2)return 'attack';const choices=actor.loadout||[];for(let i=0;i<choices.length;i++){const n=(actor.skillCursor+i)%choices.length,id=choices[n];if(!actor.cooldowns[id]){actor.skillCursor=(n+1)%choices.length;actor.cooldowns[id]=id==='summon'?3:2;return id}}return 'attack'}
 record(e){Object.assign(e,{seq:++this.seq,scheduledAtMs:this.clockMs,side:this.side,wave:this.runWave,round:this.round,outcome:this.outcome});this.events.push(e);if(this.events.length>64)this.events.shift();return e}
 idle(){return {actor:'scheduler',kind:'wait',skill:'attack',scheduledAtMs:this.clockMs,hits:[],path:[],outcome:this.outcome}}
 step(){
  if(this.outcome)return null;if(this.paused)return this.idle();const task=this.tasks.shift();if(!task)return null;this.clockMs=task.at;
  if(task.type==='handoff'){
   if(this.hero.qi<=0){this.outcome='defeat';this.reason='气血耗尽';this.tasks=[];return this.record({...this.idle(),kind:'end'})}
   if(!this.units.some(u=>u.team==='enemy'&&u.qi>0)){if(this.runWave>=this.totalWaves){this.outcome='victory';this.reason='二十波通关';this.tasks=[];return this.record({...this.idle(),kind:'end'})}this.runWave++;this.round++;this.spawnWave();this.beginSide('hero',this.clockMs+350);return this.record({...this.idle(),kind:'wave'})}
   const next=task.side==='hero'?'enemy':'hero';if(next==='hero')this.round++;this.beginSide(next,this.clockMs);return this.record({...this.idle(),kind:'side'})
  }
  const actor=this.units.find(u=>u.id===task.actor);
  if(task.type==='cast'){
   const target=actor?.qi>0?this.selectTarget(actor):null;if(!target)return this.idle();this.turn++;const skill=this.chooseSkill(actor),healing=skill==='summon';
   let targets;if(healing){targets=this.units.filter(u=>u.team===actor.team&&u.qi>0).sort((a,b)=>a.qi/a.maxQi-b.qi/b.maxQi).slice(0,1)}else targets=['waterdragon','array','wind','fireball'].includes(skill)?this.units.filter(u=>u.team!==actor.team&&u.qi>0):[target];
   const contactMs=650,range=actor.range,hits=targets.map(u=>({id:u.id,kind:healing?'heal':'damage',amount:0,pending:true}));
   const event=this.record({actor:actor.id,target:healing?targets[0].id:target.id,activationId:++this.activation,kind:'attack',skill,range,strategy:actor.strategy,durationMs:1500,contactMs,hits,path:[]});
   this.add('impact',this.clockMs+contactMs,{actor:actor.id,event:copy(event),power:Math.max(1,actor.attack||1)});return event;
  }
  if(task.type==='impact'){
   const cast=task.event,hits=[];
   for(const h of cast.hits){const victim=this.units.find(u=>u.id===h.id);if(!victim||victim.qi<=0)continue;let amount;
    if(h.kind==='heal'){amount=Math.min(victim.maxQi-victim.qi,Math.round(task.power*1.8));victim.qi+=amount}else{amount=Math.min(victim.qi,Math.max(1,Math.round(task.power*.8*(cast.skill==='attack'?1:cast.hits.length>1?.8:1.65)-(victim.defense||0)*.12)));victim.qi-=amount;if(victim.team==='enemy')this.enemyDamage+=amount/this.totalWaves}
    hits.push({id:victim.id,kind:h.kind,amount,dead:victim.qi<=0});
   }
   return this.record({actor:cast.actor,target:cast.target,activationId:cast.activationId,kind:'impact',skill:cast.skill,range:cast.range,hits,path:[]});
  }
  return this.idle();
 }
 nextDelayMs(){return this.paused?100:this.tasks.length?Math.max(0,this.tasks[0].at-this.clockMs):100}
 snapshot(){return copy({...this,enemyQi:this.enemyQi,hero:undefined})}
}
T.SurvivorBattle=Battle3v3;T.Battle3v3=Battle3v3;T.restore=function(s){if(s?.combatStyle!=='battle-b-3v3')return previous(s);if(s.outcome||s.version!==3||!Array.isArray(s.tasks)||!Array.isArray(s.units)||s.units.length!==6)return null;const d=copy(s);delete d.enemyQi;return Object.assign(Object.create(Battle3v3.prototype),d)};
if(typeof module!=='undefined')module.exports={Battle3v3};
})();
