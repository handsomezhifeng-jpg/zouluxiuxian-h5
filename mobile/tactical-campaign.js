/* Slot-scoped 20x20 campaign. Legacy v2 is backed up and imported once only. */
(()=>{'use strict';
 let catalog=[],slot=null,data=null,active=false,pending=false,observed=false,encounter=null,serial=0;
 const legacyKey='mobile-adventure-stages-v1',ownerKey='mobile-tactical-legacy-owner',prefix='mobile-tactical-campaign-v1:';
 const fresh=()=>({version:3,stage:1,kills:0,mode:'push',farmStage:1,farmWave:0});
 const read=k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return null;}};
 const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
 const persist=()=>{if(slot!==null&&data)put(prefix+slot,data);};
 function normalize(d){const n={...fresh(),...d,version:3};n.stage=Math.max(1,Math.floor(Number(n.stage)||1));n.kills=Math.max(0,Math.min(19,Math.floor(Number(n.kills)||0)));n.mode=n.mode==='farm'?'farm':'push';n.farmStage=Math.max(1,Math.min(n.stage,Math.floor(Number(n.farmStage)||n.stage)));n.farmWave=Math.max(0,Math.min(18,Math.floor(Number(n.farmWave)||0)));return n;}
 function selectSlot(next){if(!Number.isInteger(next)||next<0||next===slot)return;slot=next;const saved=read(prefix+slot);if(saved)data=normalize(saved);else{const legacy=read(legacyKey),owner=read(ownerKey);if(legacy&&(owner===null||owner===slot)){if(owner===null){put(ownerKey,slot);put('mobile-tactical-legacy-backup',legacy);}data=normalize(legacy);data.migratedFrom='adventure-v2';}else data=fresh();persist();}active=false;pending=false;observed=false;encounter=null;}
 function config(stage){const anchor=catalog[Math.min(stage-1,catalog.length-1)];if(!anchor)return null;return {anchor,roster:catalog.filter(e=>e.region===anchor.region).slice(0,3)};}
 function make(boss=false){if(!data||data.stage>20)return null;const stage=data.mode==='farm'?data.farmStage:data.stage,c=config(stage);if(!c)return null;const wave=boss?19:data.mode==='farm'?data.farmWave:Math.min(18,data.kills),species=c.roster[wave%Math.max(1,c.roster.length)]??c.anchor;const stats={...c.anchor.stats},factor=1+wave*.035;stats.maxQi=Math.max(1,Math.round(stats.maxQi*factor*(boss?1.65:1)));stats.qi=stats.maxQi;stats.attack=Math.max(1,Math.round(stats.attack*factor*(boss?1.12:1)));stats.defense=Math.max(0,Math.round(stats.defense*factor));return {id:species.id,artId:species.artId,region:species.region,name:boss?self.MobileTactical.bosses[stage-1]:species.name,level:(stage-1)*5+1+Math.floor(wave/4),stage,wave,boss,stats,serial:++serial};}
 function snapshot(){return {...(data??fresh()),required:20,bossReady:(data?.kills??0)>=19,boss:!!encounter?.boss,active,pending,observed,encounter,target:encounter?.id,roster:[],complete:!!data&&data.stage>20};}
 function begin(_id,action='continue'){if(!data)return snapshot();if(action==='boss'&&data.kills<19)return snapshot();if(action!=='farm')data.mode='push';const boss=action==='boss'||data.mode==='push'&&data.kills>=19;encounter=make(boss);active=!!encounter;pending=false;observed=false;persist();return snapshot();}
 self.MobileAdventureStages={selectSlot,snapshot,configure(items){catalog=items;},config,observe(){observed=true;},begin,preview(action){if(!data)return null;const copy={...data};if(action==='boss')data.mode='push';const e=make(action==='boss'||data.mode==='push'&&data.kills>=19);data=copy;return e;},
 next(){encounter=make(data.mode==='push'&&data.kills>=19);active=!!encounter;pending=false;observed=false;return snapshot();},ready:()=>!pending,
 stop(){active=false;pending=false;observed=false;persist();},
 reset(){data={...fresh(),reincarnations:data?.reincarnations};active=false;pending=false;observed=false;encounter=null;persist();},
 syncReincarnation(n){if(!data||!Number.isInteger(n)||n<0)return false;if(!Number.isInteger(data.reincarnations)){data.reincarnations=n;persist();return false;}if(data.reincarnations===n)return false;this.reset();data.reincarnations=n;persist();return true;},
 victory(id){if(!active||pending||id!==encounter?.id)return;if(encounter.boss){data.stage++;data.kills=0;data.mode='push';}else if(data.mode!=='farm'){data.kills=Math.min(19,data.kills+1);if(data.kills>=19){data.mode='farm';data.farmStage=data.stage;data.farmWave=18;}}pending=true;persist();},
 defeat(){if(!active||pending)return;if(data.mode!=='farm'){data.farmStage=data.kills>0?data.stage:Math.max(1,data.stage-1);data.farmWave=data.kills>0?data.kills-1:data.stage>1?18:0;}data.mode='farm';pending=true;persist();},
 scale(enemy){if(!active||!encounter)return enemy;return {...encounter.stats,qi:Math.max(0,Math.round(encounter.stats.maxQi*enemy.qi/Math.max(1,enemy.maxQi))),speed:enemy.speed};}
 };
})();
