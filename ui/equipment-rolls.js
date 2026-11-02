/* Independent rolls: quality controls affix count, stars control each affix multiplier. */
(()=>{'use strict';
const qualities=[['凡品','#77746b'],['珍品','#39824d'],['法器','#3777b8'],['灵器','#8952ab'],['灵宝','#c47c19'],['仙器','#bd4141']].map(([name,color],index)=>({name,color,textColor:['#625d53','#28643a','#285f92','#70408e','#8b5510','#9f2b2b'][index],index,count:index+1}));
// Integer-only balance table: base value, realm growth per tier, score per point.
const balanceVersion=2;
const attributes=[['attack','攻击',12,1.65,1],['defense','防御',8,1.65,1.5],['maxQi','气血',120,1.65,.1],['speed','速度',2,1.12,6],['crit','暴击',12,1.18,1],['accuracy','命中',12,1.18,1],['dodge','闪避',12,1.18,1],['critResist','抗暴击',12,1.18,1],['lifesteal','吸血',6,1.65,2],...['金','木','水','火','土'].map((n,i)=>[['metal','wood','water','fire','earth'][i]+'Attack',n+'攻击',10,1.65,1.2]),...['金','木','水','火','土'].map((n,i)=>[['metal','wood','water','fire','earth'][i]+'Resist',n+'抗性',8,1.65,1.5])].map(([key,name,base,growth,scoreWeight])=>({key,name,base,growth,scoreWeight,percent:false}));
const byKey=Object.fromEntries(attributes.map(a=>[a.key,a]));let serial=0;
const valueFor=(key,tier,multiplier)=>Math.max(1,Math.round(byKey[key].base*Math.pow(byKey[key].growth,tier)*multiplier));
function rebalance(item){return {...item,balanceVersion,affixes:item.affixes.map(a=>{const multiplier=Number.isFinite(a.multiplier)?Math.max(1+(item.stars-1)*.1,Math.min(1+item.stars*.1,a.multiplier)):1+(item.stars-1)*.1+.05;return {...a,multiplier,value:valueFor(a.key,item.tier,multiplier)};})};}
function roll(base,rng=Math.random){const quality=Math.min(5,Math.floor(rng()*6)),stars=Math.min(9,1+Math.floor(rng()*9)),pool=[...attributes],affixes=[];for(let i=0;i<quality+1;i++){const a=pool.splice(Math.min(pool.length-1,Math.floor(rng()*pool.length)),1)[0],multiplier=1+(stars-1)*.1+rng()*.1;affixes.push({key:a.key,value:valueFor(a.key,base.tier,multiplier),multiplier});}const atlas=globalThis.MobileEquipmentAtlas||window.MobileEquipmentAtlas,appearance=atlas?.variant?.(base,quality)||base;return {...appearance,baseId:appearance.id,id:'gear-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+(++serial)),quality,stars,affixes,balanceVersion};}
function bonus(i){return i?.affixes?Object.fromEntries(i.affixes.map(a=>[a.key,a.value])):{};}
function format(key,value){return '+'+Math.round(Number(value)).toLocaleString('zh-CN');}
function score(item){return Math.round((item?.affixes||[]).reduce((sum,a)=>sum+a.value*(byKey[a.key]?.scoreWeight||0),0)*100)/100;}
function compare(a,b,realm,atlas=globalThis.MobileEquipmentAtlas){return Number(atlas.canCarry(b,realm))-Number(atlas.canCarry(a,realm))||score(b)-score(a)||b.quality-a.quality||b.stars-a.stars||String(a.id).localeCompare(String(b.id));}
window.MobileEquipmentRolls={qualities,attributes,byKey,roll,bonus,format,score,compare,rebalance,balanceVersion};
})();
