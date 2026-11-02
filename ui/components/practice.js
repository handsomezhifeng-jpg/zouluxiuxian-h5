(() => {
  const UI=window.SilkUI=window.SilkUI||{};
  UI.practice=(s,{esc,number,percent},breakthrough='')=>{
    const art=s.studying?s.practiceArt:null;
    const method=art||s.methods?.find(m=>m.id===s.selectedMethod)||s.methods?.find(m=>m.unlocked)||s.methods?.[0];
    const progress=percent(art?(art.requiredInsight>0?art.insight/art.requiredInsight*100:0):s.progress),cap=art?art.cap:window.MobileMoonUI.stageCap(method);
    const duration=art?(art.monthlyInsightRate>0&&art.remainingInsight!=null?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(art.remainingInsight/art.monthlyInsightRate):'—'):Number.isFinite(Number(method?.months))?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(Number(method.months)):'—';
    const action=art?`data-action="method-art-stop" data-id="${art.id}"`:method?`data-action="${s.cultivating?'stop':'train'}" data-id="${method.id}" ${!method.unlocked||(!s.cultivating&&method.level>=method.cap)?'disabled':''}`:'disabled';
    return `<section class="moon-controls silk-practice" data-ui-component="practice-controls" aria-label="修炼操作"><div class="silk-realm-row" data-ui-component="current-realm"><span>${esc(s.realm||'初入仙途')}</span>${breakthrough}</div><div class="moon-training-line"><img class="silk-method-scroll" src="${UI.assets}method-scroll-transparent.png" alt=""><span><strong>${esc(method?.name||'等待修行')}</strong> · 耗时${duration}月</span><small>第 ${number(method?.level)}/${number(cap)} 层</small></div>${UI.progress(progress)}<div class="moon-actions" data-ui-component="action-buttons">${UI.button({label:s.cultivating||art?'暂停修炼':'修炼',attributes:action})}${UI.button({label:'更换法门',attributes:'data-moon-open',secondary:true})}</div>${s.blocked?'<button class="moon-notice" data-action="original-dialog">有新的剧情提示，点击查看</button>':''}</section>`;
  };
})();
