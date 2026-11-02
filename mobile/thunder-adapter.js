(()=>{
 const P=window.GameAdapter.prototype,original=P.getRealmSnapshot,R=window.MobileThunderRules,M=window.MobileTurnCombat;
 P.getRealmSnapshot=function(){
  const r=original.call(this);if(!r)return r;
  const project=raw=>window.MobileEquipment?.apply(M.playerProfile(raw),this._number('存档档位'))??M.playerProfile(raw);
  const raw={qi:r.qi,maxQi:r.maxQi,defense:r.defense};let p=project(raw);const target=r.level+1;
  const power=M.profile({attack:Number(this._at(this._array('dj'),target,2))*Number(this._formula('天谴敌方加成',''))}).attack;
  const engine=this.engineWindow?.MobileThunder;
  let trial=engine?.snapshot();if(trial&&!r.active&&!trial.result&&(r.level>=trial.target||p.qi<=0&&trial.strikes>0)){engine.finish(r.level>=trial.target);trial=engine.snapshot();}
  // Restore actual engine health over 1.5 seconds after a failed attempt.
  if(!r.active&&trial?.result==='failed'){
   if(this._thunderRecovery?.id!==trial.id)this._thunderRecovery={id:trial.id,started:Date.now(),initial:raw.qi,done:false};
   const recovery=this._thunderRecovery;
   if(!recovery.done){
    const ratio=Math.min(1,Math.max(0,(Date.now()-recovery.started)/1500));
    raw.qi=Math.min(raw.maxQi,Math.max(raw.qi,recovery.initial+(raw.maxQi-recovery.initial)*ratio));
    this.runtime.globalVars['真气']=raw.qi;
    recovery.done=ratio>=1||raw.qi>=raw.maxQi;p=project(raw);
   }
  }else if(r.active){this._thunderRecovery=null;}
  const total=r.active&&trial?trial.total:R.count(target),losses=Array.from({length:total},(_,i)=>R.damage(power,p.defense,i,total));
  r.thunder={...trial,total:r.active&&trial?trial.total:trial?.result?trial.total:total,nextTotal:R.count(target),nextDamage:losses[0],estimatedLoss:losses.reduce((a,b)=>a+b,0)};
  r.qi=p.qi;r.maxQi=p.maxQi;r.defense=p.defense;r.progress=trial&&r.active?trial.strikes/trial.total*100:0;
  if(r.active&&trial?.rawAfter!=null)r.qi=project({...raw,qi:Math.min(raw.qi,trial.rawAfter)}).qi;
  r.canAct=Boolean(r.entryAvailable&&r.level<150&&p.qi>0&&!this._blocked()&&!this.busy);
  r.reason=!r.entryAvailable?'完成主线后开启突破。':r.level>=150?'当前境界已达本轮上限。':p.qi<=0?'气血不足，请先恢复。':null;
  r.readiness={confident:r.canAct&&p.qi>r.thunder.estimatedLoss,reason:p.qi>r.thunder.estimatedLoss?'当前气血与防御可承受预计雷劫':'预计伤害较高，建议提升气血与防御'};
  return r;
 };
 P.startRealm=function(options={}){
  const guard=this._guard();if(guard)return guard;const r=this.getRealmSnapshot();
  if(options.expectedRealmFingerprint&&options.expectedRealmFingerprint!==r.realmFingerprint)return this._fail('境界已变化，请重新确认。');
  if(r.active)return this._fail('当前正在承受雷劫。');if(!r.canAct)return this._fail(r.reason||'请稍候再突破。');
  this.engineWindow.MobileThunder.begin(r.level+1,this._number('真气'));this._call('开始渡劫',r.level+1);return this._result(true,`开始接受${r.thunder.nextTotal}道雷劫。`);
 };
 P.stopRealm=function(){const guard=this._guard();if(guard)return guard;const r=original.call(this);this._call(r.mode==='major'?'停止大境界渡劫':r.mode==='saint'?'停止圣境突破':'停止渡劫');this.engineWindow.MobileThunder.cancel();return this._result(true,'已中止渡劫，本次不提升境界。');};
})();
