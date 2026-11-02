(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const n=v=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0}).format(v??0);
 function render(s,ui){
  const r=s.tribulation;if(!r)return '<section class="paper-card">正在读取境界…</section>';
  const t=r.thunder||{},active=r.active;
  return `<section class="moon-cultivation thunder-realm ${active&&!t.result&&t.last?'is-struck':''}" aria-label="境界渡劫">${window.MobileMoonUI.profile(s,{esc,number:n})}<button class="thunder-back" data-action="navigate" data-route="cultivation" aria-label="返回修炼">返回</button><div class="moon-scene"></div><div class="thunder-weather"></div><svg class="thunder-bolt" viewBox="0 0 750 1100" preserveAspectRatio="none" aria-hidden="true"><path d="M435 -40 370 120 414 112 338 270 389 248 344 424 390 401 365 595"/><path class="thunder-branch" d="M383 169 489 242 448 250 515 351M353 330 264 410 301 416 232 493"/></svg><div class="thunder-flash" aria-hidden="true"></div>${active&&!t.result&&t.last?`<span class="thunder-hit" aria-hidden="true">−${n(t.last.damage)}</span>`:''}<section class="moon-controls thunder-controls"><div class="thunder-current-realm" aria-label="当前境界">${esc(r.currentName||s.realm||'初入仙途')}</div><div class="thunder-health"><span>气血</span><strong><span data-realm-value="qi">${n(r.qi)}</span> / <span data-realm-value="maxQi">${n(r.maxQi)}</span></strong></div><div class="thunder-hp-track" role="progressbar" aria-label="渡劫气血" aria-valuemin="0" aria-valuemax="${r.maxQi}" aria-valuenow="${r.qi}"><i data-thunder-hp style="width:${r.maxQi>0?r.qi/r.maxQi*100:0}%"></i></div><div class="moon-actions"${active?' style="visibility:hidden" inert aria-hidden="true"':''}><button class="moon-primary" data-action="realm-start" data-realm-fingerprint="${esc(r.realmFingerprint)}" ${active||!r.canAct||ui.manualPause?'disabled':''}>突破</button></div></section></section>`;
 }
 window.MobileThunderView={render};
})();
