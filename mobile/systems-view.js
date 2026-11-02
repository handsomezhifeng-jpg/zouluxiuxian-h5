/* Portrait system views. All values are snapshots from the original engine. */
(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1,notation:Math.abs(Number(value))>=1e7?'compact':'standard'}).format(Number(value));
  const meter=(progress,label)=>`<div class="progress-track"><div class="progress-fill" data-progress="system" style="width:${Math.max(0,Math.min(100,progress||0))}%"></div></div><div class="method-meta"><span>${label}</span><strong data-system-value="progress">${n(progress)}%</strong></div>`;
  const locked=(name,text)=>`<section class="paper-card empty-state"><div class="practice-symbol">道</div><h2>${name}尚未开启</h2><p>${esc(text || '跟随原游戏的主线教学开启此系统。')}</p></section>`;
  function market(m) {
    if(!m)return '<section class="paper-card"><p class="muted">正在读取商会…</p></section>';
    if(!m.unlocked)return locked('商会',m.unlockReason);
    return `<section class="paper-card"><div class="section-heading"><h2>商会交易</h2><span class="eyebrow">灵石 <strong data-value="spiritStones">${n(m.spiritStones)}</strong></span></div><div class="filter-strip">${m.floors.map(floor=>`<button class="chip ${floor.floor===m.floor?'is-active':''}" data-action="market-floor" data-id="${floor.floor}" ${floor.unlocked?'':'disabled'}>${esc(floor.label)}</button>`).join('')}</div><div class="filter-strip" aria-label="商品分类">${m.categories.map(category=>`<button class="chip ${category===m.category?'is-active':''}" data-action="market-category" data-category="${esc(category)}">${esc(category)}</button>`).join('')}</div><div class="market-list">${m.items.length?m.items.map(item=>`<button class="market-item" data-action="market-detail" data-id="${item.listIndex}"><span class="collection-emblem" aria-hidden="true">${esc((item.category || '物').slice(0,1))}</span><span class="market-copy"><strong>${esc(item.name)}</strong><small>${esc(item.category)} · ${n(item.tier)}阶 · 库存 ${n(item.stock)}</small>${item.reason?`<small>${esc(item.reason)}</small>`:''}</span><span class="market-price">${n(item.unitPrice)}<small>灵石 / 枚</small></span></button>`).join(''):'<div class="empty-state"><p>当前分类暂无可购货品。</p></div>'}</div></section>`;
  }
  function marketDetail(detail,paused) {
    if(!detail)return '<p class="muted">该货品当前不可购买。</p>';
    const plain=value=>typeof value==='string'?value.replace(/\[\/?(?:color|size|b|i|u|s|font|outline|shadow|stroke|background)(?:=[^\]]*)?\]/gi,'').trim():'';
    const metadata=[];
    if(plain(detail.tierLabel))metadata.push(['境阶',plain(detail.tierLabel)]);
    else if(Number.isFinite(detail.tier))metadata.push(['境阶',`${n(detail.tier)}阶`]);
    if(plain(detail.qualityName))metadata.push(['品质',plain(detail.qualityName)]);
    else if(['法宝','丹药','宝材'].includes(detail.category)&&Number.isFinite(detail.quality)&&detail.quality>0)metadata.push(['品质',n(detail.quality)]);
    // svgw column 3 is category-specific: only label the meanings verified by tips.
    if(detail.category==='宝材'&&Number.isFinite(detail.level)&&detail.level>0)metadata.push(['等级',n(detail.level)]);
    if(detail.category==='灵果'&&Number.isFinite(detail.level)&&detail.level>0)metadata.push(['年份',`${n(detail.level)}年`]);
    if(plain(detail.subtype)&&detail.subtype!==detail.category)metadata.push(['种类',plain(detail.subtype)]);
    if(plain(detail.learnedLabel))metadata.push(['学习状态',plain(detail.learnedLabel)]);
    // effectText is normally generated from details. Keep any additional lines,
    // but show each actual description/effect only once, without executing markup.
    const lines=[],seen=new Set();
    const append=value=>{
      for(const text of plain(value).split(/\r?\n/)){
        const line=text.trim(),key=line.replace(/[\s\u3000]/g,'').replace(/：/g,':');
        if(line&&!seen.has(key)){seen.add(key);lines.push(line);}
      }
    };
    append(detail.description);
    for(const effect of Array.isArray(detail.details)?detail.details:[]){
      if(effect?.value===null||effect?.value===undefined||typeof effect.value==='number'&&!Number.isFinite(effect.value))continue;
      const label=plain(effect.label),value=typeof effect.value==='string'?plain(effect.value):String(effect.value),unit=plain(effect.unit);
      if(label&&value)append(`${label}：${value}${unit}`);
    }
    append(detail.effectText);
    return `<div class="eyebrow">${esc(detail.category || '商会货品')}</div><h2 id="marketTitle">${esc(detail.name)}</h2>${metadata.length?`<div class="detail-metrics">${metadata.map(([label,value])=>`<span>${esc(label)} <strong>${esc(value)}</strong></span>`).join('')}</div>`:''}${lines.length?`<div class="detail-copy"><p>${esc(lines.join('\n'))}</p></div>`:''}<div class="detail-metrics"><span>单价 <strong>${n(detail.unitPrice)}</strong> 灵石</span><span>库存 <strong>${n(detail.stock)}</strong></span><span>最多可购 <strong>${n(detail.maxPurchase)}</strong></span></div>${detail.reason?`<p class="muted">${esc(detail.reason)}</p>`:''}<label class="input-label" for="purchaseQuantity">购买数量</label><input id="purchaseQuantity" class="quantity-input" type="number" inputmode="numeric" min="1" max="${detail.maxPurchase || 1}" step="1" value="1" aria-label="购买数量"><div class="menu-actions"><button class="primary-button" data-action="market-buy" data-id="${detail.listIndex}" ${detail.canPurchase&&!paused?'':'disabled'}>购买</button>${paused?'<button class="primary-button" data-action="pause-toggle">继续游戏以购买</button>':''}<button class="secondary-button" data-action="close-market-detail">返回商会</button></div>`;
  }
  const kindTabs=(system,kind,choices)=>`<div class="system-tabs">${Object.entries(choices).map(([id,name])=>`<button class="${id===kind?'is-active':''}" data-action="system-kind" data-system="${system}" data-kind="${id}">${name}</button>`).join('')}</div>`;
  function gathering(g,ui) {
    const tabs=kindTabs('gathering',ui.gatheringKind,{herbs:'采药',mining:'采矿'});
    if(!g?.ready)return tabs+'<section class="paper-card"><p class="muted">正在读取采集技艺…</p></section>';
    if(!g.unlocked)return tabs+locked(ui.gatheringKind==='herbs'?'采药':'采矿','先完成原主线的功法与渡劫教学。');
    const target=g.targets.find(item=>item.id===(g.active?g.activeTarget:g.selectedTarget));
    return tabs+`<section class="paper-card"><div class="section-heading"><h2>${ui.gatheringKind==='herbs'?'草木采药':'金石采矿'}</h2><span class="chip">技艺 ${n(g.level)} 级</span></div><p class="muted">熟练度 ${n(g.proficiency)} / ${n(g.proficiencyCap)} · 最高 ${n(g.maxLevel)} 级</p>${target?`<div class="practice-symbol ${g.active?'is-practicing':''}">${ui.gatheringKind==='herbs'?'药':'矿'}</div><h2 class="practice-name">${esc(target.name || target.displayName)}</h2>${meter(g.progress,g.active?'采集中':'采集进度')}<p class="muted">每轮约 ${n(target.cycleMonths)} 月${target.experiencePerCycle==null?'':` · 经验 ${n(target.experiencePerCycle)}`}</p><button class="primary-button full-width" data-action="${g.active?'gather-stop':'gather-start'}" data-id="${target.id}" ${!g.active&&!g.canStart?'disabled':''}>${g.active?'停止采集':'开始采集'}</button>`:''}</section><section class="paper-card"><div class="section-heading"><h2>采集材料</h2></div><div class="enemy-list">${g.targets.map(item=>`<button class="enemy-option ${item.id===g.selectedTarget?'is-selected':''}" data-action="gather-select" data-id="${item.id}" ${item.selectable?'':'disabled'}><span class="enemy-mark">${item.unlocked?(ui.gatheringKind==='herbs'?'草':'石'):'?'}</span><span><strong>${esc(item.displayName || item.name)}</strong><small>${item.unlocked?`持有 ${n(item.outputs?.[0]?.owned)} · 每轮产出 ${n(item.outputs?.[0]?.quantity)}`:`技艺 ${n(item.requiredLevel)} 级开启`}</small></span>${item.unlocked?'<span>›</span>':''}</button>`).join('')}</div></section>`;
  }
  function crafting(c,ui) {
    const tabs=kindTabs('crafting',ui.craftingKind,{alchemy:'炼丹',smithing:'炼器'});
    if(!c?.ready)return tabs+'<section class="paper-card"><p class="muted">正在读取炼制技艺…</p></section>';
    if(!c.unlocked)return tabs+locked(c.name,ui.craftingKind==='alchemy'?'草木技艺达到 5 级后，跟随原剧情开启炼丹。':'金石技艺达到 5 级后，跟随原剧情开启炼器。');
    const recipe=c.active?c.activeRecipe:c.selectedRecipe,learned=c.recipes.filter(item=>item.learned);
    return tabs+`<section class="paper-card"><div class="section-heading"><h2>${esc(c.name)}</h2><span class="chip">技艺 ${n(c.skill?.level)} 级</span></div>${recipe?`<h2 class="practice-name">${esc(recipe.name)}</h2><p class="muted">${n(recipe.tier)}阶 · 每轮 ${n(recipe.months)} 月 · 材料倍率 ${n(c.materialMultiplier)}</p>${c.active?meter(c.progress,'炼制中'):''}<ul class="ingredient-list">${recipe.materials.map(material=>`<li class="${material.enough?'':'is-short'}"><span>${esc(material.name)}</span><span>${n(material.owned)} / ${n(material.count)}</span></li>`).join('')}</ul><button class="primary-button full-width" data-action="${c.active?'craft-stop':'craft-start'}" data-id="${recipe.id}" ${!c.active&&!recipe.canStart?'disabled':''}>${c.active?'停止炼制':`开始${esc(c.name)}`}</button><p class="muted">${!recipe.skillReady?`需${esc(c.name)}技艺 ${n(recipe.requiredSkill)} 级。`:!recipe.materialsReady?'材料尚不足，可在采集与历练中获得。':c.continuous?'按当前设置连续炼制，原游戏结算成品与品质。':'本次成品与品质由原游戏结算。'}</p>`:'<div class="empty-state"><p>尚未选择已学配方。</p></div>'}</section><section class="paper-card"><div class="section-heading"><h2>已学配方</h2><span class="eyebrow">${learned.length} 项</span></div>${learned.length?`<div class="enemy-list">${learned.map(item=>`<button class="enemy-option ${recipe?.id===item.id?'is-selected':''}" data-action="craft-select" data-id="${item.id}" ${item.selectable?'':'disabled'}><span class="enemy-mark">${ui.craftingKind==='alchemy'?'丹':'器'}</span><span><strong>${esc(item.name)}</strong><small>${n(item.tier)}阶 · ${n(item.months)}月${!item.inCurrentCategory?' · 需切换原品类':''}</small></span><span>›</span></button>`).join('')}</div>`:'<div class="empty-state"><p>在商会购买丹方或器方，再从纳戒学习。</p><button class="secondary-button" data-action="navigate" data-route="market">前往商会</button></div>'}<button class="secondary-button full-width" data-action="craft-original">品类与炼制设置</button></section>`;
  }
  window.MobileSystems={market,marketDetail,gathering,crafting,meter,locked,esc,n};
})();
