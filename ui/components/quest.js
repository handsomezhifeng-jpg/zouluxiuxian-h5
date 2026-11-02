(() => {
  const UI=window.SilkUI=window.SilkUI||{};
  UI.quest=(s,{questCard})=>`<div class="moon-quest silk-quest" data-ui-component="quest-banner"><img class="silk-quest-scroll" src="${UI.assets}quest-scroll.png" alt="">${questCard(s)||'<p>静心修行 · 等待新的机缘</p>'}</div>`;
})();
