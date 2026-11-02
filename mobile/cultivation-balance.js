/* Shared by native combat settlement, snapshots, method cards and gain tips. */
(()=>{
  const table=globalThis.MobileCultivationTable;
  const fields=[['qi',3,4,'气血'],['attack',4,5,'攻击'],['defense',5,6,'防御']];
  let runtime=null,source=null;
  const baseRaw={};
  const cell=(name,x,y)=>Number(table.tables[name].data[x]?.[y]?.[0])||0;
  const read=(x,y)=>Number(runtime?.objects?.save?.getFirstInstance()?.getAt(x,y))||0;
  const modifier=()=>Number(runtime?.globalVars?.命石修炼属性)||0;
  function foundation(){
    const raw=source?.baseRaw||baseRaw;
    return globalThis.MobileTurnCombat.profile({maxQi:raw.qi||0,qi:raw.qi||0,attack:raw.attack||0,defense:raw.defense||0});
  }
  function method(id,level){
    return fields.map(([key,column,,label])=>{
      const base=cell('xl',id,column),total=MobileMeditation.total(level,base,modifier());
      return {key,label,total,next:MobileMeditation.total(level+1,base,modifier())-total,unit:''};
    });
  }
  function art(id,level){
    const base=foundation();
    const result=fields.map(([key,,column,label])=>{
      const rate=Math.round((key==='qi'?base.maxQi:base[key])*cell('gf',id,column)/100);
      return {key,label,total:rate*level,next:rate,unit:''};
    });
    for(const [key,column,label,unit,divisor] of [['lifespan',7,'寿元','年',1],['cultivationSpeedPercent',8,'修炼速度','%',1],['detoxRaw',9,'祛毒','',100]]){
      const total=cell('gf',id,column)*level/divisor;
      // Lifespan is integer-valued in native settlement; next is its confirmed marginal gain.
      const next=key==='lifespan'?Math.round(lifeTotal()+cell('gf',id,column))-Math.round(lifeTotal()):cell('gf',id,column)/divisor;
      if(total||next)result.push({key,label,total:key==='lifespan'?Math.round(total):total,next,unit});
    }
    return result;
  }
  function lifeTotal(){
    if(runtime){const g=runtime.globalVars;return Number(g.初始寿元||0)+Number(g.丹药寿元||0)+Number(g.灵果寿元||0)+Number(runtime.callFunction('寿元加成计算',0)||0);}
    return 0;
  }
  function profile(raw){
    if(!runtime||!Number.isFinite((source?.baseRaw||baseRaw).qi))return globalThis.MobileTurnCombat.profile(raw);
    const base=foundation(),total={qi:base.maxQi,attack:base.attack,defense:base.defense};
    for(let id=1;id<table.tables.xl.size[0];id++)for(const gain of method(id,read(id,1)))total[gain.key]+=gain.total;
    for(let id=1;id<table.tables.gf.size[0];id++){
      const level=read(id,2);if(!level)continue;
      for(const [key,,column] of fields)total[key]+=Math.round((key==='qi'?base.maxQi:base[key])*cell('gf',id,column)/100)*level;
    }
    const ratio=Math.max(0,Math.min(1,(Number(raw.qi)||0)/Math.max(1,Number(raw.maxQi??raw.qi)||0)));
    return {maxQi:total.qi,qi:Math.ceil(total.qi*ratio),attack:total.attack,defense:total.defense};
  }
  function format(value){const n=Math.abs(value),unit=n>=1e8?'亿':n>=1e4?'万':'',scaled=unit==='亿'?value/1e8:unit==='万'?value/1e4:value;return new Intl.NumberFormat('zh-CN',{maximumFractionDigits:4}).format(scaled)+unit;}
  function gainRows(before,after){
    const rows=[['气血','maxQi'],['攻击','attack'],['防御','defense'],['寿元','lifespan']].map(([label,key])=>[label,(after.stats?.[key]||0)-(before.stats?.[key]||0),key==='lifespan'?'年':'']).filter(([,gain])=>gain>0);
    for(const a of after.methodArts||[]){const old=(before.methodArts||[]).find(v=>v.id===a.id);if(!old||a.level<=old.level)continue;for(const g of a.balanceGains||[]){if(!['cultivationSpeedPercent','detoxRaw'].includes(g.key))continue;const prior=old.balanceGains?.find(v=>v.key===g.key);const delta=Number((g.total-(prior?.total||0)).toFixed(8));if(delta>0)rows.push([g.label,delta,g.unit]);}}
    return rows;
  }
  const api={table,baseRaw,method,art,profile,format,gainRows,bind(value,engineSource=null){runtime=value;source=engineSource;}};
  globalThis.MobileCultivationBalance=api;
  if(typeof module!=='undefined')module.exports=api;
})();
