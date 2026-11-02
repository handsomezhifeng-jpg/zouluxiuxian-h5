(() => {
  let filter='all';
  const num=v=>v==null||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(Number(v));
  const amount=v=>window.MobileCultivationBalance.format(v);
  const signed=(v,unit='')=>v==null?'—':`${Number(v)>=0?'+':''}${amount(v)}${unit}`;
  const artFields=[['qiPercent','气血','%'],['attackPercent','攻击','%'],['defensePercent','防御','%'],['lifespan','寿元','年'],['cultivationSpeedPercent','修炼速度','%'],['detoxRaw','祛毒','']];
  function render(s,{esc}){
    const artActive=s.studying&&s.practiceArt;
    const current=artActive?s.practiceArt:(s.methods?.find(m=>m.id===s.selectedMethod)||s.methods?.find(m=>m.unlocked));
    const methods=(s.methods||[]).map(m=>({...m,kind:'meditation',current:!artActive&&m.id===current?.id,active:m.active||s.cultivating&&m.id===s.selectedMethod}));
    const arts=(s.methodArts||s.arts||[]).filter(a=>a.level>0).map(a=>({...a,kind:'art',current:!!artActive&&a.id===current?.id,active:s.studying&&a.id===s.studyingArt,unlocked:true,cap:a.cap||100}));
    const items=[...methods,...arts];
    function row(m){
      const art=m.kind==='art',known=m.unlocked,full=m.level>=m.cap;
      const gains=m.balanceGains||(art?artFields.map(([key,label,unit])=>{let value=m.effectsPerLevel?.[key];if(key==='detoxRaw'&&value!=null)value/=100;return {label,total:value==null?null:value*m.level,next:value,unit};}):[['气血','Qi'],['攻击','Attack'],['防御','Defense']].map(([label,key])=>({label,total:m[key.toLowerCase()+'Gain'],next:m['next'+key+'Gain'],unit:''})));
      const months=art?(m.monthlyInsightRate>0&&m.remainingInsight!=null?m.remainingInsight/m.monthlyInsightRate:null):m.months;
      const disabled=!known||full||m.active||art&&m.reason;
      const time=art?`${num(months)}月到下层`:`${num(months)}月/层`;
      const visibleGains=gains.filter(g=>!['速度','寿元','修炼速度','祛毒'].includes(g.label)||g.total||g.next);
      const status=m.active?'<span class="method-current-mark">当前</span>':`<button type="button" class="method-switch" data-action="${art?'method-art-study':'train'}" data-id="${m.id}" ${disabled?'disabled':''}>${full?'圆满':!known?'未解锁':'切换'}</button>`;
      return `<article class="method-entry ${m.current?'is-current':''} ${known?'':'is-locked'}" data-method-kind="${m.kind}" aria-label="${esc(m.name)}" ${filter!=='all'&&filter!==m.kind?'hidden':''}><span class="method-entry-icon"><img src="${window.SilkUI.assets}nav-a-${art?'arts':'cultivation'}.png" alt=""></span><div class="method-entry-head"><div class="method-entry-name"><strong>${esc(m.name)}</strong><small>${art?'功法':'打坐'}</small></div>${status}<p class="method-entry-meta">${known?`第 ${num(m.level)}/${num(m.cap)} 层 <span>${time}</span>`:esc(m.unlockText||m.lockReason||'尚未解锁')}</p></div>${known?`<div class="method-inline-gains" aria-label="总加成与下一层加成">${visibleGains.map(g=>`<div class="method-gain-line"><span class="method-gain-label">${g.label}</span><span class="method-gain-total" aria-label="总加成">${signed(g.total,g.unit)}</span><span class="method-gain-next" aria-label="下一层加成">${full?'—':signed(g.next,g.unit)}</span></div>`).join('')}</div>`:''}${m.reason&&!m.active?`<p class="method-unavailable">${esc(m.reason)}</p>`:''}</article>`;

    }
    return `<details class="moon-methods method-picker" data-state-key="moon-methods"><summary class="moon-sheet-trigger">更换法门</summary><section class="moon-sheet method-picker-page" role="dialog" aria-modal="true" aria-label="修炼法门选择"><header class="method-picker-top"><button type="button" data-moon-close class="method-return" aria-label="返回修炼">返回</button><p class="method-current">当前修炼：<strong>${esc(current?.name||'暂无')}</strong></p><span class="method-header-line" aria-hidden="true"></span></header><div class="method-toolbar"><nav class="method-filters" aria-label="法门分类">${[['all','全部'],['meditation','打坐'],['art','功法']].map(([id,name])=>`<button type="button" data-method-filter="${id}" aria-pressed="${filter===id}"><span class="method-filter-label">${name}</span></button>`).join('')}</nav><div class="method-gain-legend"><span>黑色：总加成</span><span>金色：下一层加成</span></div></div><div class="method-picker-list">${items.map(row).join('')}<p class="method-empty" ${filter==='art'&&!arts.length?'':'hidden'}>尚未学会功法，可先从纳戒中的功法书领悟。</p></div></section></details>`;

  }
  document.addEventListener('click',e=>{const button=e.target.closest('[data-method-filter]');if(!button)return;filter=button.dataset.methodFilter;const root=button.closest('.method-picker');root.querySelectorAll('[data-method-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.methodFilter===filter)));root.querySelectorAll('[data-method-kind]').forEach(row=>row.hidden=filter!=='all'&&row.dataset.methodKind!==filter);root.querySelector('.method-empty').hidden=filter!=='art'||!!root.querySelector('[data-method-kind="art"]');});
  window.MobileMethodPicker={render};
})();
