(()=>{
 let current=null,serial=0;
 const R=self.MobileThunderRules,M=self.MobileTurnCombat;
 const begin=(target,qi=null)=>(current={id:++serial,target,total:R.count(target),strikes:0,initial:null,last:null,result:null,rawAfter:qi});
 self.MobileThunder={begin,cancel(){if(current&&!current.result)current.result='stopped';},finish(success){if(current&&!current.result)current.result=success?'success':'failed';},snapshot:()=>current?{...current,last:current.last?{...current.last}:null}:null,
 step(raw){
  if(!current||current.target!==raw.target||current.result)begin(raw.target);
  if(current.initial===null)current.initial=raw.remaining;
  const available=Math.min(raw.qi,current.rawAfter??raw.qi),base=M.playerProfile({qi:available,maxQi:raw.maxQi,defense:raw.defense}),p=self.MobileEquipmentCombat?.apply(base)??base,power=M.profile({attack:raw.power}).attack;
  const hit=R.damage(power,p.defense,current.strikes,current.total),after=Math.max(0,available-Math.ceil(hit*raw.maxQi/Math.max(1,p.maxQi))),loss=raw.qi-after;
  current.rawAfter=after;current.strikes++;current.last={seq:current.strikes,damage:Math.min(p.qi,hit),rawDamage:loss};
  if(loss>=raw.qi)current.result='failed';else if(current.strikes>=current.total)current.result='success';
  return current.strikes>=current.total?raw.remaining:current.initial/current.total;
 },incoming:()=>current?.last?.rawDamage??0};
})();
