/* Portrait presentation only. Gameplay is owned by the shipped runtime. */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>v===null||v===undefined||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(Number(v));
  const locked=(name,reason)=>`<section class="paper-card empty-state"><h2>${esc(name)}尚未开启</h2><p>${esc(reason)}</p></section>`;
  const live=(field,value)=>`<span data-live-number="expedition.${esc(field)}">${n(value)}</span>`;
  function expedition(s,ui={}){
    if(!s?.ready)return '<section class="paper-card"><p>正在读取原秘境…</p></section>';
    if(!s.unlocked)return locked('秘境',s.unlockReason);
    const current=s.regions.find(r=>r.id===(s.active?s.currentId:s.selectedId)),paused=Boolean(ui.manualPause),f=esc(s.fingerprint);
    return `<section class="paper-card"><div class="section-heading"><h2>${esc(current?.name||'秘境探索')}</h2><span class="chip">${s.active?`探索第${live('currentFloor',s.currentFloor)}层`:'待出发'}</span></div><p>${esc(s.note)}</p>${s.active?`${s.battle?.active?(window.MobileCombat?.summary(s.battle,'expedition')||''):''}<div class="stats-grid"><div class="stat"><span>自身气血 · 速度 ${live('battle.playerSpeed',s.battle?.playerSpeed)}</span><strong>${live('battle.playerQi',s.battle?.playerQi)} / ${live('battle.maxPlayerQi',s.battle?.maxPlayerQi)}</strong></div><div class="stat"><span>敌方气血 · 速度 ${live('battle.enemySpeed',s.battle?.enemySpeed)}</span><strong>${s.battle?.active?`${live('battle.enemyQi',s.battle.enemyQi)} / ${live('battle.maxEnemyQi',s.battle.maxEnemyQi)}`:'当前无战斗'}</strong></div></div>`:`<p>进入层数 ${n(current?.startFloor)} · 最高到达 ${n(current?.highestFloor)}</p><p class="muted">${esc(current?.requiredRealm||'')}起可进入 · 可得${esc(current?.materialName||'原随机物品')}</p>`}<button class="primary-button full-width" data-action="${s.active?'expedition-end':'expedition-enter'}" data-expedition-fingerprint="${f}" ${paused||!(s.active?s.canEnd:s.canEnter)?'disabled':''}>${s.active?'结束当前秘境':'进入秘境'}</button>${s.reason?`<p class="muted">${esc(s.reason)}</p>`:''}</section><section class="paper-card"><h2>探索设置</h2>${!s.prepared?`<button class="secondary-button full-width" data-action="expedition-open" ${paused?'disabled':''}>重新打开秘境</button>`:''}${[['autoExplore','自动探索'],['repeat','重复探索']].map(([key,label])=>`<button class="secondary-button full-width" data-action="expedition-setting" data-setting="${key}" data-setting-value="${!s.settings[key]}" ${paused||!s.settings.canConfigure?'disabled':''}>${esc(label)}：${s.settings[key]?'开启':'关闭'}</button>`).join('')}${s.settings.reason?`<p class="muted">${esc(s.settings.reason)}</p>`:''}<p class="muted">自动探索会停止其他主动行为。每十层有首领，重复探索会在击败首领后重走当前十层；结束秘境关闭自动探索。</p><button class="secondary-button full-width" data-action="expedition-original">探格与调整开始层数</button></section><section class="paper-card"><h2>秘境山河</h2><div class="enemy-list">${s.regions.map(region=>`<button class="enemy-option expedition-single-column ${region.selected?'is-selected':''}" data-action="expedition-select" data-id="${region.id}" ${paused||!s.canSelect||!region.unlocked?'disabled':''}><span><strong>${esc(region.name)}</strong><small>${esc(region.requiredRealm||'')} · ${region.unlocked?`已到${n(region.highestFloor)}层`:esc(region.reason)}</small></span></button>`).join('')}</div></section>`;
  }

  const stoneCopy=item=>item?'<h3>'+esc(item.name)+'</h3><p>'+n(item.level)+'级 · '+esc(item.gradeLabel)+(item.locked?' · 已锁定':'')+'</p><p>'+esc(item.primary.name)+' +'+n(item.primary.value)+'</p>'+item.affixes.map(affix=>'<p class="muted">'+esc(affix.type)+' +'+n(affix.value)+'%</p>').join(''):'<p>空命位</p>';
  function fateStones(s,ui={}){
    if(!s?.ready)return '<section class="paper-card"><p>正在读取原命石…</p></section>';
    if(!s.unlocked)return locked('命石',s.unlockReason);
    return '<section class="paper-card"><h2>命石入命</h2><p>'+esc(s.warning)+'</p><p>'+esc(s.guide)+'</p>'+
      (s.reason?'<p class="muted">'+esc(s.reason)+'</p>':'')+
      '<button class="secondary-button" data-action="fate-original" '+(ui.manualPause?'disabled':'')+'>查看原命石界面</button><button class="secondary-button" data-action="fate-inventory-original" '+(ui.manualPause?'disabled':'')+'>原纳戒与锁定设置</button></section>'+
      '<section class="paper-card"><h2>入命所得</h2><div class="stats-grid">'+Object.entries(s.totals).map(([name,value])=>'<div class="stat"><span>'+esc(name)+'</span><strong>'+n(value)+esc(s.totalUnits?.[name]||'')+'</strong></div>').join('')+'</div></section>'+
      '<section class="paper-card"><h2>十方命位</h2><div class="enemy-list">'+s.slots.map(slot=>'<article class="enemy-option expedition-single-column"><span><strong>'+esc(slot.label)+' · '+esc(slot.item?.name||'空位')+'</strong><small>'+
        (slot.item?n(slot.item.level)+'级 · '+esc(slot.item.gradeLabel)+' · '+esc(slot.item.primary.name)+'+'+n(slot.item.primary.value):esc(slot.type))+'</small>'+
        (slot.item?.affixes||[]).map(affix=>'<small>'+esc(affix.type)+' +'+n(affix.value)+'%</small>').join('')+'</span></article>').join('')+'</div></section>'+
      '<section class="paper-card"><h2>纳戒中的命石</h2>'+(s.inventory.length?s.inventory.map(item=>'<article class="paper-card">'+stoneCopy(item)+'<p class="muted">持有 '+n(item.count)+' 枚 · 对应'+esc(s.slots[item.slot-1]?.label||'未知')+'位</p>'+
        (item.reason?'<p class="muted">'+esc(item.reason)+'</p>':'')+
        '<button class="primary-button full-width" data-action="fate-review" data-id="'+item.inventoryIndex+'" data-token="'+esc(item.token)+'" '+(ui.manualPause||!item.canInscribe?'disabled':'')+'>核对'+(s.slots[item.slot-1]?.item?'替换并入命':'入命')+'</button></article>').join(''):'<p class="muted">尚未获得原命石。</p>')+'</section>';
  }
  function fateStoneReview(review,paused=false){
    const changed=Object.keys(review.totalsBefore||{});
    return '<article class="dialogue-card detail-card"><div class="eyebrow">命石入命前确认</div><h2 id="fateReviewTitle">'+(review.replacing?'替换原命石':'将命石入命')+'</h2><p>'+esc(review.summary)+'</p>'+
      '<section class="paper-card"><h3>本次命石 · '+esc(review.slotLabel||'待确认')+'位</h3>'+stoneCopy(review.incoming)+'</section><section class="paper-card"><h3>原命位</h3>'+stoneCopy(review.previous)+'</section>'+
      (review.warnings||[]).map(warning=>'<p class="'+(review.replacing?'realm-warning':'muted')+'">'+esc(warning)+'</p>').join('')+
      '<details><summary>入命合计前后</summary><div class="stats-grid">'+changed.map(name=>'<div class="stat"><span>'+esc(name)+'</span><strong>'+n(review.totalsBefore?.[name])+' → '+n(review.totalsAfter?.[name])+(['气感','神识','根骨','悟性','机缘'].includes(name)?'':'%')+'</strong></div>').join('')+'</div></details>'+
      (review.reason?'<p class="muted">'+esc(review.reason)+'</p>':'')+
      '<div class="action-row"><button class="secondary-button" data-action="fate-review-close">暂不入命</button><button class="primary-button" data-action="fate-confirm" data-id="'+review.inventoryIndex+'" data-token="'+esc(review.token)+'" '+(paused||!review.canConfirm?'disabled':'')+'>'+(review.replacing?'确认旧石消失并替换':'确认入命')+'</button></div><p class="muted">每次消耗此实例1枚，入命后不能卸下。实例、锁定状态或原命位变化后须重新核对。</p></article>';
  }
  window.MobileExpedition={expedition,fateStones,fateStoneReview};
})();
