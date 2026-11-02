/* Audited expression extension for the mobile-only generated event project. */
(()=>{
 let expressions;
 const unit=base=>Math.max(2,Math.round(base*.1));
 const amount=(base,quantity)=>unit(base)*quantity;
 Object.defineProperty(self,'C3_ExpressionFuncs',{configurable:true,get:()=>expressions,set(value){
  if(value.length!==9875)throw Error('Unexpected native expression table; economy patch refused');
  expressions=value;
  for(const [index,key] of [[112,'qi'],[113,'attack'],[114,'defense']]){
   const original=value[index];
   value[index]=p=>{
    const actual=original(p),baseline=original({_GetNode:i=>i===3?{GetBoundMethod:()=>()=>0}:i===4?{GetVar:()=>({GetValue:()=>1})}:p._GetNode(i)});
    return()=>{self.MobileCultivationBalance.baseRaw[key]=baseline();return actual();};
   };
  }
  // 修炼属性: the two native parameters plus the existing fate-stone modifier.
  value[6511]=p=>{const base=p._GetNode(0).GetVar(),modifier=p._GetNode(1).GetVar(),level=p._GetNode(2).GetVar();return()=>self.MobileMeditation.total(level.GetValue(),base.GetValue(),modifier.GetValue());};
  // Bypass only expiry/warning checks; age, lifespan, time and saved values remain real.
  const remainingLife=value[951];value[951]=p=>{const run=remainingLife(p);return()=>self.MobileLifespan.remainingForRules(run());};
  const nativeVictory=value[2066];value[2066]=p=>{const run=nativeVictory(p),enemy=p._GetNode(11).GetVar();return()=>{const boss=self.MobileAdventureStages?.snapshot().boss,text=run();self.MobileAdventureStages?.victory(enemy.GetValue());const final=boss?text.replace('！参悟','首领！参悟'):text;if(p._GetNode(10).ExpObject(enemy.GetValue(),3)!==1)self.MobileBattleRewards?.settle(final);return final;};};
  value.push(p=>{const wp=p._GetNode(0),id=p._GetNode(1).GetBoundMethod(),zy=p._GetNode(2),ll=p._GetNode(3),enemy=p._GetNode(4).GetVar(),roll=p._GetNode(5).GetVar(),drop=p._GetNode(6).GetVar(),luck=p._GetNode(7).GetVar();return()=>{const item=id(zy.ExpObject((ll.ExpObject(enemy.GetValue(),3)-1)*3+roll.GetValue(),3));return amount(wp.ExpObject(item,6),Math.round(drop.GetValue()*luck.GetValue()));};});
  value.push(p=>{const old=value[2066](p),wp=p._GetNode(16),id=p._GetNode(17).GetBoundMethod(),zy=p._GetNode(9),ll=p._GetNode(10),enemy=p._GetNode(11).GetVar(),roll=p._GetNode(12).GetVar(),drop=p._GetNode(14).GetVar(),luck=p._GetNode(15).GetVar();return()=>{const item=id(zy.ExpObject((ll.ExpObject(enemy.GetValue(),3)-1)*3+roll.GetValue(),3)),gain=amount(wp.ExpObject(item,6),Math.round(drop.GetValue()*luck.GetValue()));const text=old().split('获得[color=blue]')[0]+'获得[color=blue]'+gain+'[/color]灵石！';self.MobileBattleRewards?.settle(text);return text;};});
  value.push(p=>{const ll=p._GetNode(0),enemy=p._GetNode(1).GetVar();return()=>ll.ExpObject(enemy.GetValue(),3);});
  value.push(()=> '灵石');
  // Native teaching remains in order, but no longer tells the player to sell a removed drop.
  for(let i=0;i<9875;i++){
    const factory=value[i],source=String(factory);
    if(source.includes('下品凡核')&&source.includes('卖出'))value[i]=p=>{const run=factory(p);const rewrite=()=>{const text=typeof run==='function'?run():run;return typeof text==='string'&&text.includes('下品凡核')&&text.includes('卖出')?'凡界历练的凡核奖励已按出售价值自动折成灵石。\n继续历练，持有500灵石即可完成任务，无需手动卖出。':text;};return typeof run==='function'?rewrite:rewrite();};
  }
  const spirit=value[2071];value[2071]=p=>{const run=spirit(p);return()=>{const text=run();self.MobileBattleRewards?.extra(text);return text;};};
  self.MobileTurnNative.install(value);
 }});
 self.MobileCoreEconomy={unit,amount};
})();

