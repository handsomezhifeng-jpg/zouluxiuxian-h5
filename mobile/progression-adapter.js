/* Real realm/cultivation metrics. Actions call the original Construct functions.
 * Evidence: analysis/mechanics.txt events 2044,2093,2097,2099,2174-2180,
 * 2187,2193,2266-2276; construct/local-variables.json supplies the exact SIDs.
 */
(() => {
  'use strict';
  const p = window.GameAdapter.prototype;
  // dj.json stores later-realm values as strings (dj[43,3]: "1.11955E+11").
  // Read numeric variables with finite(), but preserve raw table operand types
  // until the original expression has finished. Construct's arithmetic helpers
  // keep the left operand unless both operands are numbers (runtime:11528-11580).
  // SetVar converts the final result to a number only afterwards (runtime:2816).
  const finite = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const nativeOperation = (a,b,operation) => a===null||b===null?null:
    typeof a==='number'&&typeof b==='number'?operation(a,b):a;
  const nativeMultiply = (a,b) => nativeOperation(a,b,(left,right)=>left*right);
  const nativeDivide = (a,b) => nativeOperation(a,b,(left,right)=>left/right);
  const nativeSubtract = (a,b) => nativeOperation(a,b,(left,right)=>left-right);
  const clean = value => String(value ?? '').replace(/\[\/?(?:color|size|b|i|u|s|font)(?:=[^\]]*)?\]/gi,'');
  const enabled = button => button?.instVars?.开关 === true || button?.instVars?.开关 === 1;
  const safe = (read, fallback = null) => { try { return read() ?? fallback; } catch { return fallback; } };
  const STAGES = [{level:10,label:'筑基',materialId:481},{level:20,label:'结丹',materialId:482},{level:30,label:'培婴',materialId:483}];
  const GRADE_NAMES = ['零','一','二','三','四','五','六','七','八','九','十'];
  const committed = (a,i) => Boolean(i && typeof a._nativeControlCommitted==='function' && a._nativeControlCommitted(i));
  const visibleCommitted = (a,name) => a._instances(name).filter(i=>committed(a,i)&&a._visible(i));
  const stage = a => STAGES.find(s=>s.level>=a._number('lv')) ?? null;
  const materialEfficiency = (level,quality) => level===null||quality===null?null:Math.round((Math.pow(1.12,level)*(quality/100)+1)*100)/100;
  function state(a) {
    const level=a._number('lv'), normal=a._flag('渡劫开关'),major=a._flag('大境界渡劫开关'),saint=a._flag('圣境突破开关');
    const active=Boolean(normal||major||saint), save=a._array('save');
    const mode=major?'major':saint?'saint':normal?'normal':level>=151?'saint':level%10===0?'major':'normal';
    const target=active?a._number('渡劫等级'):mode==='saint'?(finite(a._at(save,1,34))??0)+1:level+1;
    const materialCells=[1,2,3].map(x=>a._at(save,x,26));
    return {level,normal,major,saint,active,mode,target,materialCells,
      fingerprint:JSON.stringify([level,normal,major,saint,target,...materialCells])};
  }
  function covered(a,button,names) {
    const point=safe(()=>button.layer.layerToCssPx(button.x,button.y));
    if(!point)return true;
    return names.some(name=>a._instances(name).filter(i=>committed(a,i)).some(i=>{
      if(safe(()=>i.layer.isSelfAndParentsInteractive,false)!==true)return false;
      const box=safe(()=>i.getBoundingBox()),view=safe(()=>i.layer.getViewport());
      if(!box||!view||box.right<=view.left||box.left>=view.right||box.bottom<=view.top||box.top>=view.bottom)return false;
      const local=safe(()=>i.layer.cssPxToLayer(...point));
      return local&&local[0]>=box.left&&local[0]<=box.right&&local[1]>=box.top&&local[1]<=box.bottom;
    }));
  }
  function realmButton(a,s=state(a)) {
    return visibleCommitted(a,s.mode==='saint'?'圣境突破按钮文字':'渡劫按钮文字')
      .find(i=>finite(safe(()=>i.instVars.修炼等级))===s.target)??null;
  }
  function materialFrame(a) { return visibleCommitted(a,'渡劫材料框背景').find(enabled)??null; }
  function actionReason(a,own=false,allowSelection=false) {
    if(a._layout()!=='主界面'||!a._dataReady())return '请先等待原游戏完整载入。';
    if(!own&&a.busy)return '正在处理上一项操作。';
    if(a._realmPending)return '上次渡劫操作尚未确认，请在原界面核对，勿重复提交。';
    if(!allowSelection&&a._blocked())return '请先完成或关闭原游戏中的对话框。';
    const unlocked=a._realmUnlocked();
    if(unlocked===null)return '渡劫解锁数据尚未载入。';
    if(!unlocked)return '请先完成主线“参悟功法”的教学对话，解锁渡劫。';
    return null;
  }
  async function ensureRealmPage(a) {
    const reason=actionReason(a,true); if(reason)return a._fail(reason);
    const ready=()=>{
      const s=state(a),button=realmButton(a,s);
      return a._global('主页界面')==='渡劫'&&Boolean(button&&enabled(button))&&
        (s.mode!=='major'||s.active||Boolean(materialFrame(a)));
    };
    if(!ready())a._call('打开渡劫系统',1,0);
    // Public instances include pending creates; native SOLs do not. A frame
    // and its exact target button must be committed before dispatching actions.
    await new Promise(resolve=>setTimeout(resolve,40));
    await a._waitUntil(ready,3000);
    return null;
  }
  async function run(a,operation) {
    const initial=a._guard();if(initial)return initial;
    const reason=actionReason(a);if(reason)return a._fail(reason);
    a.busy=true;a._realmBusy=true;
    try{return await operation();}
    catch(error){return a._fail(error.message||'原游戏尚未确认渡劫操作完成。',a._realmPending?{transactionMayHaveRun:true,requiresOriginal:true}:{});}
    finally{a._realmBusy=false;a.busy=false;}
  }
  function confirmation(a,options,s=state(a)) {
    return options.expectedRealmFingerprint!==undefined&&options.expectedRealmFingerprint!==s.fingerprint?
      a._fail('境界、渡劫或材料已变化，请重新查看后确认。'):null;
  }
  function candidate(a,row,own=false,allowSelection=false) {
    const currentStage=stage(a), held=a._array('svwp'),wp=a._array('wp');
    if(!Number.isInteger(row)||row<1||!held||row>=held.width||held.height<14||!currentStage)return null;
    const id=finite(a._at(held,row,0)),count=finite(a._at(held,row,1));
    if(id!==currentStage.materialId||count===null||count<=0||a._at(wp,id,2)!=='宝材')return null;
    const quality=finite(a._at(held,row,2)),level=finite(a._at(held,row,3)),lock=a._at(held,row,7);
    const cells=[];for(let y=0;y<held.height;y++)for(let z=0;z<held.depth;z++)cells.push(a._at(held,row,y,z));
    const s=state(a);const supported=STAGES.some(x=>x.level===s.level);
    const finalReason=actionReason(a,own,allowSelection)||(!supported?'请修至对应大境界圆满后再选择宝材。':null)||
      (s.active?'渡劫中不能更换宝材。':null)||(finite(s.materialCells[0])!==0?'请先卸下当前宝材，再选择另一件。':null)||
      (lock===null||lock===undefined?'宝材锁定状态尚未确定。':null)||
      (finite(lock)===1?'此物品已锁定，原选择器不显示。':null)||
      (!Number.isSafeInteger(count)||count<1?'宝材数量尚不能确认精确消耗一件。':null)||
      (quality===null||quality<0||level===null?'宝材等级或品质尚未确定。':null);
    return {inventoryIndex:row,id,name:a._at(wp,id,1),count,quality,level,lockFlag:lock,
      efficiencyMultiplier:materialEfficiency(level,quality),token:JSON.stringify([row,...cells]),canSelect:!finalReason,reason:finalReason};
  }
  function materialCounts(a) {
    const held=a._array('svwp'),wp=a._array('wp'),map=new Map();
    if(!held||held.height<14)return null;
    for(let row=1;row<held.width;row++) {
      const id=a._at(held,row,0),count=finite(a._at(held,row,1));
      if(a._at(wp,id,2)!=='宝材'||count===null||count<=0)continue;
      if(!Number.isSafeInteger(count)||finite(a._at(held,row,2))===null||finite(a._at(held,row,3))===null)return null;
      const key=JSON.stringify([finite(id),finite(a._at(held,row,2)),finite(a._at(held,row,3))]);
      map.set(key,(map.get(key)||0)+count);
    }
    return map;
  }
  const sameCounts=(a,expected)=>{
    const actual=materialCounts(a);return actual&&[...new Set([...actual.keys(),...expected.keys()])].every(key=>(actual.get(key)||0)===(expected.get(key)||0));
  };
  function logs(a) {return a._instances('记录文字').map(i=>({key:JSON.stringify([safe(()=>i.uid),safe(()=>i.text)]),text:clean(safe(()=>i.text))}));}
  function gradeLabel(a,s,rounds) {
    // 金丹中文显示 calls the stateful simulation 结丹品级预估 when idle.
    // Never call it from a snapshot; read its native rendered text if present.
    const rendered=visibleCommitted(a,'渡劫金丹文字').find(i=>typeof safe(()=>i.text)==='string');
    if(a._global('主页界面')==='渡劫'&&rendered)return clean(rendered.text);
    const recorded=s.major?rounds:finite(a._at(a._array('save'),Math.floor((s.level-1)/10),27));
    if(recorded>0&&recorded<=10)return `${GRADE_NAMES[11-recorded]}品${String(a._at(a._array('dj'),s.major?s.level+1:s.level,1)??'').slice(0,2)}`;
    return s.major?'未成':'尚未开始';
  }
  p.getCharacterSnapshot = function() {
    const fields = {
      spiritStones:'灵石', qiSense:'总气感', spiritualSense:'总神识', constitution:'总根骨',
      baseQiSense:'气感',baseSpiritualSense:'神识',baseConstitution:'根骨',
      comprehension:'总悟性',luck:'总机缘',qiMultiplier:'真气上限加成系数',attackMultiplier:'攻击加成系数',defenseMultiplier:'防御加成系数',artEfficiency:'功法参悟效率',resourceMultiplier:'掉落加成系数',
      cultivationSpeed:'修炼加速系数',poison:'丹毒',poisonCap:'丹毒上限',caveEnergy:'洞府灵气',
      treasureQi:'法宝真气',treasureAttack:'法宝攻击',treasureDefense:'法宝防御',
      beastQi:'灵兽真气',beastAttack:'灵兽攻击',beastDefense:'灵兽防御',
      sectQi:'门派真气',sectAttack:'门派攻击',sectDefense:'门派防御'
    };
    const result=Object.fromEntries(Object.entries(fields).map(([key,name])=>[key,this._number(name)]));
    result.artMonthlyRate=result.artEfficiency===null||result.comprehension===null?null:result.artEfficiency*result.comprehension*100;
    return result;
  };
  p.getRealmSnapshot = function() {
    const s=state(this),lv=s.level;
    if(lv===null || this._layout()!=='主界面') return null;
    const {normal,major,saint,mode,active,target}=s;
    const dj=this._array('dj'),save=this._array('save');
    const enemyFactor=this._formula('天谴敌方加成','');
    const arrayLevel=this._formula('灵阵等级计算',this._formula('灵阵煞性',0),0);
    const reduction=this._at(this._array('lz'),arrayLevel,3);
    let limit=finite(this._local(238575098047099));
    if(mode==='normal'||mode==='major'&&!active) {
      const base=this._at(dj,target,3);
      // Exact initial progress assigned by 开始渡劫 2094 / expression 1765.
      limit=finite(nativeMultiply(nativeMultiply(base,nativeSubtract(1,nativeDivide(reduction,10000))),enemyFactor));
    } else if(!active && mode==='saint') limit=this._formula('圣境突破值',target);
    const remaining=finite(this._local(935854885654278));
    const progress=active&&limit>0?Math.max(0,Math.min(100,(normal?1-remaining/limit:remaining/limit)*100)):0;
    const id=finite(this._at(save,1,26));
    const material=id>0?{id,name:this._at(this._array('wp'),id,1),quality:finite(this._at(save,2,26)),level:finite(this._at(save,3,26)),
      token:JSON.stringify(s.materialCells)}:null;
    if(material)material.efficiencyMultiplier=materialEfficiency(material.level,material.quality);
    const button=realmButton(this,s),currentStage=stage(this),supported=STAGES.some(x=>x.level===lv);
    const frame=materialFrame(this),reason=actionReason(this),materialReason=reason||(!supported?'请修至炼气、筑基或金丹圆满，再选择对应宝材。':null)||
      (active?'渡劫中不能装卸宝材。':null);
    const gradeRounds=major?finite(this._local(957941011305532)):null;
    let curseValue=0;for(let x=1;x<=15;x++){const value=finite(this._at(save,x,27));if(value===null){curseValue=null;break;}curseValue+=value;}
    if(curseValue!==null)curseValue=Math.round(curseValue);
    const materialCandidates=[];
    if(supported&&!active){const held=this._array('svwp');for(let row=1;row<(held?.width??0);row++){const item=candidate(this,row);if(item)materialCandidates.push(item);}}
    const canAct=!reason&&Boolean(button&&enabled(button)&&!covered(this,button,['黑幕','遮挡底板上','遮挡底板下']));
    const result = {
      level:lv,mode,active,target,
      currentName:this._at(dj,lv,1),nextName:mode==='saint'?`圣境 ${target} 层`:this._at(dj,lv+1,1),
      progress,remaining,limit,timeLeft:active&&(major||saint)?finite(this._local(375922968805586)):null,
      grade:gradeRounds,
      qi:this._number('真气'),maxQi:this._number('真气上限'),
      attack:this._number('攻击'),defense:this._number('防御'),
      tribulationPower:mode==='normal'?finite(nativeMultiply(this._at(dj,lv+1,2),enemyFactor)):mode==='major'?
        (major?finite(this._local(554828681505264)):finite(nativeMultiply(this._at(dj,lv+1,2),enemyFactor))):this._formula('圣境突破强度',target),
      lifespanGain:mode==='saint'?null:finite(this._at(dj,lv+1,6)),material,
      prepared:this._global('主页界面')==='渡劫'&&Boolean(button),
      buttonLabel:button?clean(button.text):null,
      canAct,reason,realmFingerprint:s.fingerprint,materialCandidates,
      major:{supported,stageLabel:currentStage?.label??null,requiredLevel:currentStage?.level??null,
        materialId:currentStage?.materialId??null,materialName:currentStage?this._at(this._array('wp'),currentStage.materialId,1):null,
        timeLimit:30,gradeRounds,gradeLabel:gradeLabel(this,s,gradeRounds),curseValue,
        materialEfficiency:major?finite(this._local(207520484960558)):material?.efficiencyMultiplier??1,
        canSelectMaterial:!materialReason&&!material,canRemoveMaterial:!materialReason&&Boolean(material)&&this._flag('自动出售开关')!==true,
        reason:materialReason||(material&&this._flag('自动出售开关')===true?'自动出售已开启，请在原界面关闭后再回收宝材。':null),
        materialRule:'宝材需与当前大境界对应；已锁定物品不会出现在原选择器中。放入时从纳戒取走一件，开始前可以卸下。',
        lossWarning:'开始后宝材即被消耗，失败或放弃均不返还，也不恢复已损失真气。主动放弃不结算本次品级。渡劫耗时会正常推进年龄。',
        rules:['大境界限时30个月，每完成一轮提升一次品级，下一轮难度提高。',
          '完成10轮直接成功；完成至少1轮后，真气耗尽或时间结束时按已有品级成功。',
          '未完成1轮时真气耗尽或时间结束则失败。主动放弃不会按已有轮数突破。',
          '成功记录本次品级并增加天谴值，同时提高后续渡劫难度；宝材的等级与品质影响攻防效率。'],
        preparedMaterialControl:Boolean(frame)},
      entryAvailable:this._realmUnlocked()===true,
      recentMessages:this._instances('记录文字').filter(i=>this._visible(i)).map(i=>clean(i.text)).filter(Boolean).slice(-5)
    };
    result.readiness=this.getRealmReadiness(result);
    return result;
  };
  p.getRealmReadiness=function(r){
    // Read-only conservative estimate. Native mechanics events 2106 / 2196:
    // 0.02-month ticks, rounded damage, at least one major round required.
    if(!r?.entryAvailable||r.active||r.mode==='saint'||r.reason||r.level>=150)
      return {confident:false,reason:'请进入境界查看当前条件'};
    const lz=this._array('lz');
    const bonus=kind=>{
      const index=this._formula('灵阵等级计算',this._formula(kind,0),0);
      if(typeof index!=='number'||!Number.isFinite(index))return null;
      return finite(this._at(lz,index,kind==='灵阵锋韧'?4:5));
    };
    const attackBonus=bonus('灵阵锋韧'),defenseBonus=bonus('灵阵刚体');
    const nums=[r.attack,r.defense,r.qi,r.maxQi,r.limit,r.tribulationPower,attackBonus,defenseBonus];
    if(nums.some(n=>typeof n!=='number'||!Number.isFinite(n))||r.limit<=0||r.qi<=0)
      return {confident:false,reason:'数据不足，暂不提示突破把握'};
    const efficiency=r.mode==='major'?r.material?.efficiencyMultiplier:1;
    // Missing major material requires explicit confirmation; never encourage it.
    if(!(efficiency>0))return {confident:false,reason:'请先检查渡劫宝材'};
    const attack=r.attack*efficiency*(1+attackBonus/10000);
    const defense=r.defense*efficiency*(1+defenseBonus/10000);
    const perTick=2*Math.round(Math.max(0,Math.min(attack/10,r.mode==='major'?r.limit/100:Infinity)));
    const loss=2*Math.round(Math.max(0,Math.min((r.tribulationPower-defense)/10,r.mode==='major'?r.maxQi/50:Infinity)));
    if(perTick<=0)return {confident:false,reason:'当前攻击尚不足以破境'};
    const ticks=Math.ceil(r.limit/perTick),remaining=r.qi-ticks*loss;
    const confident=Number.isFinite(ticks)&&remaining>=Math.max(1,r.qi*.25)&&(r.mode!=='major'||ticks*.02<=24);
    return {confident,estimatedQiRemaining:remaining,estimatedMonths:ticks*.02,
      reason:confident?'按当前攻防、气血与灵阵估算，把握较高':'当前余量不足，请查看境界详情'};
  };
  p.prepareRealm = function() {
    return run(this,async()=>{const opened=await ensureRealmPage(this);return opened??this._result(true,'渡劫界面已就绪。');});
  };
  p.startRealm = function(options={}) {
    return run(this,async()=>{
      const opened=await ensureRealmPage(this);if(opened)return opened;
      const s=state(this),button=realmButton(this,s),stale=confirmation(this,options,s);if(stale)return stale;
      if(s.active)return this._fail('当前已在渡劫中。');
      const label=clean(safe(()=>button.text));
      const stageLabel=STAGES.find(x=>x.level===s.level)?.label;
      const allowed=s.mode==='major'?s.level>0&&s.level<=150&&s.level%10===0&&label&&
        (stageLabel?label===stageLabel:!['放弃','停止','突破'].includes(label)):label==='突破';
      if(!button||!enabled(button)||!allowed||covered(this,button,['黑幕','遮挡底板上','遮挡底板下']))return this._fail('原渡劫按钮尚未就绪或被遮挡。');
      if(s.mode==='major'&&s.materialCells.some(v=>finite(v)===null))return this._fail('渡劫材料槽尚未完整载入。');
      if(s.mode==='major'&&finite(s.materialCells[0])===0&&options.confirmWithoutMaterial!==true)return this._fail('缺少渡劫宝材；强行渡劫可能降低结果品级。',{needsMaterialConfirmation:true,realmFingerprint:s.fingerprint});
      const oldLogs=new Set(logs(this).map(x=>x.key));
      this._realmPending={kind:'start',level:s.level,target:s.target};
      if(s.mode==='normal')this._call('开始渡劫',s.target);
      else if(s.mode==='major')this._call('开始大境界渡劫',s.target,1);
      else this._call('开始圣境突破',s.target,0);
      let outcome=null;
      await this._waitUntil(()=>{
        const now=state(this);
        if(now.active&&now.mode===s.mode&&now.target===s.target&&
          (s.mode!=='major'||now.materialCells.every(v=>finite(v)===0)&&finite(this._local(207520484960558))!==null)){
          outcome='active';return true;
        }
        if(s.mode!=='saint'&&now.level>=s.target){outcome='success';return true;}
        const receipt=logs(this).find(x=>!oldLogs.has(x.key)&&/突破成功|渡劫成功|突破失败|渡劫失败|境界已满/.test(x.text));
        if(receipt){outcome=/失败|已满/.test(receipt.text)?'failed':'success';return true;}
        return false;
      },3500);
      this._realmPending=null;
      return outcome==='failed'?this._fail('原游戏已结算渡劫失败，请查看真气、材料及原记录。',{completed:true}):
        this._result(true,outcome==='active'?'已按原规则开始渡劫。':'本次渡劫已由原游戏结算。',{target:s.target,started:outcome==='active',completed:outcome!=='active'});
    });
  };
  p.stopRealm = function(options={}) {
    return run(this,async()=>{
      const opened=await ensureRealmPage(this);if(opened)return opened;
      const s=state(this),button=realmButton(this,s),stale=confirmation(this,options,s);if(stale)return stale;
      if(!s.active)return this._fail('当前没有正在进行的渡劫。');
      if(!button||!enabled(button)||clean(button.text)!==(s.mode==='major'?'放弃':'停止')||
        covered(this,button,['黑幕','遮挡底板上','遮挡底板下']))return this._fail('原停止按钮尚未就绪或被遮挡。');
      this._realmPending={kind:'stop',target:s.target};
      this._call(s.mode==='major'?'停止大境界渡劫':s.mode==='saint'?'停止圣境突破':'停止渡劫');
      this._call('打开渡劫系统',1,0);
      await this._waitUntil(()=>{
        const now=state(this),next=realmButton(this,now),label=clean(safe(()=>next.text));
        return !now.active&&next&&next.uid!==button.uid&&enabled(next)&&
          (now.mode==='major'?label&&!['放弃','停止','突破'].includes(label):label==='突破');
      },3000);
      this._realmPending=null;
      return this._result(true,s.mode==='major'?'已放弃本次大境界渡劫；不结算品级，已耗宝材和真气不返还。':'已停止本次渡劫。');
    });
  };
  p.selectRealmMaterial = function(inventoryIndex,options={}) {
    return run(this,async()=>{
      const opened=await ensureRealmPage(this);if(opened)return opened;
      const s=state(this),stale=confirmation(this,options,s);if(stale)return stale;
      const incoming=candidate(this,inventoryIndex,true);
      if(!incoming?.canSelect)return this._fail(incoming?.reason||'请选择当前大境界对应的原宝材。');
      if(options.expectedToken!==undefined&&options.expectedToken!==incoming.token)return this._fail('纳戒宝材已变化，请重新选择。');
      const frame=materialFrame(this);
      if(!frame||covered(this,frame,['黑幕','遮挡底板上','遮挡底板下']))return this._fail('原材料框尚未就绪或被遮挡。');
      const popupBefore=new Set(this._instances('物品选择背景').map(i=>i.uid));
      const tipBefore=new Set(this._instances('道具tips按钮文字').map(i=>i.uid));
      let ownsPopup=false,ownsTips=false;
      try {
        ownsPopup=true;
        // Same constructor/filters as 2125. The original modal creates a black
        // backdrop, so its legal selector is validated against 2129's own masks
        // rather than using the generic helper's always-block-black rule.
        this._call('打开物品选择界面',0,0,9,incoming.name,0,0,'','渡劫材料',false);
        const selector=()=>visibleCommitted(this,'物品选择背景').find(i=>!popupBefore.has(i.uid)&&
          safe(()=>i.instVars.功能)==='渡劫材料'&&safe(()=>i.instVars.指定物品名)===incoming.name);
        await this._waitUntil(()=>Boolean(selector()),3000);
        const viewport=safe(()=>this.runtime.layout.getLayer(19).getViewport());
        const width=finite(viewport?.width),height=finite(viewport?.height);
        if(width===null||height===null||height<400)return this._fail('原游戏视口尚未准备完成。');
        const held=this._array('svwp');
        ownsTips=true;
        // All 21 source parameters; 宝材 branch1202 creates the native 选择 button.
        this._call('道具tips建立',viewport.left+width/2-80,viewport.top+height/2-150,inventoryIndex,'物品选择',0,0,
          ...[2,3,4,5,6].map(y=>this._at(held,inventoryIndex,y)),incoming.count,incoming.id,9,
          ...[8,9,10,11,12,13].map(y=>this._at(held,inventoryIndex,y)),0);
        const tip=()=>visibleCommitted(this,'道具tips按钮文字').find(i=>!tipBefore.has(i.uid)&&
          clean(i.text)==='选择'&&finite(safe(()=>i.instVars.道具序号))===inventoryIndex);
        await this._waitUntil(()=>Boolean(tip()&&enabled(tip())),3000);
        const fresh=state(this),current=candidate(this,inventoryIndex,true,true),button=tip();
        const reason=actionReason(this,true,true),changed=confirmation(this,options,fresh);
        if(reason)return this._fail(reason);if(changed)return changed;
        if(fresh.fingerprint!==s.fingerprint||!current?.canSelect||current.token!==incoming.token||!selector())return this._fail('境界、材料槽或纳戒行已变化，请重新选择。');
        if(!button||!enabled(button)||covered(this,button,['遮挡底板上','数字输入背景']))return this._fail('原选择按钮尚不可用或被遮挡。');
        const expected=materialCounts(this);if(!expected)return this._fail('原纳戒材料数量尚未确认。');
        const key=JSON.stringify([incoming.id,incoming.quality,incoming.level]);expected.set(key,(expected.get(key)||0)-1);
        this._realmPending={kind:'select-material',row:inventoryIndex};
        // 2132 owns save[1..3,26] and the one-item native loss. No array writes.
        this._call('设置渡劫材料',inventoryIndex);
        await this._waitUntil(()=>{
          const cells=state(this).materialCells;
          return finite(cells[0])===incoming.id&&finite(cells[1])===incoming.quality&&finite(cells[2])===incoming.level&&sameCounts(this,expected);
        },3500);
        this._realmPending=null;
        return this._result(true,`已放入${incoming.name}；开始前可卸下，开始后会消耗。`,{materialId:incoming.id});
      } finally {
        if(ownsTips)safe(()=>this._call('关闭物品tips'));
        if(ownsPopup)safe(()=>this._call('关闭物品选择界面'));
      }
    });
  };
  p.removeRealmMaterial = function(options={}) {
    return run(this,async()=>{
      const opened=await ensureRealmPage(this);if(opened)return opened;
      const s=state(this),stale=confirmation(this,options,s);if(stale)return stale;
      if(!STAGES.some(x=>x.level===s.level)||s.active)return this._fail('请在本轮大境界渡劫开始前卸下材料。');
      const [id,quality,level]=s.materialCells.map(finite),frame=materialFrame(this);
      if(!(id>0)||quality===null||level===null)return this._fail('当前没有已确认的渡劫材料。');
      if(this._flag('自动出售开关')===true)return this._fail('请先在原界面关闭自动出售，再回收宝材。',{requiresOriginal:true});
      if(!frame||!enabled(frame)||covered(this,frame,['黑幕','遮挡底板上','遮挡底板下']))return this._fail('原材料框尚未就绪或被遮挡。');
      const expected=materialCounts(this);if(!expected)return this._fail('原纳戒材料数量尚未确认。');
      const key=JSON.stringify([id,quality,level]);expected.set(key,(expected.get(key)||0)+1);
      this._realmPending={kind:'remove-material',id};
      // Original 2135 obtains the item, clears all three cells and refreshes UI.
      // Its source frame/bool/masks and automatic-sale risk are checked above.
      this._call('卸下渡劫材料');
      await this._waitUntil(()=>state(this).materialCells.every(v=>finite(v)===0)&&sameCounts(this,expected),3500);
      this._realmPending=null;
      return this._result(true,'已按原规则卸下渡劫材料并放回纳戒。',{materialId:id});
    });
  };
})();
