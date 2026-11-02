/* One automatic local save. No gameplay numbers or progression are changed. */
(() => {
  'use strict';
  let pending=false,started=false,error='',restarting=false;
  let saving=false,lastSavedAt=0,lastSavedKey='',latestAdapter=null,latestSnapshot=null;
  const saveKey=s=>JSON.stringify([s.currentSlot,s.realm,s.stats,s.selectedMethod,s.methods?.map(m=>[m.id,m.level]),s.inventory,s.arts]);
  async function persist(adapter=latestAdapter,snapshot=latestSnapshot,force=false){
    if(!adapter||!snapshot?.isInGame||saving||restarting||pending||adapter.busy||adapter._nativeInputBusy||snapshot.blocked)return;
    const key=saveKey(snapshot);
    if(!force&&(key===lastSavedKey||Date.now()-lastSavedAt<3000))return;
    saving=true;
    try{
      const result=checked(await adapter.save());
      if(!result?.pending){lastSavedKey=key;lastSavedAt=Date.now();}
    }catch(reason){console.warn('[存档] 自动保存未完成，将重试：',reason.message);lastSavedAt=Date.now();}
    finally{saving=false;}
  }
  const checked=result=>{if(result?.ok===false)throw new Error(result.message);return result;};
  async function ensure(adapter,snapshot,onChange){
    latestAdapter=adapter;latestSnapshot=snapshot;
    if(snapshot?.isInGame&&!restarting){started=true;void persist(adapter,snapshot);return;}
    if(!adapter||pending||started||restarting)return;
    if(snapshot?.isInGame){started=true;return;}
    if(!snapshot?.ready||snapshot.layout!=='开始界面')return;
    pending=true;error='';
    try{
      checked(await adapter.prepareSlots());
      const slots=adapter.getSlots();
      const occupied=slots.filter(item=>item.occupied===true).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
      const slot=occupied.find(item=>item.slot===0)||occupied[0];
      if(slot)checked(await adapter.loadSlot(slot.slot,{confirmOlderSave:true}));
      else{
        if(!slots.length||slots.some(item=>item.occupied!==false))throw new Error('本机修仙记录尚未读取完成。');
        const storage=adapter.runtime?.storage;
        if(typeof storage?.getItem!=='function')throw new Error('无法确认已有存档，已停止自动创建新游戏。');
        const raw=await Promise.all(slots.map(item=>storage.getItem(`${item.slot}save`)));
        const existing=raw.map((value,index)=>({value,slot:slots[index].slot})).filter(item=>item.value!==null&&item.value!==undefined&&item.value!=='');
        if(existing.length){const local=existing.find(item=>item.slot===0)||existing[0];checked(await adapter.loadSlot(local.slot,{confirmOlderSave:true,recoverLocal:true}));}
        else checked(await adapter.startNewGame(0));
      }
      started=true;
    }catch(reason){error=reason.message||'读取记录失败，请重试。';started=true;}
    finally{pending=false;onChange?.();}
  }
  async function restart(adapter){
    if(restarting||pending||saving||adapter?.busy||adapter?._nativeInputBusy)throw new Error('请等待当前操作完成。');
    const engine=adapter?._engine?.(),storage=adapter?.runtime?.storage;
    if(!engine||!storage?.clear||!storage?.keys)throw new Error('游戏尚未就绪，暂不能重新开始。');
    restarting=true;
    engine.SetSuspended(true);
    try{
      const plugin=engine.GetObjectClassByIndex(607)?.GetSingleGlobalInstance()?.GetSdkInstance();
      if(plugin)await adapter._waitUntil(()=>plugin._pendingSets===0,12000);
      await window.MobileCave?.reset();
      await window.MobileEquipment?.flush();
      await storage.clear();
      window.MobileEquipment?.forget();
      adapter.engineWindow?.MobileAdventureStages?.reset();
      if((await storage.keys()).length)throw new Error('存档尚未清除完成，请重试。');
      return {ok:true};
    }catch(reason){
      // Keep the old runtime stopped: it must not write cleared saves back.
      error=reason.message;throw reason;
    }
  }
  // Periodic saves are the primary guarantee; unloading cannot await IndexedDB.
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void persist(undefined,undefined,true);});
  addEventListener('pagehide',()=>{void persist(undefined,undefined,true);});
  addEventListener('beforeunload',()=>{void persist(undefined,undefined,true);});
  window.MobileSingleSave={ensure,persist,restart,retry(){if(!restarting){started=false;error='';}},get error(){return error;},get restarting(){return restarting;}};
})();
