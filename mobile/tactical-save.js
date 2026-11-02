/* Tactical checkpoint is committed alongside the original slot save, not per UI tick. */
(()=>{'use strict';
 const P=window.GameAdapter.prototype,baseSave=P.save,baseSnapshot=P.getSnapshot,baseStop=P.stopBattle;
 const key=slot=>`mobile-tactical-checkpoint-v1:${slot}`;
 function ensure(a,s){if(!s?.isInGame||!Number.isInteger(s.currentSlot))return;const token=`${s.currentSlot}`;if(a._tacticalCheckpointSlot===token)return;a._tacticalCheckpointSlot=token;const slot=s.currentSlot;Promise.resolve(a.runtime.storage.getItem(key(slot))).then(record=>{if(a._tacticalCheckpointSlot===token)a.engineWindow.MobileTacticalSaved=record||null;}).catch(()=>{});}
 P.getSnapshot=function(){const s=baseSnapshot.call(this);if(s.isInGame){ensure(this,s);this._configureAdventureStages?.();if(this._flag('历练开关'))this.tickAdventureStages?.();}return s;};
 P.save=async function(){const slot=this._number('存档档位'),snap=this.engineWindow?.MobileTurnNative?.snapshot('adventure',slot)?.tactical,st=this.engineWindow?.MobileAdventureStages?.snapshot(),active=this._flag('历练开关'),record=active&&snap&&!snap.outcome?{version:1,slot,enemyId:st?.encounter?.id,playerRaw:this._number('真气'),enemyRaw:this._local(441198026611266),state:snap}:null;const result=await baseSave.call(this);if(result?.ok&&!result.pending&&(record||snap?.outcome)){try{await this.runtime.storage.setItem(key(slot),record);}catch{document.dispatchEvent(new CustomEvent('equipment-message',{detail:'人物进度已保存，战场位置暂未保存，请稍后再试。'}));}}return result;};
 P.stopBattle=function(){const result=baseStop.call(this);if(result?.ok){this.engineWindow.MobileTacticalSaved=null;const slot=this._number('存档档位');void Promise.resolve(this.runtime.storage.setItem(key(slot),null)).catch(()=>{});}return result;};
})();
