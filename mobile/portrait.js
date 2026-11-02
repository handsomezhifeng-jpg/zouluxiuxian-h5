(() => {
  'use strict';
  const state = { adapter: null, dialogue: null, route: 'cultivation', snapshot: null, signature: '', classic: false, crop: 'content', zoom: 1, paused: false, manualPause:false, loading: true, slots: false, menu: false, itemId: null, artId: null, collectionFilter: '全部',marketFloor:1,marketCategory:'全部',marketIndex:null,gatheringKind:'herbs',craftingKind:'alchemy' };
  state.spiritSlot=1;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const number = value => value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1, notation: Math.abs(Number(value)) >= 10000000 ? 'compact' : 'standard' }).format(Number(value));
  const percent = value => Math.max(0, Math.min(100, Number(value) || 0));
  const screen = () => document.getElementById('screen');
  let toastTimer, diagnosticAt = 0, confirmResolver=null,screenPointerHeld=false,screenInteractionUntil=0;
  function confirmGame(message) {
    if(confirmResolver)confirmResolver(false);
    document.getElementById('confirmText').textContent=message;
    document.getElementById('confirmOverlay').hidden=false;
    return new Promise(resolve=>{confirmResolver=resolve;});
  }
  function finishConfirmation(value) {
    const resolve=confirmResolver;confirmResolver=null;
    document.getElementById('confirmOverlay').hidden=true;
    resolve?.(value);
  }
  function lockReviewSubmission(kind) {
    state.reviewSubmitting=kind;
    const overlay=document.getElementById(kind==='fate'?'fateReviewOverlay':'rebirthReviewOverlay');
    overlay?.setAttribute('aria-busy','true');
    overlay?.querySelectorAll('button').forEach(button=>button.disabled=true);
    toast('正在等待原游戏确认结果，请稍候。');
  }
  function checked(result) {
    if (result && result.ok === false) throw new Error(result.message || '当前无法执行此操作');
    return result;
  }
  function toast(text) {
    const element = document.getElementById('toast');
    if (!element) return;
    element.textContent = text; element.classList.add('is-visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('is-visible'), 3200);
  }
  function report(record) {
    if (record.kind === 'error' || record.kind === 'rejection') console.error('[MobilePort]', record.message, record.detail || '');
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
      fetch('/__mobile_diagnostics', { method: 'POST', body: JSON.stringify(record), keepalive: true }).catch(() => {});
    }
  }
  function rawRuntime() { try { return document.getElementById('engineFrame').contentWindow.c3_runtimeInterface._GetLocalRuntime(); } catch { return null; } }
  const titles = { cultivation: '修炼', realm: '境界', adventure:'历练', character: '人物', inventory: '纳戒', arts: '功法' };
  function questCard(s) {
    const quests=s.quests?.quests || [];
    if(!quests.length)return '';
      const routes={311:['cultivation','前往修炼'],312:['adventure','前往历练'],313:['adventure','前往历练'],314:['market','前往商会'],315:['arts','参悟功法'],316:['gathering','前往采药','herbs'],317:['gathering','前往采矿','mining'],318:['crafting','前往炼丹','alchemy'],319:['crafting','前往炼器','smithing'],320:['realm','前往突破'],321:['capture','前往捕兽'],322:['beasts','前往驭兽'],323:['challenge','前往挑战'],324:['cave','前往洞府'],325:['spirits','前往灵阵'],326:['realm','前往突破'],327:['reincarnation-preview','查看转世预览'],328:['realm','前往突破'],330:['realm','前往突破']};
    const card=q=>{
      const shortcut=routes[q.id];
      const progress=q.id===312?null:q.details?.currentRealm?`当前 ${q.details.currentRealm}`:q.progressText;
      const hint=q.id===312?'在凡界持续战胜乌鬃野猪，完成后跟随剧情继续。':q.hint;
      const help=String(hint || '').length>85?`<details><summary>查看任务说明</summary><p class="muted">${esc(hint)}</p></details>`:`<p class="muted">${esc(hint)}</p>`;
      return `<article class="quest-objective"><div class="section-heading"><h3>${esc(q.name || '仙途主线')}</h3>${progress?`<span class="chip">${esc(progress)}</span>`:''}</div><p>${esc(q.target || q.description)}</p>${help}${shortcut?`<button class="secondary-button" data-action="navigate" data-route="${shortcut[0]}" ${shortcut[2]?`data-kind="${shortcut[2]}"`:''}>${shortcut[1]}</button>`:''}</article>`;
    };
    return `<section class="paper-card quest-card" aria-label="主线目标" data-quest-current="${Number.isFinite(quests[0].current)?quests[0].current:''}" data-quest-required="${Number.isFinite(quests[0].required)?quests[0].required:''}"><div class="eyebrow">当前主线</div>${card(quests[0])}${quests.length>1?`<details data-quest-additional><summary>还有 ${quests.length-1} 项主线目标</summary>${quests.slice(1).map(card).join('')}</details>`:''}</section>`;
  }
  function hero(s) {
    return window.MobileMoonUI.profile(s,{esc,number})+
      (s.blocked?'<section class="paper-card"><p>仙途中有一则提示等待处理。</p><button class="secondary-button" data-action="original-dialog">查看提示</button></section>':'')+questCard(s);
  }
  function renderLanding(s) {
    const error=window.MobileSingleSave?.error;
    if(window.MobileLoading)return window.MobileLoading.render(s,error);
    return `<section class="hero landing"><div class="eyebrow">掌上仙途</div><h1 class="realm-name">${error?'读取暂未完成':'正在接续仙途'}</h1><p>${esc(error||s.loadingProgress?.text||'正在读取本机记录，首次进入将自动开始新的仙途…')}</p><div class="landing-seal">道</div>${error?'<button class="primary-button" data-action="retry-entry">重试载入</button>':''}</section>`;
  }
  function renderCultivation(s) {
    if(window.MobileMoonUI)return window.MobileMoonUI.render(s,{esc,number,percent,questCard});
    const methods = s.methods || [];
    const current = methods.find(m => m.id === s.selectedMethod) || methods.find(m => m.unlocked) || methods[0];
    const gainRows=[['◉','气血','qiGain','nextQiGain'],['⚔','攻击','attackGain','nextAttackGain'],['◇','防御','defenseGain','nextDefenseGain']];
    return `${hero(s)}<section class="paper-card practice-card jade-practice"><div class="practice-intro"><div class="practice-symbol ${s.cultivating?'is-practicing':''}">炁</div><div class="practice-info"><div class="practice-heading"><h2 class="practice-name">${esc(current?.name || '等待修行')}</h2><span class="method-badge">${current?.id===1?'基础法门':'修行法门'}</span><span class="practice-cap">最高 ${number(current?.cap)} 层</span></div><p class="practice-time">◷ 耗时 ${number(current?.months)} 月 / 层</p><div class="method-level-track"><div style="width:${current?.cap>0?percent(current.level/current.cap*100):0}%"></div><span>第 ${number(current?.level)} / ${number(current?.cap)} 层</span></div></div></div><table class="method-gains"><thead><tr><th></th><th>当前加成</th><th>下层增加</th></tr></thead><tbody>${gainRows.map(([icon,label,key,next])=>`<tr><th><i aria-hidden="true">${icon}</i>${label}</th><td>+${number(current?.[key])}</td><td class="next-gain">+${number(current?.[next])}</td></tr>`).join('')}</tbody></table><div class="practice-live"><span>${s.cultivating?'单层修炼进度':'静心凝神 · 待君入定'}</span><strong data-value="progress">${percent(s.progress).toFixed(1)}%</strong></div><div class="progress-track" role="progressbar" aria-label="单层修炼进度" aria-valuenow="${percent(s.progress)}"><div class="progress-fill" style="width:${percent(s.progress)}%"></div></div><div class="action-row">${s.cultivating?'<button class="primary-button" data-action="stop">暂歇片刻</button>':`<button class="primary-button" data-action="train" data-id="${current?.id || 1}" ${!current?.unlocked?'disabled':''}>开始修炼</button>`}</div></section><div class="method-list jade-method-list" aria-label="修行法门">${methods.filter(m=>m.id!==current?.id).map(m=>`<article class="method-card ${m.unlocked?'':'is-locked'}"><div class="method-seal" aria-hidden="true">${m.unlocked?'道':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg>'}</div><div class="method-copy"><h3>${esc(m.name)}</h3><p>${m.unlocked?`第 ${number(m.level)} 层 · 最高 ${number(m.cap)} 层`:esc(m.unlockText || m.lockReason || '尚未开启')}</p></div>${m.unlocked?`<button class="secondary-button" data-action="train" data-id="${m.id}" ${m.level>=m.cap?'disabled':''}>${m.level>=m.cap?'已圆满':'修炼'}</button>`:'<span class="lock-label">未开启</span>'}</article>`).join('')}</div><div class="more-methods" aria-hidden="true">⌄ 更多法门 · 上滑查看</div>`;

  }
  function stat(label, key, value) { return `<div class="stat"><span>${label}</span><strong data-value="${key}">${number(value)}</strong></div>`; }
  function renderAdventure(s) {
    const a=s.adventure;
    if(!a?.ready)return `${hero(s)}<section class="paper-card"><p class="muted">正在读取历练山河…</p></section>`;
    if(!a.unlocked)return `${hero(s)}<section class="paper-card empty-state"><div class="practice-symbol">游</div><h2>历练尚未开启</h2><p>请先完成原游戏的修炼引导。<br>吐纳达到 20 层后，跟随剧情开启历练。</p></section>`;
    return window.MobileCombat.render(a,s);
  }
  function renderCharacter(s) {
    const v = s.stats || {}, c=s.character || {};
    return `${hero(s)}${s.combatGrowth?`<section class="combat-growth"><strong>战斗身法 · 速度 ${number(s.combatGrowth.total)}</strong><p>基础 ${number(s.combatGrowth.base)} · 境界 +${number(s.combatGrowth.realm)} · 灵阵 +${number(s.combatGrowth.spirits)}</p><p>速度决定出手频率；攻击增强单次伤害，防御持续减伤，气血提高承伤能力。功法、法宝与灵兽的基础修为会折算为战斗属性。</p></section>`:''}<section class="paper-card"><div class="section-heading"><h2>${esc(s.playerName||'道友')} · 人物属性</h2><span class="eyebrow">形神俱养</span></div><div class="stats-grid">${stat('攻击','attack',v.attack)}${stat('防御','defense',v.defense)}${stat('速度','speed',v.speed)}${stat('气血','qi',v.qi)}${stat('气血上限','maxQi',v.maxQi)}${stat('年龄','age',v.age)}${stat('寿元','lifespan',v.lifespan)}${stat('灵石','spiritStones',c.spiritStones)}${stat('修炼速度','cultivationSpeed',c.cultivationSpeed)}${stat('洞府灵气','caveEnergy',c.caveEnergy)}</div></section><section class="paper-card"><div class="section-heading"><h2>天资与丹毒</h2></div><div class="stats-grid">${stat('总气感','qiSense',c.qiSense)}${stat('总神识','spiritualSense',c.spiritualSense)}${stat('总根骨','constitution',c.constitution)}${stat('基础气感','baseQiSense',c.baseQiSense)}${stat('基础神识','baseSpiritualSense',c.baseSpiritualSense)}${stat('基础根骨','baseConstitution',c.baseConstitution)}${stat('丹毒','poison',c.poison)}${stat('丹毒上限','poisonCap',c.poisonCap)}</div><button class="secondary-button full-width" data-action="original" data-route="character">人物其他系统</button></section><section class="paper-card"><div class="section-heading"><h2>法宝与灵兽加成</h2></div><div class="stats-grid">${stat('法宝气血','treasureQi',c.treasureQi)}${stat('法宝攻击','treasureAttack',c.treasureAttack)}${stat('法宝防御','treasureDefense',c.treasureDefense)}${stat('灵兽气血','beastQi',c.beastQi)}${stat('灵兽攻击','beastAttack',c.beastAttack)}${stat('灵兽防御','beastDefense',c.beastDefense)}</div></section>`;
  }
  function renderEquipment(s) {
    return `<section class="paper-card"><div class="section-heading"><h2>已装备法宝</h2></div><div class="equipment-list">${s.equipment?s.equipment.map(item=>`<article class="equipment-slot"><span class="equipment-type">${esc(item.slotName)}</span><div><h3>${item.empty?'尚未装备':esc(item.name || '法宝')}</h3>${item.empty?'':`<p>${(item.details || []).map(detail=>`${esc(detail.label)} ${esc(detail.value)}${esc(detail.unit || '')}`).join(' · ')}</p>`}</div>${!item.empty?`<button class="secondary-button" data-action="unequip" data-id="${item.slot}" ${item.actions?.find(action=>action.id==='unequip')?.enabled?'':'disabled'}>卸下</button>`:''}</article>`).join(''):'<p class="muted">正在读取法宝…</p>'}</div></section>`;
  }
  function renderSystem(s, route) {
    const inventory = route === 'inventory';
    const allItems = inventory ? s.inventory : s.arts;
    const categories = inventory ? ['全部',...new Set((allItems || []).map(item=>item.category).filter(Boolean))] : [];
    if(inventory&&!categories.includes(state.collectionFilter))state.collectionFilter='全部';
    const items = inventory&&state.collectionFilter!=='全部'?(allItems || []).filter(item=>item.category===state.collectionFilter):allItems;
    const empty = items === null || items === undefined ? '正在读取修仙记录…' : inventory ? '纳戒尚空，所得之物将收录于此。' : '尚未习得功法，静候传承机缘。';
    const list = !items?.length ? `<div class="empty-state"><div class="practice-symbol">${inventory ? '藏' : '法'}</div><p class="muted">${empty}</p></div>` : `<div class="collection-list">${items.map(item => `<button type="button" class="collection-item collection-select" data-action="${inventory?'item-detail':'art-detail'}" data-id="${inventory?item.inventoryIndex:item.id}"><div class="collection-emblem" aria-hidden="true">${esc((inventory ? item.category || '物' : item.name || '法').slice(0,1))}</div><div class="collection-copy"><h3>${esc(item.name || (inventory ? '未识之物' : '未名功法'))}</h3><div class="collection-meta">${inventory ? esc(item.category || '物品') : `第 ${number(item.level)} 重`}${item.tier == null ? '' : ` · ${number(item.tier)}阶`}</div>${item.description ? `<p>${esc(item.description.replace(/\[\/?(?:color|size|b|i|u|s|font)(?:=[^\]]*)?\]/gi,''))}</p>` : ''}${!inventory && item.insight != null ? `<p>参悟累积 ${number(item.insight)}</p>` : ''}</div>${inventory ? `<strong class="collection-count">×${number(item.count)}</strong>` : '<span aria-hidden="true">›</span>'}</button>`).join('')}</div>`;
    return `${hero(s)}<section class="paper-card"><div class="section-heading"><h2>${inventory ? '纳戒与物品' : '功法与传承'}</h2><span class="eyebrow">${items?.length ?? 0} ${inventory ? '项珍藏' : '门已习得'}</span></div>${inventory&&categories.length>1?`<div class="filter-strip" aria-label="物品分类">${categories.map(category=>`<button class="chip ${state.collectionFilter===category?'is-active':''}" data-action="filter-items" data-filter="${esc(category)}">${esc(category)}</button>`).join('')}</div>`:''}${list}<button class="secondary-button full-width" data-action="original" data-route="${route}">${inventory ? '纳戒其他功能' : '功法其他功能'}</button></section>`;
  }
  let collectionDraft=null, collectionPointerHeld=false, collectionInteractionUntil=0, collectionReturnFocus=null;
  function closeCollectionDetail() {
    state.itemId=null;state.artId=null;collectionDraft=null;
    collectionPointerHeld=false;collectionInteractionUntil=0;
    const overlay=document.getElementById('collectionOverlay');
    if(overlay){overlay.hidden=true;overlay.setAttribute('aria-hidden','true');overlay.dataset.signature='';overlay.dataset.selectionKey='';if(overlay.childNodes.length)overlay.replaceChildren();}
    if(collectionReturnFocus?.isConnected)collectionReturnFocus.focus({preventScroll:true});
    collectionReturnFocus=null;
  }
  function guardCollectionAction() {
    if(state.dialogue?.getSnapshot?.() || state.adapter?._blocked?.())throw new Error('请先完成原游戏中的对话或提示。');
  }
  function checkedCollectionResult(result) {
    checked(result);
    if(result?.ok!==true)throw new Error(result?.message || '原游戏尚未确认完成，请查看原界面。');
    return result;
  }
  function renderCollectionDetail() {
    const overlay=document.getElementById('collectionOverlay');if(!overlay)return;
    const isItem=state.itemId!==null, id=isItem?state.itemId:state.artId;
    if(id===null){closeCollectionDetail();return;}
    const detail=isItem?state.adapter?.getItemDetail?.(id):state.adapter?.getArtDetail?.(id);
    if(isItem&&detail?.category==='灵兽'){
      const pet=state.adapter?.getBeastDetail?.(id);
      if(pet)Object.assign(detail,{...pet,actions:[...(detail.actions||[]),...(pet.actions||[])]});
    }
    if(isItem&&detail){const recipeAction=state.adapter?.getRecipeBookAction?.(id);if(recipeAction)detail.actions=[...(detail.actions || []),recipeAction];}
    const key=`${isItem?'item':'art'}:${id}:${detail?.id ?? ''}`;
    const oldInput=overlay.querySelector('#sellQuantity');
    const sameSelection=overlay.dataset.selectionKey===key;
    if(sameSelection&&oldInput)collectionDraft={key,value:oldInput.value};
    if(!sameSelection){collectionDraft=null;if(!overlay.contains(document.activeElement))collectionReturnFocus=document.activeElement;}
    // Let the original story own the screen; keep the draft for returning afterwards.
    if(state.dialogue?.getSnapshot?.()){overlay.hidden=true;overlay.setAttribute('aria-hidden','true');return;}
    if(!overlay.dataset.gestureReady){
      overlay.dataset.gestureReady='true';
      overlay.addEventListener('pointerdown',()=>{collectionPointerHeld=true;},true);
      const release=()=>{if(collectionPointerHeld){collectionPointerHeld=false;collectionInteractionUntil=Date.now()+180;}};
      document.addEventListener('pointerup',release,true);document.addEventListener('pointercancel',release,true);
    }
    const signature=JSON.stringify({isItem,id,detail,paused:state.manualPause});
    overlay.hidden=false;overlay.setAttribute('aria-hidden','false');
    if(overlay.dataset.signature===signature)return;
    // A polling update must not destroy the button between pointerdown and click.
    if(sameSelection&&(collectionPointerHeld||Date.now()<collectionInteractionUntil))return;
    const actions=(detail?.actions || []).filter(action=>action.id!=='original'&&action.id!=='sell');
    const sell=detail?.actions?.find(action=>action.id==='sell');
    // Keep the mobile keyboard and draft stable while the quantity is being edited.
    if(sameSelection&&oldInput&&document.activeElement===oldInput){
      oldInput.max=String(detail?.count ?? 0);
      const button=overlay.querySelector('[data-action="item-sell"]');if(button)button.disabled=!sell?.enabled||state.manualPause;
      return;
    }
    const oldScroll=overlay.querySelector('.detail-card')?.scrollTop ?? 0;
    const previousArtProgress=sameSelection?parseFloat(overlay.querySelector('[data-progress="art-detail"]')?.style.width):NaN;
    const draft=collectionDraft?.key===key?collectionDraft.value:'1';
    const quantity=Number(draft);
    const keptQuantity=Number.isInteger(quantity)&&quantity>0&&Number.isFinite(detail?.count)?String(Math.min(quantity,detail.count)):draft;
    const metrics=[['数量',detail?.count],['境阶',detail?.tier],['等级',detail?.level],['参悟累积',detail?.insight]];
    if(!isItem)metrics.push(['可用参悟值',detail?.availableInsight],['升重所需',detail?.requiredInsight],['尚需参悟',detail?.remainingInsight]);
    const hasArtProgress=!isItem&&Number.isFinite(detail?.insight)&&Number.isFinite(detail?.requiredInsight)&&detail.requiredInsight>0;
    const artProgress=hasArtProgress?percent(detail.insight/detail.requiredInsight*100):null;
    // monthlyInsightRate is the original 2372/2373 expression, explicitly shown as 点/月.
    const artRate=!isItem&&Number.isFinite(detail?.monthlyInsightRate)?`<p class="muted">参悟效率 ${number(detail.monthlyInsightRate)} 点/月</p>`:!isItem&&Number.isFinite(detail?.efficiency)?`<p class="muted">参悟效率 ${number(detail.efficiency)}</p>`:'';
    overlay.innerHTML=`<article class="dialogue-card detail-card"><div class="section-heading"><span class="eyebrow">${isItem?'纳戒珍藏':'功法传承'}</span><button class="secondary-button" data-action="close-detail">收起</button></div><h2 id="collectionTitle">${esc(detail?.name || (isItem?'物品详情':'功法详情'))}</h2>${detail?`<div class="detail-copy">${detail.description?`<p>${esc(String(detail.description).replace(/\[\/?(?:color|size|b|i|u|s|font)(?:=[^\]]*)?\]/gi,''))}</p>`:''}<div class="detail-metrics">${metrics.filter(([,value])=>value!==null&&value!==undefined).map(([label,value])=>`<span>${label} <strong>${number(value)}</strong></span>`).join('')}</div>${hasArtProgress?`<p class="muted">本重进度 ${artProgress.toFixed(1)}%</p><div class="progress-track"><div class="progress-fill" data-progress="art-detail" style="width:${artProgress}%"></div></div>`:''}${artRate}${detail.effectText?`<p>${esc(detail.effectText)}</p>`:''}${detail.reason?`<p class="muted">${esc(detail.reason)}</p>`:''}</div><div class="menu-actions">${actions.map(action=>`<button class="${action.enabled?'primary':'secondary'}-button" data-action="${isItem?'item-act':'art-act'}" data-id="${id}" data-operation="${esc(action.id)}" ${action.enabled&&!state.manualPause?'':'disabled'}>${esc(action.label)}${!action.enabled&&action.reason?` · ${esc(action.reason)}`:''}</button>`).join('')}${sell?`<section class="sell-panel"><div class="sell-price">每枚可换 ${number(detail.sellUnitPrice)} 灵石</div><label for="sellQuantity">卖出数量</label><div class="sell-controls"><input id="sellQuantity" type="number" inputmode="numeric" min="1" max="${detail.count}" step="1" value="${esc(keptQuantity)}" aria-label="卖出数量"><button class="secondary-button" data-action="item-sell" data-id="${id}" ${sell.enabled&&!state.manualPause?'':'disabled'}>卖出</button></div>${sell.reason?`<small>${esc(sell.reason)}</small>`:''}</section>`:''}${state.manualPause?'<button class="primary-button" data-action="pause-toggle">继续游戏以操作</button>':''}<button class="secondary-button" data-action="detail-original" data-route="${isItem?'inventory':'arts'}">更多操作</button></div>`:'<p class="muted">该物品已不在当前列表中。</p>'}</article>`;
    const artMeter=overlay.querySelector('[data-progress="art-detail"]');
    if(artMeter){window.MobileProgress.set(artMeter,Number.isFinite(previousArtProgress)?previousArtProgress:artProgress);window.MobileProgress.set(artMeter,artProgress);}
    overlay.dataset.signature=signature;overlay.dataset.selectionKey=key;
    overlay.dataset.beastQuote=isItem&&detail?.category==='灵兽'?JSON.stringify(detail):'';
    const card=overlay.querySelector('.detail-card');if(card)card.scrollTop=oldScroll;
  }
  function renderMarketDetail() {
    const overlay=document.getElementById('marketOverlay');if(!overlay)return;
    if(state.marketIndex===null){overlay.hidden=true;overlay.dataset.signature='';return;}
    const detail=state.adapter?.getMarketItemDetail?.(state.marketIndex);
    const signature=JSON.stringify({detail,paused:state.manualPause});overlay.hidden=false;
    if(overlay.dataset.signature===signature)return;
    overlay.dataset.signature=signature;
    const oldQuantity=Number(document.getElementById('purchaseQuantity')?.value);
    overlay.innerHTML=`<article class="dialogue-card detail-card">${window.MobileSystems.marketDetail(detail,state.manualPause)}</article>`;
    if(Number.isInteger(oldQuantity)&&oldQuantity>0&&oldQuantity<=detail?.maxPurchase)document.getElementById('purchaseQuantity').value=oldQuantity;
  }
  function renderGameScreen(s){
    const content=renderGameContent(s);
    if(state.route==='character'||content.includes('class="cave-estate"'))return content;
    if(content.includes('class="survivor-arena"')||content.includes('class="tactical-battle"')||content.includes('class="silk-inventory"'))return content;
    return (content.includes('class="moon-profile')||content.includes('data-ui-component="player-profile"'))?content:window.MobileMoonUI.profile(s,{esc,number})+content;
  }
  function renderGameContent(s){
    if(state.route==='estate')return window.MobileCave.render(s);
    if(state.route==='cultivation')return renderCultivation(s);
    if(state.route==='character')return window.MobileCharacterPage.render(s);
    if(state.route==='inventory')return window.MobileInventoryPage.render(s);
    if(state.route==='realm')return window.MobileThunderView.render(s,state);
    if(state.route==='journey')return hero(s)+window.MobileJourney.journey(s.journey,state);
    if(state.route==='reincarnation-preview')return hero(s)+window.MobileJourney.reincarnation(s.reincarnation,state);
    if(state.route==='reincarnation')return hero(s)+window.MobileReincarnation.render(s.reincarnationFlow,state);
    if(state.route==='expedition')return hero(s)+window.MobileExpedition.expedition(s.expedition,state);
    if(state.route==='fate-stones')return hero(s)+window.MobileExpedition.fateStones(s.fateStones,state);
    if(state.route==='adventure')return renderAdventure(s);
    if(['market','gathering','crafting'].includes(state.route))return hero(s)+(window.MobileSystems[state.route]?.(s[state.route],state)||'');
    if(['capture','beasts','challenge','cave','spirits'].includes(state.route))return hero(s)+(window.MobileExploration?.[state.route]?.(s[state.route],state)||'<section class="paper-card"><p class="muted">正在读取此处仙缘…</p></section>');
    return renderSystem(s,state.route);
  }
  function renderLifespanRebirth() {
    const flow=state.snapshot?.reincarnationFlow;
    const mandatory=flow?.phase==='lifespan-confirmation';
    const overlay=document.getElementById('rebirthReviewOverlay');
    state.lifespanRebirth=mandatory;
    for(const child of document.body.children){
      if(child===overlay)continue;
      if(mandatory&&!child.inert){child.inert=true;child.dataset.lifespanInert='true';}
      else if(!mandatory&&child.dataset.lifespanInert==='true'){child.inert=false;delete child.dataset.lifespanInert;}
    }
    if(!mandatory){
      if(overlay?.dataset.lifespan==='true'&&!state.reviewSubmitting){overlay.hidden=true;delete overlay.dataset.lifespan;state.rebirthReview=null;}
      return false;
    }
    if(!state.reviewSubmitting&&(!state.rebirthReview||state.lifespanReviewToken!==flow.token)){
      state.lifespanReviewToken=flow.token;
      const review=state.adapter.getReincarnationReview();
      state.rebirthReview=review;
      const html=window.MobileReincarnation.lifespan(review);
      if(overlay.innerHTML!==html)overlay.innerHTML=html;
    }
    overlay.dataset.lifespan='true';overlay.hidden=false;
    document.getElementById('dialogueOverlay').hidden=true;
    return true;
  }
  function renderDialogue() {
    if(renderLifespanRebirth())return;
    const dialogue = state.dialogue?.getSnapshot();
    const dialogueOverlay = document.getElementById('dialogueOverlay');
    if(dialogue&&!state.reviewSubmitting){
      for(const [key,id] of [['fateReview','fateReviewOverlay'],['rebirthReview','rebirthReviewOverlay']]){
        if(state[key]){state[key]=null;document.getElementById(id).hidden=true;}
      }
    }
    if(dialogueOverlay) {
      if(dialogueOverlay.hidden!==!dialogue)dialogueOverlay.hidden = !dialogue;
      if(dialogue) {
        const name=document.getElementById('dialogueName');if(name.textContent!==(dialogue.name||'仙途见闻'))name.textContent=dialogue.name||'仙途见闻';
        window.MobilePerf?.dialogueShown(dialogue.uid);
        const text=String(dialogue.text || '').replace(/\[\/?(?:color|size|b|i|u|s|font|outline|shadow|stroke|background)(?:=[^\]]*)?\]/gi,'');
        const body=document.getElementById('dialogueText');if(body.textContent!==text)body.textContent=text;
        const button=document.getElementById('dialogueContinue'),disabled=dialogue.canContinue===false,label=disabled?'静候下文…':'继续';
        if(button.disabled!==disabled)button.disabled=disabled;if(button.textContent!==label)button.textContent=label;
      }
    }
  }
  function refresh(force = false) {
    if (!screen()) return;
    let s;
    try {
      state.adapter?.tickAdventureStages?.();
      s=state.adapter?.getSnapshot();
      if(s){
        if(state.route==='cultivation'){s.methodArts=(s.arts||[]).filter(art=>art.level>0).map(art=>({...art,...state.adapter.getArtDetail?.(art.id)}));s.practiceArt=s.methodArts.find(art=>art.id===s.studyingArt);}
        s.character=state.adapter.getCharacterSnapshot?.();s.equipment=state.adapter.getEquipmentSnapshot?.();s.tribulation=state.adapter.getRealmSnapshot?.();s.quests=state.adapter.getQuestSnapshot?.();
        s.beasts=state.adapter.getBeastTrainingSnapshot?.();
        if(state.route==='journey')s.journey=state.adapter.getJourneySnapshot?.();
        if(state.route==='reincarnation-preview')s.reincarnation=state.adapter.getReincarnationPreview?.();
        s.reincarnationFlow=state.adapter.getReincarnationSnapshot?.();
        if(state.route==='expedition')s.expedition=state.adapter.getExpeditionSnapshot?.();
        if(state.route==='fate-stones')s.fateStones=state.adapter.getFateStoneSnapshot?.();
        if(state.route==='adventure'){s.adventure=state.adapter.getAdventureSnapshot?.();s.adventure=window.MobileCombat?.prepare(s.adventure)??s.adventure;}
        if(state.route==='market')s.market=state.adapter.getMarketSnapshot?.({floor:state.marketFloor,category:state.marketCategory});
        if(state.route==='gathering')s.gathering=state.adapter.getGatheringSnapshot?.(state.gatheringKind);
        if(state.route==='crafting')s.crafting=state.adapter.getCraftingSnapshot?.(state.craftingKind);
        if(state.route==='capture'){s.capture=state.adapter.getCaptureSnapshot?.();if(s.capture)s.capture.settings=state.adapter.getCaptureSettingsSnapshot?.();}
        if(state.route==='challenge')s.challenge=state.adapter.getChallengeSnapshot?.();
        if(state.route==='cave')s.cave=state.adapter.getCaveSnapshot?.();
        if(state.route==='spirits')s.spirits=state.adapter.getSpiritSnapshot?.();
      }
    }catch(error){report({kind:'snapshot-error',message:error.message});}
    if (!s) s = {ready:false,isInGame:false,layout:''};
    window.MobilePlayerProfile?.ensure(state.adapter,s,()=>refresh(true));
    window.MobileEquipment?.ensure(state.adapter,s);
    const previousThunder=state.snapshot?.tribulation?.thunder;
    const thunder=s.tribulation?.thunder;
    if(previousThunder&&thunder&&['success','failed'].includes(thunder.result)&&
      (previousThunder.id!==thunder.id||previousThunder.result!==thunder.result)){
      toast(thunder.result==='success'?'渡劫成功':'渡劫失败');
    }
    state.snapshot = s;
    if(s.ready)window.MobilePerf?.mark('dataReady');
    if(s.isInGame)window.MobilePerf?.mark('inGame');
    window.MobileSingleSave?.ensure(state.adapter,s,()=>refresh(true));
    renderCollectionDetail();
    renderMarketDetail();
    renderDialogue();
    const status = document.getElementById('connectionStatus');
    if (status) status.textContent = state.manualPause?'已暂停 · 时间停止':s.isInGame ? '仙途进行中' : s.ready ? '山河已就绪' : '正在载入…';
    document.body.dataset.gameState = JSON.stringify({ ready:s.ready,layout:s.layout,isInGame:s.isInGame,cultivating:s.cultivating,selectedMethod:s.selectedMethod,progress:s.progress,realm:s.realm,stats:s.stats,loadingProgress:s.loadingProgress });
    if(location.hostname==='127.0.0.1'||location.hostname==='localhost'){
      const engine=rawRuntime();
      document.body.dataset.recipeLearning=JSON.stringify(state.adapter?.recipeLearningDiagnostics ?? null);
      document.body.dataset.pathState=JSON.stringify({route:state.route,journey:s.journey,reincarnation:s.reincarnation,reincarnationFlow:s.reincarnationFlow,expedition:s.expedition,fateStones:s.fateStones,realm:s.tribulation,quests:s.quests});
      document.body.dataset.systemSettings=JSON.stringify({capture:s.capture?.settings,beasts:s.beasts?.settings,challenge:s.challenge?.settings,cave:s.cave?{queue:s.cave.queue,queueFingerprint:s.cave.queueFingerprint,upgrade:s.cave.upgrade,spiritStones:s.cave.spiritStones}:null});
      document.body.dataset.engineState=JSON.stringify({wallTime:Date.now(),gameTime:engine?.GetGameTime?.(),dt:engine?.GetDt?.(),dtRaw:engine?.GetDtRaw?.(),timeScale:engine?.GetTimeScale?.(),tick:engine?.GetTickCount?.(),suspended:engine?.IsSuspended?.(),lifecyclePaused:state.paused,manualPause:state.manualPause,visibility:document.visibilityState,titleInput:state.adapter?._local(115033090622781),titleReady:state.adapter?._flag('载入判定'),busy:state.adapter?.busy});
    }
    const signature = JSON.stringify({
      ready:s.ready,inGame:s.isInGame,playerName:s.playerName,layout:s.layout,loadingProgress:s.loadingProgress,route:state.route,
      slots:state.slots,slotData:state.slots?s.slots:null,
      realm:s.realm,cultivating:s.cultivating,selected:s.selectedMethod,realmEntry:[s.canBreakthrough,s.stats?.qi>0,s.stats?.attack>0,s.tribulation?.entryAvailable],
      activity:[s.adventuring,s.studying,s.studyingArt,s.gatheringHerbs,s.gatheringMinerals,s.makingPills,s.makingTreasures,s.searchingBeasts,s.capturingBeasts,s.trainingBeasts,s.challenging,s.upgradingCave,state.manualPause],
      methods:s.methods?.map(m=>[m.id,m.name,m.level,m.unlocked,m.cap]),methodArts:s.methodArts?.map(a=>[a.id,a.level,a.reason,a.monthlyInsightRate,a.availableInsight>0]),
      collection:state.route==='inventory'?s.inventory:state.route==='arts'?s.arts:null,
      equipment:state.route==='character'?s.equipment:null,gearRevision:s.gearInventory?.revision,
      quests:s.quests?.quests,
      selectedItem:state.itemId,selectedArt:state.artId,filter:state.collectionFilter,
      tribulation:s.tribulation?[s.tribulation.thunder,s.tribulation.active,s.tribulation.mode,s.tribulation.canAct,s.tribulation.prepared,s.tribulation.nextName,s.tribulation.material,s.tribulation.realmFingerprint,s.tribulation.materialCandidates,s.tribulation.major,s.tribulation.reason,s.tribulation.recentMessages]:null,
      journey:s.journey,reincarnation:s.reincarnation,
      expedition:s.expedition?{...s.expedition,battle:{active:s.expedition.battle?.active}}:null,fateStones:s.fateStones,
      reincarnationFlow:s.reincarnationFlow?[s.reincarnationFlow.phase,s.reincarnationFlow.phaseLabel,s.reincarnationFlow.token,s.reincarnationFlow.points,s.reincarnationFlow.multiplier,s.reincarnationFlow.aptitudes,s.reincarnationFlow.actions,s.reincarnationFlow.trial?.active,s.reincarnationFlow.trial?.enemyLevel,s.reincarnationFlow.reason,s.reincarnationFlow.busy]:null,
      adventure:s.adventure?[s.adventure.recovery?[s.adventure.recovery.id,s.adventure.recovery.cooling,s.adventure.recovery.rewards]:null,s.adventure.stage,s.adventure.ready,s.adventure.unlocked,s.adventure.selectedRegion,s.adventure.selectedEnemy,s.adventure.battle.active,s.adventure.battle.enemyId,s.adventure.canStart,s.adventure.enemies.map(enemy=>[enemy.id,enemy.known,enemy.selectable,enemy.kills,enemy.evolution?.level]),s.adventure.messages]:null,
      market:s.market,
      gathering:s.gathering?{...s.gathering,progress:null,rawProgress:null}:null,
      crafting:s.crafting?{...s.crafting,progress:null,rawProgress:null,remainingMonths:null}:null,
      capture:s.capture?{...s.capture,progress:null,rawProgress:null,target:s.capture.target?{...s.capture.target,qi:null}:null,battle:{active:s.capture.battle?.active}}:null,
      beasts:s.beasts?{...s.beasts,progress:null,rawProgress:null}:null,
      challenge:s.challenge?{...s.challenge,battle:{active:s.challenge.battle?.active,targetId:s.challenge.battle?.targetId,autoChallenge:s.challenge.battle?.autoChallenge}}:null,
      cave:s.cave?{...s.cave,upgrade:s.cave.upgrade?{...s.cave.upgrade,progress:null,rawProgress:null,remainingMonths:null}:null}:null,
      spirits:s.spirits,spiritSlot:state.spiritSlot,
      canBreakthrough:s.canBreakthrough,blocked:s.blocked
    });
    const preserveCave=state.route==='estate'&&screen().querySelector('.cave-estate')&&screen().dataset.caveSlot===String(s.currentSlot);
    if (!preserveCave&&(force || signature !== state.signature)&&!screenPointerHeld&&Date.now()>=screenInteractionUntil) {
      const scroll = screen().scrollTop;
      const methodScroll=screen().querySelector('.method-picker-list')?.scrollTop;
      const questsOpen=screen().querySelector('[data-quest-additional]')?.open;
      const panelStates=new Map([...screen().querySelectorAll('details[data-state-key]')].map(panel=>[panel.dataset.stateKey,panel.open]));
      window.MobileLayout?.remember(screen());
      screen().innerHTML=!s.isInGame?renderLanding(s):renderGameScreen(s);
      screen().classList.toggle('game-screen',s.isInGame);
      screen().classList.toggle('choosing-slots',!s.isInGame&&state.slots);
      if(s.isInGame)window.MobileLayout?.mount(screen(),state.route);
      if(questsOpen&&screen().querySelector('[data-quest-additional]'))screen().querySelector('[data-quest-additional]').open=true;
      screen().querySelectorAll('details[data-state-key]').forEach(panel=>{if(panelStates.has(panel.dataset.stateKey))panel.open=panelStates.get(panel.dataset.stateKey);});
      screen().scrollTop = scroll;
      if(methodScroll!=null&&screen().querySelector('.method-picker-list'))screen().querySelector('.method-picker-list').scrollTop=methodScroll;
      state.signature = signature;
    }
    if(state.route==='estate'&&s.isInGame){screen().dataset.caveSlot=String(s.currentSlot);window.MobileCave?.mount(screen(),state.adapter,s);}else window.MobileCave?.detach();
    if(window.MobileCultivationFeedback)window.MobileCultivationFeedback.update(s);
    else document.querySelectorAll('[data-combat-power]').forEach(e=>e.textContent=number(window.MobilePresentation?.combatPower(s.stats)));
    const v = {...(s.stats || {}),...(s.character || {}),progress:s.progress == null ? '—' : percent(s.progress).toFixed(1)+'%'};
    document.querySelectorAll('[data-value]').forEach(e => { const key=e.dataset.value; e.textContent=key==='progress'?v[key]:number(v[key]); });
    if(!s.cultivating)document.querySelectorAll('.progress-fill:not([data-progress]):not([data-live-meter])').forEach(e=>window.MobileProgress.set(e,percent(s.progress),{snap:true}));
    document.querySelectorAll('[data-progress="realm"]').forEach(e=>window.MobileProgress.set(e,percent(s.tribulation?.progress)));
    document.querySelectorAll('[data-realm-value]').forEach(e=>e.textContent=e.dataset.realmValue==='progress'?percent(s.tribulation?.progress).toFixed(1)+'%':number(s.tribulation?.[e.dataset.realmValue]));
    document.querySelectorAll('[data-thunder-hp]').forEach(e=>{const r=s.tribulation;if(!r)return;e.style.width=(r.maxQi>0?percent(r.qi/r.maxQi*100):0)+'%';e.parentElement.setAttribute('aria-valuenow',r.qi);e.parentElement.setAttribute('aria-valuemax',r.maxQi);});
    document.querySelectorAll('[data-realm-grade-label]').forEach(e=>e.textContent=s.tribulation?.major?.gradeLabel||'品级计算中');
    window.MobileCombat?.update(state.route==='adventure'?s.adventure:null,state.combatSheet);
    window.MobileCombat?.updateSystems(s);
    const shownBattle=window.MobileCombat?.displayBattle(s.adventure?.battle)||s.adventure?.battle;
    document.querySelectorAll('[data-battle-value]').forEach(e=>e.textContent=number(shownBattle?.[e.dataset.battleValue]));
    for(const type of ['enemy','player']){const battle=shownBattle;const hp=type==='enemy'?battle?.enemyQi:battle?.playerQi;const max=type==='enemy'?battle?.maxEnemyQi:battle?.maxPlayerQi;document.querySelectorAll(`[data-progress="${type}"]`).forEach(e=>window.MobileProgress.set(e,max>0?percent(hp/max*100):0,{decrease:true,snap:true}));}
    const system=s.gathering || s.crafting;
    document.querySelectorAll('[data-progress="system"]').forEach(e=>window.MobileProgress.set(e,percent(system?.progress)));
    document.querySelectorAll('[data-system-value]').forEach(e=>e.textContent=e.dataset.systemValue==='progress'?number(percent(system?.progress))+'%':number(system?.[e.dataset.systemValue]));
    document.querySelectorAll('[role=progressbar]:not(.moon-meter):not(.stage-progress):not(.silk-life-track):not(.thunder-hp-track):not(.character-hp-track)').forEach(e=>e.setAttribute('aria-valuenow',String(percent(s.progress))));
    document.querySelectorAll('[data-character-field]').forEach(e=>{const raw=s.character?.[e.dataset.characterField],v=raw==null?null:raw*Number(e.dataset.scale||1);e.textContent=v==null?'—':number(v)+e.dataset.unit;});
    document.querySelectorAll('.character-hp-track').forEach(track=>{const ratio=s.stats?.maxQi>0?percent(s.stats.qi/s.stats.maxQi*100):0;track.setAttribute('aria-valuenow',String(ratio));const fill=track.querySelector('i');if(fill)window.MobileProgress.set(fill,ratio,{snap:true});});
    document.querySelectorAll('.silk-life-track').forEach(track=>{const ratio=s.stats?.lifespan>0?percent(s.stats.age/s.stats.lifespan*100):0;track.setAttribute('aria-valuenow',String(ratio));const fill=track.querySelector('i');if(fill)window.MobileProgress.set(fill,ratio,{snap:true});});
    window.MobileCultivationProgress?.update(s);
    const breakthrough=document.querySelector('[data-moon-breakthrough]');
    if(breakthrough){
      breakthrough.hidden=s.tribulation?.entryAvailable!==true;
      breakthrough.classList.toggle('has-confidence',s.tribulation?.readiness?.confident===true&&!s.tribulation?.active&&!s.blocked&&!state.manualPause);
      breakthrough.title=s.tribulation?.readiness?.reason||'查看突破条件';
    }
    const live=path=>String(path||'').split('.').reduce((value,key)=>value?.[key],s);
    document.querySelectorAll('[data-live-number]').forEach(e=>{const amount=live(e.dataset.liveNumber);e.textContent=amount==null?'—':number(amount)+(e.dataset.liveFormat==='percent'?'%':'');});
    document.querySelectorAll('[data-live-meter]').forEach(e=>{const amount=live(e.dataset.liveMeter),max=e.dataset.liveMax?live(e.dataset.liveMax):null;window.MobileProgress.set(e,percent(e.dataset.liveMax?(max>0?amount/max*100:0):amount),{decrease:!!e.dataset.liveMax});});
    document.querySelectorAll('.bottom-nav [data-route]').forEach(e=> {e.classList.toggle('is-active',e.dataset.route===state.route);e.setAttribute('aria-current',e.dataset.route===state.route?'page':'false');e.disabled=!s.isInGame;});
    if (Date.now()-diagnosticAt>10000) {diagnosticAt=Date.now();report({kind:'state',...JSON.parse(document.body.dataset.gameState)});}
  }
  function fitClassic() {
    const viewport = document.getElementById('classicViewport'), frame = document.getElementById('engineFrame');
    if (!viewport || !frame || !state.classic) return;
    const rect = state.crop==='sidebar' ? [0,200,670,936] : state.crop==='full' ? [0,0,2016,1136] : [640,150,1376,986];
    const baseScale = Math.max(viewport.clientWidth/rect[2],0.48);
    const scale = Math.max(.25,Math.min(1.2,baseScale*state.zoom));
    frame.style.cssText=`position:absolute;left:${-rect[0]*scale}px;top:${-rect[1]*scale}px;width:2016px;height:1136px;max-width:none;transform:scale(${scale});transform-origin:0 0;border:0;opacity:1;pointer-events:auto;`;
    viewport.style.minHeight=Math.min(rect[3]*scale,innerHeight-180)+'px';
    viewport.style.height='calc(100dvh - 160px)';
    viewport.style.overflow='auto';
    // The scroll surface preserves access to controls outside the initially selected region.
    let surface = document.getElementById('classicScrollSurface');
    if(!surface){surface=document.createElement('div');surface.id='classicScrollSurface';surface.style.pointerEvents='none';viewport.append(surface);}
    surface.style.width=Math.max(rect[2]*scale,viewport.clientWidth)+'px';
    surface.style.height=Math.max(rect[3]*scale,viewport.clientHeight)+'px';
    viewport.scrollLeft=state.crop==='full'?Math.max(0,(2016*scale-viewport.clientWidth)/2):0;
    viewport.scrollTop=0;
    document.querySelectorAll('[data-crop]').forEach(e=>{e.classList.toggle('is-active',e.dataset.crop===state.crop);e.setAttribute('aria-pressed',e.dataset.crop===state.crop?'true':'false');});
  }
  function closeClassic() {
    state.classic=false;
    document.getElementById('classicModal')?.setAttribute('hidden','');
    document.getElementById('classicModal')?.setAttribute('aria-hidden','true');
    const frame=document.getElementById('engineFrame');
    if(frame) frame.style.cssText='position:fixed;left:0;top:0;width:2016px;height:1136px;max-width:none;border:0;transform:none;';
    refresh(true);
  }
  async function openClassic(route) {
    if(!state.adapter) return;
    if(route) checked(await state.adapter.openOriginal(route));
    state.classic=true; state.crop='content'; state.zoom=1;
    const modal=document.getElementById('classicModal');modal.removeAttribute('hidden');modal.setAttribute('aria-hidden','false');
    document.getElementById('classicTitle').textContent=titles[route] || '仙途万象';
    fitClassic();
    document.querySelectorAll('[data-crop]').forEach(e=>e.classList.toggle('is-active',e.dataset.crop===state.crop));
  }
  async function prepareRoute(route) {
    let result;
    if(route==='realm'&&state.adapter?.prepareRealm)result=await state.adapter.prepareRealm();
    if(route==='adventure'&&state.adapter?.openAdventure)result=await state.adapter.openAdventure();
    if(route==='market'&&state.adapter?.openMarket)result=await state.adapter.openMarket({floor:state.marketFloor,category:state.marketCategory});
    if(route==='gathering'&&state.adapter?.openGathering)result=await state.adapter.openGathering(state.gatheringKind);
    if(route==='crafting'&&state.adapter?.openCrafting)result=await state.adapter.openCrafting(state.craftingKind);
    if(route==='capture'&&state.adapter?.openCapture)result=await state.adapter.openCapture();
    if(route==='beasts'&&state.adapter?.openBeastTraining)result=await state.adapter.openBeastTraining();
    if(route==='challenge'&&state.adapter?.openChallenge)result=await state.adapter.openChallenge();
    if(route==='cave'&&state.adapter?.openCave)result=await state.adapter.openCave();
    if(route==='spirits'&&state.adapter?.openSpirits)result=await state.adapter.openSpirits();
    if(route==='expedition'&&state.adapter?.openExpedition)result=await state.adapter.openExpedition();
    if(result?.ok===false)toast(result.message);
    return result;
  }
  async function navigate(route) {
    if(state.lifespanRebirth)return;
    state.combatSheet=null;
    const rebirth=state.adapter?.getReincarnationSnapshot?.();
    if(['start-confirmation','waiting','trial','settlement','lifespan-confirmation'].includes(rebirth?.phase)&&!['reincarnation','reincarnation-preview','journey'].includes(route)){
      route='reincarnation';toast('请先处理当前转世试炼或结算。');
    }
    if(route==='adventure'&&state.route!=='adventure'){state.adventureReturnRoute=state.route;state.adventureReturnScroll=screen()?.scrollTop||0;}
    state.route=route;state.itemId=null;state.artId=null;state.marketIndex=null;
    if(!state.manualPause&&(route!=='realm'||state.snapshot?.canBreakthrough||state.snapshot?.tribulation?.active))await prepareRoute(route);
    refresh(true);screen().scrollTop=0;
  }
  async function act(action, element) {
    const a=state.adapter;
    if(state.lifespanRebirth&&action!=='rebirth-confirm')return;
    document.body.dataset.lastAction=action;
    if(state.reviewSubmitting&&['fate-confirm','rebirth-confirm'].includes(action)){toast('原游戏正在提交，请等待结果后再操作。');return;}
    if(action==='confirm-yes'||action==='confirm-no'){finishConfirmation(action==='confirm-yes');return;}
    if(action==='retry-entry'){window.MobileSingleSave?.retry();refresh(true);return;}
    if(action==='pause-toggle'||action==='show-slots'||action==='new-game'||action==='load-slot')return;
    if(action==='restart-game'){
      if(state.reviewSubmitting||state.adapter?.busy)throw new Error('请等待当前操作完成。');
      if(!(await confirmGame('重新开始会清空本机此游戏的全部存档与进度，无法撤销。确定从头开始吗？')))return;
      checked(await window.MobileSingleSave.restart(a));
      location.reload();return;
    }
    if(action==='continue-dialogue'){checked(state.dialogue?.continue());renderDialogue();return;}
    if(action==='close-classic'){closeClassic();return;}
    if(action==='close-detail'){closeCollectionDetail();return;}
    if(action==='close-market-detail'){state.marketIndex=null;renderMarketDetail();return;}
    if(action==='menu'){state.menu=true;document.getElementById('menuOverlay').hidden=false;return;}
    if(action==='close-menu'){state.menu=false;document.getElementById('menuOverlay').hidden=true;return;}
    if(['rebirth-review-close','fate-review-close'].includes(action)&&state.reviewSubmitting){toast('原游戏正在提交，请等待结果后再返回。');return;}
    if(action==='rebirth-review-close'){state.rebirthReview=null;document.getElementById('rebirthReviewOverlay').hidden=true;return;}
    if(action==='fate-review-close'){state.fateReview=null;document.getElementById('fateReviewOverlay').hidden=true;return;}
    if(state.menu){state.menu=false;document.getElementById('menuOverlay').hidden=true;}
    if(action==='full-game'){await openClassic();state.crop='full';fitClassic();document.querySelectorAll('[data-crop]').forEach(e=>e.classList.toggle('is-active',e.dataset.crop===state.crop));return;}
    if(action==='back-cultivation'){state.route='cultivation';closeClassic();return;}
    if(!a)throw new Error('山河仍在载入，请稍候。');
    if(action==='adventure-back'){const route=state.adventureReturnRoute||'cultivation',scroll=state.adventureReturnScroll||0;await navigate(route);if(state.route===route)screen().scrollTop=scroll;return;}
    if(action==='navigate'){if(!state.snapshot?.isInGame)throw new Error('请先进入修仙档位。');if(element.dataset.route==='gathering'&&['herbs','mining'].includes(element.dataset.kind))state.gatheringKind=element.dataset.kind;if(element.dataset.route==='crafting'&&['alchemy','smithing'].includes(element.dataset.kind))state.craftingKind=element.dataset.kind;return navigate(element.dataset.route);}
    if(action==='market-floor'){checked(await a.selectMarketFloor(Number(element.dataset.id)));state.marketFloor=Number(element.dataset.id);state.marketCategory='全部';refresh(true);return;}
    if(action==='rebirth-review'){
      const review=a.getReincarnationReview();
      if(!review?.ready||!review.canConfirm)throw new Error(review?.reason||'本次转世尚未满足原结算条件。');
      state.rebirthReview=review;
      const overlay=document.getElementById('rebirthReviewOverlay');
      overlay.innerHTML=window.MobileReincarnation.review(review,state.manualPause);overlay.hidden=false;return;
    }
    if(action==='market-category'){state.marketCategory=element.dataset.category;refresh(true);return;}
    if(action==='fate-review'){
      const review=a.getFateStoneReview(Number(element.dataset.id),{expectedToken:element.dataset.token});
      if(!review?.ready||!review.canConfirm)throw new Error(review?.reason||'该命石目前无法入命，请重新核对。');
      state.fateReview=review;
      const overlay=document.getElementById('fateReviewOverlay');
      overlay.innerHTML=window.MobileExpedition.fateStoneReview(review,state.manualPause);overlay.hidden=false;return;
    }
    if(action==='market-detail'){state.marketIndex=Number(element.dataset.id);renderMarketDetail();return;}
    if(action==='spirit-slot'){state.spiritSlot=Number(element.dataset.id);refresh(true);return;}
    if(action==='system-kind'){let result;if(element.dataset.system==='gathering'){state.gatheringKind=element.dataset.kind;if(!state.manualPause)result=await a.openGathering(state.gatheringKind);}else{state.craftingKind=element.dataset.kind;if(!state.manualPause)result=await a.openCrafting(state.craftingKind);}if(result?.ok===false)toast(result.message);refresh(true);return;}
    if(state.manualPause&&!['save','filter-items','item-detail','art-detail','detail-original','original','original-dialog'].includes(action))throw new Error('请先点右上角继续游戏。');
    if(action==='train'){checked(await a.startCultivation(Number(element.dataset.id)));const sheet=document.querySelector('.moon-methods[open]');if(sheet){sheet.open=false;document.querySelector('[data-moon-open]')?.focus();}toast('已开始修炼');}
    else if(action==='method-art-study'||action==='method-art-stop'){const result=checked(await a.performArtAction(Number(element.dataset.id),action==='method-art-stop'?'stop':'study'));const sheet=document.querySelector('.moon-methods[open]');if(sheet)sheet.open=false;toast(result.message||'已切换修炼');}
    else if(action==='stop'){checked(await a.stopCultivation());toast('已暂停修炼');}
    else if(action==='save'){checked(await a.save());toast('已保存到本机档位');}
    else if(action==='rebirth-open'){const result=checked(await a.openReincarnation());toast(result.message);}
    else if(action==='rebirth-start'){
      const expectedToken=element.dataset.token;
      if(!(await confirmGame('开始转世试炼会回满气血并进入轮回境战斗。试炼结束后仍须单独确认转世，才会重置人物与物品。现在开始试炼？')))return;
      const result=checked(await a.startReincarnationTrial({expectedToken}));toast(result.message);
    }
    else if(action==='rebirth-abandon'){
      const expectedToken=element.dataset.token;
      if(!(await confirmGame('放弃本次试炼所得并返回？此操作不会执行转世。')))return;
      const result=checked(await a.abandonReincarnationTrial({expectedToken}));toast(result.message);
    }
    else if(action==='rebirth-confirm'){
      if(state.lifespanRebirth){state.rebirthReview=a.getReincarnationReview();element.dataset.token=state.rebirthReview?.token;}
      if(!state.rebirthReview||element.dataset.token!==state.rebirthReview.token)throw new Error('请重新查看这一次转世的收益与损失。');
      let result;
      lockReviewSubmission('rebirth');
      try{result=checked(await a.confirmReincarnation({expectedToken:state.rebirthReview.token,confirmed:true}));}
      finally{state.reviewSubmitting=null;state.rebirthReview=null;document.getElementById('rebirthReviewOverlay').hidden=true;document.getElementById('rebirthReviewOverlay').removeAttribute('aria-busy');}
      state.route='cultivation';refresh(true);
      await a.save();
      toast('已转世，新的修行开始了。');
    }
    else if(action==='rebirth-multiplier'){const result=checked(await a.cycleAptitudeMultiplier({expectedToken:element.dataset.token}));toast(result.message);}
    else if(action==='rebirth-allocate'){const result=checked(await a.allocateAptitude(element.dataset.name,{expectedToken:element.dataset.token}));toast(result.message);}
    else if(action==='expedition-select'){const result=checked(await a.selectExpedition(Number(element.dataset.id)));toast(result.message);}
    else if(action==='expedition-open'){const result=checked(await a.openExpedition());toast(result.message);}
    else if(action==='expedition-enter'){const result=checked(await a.enterExpedition({expectedFingerprint:element.dataset.expeditionFingerprint}));toast(result.message);}
    else if(action==='expedition-end'){const result=checked(await a.endExpedition({expectedFingerprint:element.dataset.expeditionFingerprint}));toast(result.message);}
    else if(action==='expedition-setting'){const result=checked(await a.configureExpedition({[element.dataset.setting]:element.dataset.settingValue==='true'}));toast(result.message);}
    else if(action==='expedition-original'){checked(await a.openExpedition());await openClassic();}
    else if(action==='fate-original'){checked(await a.openFateStones());await openClassic();}
    else if(action==='fate-inventory-original'){await openClassic('inventory');}
    else if(action==='fate-confirm'){
      if(!state.fateReview||element.dataset.token!==state.fateReview.token)throw new Error('请重新核对这一次命石入命。');
      let result;
      lockReviewSubmission('fate');
      try{result=checked(await a.inscribeFateStone(state.fateReview.inventoryIndex,{expectedToken:state.fateReview.token,confirmed:true}));}
      finally{state.reviewSubmitting=null;state.fateReview=null;document.getElementById('fateReviewOverlay').hidden=true;document.getElementById('fateReviewOverlay').removeAttribute('aria-busy');}
      toast(result.message);
    }
    else if(action==='realm-start'){
      const expectedRealmFingerprint=element.dataset.realmFingerprint;
      let result=await a.startRealm({expectedRealmFingerprint});
      if(result.needsMaterialConfirmation){if(!(await confirmGame(result.message+'\n确定强行渡劫？')))return;result=await a.startRealm({confirmWithoutMaterial:true,expectedRealmFingerprint});}
      checked(result);toast(result.message);
    }
    else if(action==='realm-stop'){
      const realm=a.getRealmSnapshot();
      if(realm?.mode==='major'&&!(await confirmGame(realm.major?.lossWarning||'放弃本次大境界渡劫？已使用宝材按原规则处理。')))return;
      checked(await a.stopRealm({expectedRealmFingerprint:element.dataset.realmFingerprint}));toast('已停止渡劫');
    }
    else if(action==='realm-material-select'){const result=checked(await a.selectRealmMaterial(Number(element.dataset.id),{expectedToken:element.dataset.token,expectedRealmFingerprint:element.dataset.realmFingerprint}));toast(result.message);}
    else if(action==='realm-material-remove'){const result=checked(await a.removeRealmMaterial({expectedRealmFingerprint:element.dataset.realmFingerprint}));toast(result.message);}
    else if(action==='combat-targets'){state.combatSheet='targets';}
    else if(action==='combat-log'){state.combatSheet='log';}
    else if(action==='combat-close'){state.combatSheet=null;}
    else if(action==='adventure-region'){checked(await a.selectRegion(Number(element.dataset.id)));}
    else if(action==='adventure-enemy'){
      const id=Number(element.dataset.id),battle=a.getAdventureSnapshot().battle;
      if(battle.active&&battle.enemyId!==id){
        if(!await confirmGame('停止当前历练并切换目标？切换后需点击开始历练。'))return;
        checked(await a.stopBattle());
      }
      checked(await a.selectEnemy(id));state.combatSheet=null;
    }
    else if(action==='battle-start'){const result=checked(await a.startBattle(Number(element.dataset.id)));toast(result.message||'历练已开始');}
    else if(action==='battle-resume'||action==='battle-boss'){const result=checked(await a.startBattle(null,action==='battle-boss'?'boss':'continue'));toast(result.message);}
    else if(action==='battle-stop'){checked(await a.stopBattle());toast('已停止历练');}
    else if(action==='capture-search'){const result=checked(await a.startBeastSearch());toast(result.message);}
    else if(action==='capture-search-stop'){const result=checked(await a.stopBeastSearch());toast(result.message);}
    else if(action==='capture-start'){const result=checked(await a.startBeastCapture());toast(result.message);}
    else if(action==='capture-stop'){const result=checked(await a.stopBeastCapture());toast(result.message);}
    else if(action==='capture-original'){return act('full-game',element);}
    else if(action==='capture-configure'){const result=checked(await a.configureCaptureSettings({minimumRarity:Number(element.dataset.settingValue),expectedToken:element.dataset.token}));toast(result.message);}
    else if(action==='beast-undeploy'){const pet=a.getBeastTrainingSnapshot()?.equipped;if(pet?.affinity>0&&!(await confirmGame('下阵后灵兽回到纳戒，当前契合余量不会保存。确定下阵？')))return;const result=checked(await a.undeployBeast());toast(result.message);}
    else if(action==='beast-training-start'){const result=checked(await a.startBeastTraining());toast(result.message);}
    else if(action==='beast-training-stop'){const result=checked(await a.stopBeastTraining());toast(result.message);}
    else if(action==='beast-multiplier'){const result=checked(await a.configureBeastTraining({materialMultiplier:Number(element.dataset.settingValue)}));toast(result.message);}
    else if(action==='challenge-category'){const result=checked(await a.selectChallengeCategory(element.dataset.category));toast(result.message);}
    else if(action==='challenge-select'){checked(await a.selectChallenge(Number(element.dataset.id)));}
    else if(action==='challenge-start'){const result=checked(await a.startChallenge(Number(element.dataset.id)));toast(result.message);}
    else if(action==='challenge-stop'){const result=checked(await a.stopChallenge());toast(result.message);}
    else if(action==='challenge-auto'){const result=checked(await a.configureChallenge({autoChallenge:element.dataset.settingValue==='true'}));toast(result.message);}
    else if(action==='cave-select'){checked(await a.selectCaveBuilding(element.dataset.name));}
    else if(action==='cave-start'){const result=checked(await a.startCaveUpgrade(element.dataset.name));toast(result.message);}
    else if(action==='cave-stop'){
      const cave=a.getCaveSnapshot(),upgrade=cave?.upgrade;
      const message=(upgrade?.refundable?`停止${upgrade.name}升级，按原规则返还 ${number(upgrade.refundAmount)} 灵石？`:`停止${upgrade?.name||'当前洞府建筑'}升级？`)+(cave?.queueCount?' 待建队列会按原规则接续执行。':'');
      if(!(await confirmGame(message)))return;
      const result=checked(await a.stopCaveUpgrade({expectedQueueFingerprint:cave.queueFingerprint}));toast(result.message);
    }
    else if(action==='cave-enqueue'){const result=checked(await a.enqueueCaveUpgrade(element.dataset.name,{expectedTargetLevel:Number(element.dataset.level),expectedQueueFingerprint:element.dataset.queue}));toast(result.message);}
    else if(action==='cave-queue-remove'){const result=checked(await a.removeCaveQueue(Number(element.dataset.slot),{expectedName:element.dataset.name,expectedToken:element.dataset.token}));toast(result.message);}
    else if(action==='cave-original'){return act('full-game',element);}
    else if(action==='spirit-equip'){
      const row=Number(element.dataset.id),slot=state.spiritSlot,detail=a.getSpiritItemDetail(row),current=a.getSpiritSnapshot()?.slots?.find(item=>item.slot===slot);
      if(!detail)throw new Error('该灵物已不在纳戒中。');
      if(current?.item&&!(await confirmGame(`将${detail.name}放入第${slot}槽？原灵物会回到纳戒。`)))return;
      const result=checked(await a.equipSpirit(slot,row,{expectedItemId:Number(element.dataset.itemId),expectedInstance:element.dataset.instance}));toast(result.message);
    }
    else if(action==='spirit-unequip'){const result=checked(await a.unequipSpirit(Number(element.dataset.id)));toast(result.message);}
    else if(action==='unequip'){checked(await a.unequipItem(Number(element.dataset.id)));toast('法宝已卸下，收回纳戒');}
    else if(action==='item-sell'){
      guardCollectionAction();
      const id=Number(element.dataset.id),quantity=Number(document.getElementById('sellQuantity')?.value),detail=a.getItemDetail(id);
      if(!detail||!Number.isInteger(quantity)||quantity<1||quantity>detail.count)throw new Error('请输入持有范围内的整数数量。');
      if(!(await confirmGame(`卖出 ${quantity} 枚${detail.name}，换取 ${number(quantity*detail.sellUnitPrice)} 灵石？`)))return;
      guardCollectionAction();
      const result=checkedCollectionResult(await a.sellItem(id,quantity,{expectedItemId:detail.id,expectedUnitPrice:detail.sellUnitPrice}));
      const current=a.getItemDetail(id);
      if(state.itemId===id&&(!current||current.id!==detail.id))closeCollectionDetail();
      toast(result.message || '原游戏已确认卖出。');renderCollectionDetail();
    }
    else if(action==='market-buy'){const id=Number(element.dataset.id),quantity=Number(document.getElementById('purchaseQuantity')?.value),detail=a.getMarketItemDetail(id);if(!detail||!Number.isInteger(quantity)||quantity<1||quantity>detail.maxPurchase)throw new Error('请输入库存和灵石允许范围内的购买数量。');if(!(await confirmGame(`购买 ${quantity} 枚${detail.name}，共需 ${number(quantity*detail.unitPrice)} 灵石？`)))return;const result=checked(await a.purchaseItem(id,quantity,{expectedItemId:detail.id,expectedUnitPrice:detail.unitPrice}));state.marketIndex=null;renderMarketDetail();toast(result.message || '购买成功，已收入纳戒');}
    else if(action==='gather-select'){checked(await a.selectTarget(state.gatheringKind,Number(element.dataset.id)));}
    else if(action==='gather-start'){checked(await a.startGathering(state.gatheringKind,Number(element.dataset.id)));toast('已开始采集');}
    else if(action==='gather-stop'){checked(await a.stopGathering(state.gatheringKind));toast('采集已停止');}
    else if(action==='craft-select'){checked(await a.selectRecipe(state.craftingKind,Number(element.dataset.id)));}
    else if(action==='craft-start'){checked(await a.startCrafting(state.craftingKind,Number(element.dataset.id)));toast('已开始炼制');}
    else if(action==='craft-stop'){checked(await a.stopCrafting(state.craftingKind));toast('已停止炼制');}
    else if(action==='craft-original'){checked(await a.openCrafting(state.craftingKind));await openClassic();}
    else if(action==='filter-items'){state.collectionFilter=element.dataset.filter;}
    else if(action==='item-detail'){state.itemId=Number(element.dataset.id);state.artId=null;renderCollectionDetail();}
    else if(action==='art-detail'){state.artId=Number(element.dataset.id);state.itemId=null;renderCollectionDetail();}
    else if(action==='item-act'||action==='art-act'){
      if(element.dataset.operation==='original'){
        closeCollectionDetail();await openClassic(a._blocked?.()?undefined:action==='item-act'?'inventory':'arts');
      }else{
        guardCollectionAction();
        const id=Number(element.dataset.id),before=action==='item-act'?a.getItemDetail(id):null;
        const operation=element.dataset.operation;
        let pending;
        if(operation==='deploy-beast'){
          const pet=a.getBeastDetail(id),currentPet=a.getBeastTrainingSnapshot()?.equipped;
          const quote=JSON.parse(document.getElementById('collectionOverlay').dataset.beastQuote||'null');
          if(!pet)throw new Error('该灵兽已不在当前纳戒行。');
          if(!quote||quote.instanceKey!==pet.instanceKey)throw new Error('灵兽实例已经变化，请重新查看资质。');
          if(currentPet&&!(await confirmGame(`将${pet.displayName||pet.name}替换上阵？当前灵兽会回到纳戒，契合余量不随背包保存。`)))return;
          pending=a.deployBeast(id,{expectedItemId:quote.id,expectedBeast:quote});
        }else pending=operation==='learn-recipe'?a.learnRecipeBook(id):a[action==='item-act'?'performItemAction':'performArtAction'](id,operation);
        const result=checkedCollectionResult(await pending);
        window.MobileAudio?.effect(operation.includes('sell')?'sell':operation.includes('equip')||operation==='deploy-beast'?'equip':'heal',.55);
        if(operation==='deploy-beast'){closeCollectionDetail();state.route='beasts';}
        const current=action==='item-act'?a.getItemDetail(id):null;
        if(action==='item-act'&&state.itemId===id&&(!current||current.id!==before?.id))closeCollectionDetail();
        toast(result.message || '原游戏已确认完成。');renderCollectionDetail();
      }
    }
    else if(action==='detail-original'){closeCollectionDetail();await openClassic(a._blocked?.()?undefined:element.dataset.route);}
    else if(action==='original'){await openClassic(element.dataset.route);}
    else if(action==='original-dialog'){return act('full-game',element);}
    refresh(true);
  }
  const port = {
    attach(runtime, engineWindow) {
      engineWindow.MobileCultivationBalance?.bind(runtime);
      window.MobileCultivationBalance?.bind(runtime,engineWindow.MobileCultivationBalance);
      state.adapter=new window.GameAdapter(runtime,engineWindow);
      window.MobileAudio?.attach(state.adapter);
      if(window.MobileDialogue) state.dialogue=new window.MobileDialogue(runtime,engineWindow);
      state.loading=false;
      report({kind:'runtime-attached'});window.MobilePerf?.mark('runtimeAttached');
      for(const event of ['afterprojectstart','afterlayoutstart']) {try{runtime.addEventListener(event,()=>refresh(true));}catch{}}
      refresh(true);
    },
    report,
    handleBack() {
      if(document.querySelector('dialog.equipment-bag[open]')){document.querySelector('dialog.equipment-bag[open]').close();return true;}
      if(state.lifespanRebirth)return true;
      if(window.MobilePlayerProfile?.isNaming)return true;
      if(state.reviewSubmitting){toast('原游戏正在提交，请等待结果后再返回。');return true;}
      if(confirmResolver){finishConfirmation(false);return true;}
      if(state.combatSheet){state.combatSheet=null;refresh(true);return true;}
      if(state.fateReview){state.fateReview=null;document.getElementById('fateReviewOverlay').hidden=true;return true;}
      if(state.rebirthReview){state.rebirthReview=null;document.getElementById('rebirthReviewOverlay').hidden=true;return true;}
      if(state.marketIndex!==null){state.marketIndex=null;renderMarketDetail();return true;}
      if(state.itemId!==null||state.artId!==null){closeCollectionDetail();return true;}
      if(state.menu){state.menu=false;document.getElementById('menuOverlay').hidden=true;return true;}
      if(state.classic){closeClassic();return true;}
      if(state.snapshot?.isInGame&&['start-confirmation','waiting','trial','settlement','lifespan-confirmation'].includes(state.adapter?.getReincarnationSnapshot?.()?.phase)){state.route='reincarnation';refresh(true);return true;}
      if(state.slots){state.slots=false;refresh(true);return true;}
      if(state.route!=='cultivation'){state.route='cultivation';refresh(true);return true;}
      return false;
    },
    async handlePause() {window.MobileAudio?.suspend(true);if(window.MobileSingleSave?.restarting)return;if(state.paused)return;state.paused=true;if(state.manualPause)return;try{if(state.snapshot?.isInGame)checked(await state.adapter.save());}catch(error){report({kind:'pause-error',message:error.message});}finally{if(state.paused)rawRuntime()?.SetSuspended(true);}},
    handleResume() {window.MobileAudio?.suspend(false);if(window.MobileSingleSave?.restarting)return;if(!state.paused)return;state.paused=false;try{if(!state.manualPause)rawRuntime()?.SetSuspended(false);}catch{}refresh(true);},
  };
  window.MobilePort=port;
  document.addEventListener('equipment-change',()=>{refresh(true);window.MobileEquipmentBag?.refresh();});
  document.addEventListener('equipment-message',e=>toast(e.detail));
  document.addEventListener('equipment-drop',e=>toast(`获得装备 · ${e.detail.name}`));
  addEventListener('DOMContentLoaded',()=>{
    document.addEventListener('pointerdown',event=>{if(screen()?.contains(event.target))screenPointerHeld=true;},true);
    const releaseScreenPointer=()=>{if(screenPointerHeld){screenPointerHeld=false;screenInteractionUntil=Date.now()+180;}};
    document.addEventListener('pointerup',releaseScreenPointer,true);document.addEventListener('pointercancel',releaseScreenPointer,true);
    document.addEventListener('click',event=>{
      if(location.hostname==='127.0.0.1'||location.hostname==='localhost')document.body.dataset.lastClick=JSON.stringify({tag:event.target.tagName,id:event.target.id,action:event.target.closest('[data-action]')?.dataset.action,time:Date.now()});
      const zoom=event.target.closest('[data-zoom]');if(zoom){state.zoom=Math.max(.5,Math.min(2.5,state.zoom*(zoom.dataset.zoom==='in'?1.25:.8)));fitClassic();return;}
      const shift=event.target.closest('[data-shift]');if(shift){const v=document.getElementById('classicViewport');const d=shift.dataset.shift;v.scrollBy({left:(d==='left'?-1:d==='right'?1:0)*v.clientWidth*.55,top:(d==='up'?-1:d==='down'?1:0)*v.clientHeight*.5,behavior:'smooth'});return;}
      const crop=event.target.closest('[data-crop]');if(crop){state.crop=crop.dataset.crop;fitClassic();document.querySelectorAll('[data-crop]').forEach(e=>e.classList.toggle('is-active',e===crop));return;}
      const action=event.target.closest('[data-action]');if(action){Promise.resolve(act(action.dataset.action,action)).catch(error=>toast(error.message || '暂时无法执行此操作'));return;}
      const route=event.target.closest('.bottom-nav [data-route]');if(route&&!route.disabled){Promise.resolve(navigate(route.dataset.route)).catch(error=>toast(error.message));}
    });
    refresh(true);const poll=()=>{refresh();setTimeout(poll,state.snapshot?.isInGame?400:16);};setTimeout(poll,16);
    const updateDialogue=()=>{if(state.dialogue)renderDialogue();
      // Read only the active meter; a full game snapshot stays on the slower UI poll.
      const a=state.adapter;
      if(state.snapshot?.isInGame&&a?._flag('修炼开关')){
        const value=a._local(395257993791850);
        if(Number.isFinite(value))document.querySelectorAll('.practice-card .progress-fill:not([data-progress])').forEach(e=>window.MobileProgress.set(e,percent(value),{duration:80}));
      }
      if(state.snapshot?.isInGame){
        const raw=a?._flag('修炼开关')?a._local(395257993791850):state.snapshot.progress;
        if(Number.isFinite(raw))window.MobileCultivationProgress?.update(state.snapshot,raw);
      }
      requestAnimationFrame(updateDialogue);};requestAnimationFrame(updateDialogue);
  });
  addEventListener('resize',fitClassic);
  addEventListener('error',event=>report({kind:'error',message:event.message,detail:event.error?.stack}));
  addEventListener('unhandledrejection',event=>report({kind:'rejection',message:event.reason?.message??event.reason}));
})();

