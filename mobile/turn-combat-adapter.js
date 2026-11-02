/* Combat projections share the authoritative model used by the native loop. */
(()=>{
  'use strict';
  const P=window.GameAdapter.prototype,M=window.MobileTurnCombat;
  P.getCombatGrowth=function(){
    const read=(name,x,y)=>Number(this._at(this._array(name),x,y))||0;
    let spirit=0;const capacity=Math.max(0,Math.min(25,read('df',this._number('灵阵等级'),11)));
    for(let i=1;i<=capacity;i++){const id=read('svlz',i,0);if(id>0)spirit+=read('lw',read('wp',id,4),3)*read('svlz',i,2)/100;}
    return M.growth(this._number('lv'),(x,y)=>read('save',x,y),spirit);
  };
  const native=(a,mode)=>a.engineWindow?.MobileTurnNative?.snapshot(mode,a._number('存档档位'))??null;
  const player=a=>{const p={...M.playerProfile({qi:a._number('真气'),maxQi:a._number('真气上限'),attack:a._number('攻击'),defense:a._number('防御')}),speed:a.getCombatGrowth().total};return window.MobileEquipment?.apply(p,a._number('存档档位'))??p;};
  function enemy(a,stats,name,id,mode,tier,evolution){
    const speed=M.enemySpeed(name,id,tier??Math.floor(Math.max(0,a._number('lv')-1)/30)+1,evolution??0);
    return M.enemyProfile({...stats,maxQi:stats?.maxQi??stats?.qi},speed,M.enemySpeed(name,id,1,0));
  }
  function projectBattle(a,b,mode,target){
    if(!b)return;
    const p=player(a),rawMax=b.maxEnemyQi;
    const e=enemy(a,{qi:b.enemyQi,maxQi:rawMax,attack:b.enemyAttack??b.attack,defense:b.enemyDefense??b.defense},target?.name??b.name,target?.id??b.targetId??b.enemyId,mode,target?.regionId,target?.evolution?.level);
    b.raw={...b};b.playerQi=p.qi;b.maxPlayerQi=p.maxQi;b.playerAttack=p.attack;b.playerDefense=p.defense;
    b.playerSpeed=p.speed;b.enemySpeed=target?.stats?.speed??e.speed;
    if(b.active){b.enemyQi=e.qi;b.maxEnemyQi=e.maxQi;b.enemyAttack=e.attack;b.enemyDefense=e.defense;}
    const timeline=native(a,mode);
    b.turnCombat={...timeline,playerSpeed:p.speed,enemySpeed:b.enemySpeed,order:timeline?.order??new M.Timeline().preview(p.speed,b.enemySpeed)};
  }
  const adventure=P.getAdventureSnapshot;
  P.getAdventureSnapshot=function(){
    const s=adventure.call(this);
    const current=s.enemies.find(e=>e.id===s.battle.enemyId);
    projectBattle(this,s.battle,'adventure',current);
    for(const e of s.enemies){e.rawStats=e.stats;if(e.known)e.stats=enemy(this,e.stats,e.name,e.id,'adventure',e.regionId,e.evolution?.level);}
    return s;
  };
  const challenge=P.getChallengeSnapshot;
  P.getChallengeSnapshot=function(){
    const s=challenge.call(this);projectBattle(this,s.battle,'challenge',s.targets.find(t=>t.id===s.battle.targetId));
    for(const t of s.targets){t.rawStats=t.stats;t.stats=enemy(this,t.stats,t.name,t.id,'challenge');if(t.reward?.type)t.reward.type=t.reward.type+'修为';}
    if(s.selected){const t=s.targets.find(t=>t.id===s.selected.id);s.selected=t??{...s.selected,stats:enemy(this,s.selected.stats,s.selected.name,s.selected.id,'challenge')};}
    s.battle.note='速度决定行动顺序，单次行动独立结算伤害。';return s;
  };
  if(P.getArtDetail){
    const detail=P.getArtDetail;
    P.getArtDetail=function(id){
      const d=detail.call(this,id);if(!d)return d;
      for(const e of d.details??[])if(/每重(真气|气血|攻击|防御)加成/.test(e.label))e.label=e.label.replace('加成','修为加成');
      d.balanceGains=window.MobileCultivationBalance.art(id,d.level);
      d.details=d.balanceGains.map(g=>({label:'每层'+g.label,value:g.next,unit:g.unit}));
      d.effectText=d.details.map(e=>`${e.label}：${e.value}${e.unit}`).join('\n');return d;
    };
  }
  const snapshot=P.getSnapshot;
  P.getSnapshot=function(){
    const s=snapshot.call(this);if(!s.isInGame)return s;
    s.legacyStats={...s.stats};s.combatGrowth=this.getCombatGrowth();
    s.stats={...s.stats,...M.playerProfile(s.stats),speed:s.combatGrowth.total};
    for(const m of s.methods??[]){
      m.balanceGains=window.MobileCultivationBalance.method(m.id,m.level);
      for(const g of m.balanceGains){m[g.key+'Gain']=g.total;m['next'+g.key[0].toUpperCase()+g.key.slice(1)+'Gain']=g.next;}
    }
    if(s.character){for(const prefix of ['treasure','beast'])for(const [suffix,field,base,start] of [['Qi','maxQi',1000,500],['Attack','attack',40,60],['Defense','defense',20,30]]){const raw=s.character[prefix+suffix],total=s.legacyStats[field];if(Number.isFinite(raw)&&Number.isFinite(total)){const f=v=>v>0?Math.max(1,Math.round(start*Math.pow(v/base,.45))):0;s.character[prefix+suffix]=Math.max(0,f(total)-f(Math.max(0,total-raw)));}}}
    for(const [key,mode] of [['capture','capture'],['expedition','expedition']]){
      if(s[key]?.battle){const b=s[key].battle;b.enemyId=this._number(key==='capture'?'捕兽结果编号':'秘境敌人编号');projectBattle(this,b,mode,key==='capture'?s.capture.target:null);}
    }
    if(s.capture?.target){const t=s.capture.target;Object.assign(t,enemy(this,t,t.name,t.id,'capture'));}
    if(s.reincarnationFlow?.trial){const b=s.reincarnationFlow.trial;b.enemyId=b.enemyLevel;projectBattle(this,b,'reincarnation',null);}
    if(window.MobileEquipment){s.stats=window.MobileEquipment.apply(s.stats,s.currentSlot);s.gearInventory=window.MobileEquipment.snapshot();}
    return s;
  };
})();
