/* Campaign progression; native settlement remains the sole owner of loot. */
(()=>{
 'use strict';
 const key='mobile-adventure-stages-v1';let data,catalog=[];
 try{data=JSON.parse(localStorage.getItem(key));}catch{}
 if(!data||!Number.isInteger(data.stage)||data.stage<1||!Number.isInteger(data.kills))data={stage:1,kills:0};
 data.kills=Math.max(0,Math.min(20,data.kills));data.mode=data.mode==='farm'?'farm':'push';data.farmStage=Math.max(1,Math.min(data.stage,Number(data.farmStage)||data.stage));data.farmWave=Math.max(0,Math.min(19,Number(data.farmWave)||0));
 // Migrate old whole-stage farming to the last confirmed winning encounter.
 if(data.version!==2&&data.mode==='farm'){data.farmStage=data.kills>0?data.stage:Math.max(1,data.stage-1);data.farmWave=data.kills>0?data.kills-1:data.stage>1?19:0;}
 data.version=2;
 let active=false,pending=false,observed=false,encounter=null,serial=0;
 const persist=()=>{try{localStorage.setItem(key,JSON.stringify(data));}catch{}};
 function config(stage){const anchor=catalog[Math.min(stage-1,catalog.length-1)];if(!anchor)return null;const region=catalog.filter(e=>e.region===anchor.region);const count=Math.min(region.length,2+(stage-1)%3);const start=region.findIndex(e=>e.id===anchor.id);return {anchor,roster:Array.from({length:count},(_,i)=>region[(start+i)%region.length])};}
 function make(boss=false){const stage=data.mode==='farm'?data.farmStage:data.stage,c=config(stage);if(!c)return null;const wave=data.mode==='farm'?data.farmWave:Math.min(19,data.kills);const species=boss?c.anchor:c.roster[wave%c.roster.length];const level=(stage-1)*5+1+(boss?5:Math.floor(wave/4));const factor=(1+wave*.055)*(1+(wave%c.roster.length)*.008);const stats={...c.anchor.stats};stats.maxQi=Math.round(stats.maxQi*factor*(boss?3:1));stats.qi=stats.maxQi;stats.attack=Math.round(stats.attack*factor*(boss?1.7:1));stats.defense=Math.round(stats.defense*factor*(boss?1.4:1));return {id:species.id,artId:species.artId,region:species.region,name:species.name+(boss?'首领':''),level,stage,wave,boss,stats,serial:++serial};}
 function snapshot(){const c=config(data.mode==='farm'?data.farmStage:data.stage);return {...data,required:20,bossReady:data.kills>=20,boss:Boolean(encounter?.boss),active,pending,observed,target:encounter?.id,encounter,roster:c?.roster.map(e=>({id:e.id,name:e.name}))??[],complete:catalog.length>0&&data.stage>catalog.length};}
 function begin(_id,action='continue'){if(action==='continue'){data.mode='push';}if(action==='boss'){data.mode='push';if(data.kills<20)return snapshot();}const boss=action==='boss';encounter=make(boss);active=Boolean(encounter);pending=false;observed=false;persist();return snapshot();}
 self.MobileAdventureStages={snapshot,configure(items){catalog=items;},config,observe(){observed=true;},begin,
 next(){encounter=make(false);active=Boolean(encounter);pending=false;observed=false;return snapshot();},
 ready:()=>!pending,
 stop(){active=false;pending=false;observed=false;},
 reset(){data={version:2,stage:1,kills:0,mode:'push',farmStage:1,farmWave:0,reincarnations:data.reincarnations};active=false;pending=false;observed=false;encounter=null;persist();},
 syncReincarnation(turns){if(!Number.isInteger(turns)||turns<0)return false;if(!Number.isInteger(data.reincarnations)){data.reincarnations=turns;persist();return false;}if(turns===data.reincarnations)return false;self.MobileAdventureStages.reset();data.reincarnations=turns;persist();return true;},
 victory(id){if(!active||pending||id!==encounter?.id)return;if(encounter.boss){data.stage++;data.kills=0;data.mode='push';}else if(data.mode==='farm'){/* Repeat the same cleared encounter until explicitly challenged. */}else{data.kills=Math.min(20,data.kills+1);if(data.kills===20){data.mode='farm';data.farmStage=data.stage;data.farmWave=19;}}pending=true;persist();},
 defeat(){if(!active||pending)return;if(data.mode!=='farm'){data.farmStage=data.kills>0?data.stage:Math.max(1,data.stage-1);data.farmWave=data.kills>0?data.kills-1:data.stage>1?19:0;}data.mode='farm';pending=true;persist();},
 scale(enemy){if(!active||!encounter)return enemy;return {...encounter.stats,qi:Math.max(0,Math.round(encounter.stats.maxQi*enemy.qi/Math.max(1,enemy.maxQi))),speed:enemy.speed};},
 preview(action){const saved={...data};if(action==='boss')data.mode='push';const e=make(action==='boss');data=saved;return e;}
 };
})();
