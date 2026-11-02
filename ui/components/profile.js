(() => {
  const UI=window.SilkUI=window.SilkUI||{};
  UI.profile=(s,{esc,number})=>{
    const v=s.stats||{},power=window.MobilePresentation.combatPower(v);
    const age=Number(v.age),life=Number(v.lifespan),ratio=life>0?Math.max(0,Math.min(100,age/life*100)):0;
    return `<header class="silk-profile" data-ui-component="player-profile"><div class="moon-identity"><button class="moon-avatar silk-avatar" data-action="navigate" data-route="character" aria-label="查看人物属性"></button><div class="moon-player"><span title="${esc(s.playerName||'道友')}">${esc(s.playerName||'道友')}</span><div class="moon-strength"><b data-combat-power>${number(power)}</b></div></div><div class="moon-life"><span class="silk-age-values"><b data-value="age">${number(v.age)}</b>/<b data-value="lifespan">${number(v.lifespan)}</b>年</span><div class="silk-life-track" role="progressbar" aria-label="已用寿元" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${ratio}"><i style="width:${ratio}%"></i></div><button data-action="navigate" data-route="realm">${esc(s.realm||'初入仙途')}</button></div></div></header>`;
  };
})();
