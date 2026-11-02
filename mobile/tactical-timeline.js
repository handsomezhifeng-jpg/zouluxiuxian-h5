/* Mixed presentation policy requested by the user: allied and boss acquisitions
 * finish before the action bar resumes; ordinary enemies may overlap.
 * Actor locks and hit formulas come from the APK;
 * the initiative-to-wall-time scale is an explicit project adapter because
 * the shipped client consumes server Step.Time and does not produce it.
 * Damage is resolved at impact, never when a cast is only being planned.
 */
(()=>{'use strict';
 const T=globalThis.MobileTactical||(typeof require==='function'?require('./tactical-model.js'):null);
 const S=globalThis.MobileTacticalSourceRules||(typeof require==='function'?require('./tactical-source-rules.js'):null);
 const M=globalThis.MobileTacticalMonsterSource||(typeof require==='function'?require('./tactical-monster-source.js'):null);
 const P=globalThis.MobileTacticalPathfinding||(typeof require==='function'?require('./tactical-pathfinding.js'):null);
 if(!T||!S)throw Error('Tactical source rules must load before the timeline');
 const Base=T.Battle,copy=v=>JSON.parse(JSON.stringify(v)),rawRestore=T.restore;
 const sourceIds=new Set([...Object.keys(S.skillCosts),'summon']);
 class TimelineBattle extends Base{
  constructor(options={}){
   super({...options,layout:options.layout??'scroll-v1'});this.executionMode='timeline-v2';this.executionPolicy='mixed-priority-v1';this.priorityGate=null;this.roundLimitMode=options.roundLimitMode||'global';this.maxRounds=options.maxRounds||30;this.clockMs=0;this.taskSerial=0;this.tasks=[];this.actors={};this.rngState=(Number(options.seed)>>>0)||1;
   this.configureSourceActors(options);
   this.initiativeMsScale=Number.isFinite(options.initiativeMsScale)?Math.max(.001,options.initiativeMsScale):.1;
   const first=Math.min(...this.units.map(u=>u.next));
   for(const u of this.units){u.lastReleaseRound=u===this.hero?{summon:-5}:{};if(u===this.hero&&options.initialCooldowns)for(const [id,cd] of Object.entries(options.initialCooldowns)){const sk=T.skills.find(s=>s.id===id);if(sk&&sourceIds.has(id))u.lastReleaseRound[id]=Math.max(0,Number(cd)||0)-sk.cd;}u.facing=u.facing===-1?-1:1;this.actors[u.id]={activation:null,startedAt:null};this.refreshCD(u,false);this.addTask('act',(u.next-first)*this.initiativeMsScale,{actor:u.id});}
  }
  configureSourceActors(options){
   this.hero.movementBudget=options.movementBudget??4;
   if(!M)return;
   // Source archetypes mapped to our existing art; these IDs are not claimed
   // to identify every unit visible in the supplied recording.
   for(const u of this.units.slice(1)){
    const template=M.byId[u.boss?3401:u.art==='blade'?3204:u.art==='caster'?3205:3203];
    u.sourceMonsterId=template.id;u.realCenter=copy(template.realCenter||{x:0,y:0});u.resourceMode='source-none';u.movementBudget=template.moveDist;u.skillDefinitions={};
    for(const data of template.skills){if(data.cooldown===null)continue;const id='npc-'+data.skillId;u.skillDefinitions[id]={id,sourceNpc:copy(data),cd:data.cooldown,range:Math.max(...data.sourceRangeCells.map(p=>Math.abs(p.x)+Math.abs(p.y))),apCost:0};}
    u.loadout=Object.keys(u.skillDefinitions);
    if(u.boss){
     u.footprint=copy(template.footprint);
     const occupied=new Set(this.occupied(u).map(p=>`${p.x},${p.y}`)),fits=p=>T.bodyCells({...u,...p}).every(c=>T.valid(this.grid,c)&&!occupied.has(`${c.x},${c.y}`));
     if(!fits(u)){const candidates=[];for(let y=0;y<this.grid.height;y++)for(let x=0;x<this.grid.width;x++){const p={x,y};if(fits(p))candidates.push(p);}candidates.sort((a,b)=>T.dist(a,{x:5,y:this.grid.layout==='scroll-v1'?20:8})-T.dist(b,{x:5,y:this.grid.layout==='scroll-v1'?20:8}));if(candidates.length)Object.assign(u,candidates[0]);else delete u.footprint;}
    }
   }
  }
  sourceCooldown(u,id){return sourceIds.has(id)||!!this.skill(u,id)?.sourceNpc;}
  random(){let x=this.rngState|0;x^=x<<13;x^=x>>>17;x^=x<<5;this.rngState=x>>>0;return this.rngState/4294967296;}
  isSerialActor(u){return !!u&&(u.team===this.hero.team||u.boss===true);}
  addTask(type,at,data={}){let due=Math.max(this.clockMs,Number(at)||0);if(type==='act'&&this.priorityGate&&data.actor!==this.priorityGate.actor)due=Math.max(due,this.priorityGate.until);const task={type,at:due,order:++this.taskSerial,...data};this.tasks.push(task);return task;}
  shiftOtherInitiatives(actor,delta){for(const task of this.tasks)if(task.type==='act'&&task.actor!==actor)task.at=Math.max(this.clockMs,task.at+delta);for(const [id,owner] of Object.entries(this.actors))if(id!==actor&&owner.activation&&owner.startedAt!==null)owner.startedAt+=delta;}
  holdPriority(u,event,duration){if(duration<=0)return;this.shiftOtherInitiatives(u.id,duration);this.priorityGate={actor:u.id,activationId:event.activationId,until:this.clockMs+duration};}
  releasePriority(aborted=false){const gate=this.priorityGate;if(!gate)return;if(aborted&&gate.until>this.clockMs)this.shiftOtherInitiatives(gate.actor,-(gate.until-this.clockMs));this.priorityGate=null;}
  refreshPriority(){const gate=this.priorityGate;if(!gate)return;const actor=this.units.find(u=>u.id===gate.actor);if(!actor||actor.qi<=0){this.releasePriority(true);return;}if(this.clockMs>=gate.until&&!this.actors[gate.actor]?.activation)this.releasePriority();}
  sortTasks(){this.refreshPriority();const gate=this.priorityGate;if(gate)for(const task of this.tasks)if(task.type==='act'&&task.actor!==gate.actor)task.at=Math.max(task.at,gate.until);this.tasks.sort((a,b)=>a.at-b.at||(a.type==='hit'?0:1)-(b.type==='hit'?0:1)||(gate?(a.actor===gate.actor?0:1)-(b.actor===gate.actor?0:1):0)||a.order-b.order);}
  nextDelayMs(){if(this.outcome||!this.tasks.length)return 16;this.sortTasks();return Math.max(0,this.tasks[0].at-this.clockMs);}
  period(u){return S.speedToTime(u.speed)*this.initiativeMsScale;}
  refreshCD(u,isDriving,round=u.acts){u.lastReleaseRound??={};for(const id of u.loadout||[]){if(!this.sourceCooldown(u,id))continue;const sk=this.skill(u,id);u.cooldowns[id]=Math.max(0,S.getSkillLeftCD({cd:sk.cd,lastRound:u.lastReleaseRound[id]??0,round,isDriving}));}}
  aim(u,sk){
   if(sk.id==='summon')return {target:u,center:u,targets:[u]};
   if(!sk.sourceNpc)return super.aim(u,sk);
   const data=sk.sourceNpc,cure=data.childHits?.some(h=>h.base.DamageActionType===5);
   if(cure){const target=this.units.filter(t=>t.team===u.team&&t.qi>0&&t.qi<t.maxQi&&T.bodyCells(t).some(p=>data.sourceRangeCells.some(o=>u.x+o.x===p.x&&u.y+o.y===p.y))).sort((a,b)=>a.qi/a.maxQi-b.qi/b.maxQi||a.id.localeCompare(b.id))[0];return target?{target,center:target,targets:[target]}:null;}
   if(data.selfArea){const cells=this.sourceScopeCells(u,data.childHits[0].Scope,{x:0,y:-1}),targets=this.targets(u).filter(t=>T.bodyCells(t).some(p=>cells.some(c=>c.x===p.x&&c.y===p.y)));return targets.length?{target:u,center:u,targets}:null;}
   if(data.sourcePrefixFields?.[2]===2){
    const occupied=new Set(this.occupied(u).map(p=>`${p.x},${p.y}`));let best=null;
    for(const offset of data.sourceRangeCells){const center={x:u.x+offset.x,y:u.y+offset.y};if(!T.bodyCells({...u,...center}).every(p=>T.valid(this.grid,p)&&!occupied.has(`${p.x},${p.y}`)))continue;const direction=this.direction(u,center),cells=(data.childHits||[]).flatMap(child=>this.sourceScopeCells(child.actOnSource===1?u:{...u,...center},child.Scope||[],direction)),targets=this.targets(u).filter(t=>T.bodyCells(t).some(p=>cells.some(c=>c.x===p.x&&c.y===p.y))),score=targets.length*100-T.dist(u,center);if(targets.length&&(!best||score>best.score))best={target:targets[0],center,targets,score};}
    return best;
   }
   // Target selection/rotation is a project adapter; the client exposes
   // range cells but not the server's complete skill-center selection.
   const legal=this.targets(u).filter(t=>T.bodyCells(t).some(p=>data.sourceRangeCells.some(o=>u.x+o.x===p.x&&u.y+o.y===p.y)&&T.los(this.grid,u,p)));
   const target=legal.sort((a,b)=>T.dist(u,a)-T.dist(u,b)||a.qi-b.qi)[0];return target?{target,center:target,targets:[target]}:null;
  }
  skillApproach(u,sk){
   if(this.aim(u,sk))return [];
   const target=this.chooseTarget(u);if(!target||!P)return null;
   const occupied=new Set(this.occupied(u).map(p=>`${p.x},${p.y}`)),checkEnd=p=>!!this.aim({...u,...p},sk);
   const route=P.findPath({start:u,end:target,bodyRanges:T.bodyCells(u).map(p=>({x:p.x-u.x,y:p.y-u.y})),canStand:p=>T.valid(this.grid,p)&&!occupied.has(`${p.x},${p.y}`),checkEnd,preferDistance:-1});
   return route?.length&&checkEnd(route.at(-1))?route:null;
  }
  sourceScopeCells(source,scope,direction){
   const d=direction,heading=d.x<0?2:d.x>0?3:d.y>0?1:0,center=source.realCenter||{x:0,y:0};
   return scope.map(s=>{const p=S.calcLocalToWorldPos(s.Pos,S.boardToSourceGrid(source),{x:center.x,y:-center.y},heading,false);return {x:p.x,y:-p.y};});
  }
  contacts(u,sk,aim){
   if(!['windshot','fireball'].includes(sk.id))return [];
   const source=S.boardToSourceGrid(u),target=S.boardToSourceGrid(aim.center||aim.target),flipX=S.calcFlipX(source,target,u.facing<0);
   const children=S.skillHitChildren.filter(c=>sk.id==='windshot'?c.id>=10511&&c.id<=10515:c.id===10801);
   return children.map((c,index)=>{const start=S.calcSkillStartPos(c,source,target,{flipX}),flightMs=S.calcSkillHitDelay(c,source,target,{flipX})*1000;return {index,childId:c.id,targetId:sk.id==='windshot'?aim.target.id:null,x:target.x,y:-target.y,from:{x:start.x,y:-start.y},launchMs:c.spawnSeconds*1000,delayMs:c.spawnSeconds*1000+flightMs,flightMs,pending:true};});
  }
  cast(u,sk,aim,event){
   const point=aim.center||aim.target,side=Math.sign(point.x-u.x);if(side)u.facing=side;
   if(sk.sourceNpc){this.castSourceNpc(u,sk,aim,event);u.lastReleaseRound??={};u.lastReleaseRound[sk.id]=u.acts;this.refreshCD(u,true);return;}
   event.projectiles=this.contacts(u,sk,aim);
   if(sk.id==='summon'){
    event.kind='guard';event.skill='summon';event.center={x:u.x,y:u.y};event.hits=[{id:u.id,x:u.x,y:u.y,kind:'shield',amount:0,pending:true,delayMs:S.sourceSummon.spawnDelayMs}];event.intents=[{actor:u.id,kind:'summon',delayMs:S.sourceSummon.spawnDelayMs}];u.cooldowns[sk.id]=sk.cd;
   }else if(sk.id==='fireball'||sk.id==='waterdragon'){
    event.kind='attack';event.skill=sk.id;event.element=sk.element;event.center={x:point.x,y:point.y};event.intents=[];
    const flat=Math.round(sk.reference.flat*Math.max(1,Math.min(29,u.skillLevel||1))/29);
    if(sk.id==='fireball'){
     const cells=[];for(let y=point.y-1;y<=point.y+1;y++)for(let x=point.x-1;x<=point.x+1;x++)if(T.valid(this.grid,{x,y}))cells.push({x,y});
     event.area=cells;event.intents.push({actor:u.id,kind:'damage',areaCells:cells,power:sk.reference.ratio,flat,delayMs:event.projectiles[0].delayMs});
    }else{
     event.area=copy(aim.cells);const d=this.direction(u,aim.target);
     for(let depth=1;depth<=4;depth++){const cells=aim.cells.filter(p=>(p.x-u.x)*d.x+(p.y-u.y)*d.y===depth);event.intents.push({actor:u.id,kind:'damage',areaCells:cells,power:sk.reference.ratio,flat,delayMs:750+(depth-1)*100,perCell:true,falloff:.25});}
    }
    for(const intent of event.intents)for(const t of this.targets(u).filter(t=>T.bodyCells(t).some(p=>intent.areaCells.some(c=>c.x===p.x&&c.y===p.y))))event.hits.push({id:t.id,x:t.x,y:t.y,kind:'damage',amount:0,pending:true,delayMs:intent.delayMs});
    u.cooldowns[sk.id]=sk.cd;
   }else if(sk.id==='guard'||sk.id==='heal'){
    event.kind=sk.id==='guard'?'guard':'heal';event.skill=sk.id;event.element='physical';event.center={x:u.x,y:u.y};const shield=sk.id==='guard',delayMs=shield?200:230;
    event.hits.push({id:u.id,x:u.x,y:u.y,kind:shield?'shield':'heal',amount:0,pending:true,delayMs});event.intents=[{actor:u.id,target:u.id,kind:shield?'shield':'heal',amount:Math.round(u.maxQi*(shield?.16:.15)),delayMs}];u.cooldowns[sk.id]=sk.cd;
   }else super.cast(u,sk,aim,event);
   if(sourceIds.has(sk.id)){u.lastReleaseRound??={};u.lastReleaseRound[sk.id]=u.acts;this.refreshCD(u,true);}
  }
  spawnSummon(owner,task){
   const cfg=S.sourceSummon;if(!cfg||owner.qi<=0)return null;
   const target=this.chooseTarget(owner),d=target?this.direction(owner,target):{x:0,y:-1},wanted={x:owner.x+d.x*2,y:owner.y+d.y*2},occupied=new Set(this.occupied().map(p=>`${p.x},${p.y}`)),spots=[];
   for(let y=0;y<this.grid.height;y++)for(let x=0;x<this.grid.width;x++){const p={x,y};if(T.valid(this.grid,p)&&!occupied.has(`${x},${y}`)&&T.dist(owner,p)<=4)spots.push(p);}spots.sort((a,b)=>T.dist(a,wanted)-T.dist(b,wanted)||T.dist(owner,a)-T.dist(owner,b)||a.y-b.y||a.x-b.x);if(!spots.length)return null;
   const inheritance=cfg.inheritanceRank1Level1,m=inheritance.multipliers,f=inheritance.fixedProps,maxQi=Math.max(1,(f[3]||0)+Math.trunc(owner.maxQi*m[3]));
   this.summonSerial=(this.summonSerial||0)+1;
   const pet={id:'pet-'+this.summonSerial,ownerId:owner.id,sourceMonsterId:3181,name:'树灵',team:owner.team,art:'golem',externalArt:'mobile/assets/tactical/court/tree-summon-v1.png',...spots[0],qi:maxQi,maxQi,attack:Math.max(1,Math.trunc(owner.attack*m[1])),defense:Math.max(0,Math.trunc(owner.defense*m[2])),speed:Math.max(1,Math.trunc(owner.speed*m[4])),next:task.logicTime??owner.next,acts:0,shield:0,statuses:[],cooldowns:{},lastReleaseRound:{},resourceMode:'source-none',movementBudget:cfg.moveDist,actionBudget:4,range:1,loadout:[],skillDefinitions:{},expiresAtOwnerRound:owner.acts+cfg.lifetime.durationRounds-1};
   for(const skill of cfg.skills){const id='pet-'+skill.skillId,data={skillId:skill.skillId,rootEntityId:skill.rootEntityId,sourceRangeCells:copy(skill.rangeScreen),coefficient:skill.attackCoefficient,cooldown:skill.cd,selfArea:skill.scopeReference==='self',childHits:[{...copy(skill.hit),creationDelay:skill.hitAtMs/1000,actOnSource:skill.scopeReference==='self'?1:0}],timing:{actionDuration:-1,allEndedActionDuration:skill.allEndedActionDurationMs/1000,duration:skill.visualDurationMs/1000}};pet.loadout.push(id);pet.skillDefinitions[id]={id,sourceNpc:data,range:1,cd:skill.cd,apCost:0};}
   this.units.push(pet);this.actors[pet.id]={activation:null,startedAt:null};this.refreshCD(pet,false);this.addTask('act',this.clockMs,{actor:pet.id});
   return this.record({actor:owner.id,from:task.from,kind:'spawn',skill:'summon',hits:[],path:[],spawnedId:pet.id,castSeq:task.castSeq,activationId:task.activationId,time:task.logicTime});
  }
  castSourceNpc(u,sk,aim,event){
   const data=sk.sourceNpc,target=aim.target,children=data.childHits||[],cure=children.some(c=>c.base.DamageActionType===5),timing=data.timing;
   event.kind=cure?'heal':'attack';event.skill=cure?'heal':u.art==='caster'?'bolt':u.boss?'heavy':'attack';event.logicalSkill=sk.id;event.sourceEntityId=data.rootEntityId;event.element='physical';event.center={x:(aim.center||target).x,y:(aim.center||target).y};event.intents=[];event.scopeSelection='project-oriented-source-scope';
   let lastImpact=0,moveEnd=0;
   for(const move of data.sourceMoves||[]){const delayMs=Math.max(0,move.Delay)*1000,durationMs=Math.max(0,move.behaviour?.moveDuration||0)*1000;moveEnd=Math.max(moveEnd,delayMs+durationMs);event.intents.push({actor:u.id,target:target.id,targetPoint:copy(aim.center),targetIsStandPos:data.sourcePrefixFields?.[2]===2,kind:'skill-move',delayMs,durationMs,sourceMove:copy(move)});}
   for(const child of children){
    const fromSource=child.actOnSource===1,point=aim.center||target,base=fromSource?u:{...u,...point},d=this.direction(u,point),scope=child.Scope||[],cells=this.sourceScopeCells(base,scope,d);
    const source=S.boardToSourceGrid(u),hitPos=S.boardToSourceGrid(point),flipX=S.calcFlipX(source,hitPos,u.facing<0);
    const spawnMs=Math.max(0,child.creationDelay||0)*1000,flightMs=S.calcSkillHitDelay(child,source,hitPos,{flipX})*1000,delayMs=spawnMs+flightMs;lastImpact=Math.max(lastImpact,delayMs);
    if(cure){event.intents.push({actor:u.id,target:target.id,kind:'heal',amount:Math.round(u.maxQi*data.coefficient),delayMs});event.hits.push({id:target.id,x:target.x,y:target.y,kind:'heal',amount:0,pending:true,delayMs});}
    else{
     const power=data.coefficient,eventTargets=this.targets(u).filter(t=>T.bodyCells(t).some(p=>cells.some(c=>c.x===p.x&&c.y===p.y)));
     event.area=cells;event.intents.push({actor:u.id,kind:'damage',areaCells:cells,scopeAnchor:fromSource?u.id:null,scopeLocal:scope,scopeDirection:d,power,flat:0,delayMs,childId:child.id});
     for(const t of eventTargets)event.hits.push({id:t.id,x:t.x,y:t.y,kind:'damage',amount:0,pending:true,delayMs});
    }
   }
   // Negative duration is the source's "all children ended" sentinel. The
   // local endpoint estimate is explicit until the server Step.Time is known.
   const fixed=timing?.actionDuration,post=timing?.allEndedActionDuration;
   const actionDurationMs=fixed>=0?fixed*1000:Math.max(lastImpact,moveEnd)+Math.max(0,post||0)*1000;
   event.timingOverride={windupMs:lastImpact,flightMs:0,recoveryMs:0,hitDelaysMs:[lastImpact],actionDurationMs:Math.max(16,actionDurationMs),effectDurationMs:Math.max(lastImpact+500,(timing?.duration||0)*1000),sourceEntityId:data.rootEntityId,timingMapping:fixed>=0?'apk-npc-action-duration':'apk-child-end-project-adapter'};
   u.cooldowns[sk.id]=sk.cd;
  }
  hit(actor,target,power,event,kind='damage',delayMs=null,flat=0){
   const index=(event.intents||[]).filter(h=>h.target===target.id&&h.kind===kind).length;
   const projectile=event.skill==='windshot'?event.projectiles?.[index]:event.skill==='fireball'?event.projectiles?.[0]:null;
   const p=T.presentation(event),delay=projectile?.delayMs??delayMs??p.hitDelaysMs?.[Math.min(index,p.hitDelaysMs.length-1)]??p.impactMs;
   event.intents??=[];event.intents.push({actor:actor.id,target:target.id,power,flat,kind,delayMs:delay,projectileIndex:projectile?.index});
   event.hits.push({id:target.id,x:target.x,y:target.y,amount:0,absorbed:0,kind,element:event.element||'physical',pending:true,dead:false,delayMs:delay,projectileIndex:projectile?.index});
  }
  resolveHit(task){
   const intent=task.intent,actor=this.units.find(u=>u.id===intent.actor);
   if(intent.kind==='summon')return actor?this.spawnSummon(actor,task):null;
   if(intent.kind==='expire-summon'){const pet=this.units.find(u=>u.id===intent.petId);if(!pet||pet.qi<=0)return null;pet.qi=0;pet.expired=true;this.tasks=this.tasks.filter(t=>t.type!=='act'||t.actor!==pet.id);if(this.actors[pet.id])this.actors[pet.id].activation=null;return this.record({actor:pet.id,from:{x:pet.x,y:pet.y},kind:'despawn',skill:'summon',hits:[],path:[],time:task.logicTime});}
   if(intent.kind==='skill-move'){
    if(!actor||actor.qi<=0)return null;
    const target=this.units.find(u=>u.id===intent.target&&u.qi>0);if(!target)return null;
    // The APK has the movement behaviour duration; server-selected Path is
    // absent. A legal approach path is the explicit local endpoint adapter.
    const route=intent.targetIsStandPos?T.path(this.grid,actor,intent.targetPoint,this.occupied(actor)):this.approach(actor,target,1),travel=route?.slice(0,intent.sourceMove.Distance>0?intent.sourceMove.Distance:route.length);if(!travel?.length)return null;
    const from={x:actor.x,y:actor.y};Object.assign(actor,travel.at(-1));return this.record({actor:actor.id,from,kind:'move',skill:task.skill,hits:[],path:travel,moveDurationMs:Math.max(1,intent.durationMs),sourceMoveBehaviourId:intent.sourceMove.MoveBehaviourId,source:'apk-skill-move-duration-project-endpoint',activationId:task.activationId,time:task.logicTime});
   }
   if(intent.areaCells&&actor){
    if(intent.scopeAnchor)intent.areaCells=this.sourceScopeCells(actor,intent.scopeLocal,intent.scopeDirection);
    const targets=this.targets(actor).filter(u=>T.bodyCells(u).some(p=>intent.areaCells.some(c=>c.x===p.x&&c.y===p.y))),event={actor:actor.id,from:task.from,kind:'impact',skill:task.skill,element:task.element,hits:[],path:[],castSeq:task.castSeq,castAtMs:task.castAtMs,activationId:task.activationId,time:task.logicTime};
    const leech=actor.lifesteal;if(actor.qi<=0)actor.lifesteal=0;
    this.areaHitCounts??={};const counts=this.areaHitCounts[task.castSeq]??={};
    for(const target of targets){const cells=T.bodyCells(target).filter(p=>intent.areaCells.some(c=>c.x===p.x&&c.y===p.y)),hits=intent.perCell?cells:[target];for(const cell of hits){if(target.qi<=0)break;const index=counts[target.id]||0,factor=intent.falloff?Math.pow(1-intent.falloff,index):1;Base.prototype.hit.call(this,actor,target,intent.power*factor,event,'damage',0,Math.round((intent.flat||0)*factor));const h=event.hits.findLast(h=>h.id===target.id&&h.kind==='damage');if(h&&intent.perCell){h.x=cell.x;h.y=cell.y;}counts[target.id]=index+1;}}actor.lifesteal=leech;
    for(const h of event.hits)h.originalDelayMs=intent.delayMs;
    this.check();return this.record(event);
   }
   const target=this.units.find(u=>u.id===intent.target);
   if(!actor||!target||target.qi<=0)return null;
   const event={actor:actor.id,from:task.from,kind:'impact',skill:task.skill,element:task.element,hits:[],path:[],castSeq:task.castSeq,castAtMs:task.castAtMs,activationId:task.activationId,time:task.logicTime};
   if(intent.kind==='shield'){target.shield=intent.amount;target.guardUntil=target.acts+3;event.hits.push({id:target.id,x:target.x,y:target.y,amount:target.shield,kind:'shield',delayMs:0});}
   else if(intent.kind==='heal'){const amount=Math.max(0,Math.min(target.maxQi-target.qi,intent.amount));target.qi+=amount;event.hits.push({id:target.id,x:target.x,y:target.y,amount,kind:'heal',delayMs:0});}
   else{
    const leech=actor.lifesteal;if(actor.qi<=0)actor.lifesteal=0;
    Base.prototype.hit.call(this,actor,target,intent.power,event,intent.kind,0,intent.flat);actor.lifesteal=leech;
    for(const h of event.hits){h.originalDelayMs=intent.delayMs;h.projectileIndex=intent.projectileIndex;}
    if(intent.burn&&target.qi>0)target.statuses=[copy(intent.burn)];
   }
   this.check();return this.record(event);
  }
  plan(task){
   const u=this.units.find(u=>u.id===task.actor&&u.qi>0);if(!u)return null;
   const owner=this.actors[u.id]??={activation:null,startedAt:null},fresh=!owner.activation;
   this.activation=owner.activation;
   if(fresh){owner.startedAt=this.clockMs;this.refreshCD(u,true,u.acts+1);if(u.acts>0)for(const id of u.loadout||[])if(this.sourceCooldown(u,id))u.cooldowns[id]++;}
   // Only force the chosen actor during the legacy decision function. Its
   // complete acquisition stays local; other actors' clocks are never reset.
   const nexts=new Map(this.units.filter(v=>v!==u).map(v=>[v.id,v.next]));
   if(fresh)for(const v of this.units)if(v!==u)v.next=Infinity;
   if(owner.activation)this.time=owner.logicTime;
   const priorStatuses=new Map(this.units.map(v=>[v.id,copy(v.statuses)]));let event;
   try{event=Base.prototype.step.call(this);}finally{for(const v of this.units)if(nexts.has(v.id))v.next=nexts.get(v.id);}
   if(!event){this.activation=null;return null;}
   owner.logicTime=event.time;
   // Boss status side effects belong to the eventual hit, not cast creation.
   if(event.kind==='attack'&&event.intents?.length)for(const v of this.units){const before=priorStatuses.get(v.id)||[];if(JSON.stringify(before)!==JSON.stringify(v.statuses)&&v!==u){const burn=v.statuses.find(s=>s.kind==='burn');if(burn){const first=event.intents.find(i=>i.target===v.id);if(first)first.burn=copy(burn);v.statuses=before;}}}
   owner.activation=this.activation;this.activation=null;
   const timing=T.presentation(event),serial=this.isSerialActor(u),normalLock=event.kind==='move'?timing.moveMs:event.kind==='wait'?0:timing.actionDurationMs??timing.durationMs;
   const contacts=(event.intents||[]).map(i=>(i.delayMs||0)+(i.kind==='skill-move'?(i.durationMs||0):16));
   const lock=serial&&event.kind!=='wait'?Math.max(normalLock,event.kind==='move'?0:timing.visualDurationMs||0,...contacts):normalLock;
   event.scheduledAtMs=this.clockMs;event.actionLockMs=lock;event.exclusivePresentation=serial;event.presentationEndMs=this.clockMs+lock;
   if(serial)this.holdPriority(u,event,lock);
   if(event.path.length){const side=Math.sign(event.path.at(-1).x-event.from.x);if(side)u.facing=side;}
   for(const intent of event.intents||[])this.addTask('hit',this.clockMs+intent.delayMs,{intent:copy(intent),from:copy(event.from),skill:event.skill,element:event.element,castSeq:event.seq,castAtMs:this.clockMs,activationId:event.activationId,logicTime:event.time});
   if(owner.activation)this.addTask('act',this.clockMs+lock,{actor:u.id});
   else{this.refreshCD(u,false);for(const pet of this.units.filter(p=>p.ownerId===u.id&&p.qi>0&&u.acts>=p.expiresAtOwnerRound))this.addTask('hit',this.clockMs+lock,{intent:{actor:u.id,kind:'expire-summon',petId:pet.id},logicTime:event.time});owner.startedAt??=this.clockMs;this.addTask('act',serial?this.clockMs+lock+this.period(u):Math.max(this.clockMs+lock,owner.startedAt+this.period(u)),{actor:u.id});}
   return event;
  }
  step(){
   if(this.outcome)return null;
   if(!this.tasks.length){this.check();return null;}this.sortTasks();const task=this.tasks.shift();this.clockMs=task.at;this.refreshPriority();
   const event=(task.type==='hit'?this.resolveHit(task):this.plan(task))||this.record({actor:'scheduler',kind:'wait',skill:'attack',hits:[],path:[],time:this.time});
   event.scheduledAtMs=this.clockMs;return event;
  }
  queue(count=8){if(!this.tasks)return super.queue(count);const entries=this.tasks.filter(t=>t.type==='act'&&!this.actors[t.actor]?.activation&&this.units.some(u=>u.id===t.actor&&u.qi>0)).map(t=>({id:t.actor,at:t.at,order:t.order})),out=(this.priorityGate?.actor||this.lastActing)&&this.units.some(u=>u.id===(this.priorityGate?.actor||this.lastActing)&&u.qi>0)?[this.priorityGate?.actor||this.lastActing]:[];for(let i=out.length;i<count&&entries.length;i++){entries.sort((a,b)=>a.at-b.at||a.order-b.order);const next=entries[0],u=this.units.find(u=>u.id===next.id);out.push(next.id);next.at+=this.period(u);}return out;}
  record(e){e.seq=++this.seq;e.time??=this.time;e.round=Math.max(1,this.round);e.outcome=this.outcome;this.events.push(e);if(this.events.length>128)this.events.shift();return e;}
  check(){this.refreshPriority();if(this.hero&&this.hero.qi<=0){this.outcome='defeat';this.reason='气血耗尽';}else super.check();}
  snapshot(){
   const current=this.activation;this.activation=this.actors?.[this.lastActing]?.activation||null;const value=super.snapshot();this.activation=current;
   return {...value,executionPolicy:this.executionPolicy,priorityGate:copy(this.priorityGate||null),summonSerial:this.summonSerial||0,areaHitCounts:copy(this.areaHitCounts||{}),roundLimitMode:this.roundLimitMode,maxRounds:this.maxRounds,executionMode:this.executionMode,clockMs:this.clockMs,taskSerial:this.taskSerial,tasks:copy(this.tasks),actors:copy(this.actors),rngState:this.rngState,initiativeMsScale:this.initiativeMsScale};
  }
 }
 function restore(s){
  if(s?.executionMode!=='timeline-v2')return rawRestore(s);
  const base=rawRestore({...s,activation:null});if(!base||!Number.isFinite(s.clockMs)||!Array.isArray(s.tasks)||s.tasks.length>1024||!s.actors)return null;
  if(s.tasks.some(t=>!Number.isFinite(t.at)||t.at<s.clockMs||!['act','hit'].includes(t.type)))return null;
  Object.setPrototypeOf(base,TimelineBattle.prototype);base.clockMs=s.clockMs;base.tasks=copy(s.tasks);base.actors=copy(s.actors);base.activation=null;base.executionMode='timeline-v2';base.executionPolicy='mixed-priority-v1';base.priorityGate=s.priorityGate&&Number.isFinite(s.priorityGate.until)&&s.priorityGate.until>=s.clockMs&&base.units.some(u=>u.id===s.priorityGate.actor)?copy(s.priorityGate):null;base.roundLimitMode=s.roundLimitMode||'global';base.maxRounds=s.maxRounds||30;base.taskSerial=s.taskSerial||0;base.rngState=(s.rngState>>>0)||1;base.initiativeMsScale=Number(s.initiativeMsScale)||.1;return base;
 }
 T.TimelineBattle=TimelineBattle;T.restore=restore;
 if(typeof module!=='undefined')module.exports={TimelineBattle,restore};
})();
