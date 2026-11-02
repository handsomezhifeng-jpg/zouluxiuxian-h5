// Construction-only model. No DOM, original game save, quest or economy imports.
const copy=value=>JSON.parse(JSON.stringify(value));
const key=(x,y)=>`${x},${y}`;
const ok=(message,extra={})=>({ok:true,message,...extra});
const fail=message=>({ok:false,message});
const number=value=>Number.isFinite(value)&&value>=0;
const overlaps=(a,b)=>a.x<b.x+b.size[0]&&a.x+a.size[0]>b.x&&a.y<b.y+b.size[1]&&a.y+a.size[1]>b.y;
const cells=rect=>Array.from({length:rect.size[0]*rect.size[1]},(_,i)=>[rect.x+i%rect.size[0],rect.y+Math.floor(i/rect.size[0])]);

export class CityBuilderEngine{
  constructor(data,{save=null,cityId=Object.keys(data.cities)[0],now=Date.now(),resources=null,durationScale=1,canPerform=null}={}){
    if(data.version!==1||!data.cities[cityId])throw Error('城建数据或城市无效。');
    if(!number(now)||!number(durationScale))throw Error('时间或施工倍率无效。');
    this.data=data;this.durationScale=durationScale;this.canPerform=canPerform;this.listeners=new Set();this.maps=new Map();
    for(const definition of Object.values(data.cities)){
      const source=data.world.maps.find(m=>m.id===definition.mapId);if(!source)throw Error('缺少地图：'+definition.mapId);
      const offsetX=source.normalization?.offsetX??-source.occupiedBounds.minX,offsetY=source.normalization?.offsetY??-source.occupiedBounds.minY;
      const normalize=list=>new Set((list||[]).map(p=>key(p[0]+offsetX,p[1]+offsetY)));
      this.maps.set(definition.id,{source,offsetX,offsetY,land:normalize(source.layers.ground.cells),water:normalize(source.layers.river?.cells),blocked:normalize(source.cantPass),regionByCell:new Map(definition.regions.flatMap(r=>r.cells.map(p=>[p.join(','),r.id])))});
    }
    this.state={kind:'chengjian',version:1,now,activeCity:cityId,serial:100,resources:resources===null?null:copy(resources),cities:{}};
    for(const definition of Object.values(data.cities)){
      const buildings=copy(definition.initialBuildings),roads=copy(definition.initialRoads);
      const occupied=o=>buildings.some(b=>overlaps({...b,size:data.buildings[b.type].size},o))||roads.some(p=>cells(o).some(c=>c[0]===p[0]&&c[1]===p[1]));
      this.state.cities[definition.id]={buildings,roads,opened:[...definition.initialRegions],cleared:[],repaired:[],suppressed:definition.objects.filter(occupied).map(o=>o.id),jobs:[]};
    }
    this._validateResources(this.state.resources);
    if(save!==null)this._restore(save);
    this.tick(Math.max(now,this.state.now));
  }
  get cityId(){return this.state.activeCity;}
  get city(){return this.state.cities[this.cityId];}
  get definition(){return this.data.cities[this.cityId];}
  subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
  setResources(resources){try{this._validateResources(resources);}catch(error){return fail(error.message);}this.state.resources=copy(resources);this._emit('resources');return ok('城建物资已更新。');}
  _emit(type,detail={}){for(const listener of this.listeners)try{listener({type,cityId:this.cityId,...detail},this);}catch(error){this.lastListenerError=error;}}
  _validateResources(resources){if(resources!==null&&(!resources||Array.isArray(resources)||typeof resources!=='object'||Object.values(resources).some(v=>!number(v))))throw Error('物资存档无效。');}
  _owned(cityId=this.cityId){const c=this.state.cities[cityId],d=this.data.cities[cityId];return new Set([...d.startingCells,...d.regions.filter(r=>c.opened.includes(r.id)).flatMap(r=>r.cells)].map(p=>p.join(',')));}
  _clearedTiles(cityId=this.cityId){const c=this.state.cities[cityId];return new Set(this.data.cities[cityId].objects.filter(o=>c.cleared.includes(o.id)).flatMap(cells).map(p=>p.join(',')));}
  _occupied(object,cityId=this.cityId){const city=this.state.cities[cityId];return city.buildings.some(b=>overlaps({...b,size:this.data.buildings[b.type].size},object))||city.roads.some(p=>cells(object).some(c=>c[0]===p[0]&&c[1]===p[1]));}
  visibleObjects(cityId=this.cityId){const city=this.state.cities[cityId];return this.data.cities[cityId].objects.filter(o=>!city.cleared.includes(o.id)&&!(city.suppressed.includes(o.id)&&this._occupied(o,cityId)));}
  _passable(x,y,owned=this._owned(),cleared=this._clearedTiles()){
    const m=this.maps.get(this.cityId),k=key(x,y);return owned.has(k)&&m.land.has(k)&&!m.water.has(k)&&(!m.blocked.has(k)||cleared.has(k));
  }
  canPlace(type,x,y,ignoreId=null){
    const d=this.data.buildings[type];if(!d)return fail('没有这种建筑。');
    if(!Number.isInteger(x)||!Number.isInteger(y))return fail('建筑位置必须是整数格。');
    const rect={x,y,size:d.size},owned=this._owned(),cleared=this._clearedTiles();
    if(!cells(rect).every(p=>this._passable(...p,owned,cleared)))return fail('请放在已开辟的有效陆地上。');
    if(this.city.buildings.some(b=>b.id!==ignoreId&&overlaps(rect,{...b,size:this.data.buildings[b.type].size})))return fail('这里已有建筑。');
    if(this.visibleObjects().some(o=>overlaps(rect,o)))return fail('请先清理这里的障碍；雕像所在格不能营造。');
    if(d.nearWater&&!cells(rect).some(([x,y])=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>this.maps.get(this.cityId).water.has(key(x+dx,y+dy)))))return fail('这座建筑需要临河。');
    return ok('可以放置。');
  }
  _payment(cost){
    if(!cost||Object.values(cost).some(v=>!number(v)))return fail('费用数据无效。');
    if(this.state.resources!==null)for(const [id,value]of Object.entries(cost))if((this.state.resources[id]||0)<value)return fail('物资不足：'+id);
    return ok('');
  }
  _commit(kind,payload,cost,apply){
    const payment=this._payment(cost);if(!payment.ok)return payment;
    if(this.canPerform){let check;try{check=this.canPerform({kind,cityId:this.cityId,payload:copy(payload),cost:copy(cost),now:this.state.now});}catch(error){return fail(error.message||'宿主条件检查失败。');}
      if(check?.then)return fail('canPerform须同步返回；异步确认应由宿主在调用前完成。');
      if(check===false||check?.ok===false)return fail(check?.message||'当前项目条件不允许此操作。');}
    if(this.state.resources!==null)for(const [id,value]of Object.entries(cost))this.state.resources[id]=(this.state.resources[id]||0)-value;
    const result=apply();this.tick(this.state.now);this._emit(kind,{...result,payload:copy(payload),cost:copy(cost)});return ok('操作完成。',{...result,cost:copy(cost)});
  }
  _job(kind,target,duration,extra={}){const job={id:'j'+(++this.state.serial),kind,target,startedAt:this.state.now,endsAt:this.state.now+Math.round(duration*this.durationScale*1000),...extra};this.city.jobs.push(job);return job;}
  _busy(id){return this.city.jobs.some(j=>j.target===id);}
  build(type,x,y){
    const d=this.data.buildings[type];if(!d?.buildable)return fail('这座建筑不允许重复营造。');
    const place=this.canPlace(type,x,y);if(!place.ok)return place;
    if(this.city.buildings.filter(b=>b.type===type).length>=d.maxCount)return fail('已达到该建筑数量上限。');
    return this._commit('build',{type,x,y},d.cost,()=>{const b={id:'b'+(++this.state.serial),type,x,y,level:1};this.city.buildings.push(b);this.city.roads=this.city.roads.filter(p=>!cells({...b,size:d.size}).some(c=>c[0]===p[0]&&c[1]===p[1]));const job=this._job('build',b.id,d.duration,{cost:copy(d.cost)});return {id:b.id,jobId:job.id};});
  }
  getUpgradeInfo(id){
    const b=this.city.buildings.find(b=>b.id===id);if(!b)return fail('找不到建筑。');
    if(this._busy(id))return fail('请先完成当前施工。');
    const d=this.data.buildings[b.type],next=d.upgrades.find(u=>u.level===b.level+1);
    if(b.level>=d.maxLevel)return fail('已经达到最高等级。');
    if(!next?.supported)return fail('这一档的原升级条件尚未核实，暂未开放。');
    return ok('可以升级。',copy(next));
  }
  upgrade(id){const info=this.getUpgradeInfo(id);if(!info.ok)return info;return this._commit('upgrade',{id,level:info.level},info.cost,()=>({id,jobId:this._job('upgrade',id,info.duration,{level:info.level,cost:copy(info.cost)}).id}));}
  move(id,x,y){
    const b=this.city.buildings.find(b=>b.id===id);if(!b)return fail('找不到建筑。');if(!this.data.buildings[b.type].movable||this._busy(id))return fail('这座建筑当前不能搬迁。');
    const check=this.canPlace(b.type,x,y,id);if(!check.ok)return check;
    return this._commit('move',{id,x,y},{},()=>{b.x=x;b.y=y;const footprint=cells({...b,size:this.data.buildings[b.type].size});this.city.roads=this.city.roads.filter(p=>!footprint.some(c=>p[0]===c[0]&&p[1]===c[1]));return {id};});
  }
  demolish(id){
    const b=this.city.buildings.find(b=>b.id===id);if(!b)return fail('找不到建筑。');if(!this.data.buildings[b.type].demolishable||this._busy(id))return fail('这座建筑当前不能拆除。');
    return this._commit('demolish',{id},{},()=>{this.city.buildings=this.city.buildings.filter(b=>b.id!==id);return {id};});
  }
  setRoad(x,y,enabled=true){
    if(typeof enabled!=='boolean')return fail('道路开关必须是布尔值。');
    if(!Number.isInteger(x)||!Number.isInteger(y))return fail('道路位置必须是整数格。');
    const exists=this.city.roads.some(p=>p[0]===x&&p[1]===y);if(exists===enabled)return fail(enabled?'这里已有道路。':'这里没有道路。');
    if(enabled&&(!this._passable(x,y)||this.city.buildings.some(b=>overlaps({x,y,size:[1,1]},{...b,size:this.data.buildings[b.type].size}))||this.visibleObjects().some(o=>overlaps({x,y,size:[1,1]},o))))return fail('请在没有障碍的已开陆地铺路。');
    return this._commit(enabled?'road':'remove-road',{x,y},enabled?{coins:1}:{},()=>{if(enabled)this.city.roads.push([x,y]);else this.city.roads=this.city.roads.filter(p=>p[0]!==x||p[1]!==y);return {x,y};});
  }
  getRegionInfo(id){
    const r=this.definition.regions.find(r=>r.id===id);if(!r)return fail('找不到区域。');
    if(this.city.opened.includes(id))return fail('这个区域已经开辟。');if(this._busy(id))return fail('这个区域正在开辟。');
    if(r.access.length&&!r.access.some(id=>this.city.opened.includes(id)))return fail('请先开辟前置区域。');return ok('可以开辟。',copy(r));
  }
  unlockRegion(id){const info=this.getRegionInfo(id);if(!info.ok)return info;return this._commit('unlock-region',{id,sourceConditions:info.sourceConditions},info.cost,()=>({id,jobId:this._job('region',id,info.duration).id}));}
  getObjectInfo(id){
    const o=this.definition.objects.find(o=>o.id===id);if(!o)return fail('找不到地图物件。');
    if(this._busy(id))return fail('物件正在施工。');if(this.city.cleared.includes(id)||this.city.repaired.includes(id))return fail('已经处理过这个物件。');
    if(this._occupied(o))return fail('请先搬迁占用此处的建筑或道路。');const owned=this._owned();if(!cells(o).every(p=>owned.has(p.join(','))))return fail('请先开辟物件所在区域。');
    return ok(o.kind==='statue'?'可以修复。':'可以清理。',copy(o));
  }
  clearObstacle(id){const info=this.getObjectInfo(id);if(!info.ok)return info;if(info.kind==='statue')return fail('雕像请使用修复操作。');return this._commit('clear',{id},info.cost,()=>({id,jobId:this._job('clear',id,info.duration).id}));}
  repairStatue(id){const info=this.getObjectInfo(id);if(!info.ok)return info;if(info.kind!=='statue')return fail('这不是雕像。');return this._commit('repair',{id},info.cost,()=>({id,jobId:this._job('repair',id,info.duration).id}));}
  _finish(city,job){
    if(job.kind==='upgrade')city.buildings.find(b=>b.id===job.target).level=job.level;
    if(job.kind==='region')city.opened.push(job.target);
    if(job.kind==='clear')city.cleared.push(job.target);
    if(job.kind==='repair')city.repaired.push(job.target);
    city.jobs=city.jobs.filter(j=>j.id!==job.id);
  }
  tick(now=Date.now()){
    if(!number(now)||now<this.state.now)return fail('时间无效或发生倒退。');this.state.now=now;let completed=0;
    for(const [cityId,city]of Object.entries(this.state.cities))for(const job of [...city.jobs])if(job.endsAt<=now){this._finish(city,job);completed++;this._emit('complete',{cityId,job:copy(job)});}
    return ok('时间已更新。',{completed});
  }
  finishNow(jobId){const job=this.city.jobs.find(j=>j.id===jobId);if(!job)return fail('找不到施工任务。');this._finish(this.city,job);this._emit('complete',{job:copy(job),editor:true});return ok('施工已完成。');}
  switchCity(cityId){if(!this.state.cities[cityId])return fail('找不到城市。');this.state.activeCity=cityId;this._emit('switch-city');return ok('已切换城市。');}
  exportSave(){return JSON.stringify(this.state);}
  _restore(input){
    const candidate=typeof input==='string'?JSON.parse(input):copy(input);
    if(candidate?.kind!=='chengjian'||candidate.version!==1||!number(candidate.now)||!Number.isSafeInteger(candidate.serial)||candidate.serial<100||!this.data.cities[candidate.activeCity])throw Error('不是有效的独立城建存档。');
    this._validateResources(candidate.resources);
    const previous=this.state;this.state=candidate;
    try{
      if(Object.keys(candidate.cities||{}).sort().join()!==Object.keys(this.data.cities).sort().join())throw Error('存档的城市集合不匹配。');
      for(const [cityId,city]of Object.entries(candidate.cities)){
        const d=this.data.cities[cityId];for(const field of ['buildings','roads','opened','cleared','repaired','suppressed','jobs'])if(!Array.isArray(city[field]))throw Error('城建存档缺少列表。');
        const unique=(items,ids)=>items.every(id=>ids.has(id))&&new Set(items).size===items.length;
        if(!unique(city.opened,new Set(d.regions.map(r=>r.id)))||!unique(city.cleared,new Set(d.objects.filter(o=>o.kind!=='statue').map(o=>o.id)))||!unique(city.repaired,new Set(d.objects.filter(o=>o.kind==='statue').map(o=>o.id)))||!unique(city.suppressed,new Set(d.objects.map(o=>o.id))))throw Error('存档引用了未知的地块或物件。');
        const ids=new Set();for(const b of city.buildings){const def=this.data.buildings[b.type];if(!def||typeof b.id!=='string'||ids.has(b.id)||!Number.isInteger(b.x)||!Number.isInteger(b.y)||!Number.isInteger(b.level)||b.level<1||b.level>def.maxLevel||(/^b\d+$/.test(b.id)&&Number(b.id.slice(1))>candidate.serial))throw Error('建筑存档无效。');ids.add(b.id);}
        const terrain=this.maps.get(cityId),owned=this._owned(cityId),cleared=this._clearedTiles(cityId),validTile=p=>owned.has(p.join(','))&&terrain.land.has(p.join(','))&&!terrain.water.has(p.join(','))&&(!terrain.blocked.has(p.join(','))||cleared.has(p.join(',')));
        for(let i=0;i<city.buildings.length;i++){const b=city.buildings[i],rect={...b,size:this.data.buildings[b.type].size};if(!cells(rect).every(validTile))throw Error('建筑超出已开有效陆地。');if(city.buildings.slice(i+1).some(other=>overlaps(rect,{...other,size:this.data.buildings[other.type].size})))throw Error('存档建筑互相重叠。');}
        if(city.roads.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isInteger)||!this.maps.get(cityId).land.has(p.join(','))||this.maps.get(cityId).water.has(p.join(',')))||new Set(city.roads.map(p=>p.join(','))).size!==city.roads.length)throw Error('道路存档无效。');
        if(city.roads.some(p=>!validTile(p)||city.buildings.some(b=>overlaps({x:p[0],y:p[1],size:[1,1]},{...b,size:this.data.buildings[b.type].size}))))throw Error('道路被建筑占用或超出有效地块。');
        if(this.visibleObjects(cityId).some(o=>this._occupied(o,cityId)))throw Error('建筑或道路与未清理物件重叠。');
        const jobs=new Set(),targets=new Set();for(const j of city.jobs){if(!['build','upgrade','region','clear','repair'].includes(j.kind)||typeof j.id!=='string'||jobs.has(j.id)||(/^j\d+$/.test(j.id)&&Number(j.id.slice(1))>candidate.serial)||targets.has(j.target)||!number(j.startedAt)||j.startedAt>candidate.now||!number(j.endsAt)||j.endsAt<j.startedAt)throw Error('施工存档无效。');jobs.add(j.id);targets.add(j.target);
          if(['build','upgrade'].includes(j.kind)&&!ids.has(j.target))throw Error('施工找不到建筑。');
          if(j.kind==='upgrade'){const b=city.buildings.find(b=>b.id===j.target);if(j.level!==b.level+1||j.level>this.data.buildings[b.type].maxLevel)throw Error('升级目标无效。');}
          if(j.kind==='region'&&(!d.regions.some(r=>r.id===j.target)||city.opened.includes(j.target)))throw Error('开拓目标无效。');
          if(['clear','repair'].includes(j.kind)&&(!d.objects.some(o=>o.id===j.target&&(o.kind==='statue')===(j.kind==='repair'))||city.cleared.includes(j.target)||city.repaired.includes(j.target)))throw Error('物件施工目标无效。');
        }
      }
    }catch(error){this.state=previous;throw error;}
  }
  getSnapshot(){
    const city=copy(this.city),now=this.state.now;
    city.buildings=city.buildings.map(b=>{const job=city.jobs.find(j=>j.target===b.id);return {...b,status:job?job.kind==='upgrade'?'upgrading':'building':'idle',job,progress:job?Math.min(1,(now-job.startedAt)/Math.max(1,job.endsAt-job.startedAt)):1};});
    city.objects=this.visibleObjects().map(o=>({...copy(o),repaired:city.repaired.includes(o.id),job:city.jobs.find(j=>j.target===o.id)}));
    city.regions=this.definition.regions.map(r=>({...copy(r),opened:city.opened.includes(r.id),canStart:this.getRegionInfo(r.id).ok,job:city.jobs.find(j=>j.target===r.id)}));
    return {cityId:this.cityId,now,resources:copy(this.state.resources),...city};
  }
}
