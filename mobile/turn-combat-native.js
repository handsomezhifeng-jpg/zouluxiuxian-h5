/* Installed in the native expression table. Native SubVar and victory branches
 * own HP, death, loot, quests and saves; this supplies one ordered action. */
(()=>{
  'use strict';
  const M=self.MobileTurnCombat,sessions=new Map(),history=new Map(),diagnostics=new Map(),finished=new Map();let serial=0,lastSlot=null;
  const now=()=>typeof self.performance?.now==='function'?self.performance.timeOrigin+self.performance.now():Date.now();
  // Construct caches Every_seconds before the action changes its interval. Refresh
  // only this combat condition to avoid a one-action-late waiting duration.
  function syncEvery(seconds){try{const r=self.c3_runtimeInterface?._GetLocalRuntime?.(),c=r?.GetCurrentCondition?.(),saved=c?.GetSavedDataMap?.();if(saved)saved.set('Every_seconds',seconds);}catch{}return seconds;}
  function publish(mode){if(typeof self.queueMicrotask!=='function')return;const value=snapshot(mode);self.queueMicrotask(()=>{try{const host=self.parent;if(host&&host!==self&&typeof host.dispatchEvent==='function')host.dispatchEvent(new host.CustomEvent('mobile-tactical-step',{detail:{mode,value}}));}catch{}});}
  const reset=mode=>{const s=sessions.get(mode);if(s?.last&&s.timeline){const events=history.get(mode)??[];events.push(...s.timeline.events.map(e=>({...e,session:s.session})));history.set(mode,events.slice(-24));}if(s?.tactical){history.delete(mode);if(s.tactical.outcome)finished.set(mode,{session:s.session,turn:s.tactical.seq,events:[],order:[],tactical:s.tactical.snapshot()});}sessions.delete(mode);};
  function install(expressions){
    if(expressions.length!==9879)throw Error('Turn combat expression table mismatch');
    for(const spec of self.MobileTurnNativeSpecs){
      expressions.push(p=>{
        const node=i=>p._GetNode(i),value=i=>node(i).GetVar().GetValue(),at=i=>(x,y)=>node(i).ExpObject(x,y);
        if(spec.type==='thunderInterval')return()=>1.4;
        if(spec.type==='thunderIncoming')return()=>self.MobileThunder.incoming();
        if(spec.type==='thunderStep')return()=>self.MobileThunder.step({qi:value(0),maxQi:value(1),defense:value(2),target:value(3),remaining:value(4),power:Number(at(5)(value(3),2))*Number(node(6).GetBoundMethod()(''))});
        if(spec.type==='interval')return()=>{const s=sessions.get(spec.mode);if(!s)return syncEvery(.6);if(s.tactical)return syncEvery(s.interval??.43);const gap=Math.min(s.timeline.next.player,s.timeline.next.enemy)-s.timeline.time;return s.interval=Math.max(.45,Math.min(1.2,gap*.9));};
        if(spec.type==='elapsed')return()=>sessions.get(spec.mode)?.interval??.6;
        if(spec.type==='reset'){
          const old=spec.originalNodes?expressions[spec.original](p):expressions[spec.original];return()=>{reset(spec.mode);return old();};
        }
        if(spec.type==='growth')return()=>{
          const save=at(0),svlz=at(1),wp=at(2),lw=at(3),df=at(4);
          let spirit=0;const capacity=Math.max(0,Math.min(25,df(value(6),11)));
          for(let slot=1;slot<=capacity;slot++){
            const id=svlz(slot,0);if(id>0)spirit+=Math.max(0,Number(lw(wp(id,4),3))*Number(svlz(slot,2))/100);
          }
          return M.growth(value(5),save,spirit).total;
        };
        if(spec.type==='challengeStat'){const fn=node(2).GetBoundMethod();return()=>at(0)(value(1),spec.column)*fn('');}
        if(spec.type==='adventureDefense'){const fn=node(0).GetBoundMethod();return()=>fn(value(1),false);}
        if(spec.type==='adventureStat'){const fn=node(0).GetBoundMethod();return()=>fn(value(1));}
        if(spec.type==='talisman'){const fn=node(0).GetBoundMethod();return()=>fn('历练');}
        if(spec.type==='enemySpeed')return()=>{
          const id=value(1),table=at(0),save=at(3),level=value(2);
          const tier=spec.mode==='adventure'?table(id,3):Math.floor(Math.max(0,level-1)/30)+1;
          const name=['adventure','challenge','capture'].includes(spec.mode)?String(table(id,1)):'';
          return M.enemySpeed(name,id,spec.base?1:tier,!spec.base&&spec.mode==='adventure'?Number(save(id,28)):0);
        };
        if(spec.type==='receive')return()=>sessions.get(spec.mode)?.incoming??0;
        if(spec.type==='step'){
          const fields=Object.fromEntries(Object.entries(spec.fields).map(([key,b])=>[key,expressions[b.index]({_GetNode:i=>p._GetNode(b.offset+i)})]));
          return()=>{
            if(spec.mode==='adventure'&&((self.MobileBattleRewards&&!self.MobileBattleRewards.ready())||self.MobileAdventureStages?.ready()===false)){const s=sessions.get(spec.mode);if(s)s.incoming=0;return 0;}
            const raw=Object.fromEntries(Object.entries(fields).map(([key,run])=>[key,run()]));
            diagnostics.set(spec.mode,{...raw});
            if(lastSlot!==raw.slot){sessions.clear();history.clear();finished.clear();lastSlot=raw.slot;}
            const basicPlayer={...M.playerProfile({qi:raw.playerQi,maxQi:raw.playerMax,attack:raw.playerAttack,defense:raw.playerDefense}),speed:raw.speed};
            const player=self.MobileEquipmentCombat?.apply(basicPlayer)??basicPlayer;
            let enemy=M.enemyProfile({qi:raw.enemyQi,maxQi:raw.enemyMax,attack:raw.enemyAttack,defense:raw.enemyDefense},raw.enemySpeed,raw.enemyBaseSpeed);
            if(spec.mode==='adventure')enemy=self.MobileAdventureStages?.scale(enemy)??enemy;
            if(!(player.qi>0&&enemy.qi>0)){const s=sessions.get(spec.mode);if(s)s.incoming=0;return 0;}
            if(self.MobileTactical){
              const encounter=spec.mode==='adventure'?self.MobileAdventureStages?.snapshot()?.encounter:null;
              const key=`${raw.slot}:${raw.id}:${encounter?.serial??0}`;let s=sessions.get(spec.mode);
              if(!s||s.key!==key){const saved=spec.mode==='adventure'?self.MobileTacticalSaved:null;let restored=null;if(saved&&saved.slot===raw.slot&&saved.enemyId===raw.id&&saved.state?.stage===(encounter?.stage??1)&&saved.state?.wave===(encounter?.wave??0)&&Math.abs(saved.playerRaw-raw.playerQi)<=1&&(Math.abs(saved.enemyRaw-raw.enemyQi)<=1||raw.enemyQi===raw.enemyMax))restored=self.MobileTactical.restore(saved.state);if(restored&&self.MobileTactical.SurvivorBattle&&!['jianghu-run-v1','battle-b-3v3'].includes(restored.combatStyle))restored=null;s={key,session:++serial,incoming:0,restored:!!restored,tactical:restored??new (self.MobileTactical.SurvivorBattle||self.MobileTactical.TimelineBattle||self.MobileTactical.Battle)({player,enemy,seed:(Math.floor(now())^raw.slot^(encounter?.serial||0))>>>0,stage:encounter?.stage??Math.min(20,Math.floor((raw.level||1)/5)+1),wave:encounter?.wave??0,boss:encounter?.boss??false,spawn:spec.mode==='adventure'?self.MobileTacticalSpawn:null,unitCount:spec.mode==='adventure'?null:1,loadout:self.MobileTactical.loadoutForSlot(raw.slot,self.localStorage)})};if(restored&&self.localStorage?.getItem(self.MobileTactical.loadoutKey(raw.slot))){restored.hero.loadout=[...new Set([...self.MobileTactical.loadoutForSlot(raw.slot,self.localStorage),...self.MobileTactical.defaultLoadout])].slice(0,4);if(restored.levels)for(const id of restored.hero.loadout)restored.levels[id]??=1;}if(spec.mode==='adventure')self.MobileTacticalSaved=null;sessions.set(spec.mode,s);}
              self.MobileEquipmentCombat?.start(encounter??s,raw.slot);
              // A native round-trip uses integer HP. Recompressing the same ceil'd
              // value every move/cast would manufacture health without a heal.
              const unchanged=s.expectedPlayerRaw!==undefined&&Math.abs(raw.playerQi-s.expectedPlayerRaw)<=1&&raw.playerMax===s.expectedPlayerMax&&player.maxQi===s.tactical.hero.maxQi;
              s.tactical.syncPlayer({...player,qi:unchanged?s.tactical.hero.qi:player.qi,attack:player.attack*Math.max(1,Number(raw.talisman)||1)});
              const beforePlayerQi=s.tactical.hero.qi;let event,skippedWaits=0;
              if(s.tactical.combatStyle==='battle-b-3v3'&&s.tactical.version===3){
                // The side scheduler owns contact events and can freeze without
                // accumulating a wall-clock backlog while paused.
                let dispatched=0;
                do{event=s.tactical.step();if(event)event.playback={atMs:now(),advanceMs:s.tactical.nextDelayMs(),visualDurationMs:event.durationMs||0};dispatched++;}while(!s.tactical.outcome&&!s.tactical.paused&&s.tactical.nextDelayMs()<=.001&&dispatched<16);
                s.interval=Math.max(.016,s.tactical.nextDelayMs()/1000/(s.tactical.playbackSpeed||1));
              }else if(s.tactical.executionMode==='timeline-v2'){
                s.timelineEpoch??=now()-s.tactical.clockMs;let dispatched=0;
                do{event=s.tactical.step();if(event){const timing=self.MobileTactical.presentation(event);event.playback={atMs:s.timelineEpoch+event.scheduledAtMs,advanceMs:s.tactical.nextDelayMs(),visualDurationMs:timing.visualDurationMs??timing.durationMs,skippedWaits:0};}dispatched++;}while(!s.tactical.outcome&&s.tactical.nextDelayMs()<=.001&&dispatched<64);
                s.interval=Math.max(0,(s.timelineEpoch+s.tactical.clockMs+s.tactical.nextDelayMs()-now())/1000);
              }else{
                do{event=s.tactical.step();if(event?.kind!=='wait'||event.hits.length||event.outcome)break;skippedWaits++;}while(skippedWaits<16);const timing=self.MobileTactical.presentation(event);s.interval=(timing.advanceMs??timing.durationMs)/1000;if(event)event.playback={atMs:now(),advanceMs:timing.advanceMs??timing.durationMs,visualDurationMs:timing.visualDurationMs??timing.durationMs,skippedWaits};
              }
              s.player=player;s.enemy=enemy;
              s.last=event?{...event,who:event.actor==='hero'?'player':'enemy',damage:event.hits.reduce((n,h)=>n+(h.kind==='damage'?h.amount:0),0),session:s.session,lethal:!!event.outcome}:s.last;
              publish(spec.mode);
              // Project aggregate depletion into the old native settlement channel.
              // Target HP (not rounded per-hit deltas) prevents accumulated rounding kills.
              const targetEnemy=s.tactical.outcome==='victory'?0:Math.max(1,Math.ceil(raw.enemyMax*s.tactical.enemyQi/s.tactical.maxEnemyQi));
              const targetPlayer=s.tactical.outcome==='defeat'?0:s.tactical.hero.qi===beforePlayerQi?raw.playerQi:Math.max(s.tactical.combatStyle==='battle-b-3v3'?1:0,Math.ceil(raw.playerMax*s.tactical.hero.qi/s.tactical.hero.maxQi));
              s.incoming=raw.playerQi-targetPlayer;s.expectedPlayerRaw=targetPlayer;s.expectedPlayerMax=raw.playerMax;
              if(spec.mode==='adventure'&&s.tactical.outcome==='defeat'){self.MobileBattleRewards?.settle('',false);self.MobileAdventureStages?.defeat();}
              return Math.max(0,Math.min(raw.enemyQi,raw.enemyQi-targetEnemy));
            }
            const key=`${raw.slot}:${raw.id}`;
            let s=sessions.get(spec.mode);
            if(!s||s.key!==key){s={key,session:++serial,timeline:new M.Timeline(),incoming:0};sessions.set(spec.mode,s);}
            self.MobileEquipmentCombat?.start(spec.mode==='adventure'?(self.MobileAdventureStages?.snapshot()?.encounter??s):s,raw.slot);
            // Talisman modifies the actual outgoing attack, before armor mitigation.
            player.attack*=Math.max(1,Number(raw.talisman)||1);
            const hit=s.timeline.act(player,enemy);s.player=player;s.enemy=enemy;s.incoming=0;
            s.last={...hit,session:s.session};
            if(spec.mode==='adventure'&&hit.lethal&&hit.who==='enemy'){self.MobileBattleRewards?.settle('',false);self.MobileAdventureStages?.defeat();}
            const rawDamage=hit.who==='player'?Math.min(raw.enemyQi,Math.ceil(hit.damage*raw.enemyMax/Math.max(1,enemy.maxQi))):0;
            if(hit.who==='player'&&hit.heal)s.incoming=-Math.floor(hit.heal*raw.playerMax/Math.max(1,player.maxQi));
            if(hit.who==='enemy')s.incoming=Math.min(raw.playerQi,Math.ceil(hit.damage*raw.playerMax/Math.max(1,player.maxQi)));
            return rawDamage;
          };
        }
        throw Error('Unknown turn expression: '+spec.type);
      });
    }
  }
  function snapshot(mode,slot){
    if(slot!==undefined&&slot!==lastSlot)return null;
    const s=sessions.get(mode);if(!s){if(finished.has(mode))return finished.get(mode);const events=history.get(mode);return events?.length?{events,last:events.at(-1),turn:0,order:[]}:null;}
    if(s.tactical)return {session:s.session,turn:s.tactical.seq,last:s.last,events:[],playerSpeed:s.player?.speed,enemySpeed:s.enemy?.speed,order:[],restored:s.restored,tactical:s.tactical.snapshot()};
    return {session:s.session,turn:s.timeline.turn,last:s.last,events:[...(history.get(mode)??[]),...s.timeline.events.map(e=>({...e,session:s.session}))].slice(-24),
      playerSpeed:s.player.speed,enemySpeed:s.enemy.speed,order:s.timeline.preview(s.player.speed,s.enemy.speed)};
  }
  self.MobileTurnNative={install,snapshot,reset,command(mode,c){const result=sessions.get(mode)?.tactical?.command(c)??false;if(result)publish(mode);return result;},clear(){sessions.clear();history.clear();finished.clear();diagnostics.clear();lastSlot=null;},diagnostics:mode=>diagnostics.get(mode)??null};
})();

