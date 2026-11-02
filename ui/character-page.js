/* Four-slot character equipment presentation. Native stats remain authoritative. */
(() => {
 const base=new URL('./',document.currentScript.src).href;
 let activeTab='bonus';
 const traitTips={
  qiSense:{name:'气感',effect:'影响气血上限与修炼速度。气感越高，气血上限越高，同一层法门的修炼耗时越短。'},
  spiritualSense:{name:'神识',effect:'影响攻击。总神识参与攻击数值计算，神识越高，同等境界、法门和装备下的攻击越高。'},
  constitution:{name:'根骨',effect:'影响防御。总根骨参与防御数值计算，根骨越高，同等其他条件下的防御越高，承受攻击和雷劫时减伤更多。'},
  comprehension:{name:'悟性',effect:'影响功法参悟效率。每月参悟进度由总悟性与功法参悟效率共同计算；悟性越高，功法修习越快。'},
  luck:{name:'机缘',effect:'影响常规资源获取。总机缘参与常规资源收益计算；机缘越高，相关收益越高。秘境掉落不受机缘和资源获取率影响。'}
 };
 function traitEffects(key,total){
  if(total==null||!Number.isFinite(Number(total)))return [];
  const gain=Math.round((Number(total)-1)*1000)/10;
  const rows={qiSense:['气血上限','修炼速度'],spiritualSense:['攻击'],constitution:['防御'],comprehension:['功法参悟效率'],luck:['常规资源获取']};
  return (rows[key]||[]).map(label=>({label,value:gain}));
 }
 function hideTraitTip(){document.getElementById('characterTraitTip')?.remove();document.querySelectorAll('[data-trait-tip][aria-expanded="true"]').forEach(b=>b.setAttribute('aria-expanded','false'));}
 function showTraitTip(button){
  const key=button.dataset.traitTip,tip=traitTips[key];if(!tip)return;
  const old=document.getElementById('characterTraitTip');if(old?.dataset.key===key){hideTraitTip();return;}hideTraitTip();
  const box=document.createElement('div');box.id='characterTraitTip';box.className='character-trait-popover';box.dataset.key=key;box.setAttribute('role','tooltip');
  const raw=button.dataset.traitTotal,rows=traitEffects(key,raw===''?null:raw);
  box.innerHTML=`<b class="trait-popover-name">${esc(tip.name)}</b>${rows.length?rows.map(r=>`<p>${esc(r.label)}提升 <strong>${r.value>0?'+':''}${n(r.value)}%</strong></p>`).join(''):'<p>效果暂未读取</p>'}`;
  document.body.append(box);button.setAttribute('aria-expanded','true');
  const rect=button.getBoundingClientRect(),bounds=box.getBoundingClientRect(),pad=10;
  const left=Math.max(pad,Math.min(innerWidth-bounds.width-pad,rect.left+rect.width/2-bounds.width/2));
  const top=rect.top-bounds.height-9>=pad?rect.top-bounds.height-9:Math.min(innerHeight-bounds.height-pad,rect.bottom+9);
  box.style.left=left+'px';box.style.top=top+'px';
 }
 const n=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(v):'—';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(s){
  const v=s.stats||{},power=window.MobilePresentation?.combatPower(v),ratio=v.maxQi>0?Math.max(0,Math.min(100,v.qi/v.maxQi*100)):0;
  const c=s.character||{};
  const value=(key,label,unit='',scale=1)=>`<div class="character-trait">${traitTips[key]?`<button type="button" class="trait-tip-trigger" data-trait-tip="${key}" data-trait-total="${c[key]??''}" aria-expanded="false" aria-describedby="characterTraitTip" aria-label="${label}，查看效果说明">${label}<small aria-hidden="true">ⓘ</small></button>`:`<span>${label}</span>`}<b data-character-field="${key}" data-scale="${scale}" data-unit="${unit}">${n(c[key]==null?null:c[key]*scale)}${c[key]==null?'':unit}</b></div>`;
  const traits=`<section id="character-aptitude" class="character-traits" role="tabpanel" aria-labelledby="character-tab-aptitude" ${activeTab!=='aptitude'?'hidden':''}><h3>天资</h3><div class="character-trait-grid">${[['qiSense','气感'],['spiritualSense','神识'],['constitution','根骨'],['comprehension','悟性'],['luck','机缘']].map(([k,l])=>value(k,l)).join('')}</div></section><section id="character-bonus" class="character-traits" role="tabpanel" aria-labelledby="character-tab-bonus" ${activeTab!=='bonus'?'hidden':''}><h3>加成</h3><div class="character-trait-grid">${value('qiMultiplier','气血加成','%',100)}${value('cultivationSpeed','修炼速度','%',100)}${value('attackMultiplier','攻击加成','%',100)}${value('artMonthlyRate','功法效率','点/月')}${value('defenseMultiplier','防御加成','%',100)}${value('resourceMultiplier','资源获取','%',100)}</div></section>`;
  const realmGear=window.MobileEquipmentAtlas.realmFor(s.realm);
  const owned=window.MobileEquipment?.snapshot();
  const slots=realmGear.items.map(item=>{const equipped=window.MobileEquipment?.items.get(owned?.equipped[item.slot]);return [item.label,equipped?.name||'未装备',item.slot,equipped];});
  return `<section class="silk-character" data-realm="${esc(s.realm)}" aria-label="人物与装备"><div class="character-stage"><div class="character-aura"></div><img class="character-figure" src="${base}assets/character/B-heavy-original.png" alt="白衣修士持剑站立"><div class="character-floating-power"><div class="character-power"><span>实力</span><b data-combat-power>${n(power)}</b></div></div></div><div class="character-equipment-row">${slots.map(([label,name,id,item],i)=>`<details class="character-gear gear-${i}"><summary data-equipment-open="${id}" aria-label="${label}：${name}，点击选择装备"><span class="gear-tile artifact-frame" ${item?`style="--gear-quality:${window.MobileEquipmentRolls.qualities[item.quality]?.color}"`: ''}>${item?window.MobileEquipmentAtlas.icon(item)+`<span class="gear-stars">${item.stars}★</span>`:`<span class="gear-outline" aria-hidden="true">${{sword:'器',robe:'衣',jade:'饰',boots:'履'}[id]}</span>`}</span><span class="gear-kind">${label}</span><strong ${item?`style="color:${window.MobileEquipmentRolls.qualities[item.quality]?.textColor}"`: ''}>${name}</strong></summary></details>`).join('')}</div><div class="character-health"><div><span>气血</span><strong><span data-value="qi">${n(v.qi)}</span> / <span data-value="maxQi">${n(v.maxQi)}</span></strong></div><div class="character-hp-track" role="progressbar" aria-label="人物气血" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${ratio}"><i style="width:${ratio}%"></i></div></div><div class="character-combat-stats"><div><span>攻击</span><b data-value="attack">${n(v.attack)}</b></div><div><span>防御</span><b data-value="defense">${n(v.defense)}</b></div><div><span>速度</span><b data-value="speed">${n(v.speed)}</b></div></div><div class="character-tabbar" role="tablist" aria-label="人物详细属性"><button id="character-tab-aptitude" role="tab" data-character-tab="aptitude" aria-controls="character-aptitude" aria-selected="${activeTab==='aptitude'}">天资</button><button id="character-tab-bonus" role="tab" data-character-tab="bonus" aria-controls="character-bonus" aria-selected="${activeTab==='bonus'}">加成</button></div><div class="character-panels">${traits}</div></section>`;
 }
 window.MobileCharacterPage={render,traitTips,traitEffects};
 document.addEventListener('click',e=>{const b=e.target.closest('[data-trait-tip]');if(b)showTraitTip(b);else hideTraitTip();});
 document.addEventListener('click',e=>{const button=e.target.closest('[data-character-tab]');if(!button)return;activeTab=button.dataset.characterTab;document.querySelectorAll('[data-character-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.characterTab===activeTab)));document.querySelectorAll('.character-panels>[role="tabpanel"]').forEach(p=>p.hidden=p.id!=='character-'+activeTab);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTraitTip();});
 addEventListener('resize',hideTraitTip);addEventListener('scroll',hideTraitTip,true);
 document.addEventListener('toggle',e=>{if(e.target.matches?.('.character-gear[open]'))document.querySelectorAll('.character-gear[open]').forEach(d=>{if(d!==e.target)d.open=false;});},true);
})();
