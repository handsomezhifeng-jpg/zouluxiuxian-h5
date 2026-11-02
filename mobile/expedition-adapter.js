/* Original secret expeditions and fate stones. No gameplay setters.
 * data.json: entry 9005/8989, gates 7260-7264, settings 7551-7568,
 * end 7266-7267; stone tips 1218-1226, inscription 7626-7654.
 * Snapshot formulas are copied audited leaf expressions, never native queries.
 */
(() => {
  'use strict';
  const p = window.GameAdapter.prototype;
  const PAGE = 309151502320241, REGION = 144207867571755, FLOOR = 408676441564830;
  const STONE_LABELS = ['乾','坤','震','巽','坎','离','艮','兑','阴','阳'];
  const PRIMARY = ['气感','根骨','机缘','机缘','悟性','神识','根骨','气感','悟性','神识'];
  const GRADES = ['普通','良好','优秀','完美','史诗','神级'];
  const safe = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };
  const n = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const parameter = v => v === null || v === undefined ? null : n(typeof v === 'number' ? v : parseFloat(v));
  const enabled = i => i?.instVars?.开关 === true || i?.instVars?.开关 === 1;
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const committed = (a,i) => Boolean(i && a._nativeControlCommitted?.(i));
  const controls = (a,name) => a._instances(name).filter(i => committed(a,i) && a._visible(i));
  const control = (a,name,predicate = () => true) => controls(a,name).find(predicate) ?? null;
  const at = (a,name,x,y=0,z=0) => a._at(a._array(name),x,y,z);
  const row = (a,name,x,z=0) => {
    const table=a._array(name);if(!table||x<0||x>=table.width||z<0||z>=table.depth)return null;
    const result=[];for(let y=0;y<table.height;y++){const value=a._at(table,x,y,z);if(value===null||value===undefined)return null;result.push(value);}return result;
  };
  function reason(a,flag,own=false,allowTips=false) {
    if(a._layout()!=='主界面'||!a._dataReady())return '请先等待原游戏完整载入。';
    if(!Number.isInteger(a._number('存档档位'))||a._number('存档档位')<0||a._number('存档档位')>4)return '当前原存档槽尚未确认。';
    if(!own&&(a.busy||a._expeditionBusy))return '正在处理上一项操作。';
    if(a._expeditionPending)return '上次原输入尚未确认，请先在完整原界面核对，勿重复提交。';
    if(at(a,'save',flag,18)!==1)return flag===19?'请修至炼气圆满，并完成原秘境教学。':'请先完成原秘境与命石解锁教学。';
    if(safe(()=>a._engine().IsSuspended(),true))return '请先继续游戏。';
    if(a._blocked()||['筛选背景','对话背景',...(allowTips?[]:['道具tips背景'])].some(name=>a._instances(name).some(i=>a._visible(i))))return '请先完成或关闭原游戏中的提示。';
    if(typeof a._nativeTap!=='function'||typeof a._nativeControlCommitted!=='function')return '原控件输入尚未就绪。';
    return null;
  }
  function ctx(a){return {engine:a._engine(),slot:a._number('存档档位')};}
  function check(a,c,flag,allowTips=false){
    if(a._engine()!==c.engine||a._number('存档档位')!==c.slot)throw new Error('游戏或存档槽已变化，请重新打开。');
    const why=reason(a,flag,true,allowTips);if(why)throw new Error(why);
  }
  async function wait(a,test,c,flag,timeout=4500,allowTips=false){
    await a._waitUntil(()=>{check(a,c,flag,allowTips);return test();},timeout);
  }
  async function action(a,flag,operation){
    const why=reason(a,flag);if(why)return a._fail(why);
    a.busy=true;a._expeditionBusy=true;const c=ctx(a);
    try{return await operation(c);}
    catch(error){return a._fail(error.message||'原操作尚未确认。',a._expeditionPending?{requiresOriginal:true,transactionMayHaveRun:true}:{});}
    finally{a._expeditionBusy=false;a.busy=false;}
  }
  async function tap(a,i,c,flag,test,{allowTips=false}={}){
    check(a,c,flag,allowTips);
    if(!i||!committed(a,i)||!enabled(i))throw new Error('原控件尚未提交或不可用。');
    // Navigation 8973/7152/7571 excludes 黑幕, not the content pane's edge
    // masks. Those masks intentionally overlap the menus above the pane.
    // Scope this exception to the exact committed menu class + route label;
    // gameplay controls keep their original upper/lower-mask exclusion.
    const primaryLabel=flag===19?'历练':'修炼',secondaryLabel=flag===19?'秘境':'命石';
    const member=name=>a._instances(name).some(candidate=>candidate.uid===i.uid);
    const navigation=(i.text===primaryLabel&&i.instVars.功能===primaryLabel&&member('一级按钮文字'))||
      (i.text===secondaryLabel&&i.instVars.功能===secondaryLabel&&member('二级菜单按钮文字'));
    const blockers=['黑幕','对话背景','道具tips背景',...(navigation?[]:['遮挡底板上','遮挡底板下'])];
    const sent=await a._nativeTap(i,{allowModal:false,blockers});
    if(!sent.ok&&!sent.inputSent)throw new Error(sent.message||'原输入被拒绝。');
    // Input delivery alone is not success. Keep a retry latch on uncertain input.
    a._expeditionPending={kind:'input',uid:i.uid};
    try{
      await a._waitUntil(()=>{
        if(a._engine()!==c.engine||a._number('存档档位')!==c.slot||a._layout()!=='主界面')throw new Error('游戏或存档槽已变化。');
        return test();
      },4500);
      a._expeditionPending=null;
    }catch{throw new Error('原输入可能已发送，但游戏钟或控件尚未确认；请在原界面核对，勿重复提交。');}
  }
  const mainPreview = a => control(a,'秘境地图预览',i=>i.instVars.功能==='主显示');
  const enterButton = a => control(a,'秘境按钮文字',i=>i.text==='进入');
  const endButton = a => control(a,'秘境结束按钮文字',i=>i.text==='结束秘境');
  function expedition(a){
    const table=a._array('mj'),save=a._array('save'),level=a._number('lv');
    const ready=Boolean(a._layout()==='主界面'&&a._dataReady()&&table?.height>=20&&table?.width>=16&&table.depth>=1&&save?.height>25&&save?.width>=16&&save.depth>=1);
    const unlocked=ready&&at(a,'save',19,18)===1;
    const selectedId=parameter(a._local(PAGE)),active=a._flag('秘境开关');
    const currentId=parameter(a._local(REGION)),currentFloor=parameter(a._local(FLOOR));
    const autoExplore=a._flag('自动秘境开关'),repeat=a._flag('重复秘境开关');
    const regions=[];
    if(ready)for(let id=1;id<table.width;id++){
      const name=at(a,'mj',id,1);if(typeof name!=='string'||!name)continue;
      const requiredLevel=id*10,met=level!==null&&level>=requiredLevel;
      regions.push({id,name,requiredLevel,requiredRealm:at(a,'dj',requiredLevel,1),unlocked:unlocked&&met,
        selected:id===selectedId,highestFloor:parameter(at(a,'save',id,24)),startFloor:parameter(at(a,'save',id,25)),
        materialId:at(a,'mj',id,18),materialName:at(a,'wp',at(a,'mj',id,18),1),
        stoneIds:[at(a,'mj',id,11),at(a,'mj',id,13)],selectable:unlocked&&active===false,
        reason:!unlocked?'秘境尚未解锁。':!met?`需要${at(a,'dj',requiredLevel,1)||requiredLevel+'境'}。`:null});
    }
    const fingerprint=JSON.stringify([a._number('存档档位'),level,selectedId,active,currentId,currentFloor,
      selectedId===null?null:at(a,'save',selectedId,25)]);
    return {ready,unlocked,level,selectedId,active,currentId,currentFloor,regions,fingerprint,
      autoExplore,repeat,battle:{active:a._flag('秘境战斗开关'),playerQi:a._number('真气'),maxPlayerQi:a._number('真气上限'),
        enemyQi:parameter(a._local(116272133261412)),maxEnemyQi:parameter(a._local(916483367139881)),
        enemyAttack:parameter(a._local(421268070860292)),enemyDefense:parameter(a._local(459311314460737))}};
  }
  async function open(a,c,flag=19){
    check(a,c,flag);
    const page=flag===19?'秘境':'命石';
    if(a._global('主页界面')===page&&(flag===19?(a._flag('秘境开关')===true?endButton(a):enterButton(a)&&mainPreview(a)):control(a,'命石背景')))return;
    let entry=()=>control(a,'二级菜单按钮文字',i=>i.text===page&&i.instVars.功能===page);
    if(!entry()){
      const primaryName=flag===19?'历练':'修炼';
      const primary=control(a,'一级按钮文字',i=>i.text===primaryName&&i.instVars.功能===primaryName);
      await tap(a,primary,c,flag,()=>Boolean(entry()));
      await wait(a,()=>Boolean(entry()),c,flag);
    }
    check(a,c,flag);if(!enabled(entry()))throw new Error('原入口按钮暂不可用。');
    const ready=()=>a._global('主页界面')===page&&Boolean(flag===19?
      a._flag('秘境开关')===true?endButton(a):enterButton(a)&&mainPreview(a):control(a,'命石背景'));
    await tap(a,entry(),c,flag,ready);
    await wait(a,ready,c,flag);
  }
  p.getExpeditionSnapshot=function(){
    const s=expedition(this),why=reason(this,19),region=s.regions.find(r=>r.id===s.selectedId);
    const prepared=this._global('主页界面')==='秘境';
    const settingsReason=why||(typeof s.autoExplore!=='boolean'||typeof s.repeat!=='boolean'?'原探索设置尚未载入。':null)||(!prepared?'请先打开秘境页面。':null)||
      (!controls(this,'自动秘境勾选').some(enabled)||!controls(this,'重复秘境勾选').some(enabled)?'原探索设置尚未就绪。':null);
    return {...s,prepared,reason:why,unlockReason:!s.ready?'原秘境数据尚未载入。':!s.unlocked?'请修至炼气圆满，并完成原秘境教学。':null,
      canSelect:!why&&s.active===false,canEnter:!why&&s.active===false&&Boolean(region?.unlocked&&enabled(enterButton(this))),
      canEnd:!why&&s.active===true&&enabled(endButton(this)),
      settings:{autoExplore:s.autoExplore,repeat:s.repeat,canConfigure:!settingsReason,reason:settingsReason},
      note:'秘境掉落由原随机事件结算，不受机缘、资源获取率影响。每十层有首领；重复探索会在击败首领后重走当前十层。',
      originalControls:['开始层数调整','手动探格与敌人选择'],requiresOriginalForManualExploration:true};
  };
  p.openExpedition=function(){return action(this,19,async c=>{await open(this,c);return this._result(true,'原秘境页面已就绪。');});};
  p.selectExpedition=function(id){return action(this,19,async c=>{
    if(!Number.isInteger(id)||id<1||id>15)throw new Error('秘境编号无效。');
    if(this._flag('秘境开关')!==false)throw new Error('请先结束当前秘境。');
    await open(this,c);
    for(let step=0;step<15;step++){
      const before=expedition(this);if(before.selectedId===id)return this._result(true,'已选择原秘境。');
      const delta=Math.max(-2,Math.min(2,id-before.selectedId));
      const preview=control(this,'秘境地图预览',i=>i.instVars.功能==='列表'&&parameter(i.instVars.编号)===delta);
      await tap(this,preview,c,19,()=>parameter(this._local(PAGE))===before.selectedId+delta&&Boolean(mainPreview(this)));
      await wait(this,()=>Boolean(enterButton(this)&&mainPreview(this)),c,19);
    }
    throw new Error('原地图选择尚未确认。');
  });};
  p.enterExpedition=function(options={}){return action(this,19,async c=>{
    await open(this,c);check(this,c,19);const before=expedition(this),target=before.regions.find(r=>r.id===before.selectedId);
    if(options.expectedFingerprint!==undefined&&options.expectedFingerprint!==before.fingerprint)throw new Error('境界、秘境或起始层已变化，请重新确认。');
    if(before.active!==false||!target?.unlocked||!Number.isInteger(target.startFloor)||target.startFloor<1)throw new Error(target?.reason||'当前秘境尚不可进入。');
    await tap(this,enterButton(this),c,19,()=>this._flag('秘境开关')===true&&parameter(this._local(REGION))===target.id&&
      parameter(this._local(FLOOR))===target.startFloor&&Boolean(endButton(this)));
    return this._result(true,'已按原规则进入秘境。');
  });};
  p.configureExpedition=function(options={}){return action(this,19,async c=>{
    if(!['autoExplore','repeat'].some(key=>options[key]!==undefined))throw new Error('请选择要调整的原设置。');
    for(const key of ['autoExplore','repeat'])if(options[key]!==undefined&&typeof options[key]!=='boolean')throw new Error('原设置必须为布尔值。');
    await open(this,c);
    for(const [key,name,global]of [['autoExplore','自动秘境勾选','自动秘境开关'],['repeat','重复秘境勾选','重复秘境开关']]){
      if(options[key]===undefined||this._flag(global)===options[key])continue;
      const button=control(this,name);
      await tap(this,button,c,19,()=>this._flag(global)===options[key]&&committed(this,button)&&enabled(button));
    }
    return this._result(true,'已通过原勾选调整探索设置。');
  });};
  p.endExpedition=function(options={}){return action(this,19,async c=>{
    await open(this,c);check(this,c,19);const before=expedition(this);
    if(options.expectedFingerprint!==undefined&&options.expectedFingerprint!==before.fingerprint)throw new Error('当前秘境或层数已变化，请重新确认。');
    if(before.active!==true)throw new Error('当前未在秘境中。');
    await tap(this,endButton(this),c,19,()=>this._flag('秘境开关')===false&&this._flag('秘境战斗开关')===false&&
      this._flag('自动秘境开关')===false&&Boolean(enterButton(this)));
    return this._result(true,'已按原规则结束秘境，原自动探索已关闭。');
  });};


  const FATE_PRIMARY = ['气感','神识','根骨','悟性','机缘'];
  const FATE_SECONDARY = ['草木经验','炼器经验','金石经验','驭兽经验','炼丹经验','修炼属性','修炼速度',
    '真气回复','资源获取','祛毒速度','建筑速度','功法效率','灵物掉落'];
  const FATE_TOTALS = [...FATE_PRIMARY,...FATE_SECONDARY];
  // Shipped svzb.json [14,21,2] initializes z=1 with literal empty
  // strings. Numeric zero rows also occur in source-created empty arrays.
  // Recognize only a wholly empty source row, never coerce unknown cells.
  const emptyFateRow = values => Boolean(Array.isArray(values)&&values.length>=14&&
    (values[0]===''||values[0]===0)&&values.every(value=>value===''||value===0));
  const FATE_ACTIVITY = ['修炼','功法','历练','草木','金石','炼丹','炼器','画符','驭兽','搜索','捕兽','挑战','制造',
    '深渊','圣器精炼','渡劫','大境界渡劫','圣境突破','转世'];
  function fateActivityReason(a){
    // 7627 waits 0.2 game seconds before reading the original inventory row.
    // Reject known inventory/age producers, rather than stopping them or
    // changing the player's automatic-sale strategy behind the confirmation.
    if(a._flag('自动出售开关')===true)return '请先在原纳戒关闭自动出售，再重新核对入命，避免原等待期间库存删行。';
    const active=FATE_ACTIVITY.find(name=>a._flag(name+'开关')===true);
    if(active)return '当前'+active+'正在进行，请先停止，再重新核对命石入命。';
    if(a._flag('自动种植开关')===true||a._flag('自动挑战')===true||a._flag('神游模式')===true)
      return '请先停止自动种植、自动挑战或神游，再核对命石入命。';
    return null;
  }
  const fateSourceType = name => name === '灵物掉落' ? '灵物掉率' : name;
  function stone(a,values,index,location){
    if(!values)return null;const id=parameter(values[0]);if(!Number.isInteger(id)||at(a,'wp',id,2)!=='命石')return null;
    const name=at(a,'wp',id,1),slot=STONE_LABELS.indexOf(String(name).slice(0,1))+1,level=parameter(values[2]);
    const rank=values[8]>0?6:values[6]>0?5:values[5]>0?4:values[4]>0?3:values[3]>0?2:1;
    const primaryBase=parameter(at(a,'wp',id,4));
    const value=level===null||primaryBase===null?null:Math.round(((.5*(level-1)+primaryBase*Math.pow(1.035,level-1))*((rank+1)/7/3))*10)/10;
    const affixes=[];for(const [k,q]of [[3,9],[4,10],[5,11],[6,12],[8,13]])if(values[k]>0){
      const type=at(a,'ms',values[k],1),base=parameter(at(a,'ms',values[k],2)),quality=parameter(values[q]);
      affixes.push({type,quality,value:base===null||quality===null||level===null?null:Math.round((base/10*level*quality/100)*100)/100,unit:'%'});
    }
    const count=parameter(values[1]),lock=parameter(values[7]),primaryName=at(a,'wp',id,8);
    const known=slot>0&&level!==null&&level>=1&&Number.isSafeInteger(count)&&count>0&&lock!==null&&
      value!==null&&FATE_PRIMARY.includes(primaryName)&&values.slice(0,14).every(v=>parameter(v)!==null)&&
      affixes.every(item=>typeof item.type==='string'&&item.value!==null);
    const table=a._array(location==='inventory'?'svwp':'svzb');
    const token=known?JSON.stringify(['fate-instance-v1',safe(()=>a.engineWindow.location.origin),a._number('存档档位'),
      location,index,[table?.width,table?.height,table?.depth],values]):null;
    return {id,name,slot,location,inventoryIndex:location==='inventory'?index:null,count,level,grade:rank,
      gradeLabel:GRADES[rank-1]||'未知',primary:{name:primaryName,value},affixes,known,locked:lock===null?null:lock!==0,raw:values,token};
  }
  function fateReason(a,own=false,allowTips=false){
    return reason(a,20,own,allowTips)||(!own&&(a._fateStoneBusy||a._nativeInputBusy)?'正在处理上一项操作。':null)||
      (a._fateStonePending?'上次入命输入尚未确认，请在原界面核对并保存后重载，勿重复提交。':null)||
      fateActivityReason(a)||
      (a._instances('神国菜单背景').length?'请先返回原人物界面。':null)||
      (['操作屏蔽','制造物tips背景'].some(name=>a._instances(name).some(i=>a._visible(i)))?'请先关闭原游戏中的其他操作窗口。':null)||
      (a._flag('秘境开关')!==false||a._flag('秘境战斗开关')!==false?'请先结束当前秘境，再核对命石入命。':null);
  }
  function fateTotals(a,replacement=null){
    // Native 116-129 sums every X at svzb z=1; do not assume only ten nonzero rows.
    const table=a._array('svzb');if(!table||table.height<14||table.depth<2)return null;
    const totals=Object.fromEntries(FATE_TOTALS.map(name=>[name,0]));
    for(let index=0;index<table.width;index++){
      const values=replacement?.slot===index?replacement.values:row(a,'svzb',index,1);
      if(!values)return null;
      if(emptyFateRow(values))continue;
      const item=stone(a,values,index,'slot');if(!item?.known)return null;
      totals[item.primary.name]+=item.primary.value;
      for(const affix of item.affixes){
        const name=FATE_SECONDARY.find(label=>fateSourceType(label)===affix.type);
        if(name)totals[name]+=affix.value;
      }
    }
    for(const name of FATE_TOTALS){const scale=FATE_PRIMARY.includes(name)?10:100;totals[name]=Math.round(totals[name]*scale)/scale;}
    return totals;
  }
  const readFateTotals=a=>Object.fromEntries(FATE_TOTALS.map(name=>[name,a._number('命石'+name)]));
  const totalsEqual=(left,right)=>Boolean(left&&right&&FATE_TOTALS.every(name=>
    typeof left[name]==='number'&&typeof right[name]==='number'&&Math.abs(left[name]-right[name])<1e-8));
  function fateSnapshot(a,own=false,allowTips=false){
    const save=a._array('save'),held=a._array('svwp'),equipped=a._array('svzb');
    const ready=Boolean(a._layout()==='主界面'&&a._dataReady()&&save?.width>20&&save.height>18&&save.depth>=1&&
      held?.width>=1&&held.height>=14&&held.depth>=1&&equipped?.width>10&&equipped.height>=14&&equipped.depth>=2);
    const unlocked=ready&&at(a,'save',20,18)===1,why=fateReason(a,own,allowTips);
    const slots=STONE_LABELS.map((label,index)=>{const values=ready?row(a,'svzb',index+1,1):null,item=stone(a,values,index+1,'slot');
      return {slot:index+1,label,type:PRIMARY[index],item,empty:values?emptyFateRow(values):null,token:JSON.stringify(values)};});
    const inventory=[];if(ready)for(let index=1;index<held.width;index++){
      const item=stone(a,row(a,'svwp',index),index,'inventory');if(!item)continue;
      const itemReason=why||(!item.known?'原命石实例数据尚未完整载入。':item.locked?'这枚命石已锁定；请先在原纳戒解锁，再决定入命。':null)||
        (!slots[item.slot-1]||slots[item.slot-1].empty!==true&&!slots[item.slot-1].item?.known?'当前命位内容尚未确定。':null);
      inventory.push({...item,canInscribe:!itemReason,requiresOriginal:false,reason:itemReason,
        actions:[{id:'review-inscription',label:'核对入命',enabled:!itemReason,reason:itemReason}]});
    }
    return {ready,unlocked,reason:why,unlockReason:!ready?'原命石数据尚未载入。':!unlocked?'请先完成炼气圆满后的原秘境教学。':null,
      slots,inventory,totals:readFateTotals(a),totalUnits:Object.fromEntries(FATE_TOTALS.map(name=>[name,FATE_PRIMARY.includes(name)?'':'%'])),
      nativeInscription:true,canOpen:!why,warning:'命石入命后不能卸下；替换会使旧命石永久消失。已入命命石保留至转世以后。',
      guide:'先核对具体命石与同类命位，再确认入命；每次消耗纳戒中该实例1枚。锁定命石须先在原纳戒解锁。'};
  }
  // Digests preserve types, row order, stack count and all dimensions/depths.
  // This is freshness detection, not authentication or a storage mutation.
  function fateLedger(a){
    let h1=2166136261,h2=2246822519,cells=0;
    const add=text=>{for(let i=0;i<text.length;i++){h1=Math.imul(h1^text.charCodeAt(i),16777619);h2=Math.imul(h2^text.charCodeAt(i),3266489917);}};
    for(const name of ['svwp','svzb']){
      const table=a._array(name);
      if(!table||![table.width,table.height,table.depth].every(v=>Number.isSafeInteger(v)&&v>0)||
        table.width*table.height*table.depth>1000000)return null;
      add(JSON.stringify([name,table.width,table.height,table.depth]));
      for(let x=0;x<table.width;x++)for(let y=0;y<table.height;y++)for(let z=0;z<table.depth;z++){
        const value=a._at(table,x,y,z);if(value===null||value===undefined||typeof value==='number'&&!Number.isFinite(value))return null;
        add(JSON.stringify([typeof value,value]));cells++;
      }
    }
    return [h1>>>0,h2>>>0,cells].join(':');
  }
  function fateReview(a,index,options={},own=false,allowTips=false){
    const snapshot=fateSnapshot(a,own,allowTips),incoming=snapshot.inventory.find(item=>item.inventoryIndex===index)??null;
    const slot=incoming?.slot??null,oldSlot=slot===null?null:snapshot.slots[slot-1],previous=oldSlot?.item??null;
    const totalsBefore=snapshot.totals,calculatedBefore=snapshot.ready?fateTotals(a):null;
    const totalsAfter=incoming?.known?fateTotals(a,{slot,values:incoming.raw}):null;
    const ledger=snapshot.ready?fateLedger(a):null;
    const why=snapshot.reason||(!Number.isSafeInteger(index)||index<1?'请选择原纳戒中的具体命石。':!incoming?'该命石已不在当前纳戒行中。':
      options.expectedToken!==undefined&&options.expectedToken!==incoming.token?'命石实例或纳戒行已变化，请重新查看。':
      !incoming.canInscribe?incoming.reason:!ledger||!totalsAfter||!totalsEqual(calculatedBefore,totalsBefore)?
        '原命位、命石合计或库存数据尚未确认，请等待原界面刷新。':null);
    const token=!why?JSON.stringify(['fate-review-v1',incoming.token,ledger,oldSlot.token,totalsBefore,totalsAfter,
      at(a,'save',20,18)]):null;
    return {ready:snapshot.ready,canConfirm:!why,token,inventoryIndex:index,slot,slotLabel:oldSlot?.label??null,
      incoming,previous,replacing:Boolean(previous),totalsBefore,totalsAfter,
      summary:incoming?'将'+incoming.name+'（'+incoming.gradeLabel+'，'+incoming.level+'级）入命至'+oldSlot?.label+'位，消耗该实例1枚。':'请重新选择命石。',
      warnings:[previous?'原命位中的'+previous.name+'将永久消失，不返还纳戒。':'本次放入空命位。','入命后不能卸下；已入命命石按原规则保留至转世以后。'],
      reason:why};
  }
  function inventoryCounts(a){
    const table=a._array('svwp');if(!table||table.height<14)return null;
    const counts=new Map();
    for(let index=1;index<table.width;index++){
      const values=row(a,'svwp',index);if(!values)return null;
      const id=parameter(values[0]),quantity=parameter(values[1]);if(id===0&&quantity===0)continue;
      if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(quantity)||quantity<1)return null;
      const identity=JSON.stringify([values[0],...values.slice(2,14)]);
      counts.set(identity,(counts.get(identity)||0)+quantity);
    }
    return counts;
  }
  const countsEqual=(left,right)=>Boolean(left&&right&&[...new Set([...left.keys(),...right.keys()])]
    .every(key=>(left.get(key)||0)===(right.get(key)||0)));
  p.getFateStoneSnapshot=function(){return fateSnapshot(this);};
  p.getFateStoneDetail=function(index){return this.getFateStoneSnapshot().inventory.find(item=>item.inventoryIndex===index)??null;};
  p.getFateStoneReview=function(index,options={}){return fateReview(this,index,options);};
  p.openFateStones=function(){return action(this,20,async c=>{await open(this,c,20);return this._result(true,'原命石页面已就绪。');});};
  p.inscribeFateStone=async function(index,options={}){
    const why=fateReason(this);if(why)return this._fail(why);
    this.busy=true;this._fateStoneBusy=true;const context=ctx(this),origin=safe(()=>this.engineWindow.location.origin);
    let created=false,submitted=false,ownedTipUids=new Set();
    const verifyContext=allowTips=>{
      if(this._engine()!==context.engine||this._number('存档档位')!==context.slot||
        safe(()=>this.engineWindow.location.origin)!==origin)throw new Error('游戏或存档槽已变化，请重新核对。');
      const error=fateReason(this,true,allowTips);if(error)throw new Error(error);
    };
    try{
      const review=fateReview(this,index,{},true);
      if(options.confirmed!==true)return this._fail('请先核对命石与命位，明确确认入命及替换损失。',{requiresConfirmation:true,review});
      if(typeof options.expectedToken!=='string'||options.expectedToken!==review.token)return this._fail('命石、命位或库存已经变化，请重新核对。',{stale:true});
      if(!review.canConfirm)return this._fail(review.reason);
      if(this._fateStoneUsedReviews?.has(review.token))return this._fail('这份入命确认已提交，请核对原游戏结果。');
      if(!this._first('系统菜单背景'))return this._fail('原人物菜单尚未建立。');
      verifyContext(false);
      this._call('关闭物品tips');
      await this._waitUntil(()=>{verifyContext(false);return controls(this,'道具tips按钮文字').length===0&&controls(this,'道具tips背景').length===0;},2500);
      // Original 972, same native inventory page as openOriginal('inventory').
      // No inventory sorting, slot setter, unlock or permission helper is called.
      const oldGrid=new Set(this._instances('纳戒行囊框背景').map(i=>i.uid));
      this._call('打开纳戒分页',0,0,'命石');
      await this._waitUntil(()=>{verifyContext(false);return this._global('分页界面')==='纳戒'&&
        controls(this,'纳戒行囊框背景').some(i=>!oldGrid.has(i.uid)&&i.instVars.用途==='纳戒');},3500);
      if(fateReview(this,index,{},true).token!==review.token)return this._fail('打开原纳戒后实例或命位已变化，请重新核对。',{stale:true});
      const viewport=safe(()=>this.runtime.layout.getLayer(19).getViewport());
      const width=parameter(viewport?.width),height=parameter(viewport?.height);
      if(width===null||height===null||width<500||height<500)return this._fail('原游戏提示层视口尚未就绪。');
      const values=review.incoming.raw;
      const params=[viewport.left+width/2-80,viewport.top+height/2-160,index,'纳戒',0,0,
        ...values.slice(2,7),values[1],values[0],5,...values.slice(8,14),0];
      if(params.length!==21||params.some(value=>value===null||value===undefined))return this._fail('原命石提示参数不完整。');
      const previous=new Set(this._instances('道具tips按钮文字').map(i=>i.uid));
      this._call('道具tips建立',...params);created=true;
      let button=null;
      await this._waitUntil(()=>{
        verifyContext(true);
        const buttons=controls(this,'道具tips按钮文字');
        ownedTipUids=new Set(buttons.filter(i=>!previous.has(i.uid)&&parameter(i.instVars.道具序号)===index).map(i=>i.uid));
        button=buttons.find(i=>ownedTipUids.has(i.uid)&&i.text==='入命'&&enabled(i))??null;
        return Boolean(button&&controls(this,'道具tips背景').length===1&&
          buttons.every(i=>ownedTipUids.has(i.uid)));
      },3500);
      verifyContext(true);
      if(fateReview(this,index,{},true,true).token!==review.token)return this._fail('命石实例、锁定状态或原命位已变化，请重新核对。',{stale:true});
      if(!button||!committed(this,button)||!this._visible(button)||!enabled(button)||parameter(button.instVars.道具序号)!==index)
        return this._fail('原入命按钮尚未提交或已变化。');
      const expectedCounts=inventoryCounts(this);if(!expectedCounts)return this._fail('原纳戒数量尚未确认。');
      const identity=JSON.stringify([values[0],...values.slice(2,14)]);
      expectedCounts.set(identity,(expectedCounts.get(identity)||0)-1);
      const sent=await this._nativeTap(button,{allowModal:false,blockers:['遮挡底板上','数字输入背景','筛选背景']});
      if(!sent?.ok&&!sent?.inputSent)return sent||this._fail('原入命按钮未接收操作。');
      submitted=true;(this._fateStoneUsedReviews??=new Set()).add(review.token);
      this._fateStonePending={index,slot:review.slot,token:review.token};
      await this._waitUntil(()=>{
        if(this._engine()!==context.engine||this._number('存档档位')!==context.slot||
          this._layout()!=='主界面'||safe(()=>this.engineWindow.location.origin)!==origin)throw new Error('游戏或存档槽已变化。');
        const equipped=row(this,'svzb',review.slot,1);
        return equipped&&same(equipped.slice(0,14),values.slice(0,14))&&countsEqual(inventoryCounts(this),expectedCounts)&&
          totalsEqual(readFateTotals(this),review.totalsAfter)&&controls(this,'道具tips按钮文字').length===0;
      },6500);
      this._fateStonePending=null;
      return this._result(true,'已按原游戏规则入命'+review.incoming.name+'。',{slot:review.slot,itemId:review.incoming.id,
        replaced:Boolean(review.previous),totals:readFateTotals(this)});
    }catch(error){return this._fail(submitted?'原入命可能已提交，但结果尚未完整确认；请在原界面核对，勿重复提交。':
      error.message||'原命石入命尚未完成。',submitted?{requiresOriginal:true,transactionMayHaveRun:true}:{});}
    finally{
      // Never destroy a button after uncertain submission: original Wait(0.2)
      // still owns that SOL and must be allowed to finish normally.
      if(created&&!submitted&&this._engine()===context.engine&&this._number('存档档位')===context.slot&&
        controls(this,'道具tips按钮文字').some(i=>ownedTipUids.has(i.uid)))safe(()=>this._call('关闭物品tips'));
      this._fateStoneBusy=false;this.busy=false;
    }
  };

})();
