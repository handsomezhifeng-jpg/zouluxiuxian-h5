(() => {
  const UI=window.SilkUI=window.SilkUI||{};
  const names={cultivation:'cultivation',realm:'realm',character:'character',adventure:'adventure',inventory:'inventory',arts:'arts'};
  UI.navigation=()=>{
    const nav=document.querySelector('.bottom-nav');if(!nav)return;
    nav.dataset.uiComponent='bottom-navigation';nav.dataset.caveNavigation='true';nav.style.setProperty('background','linear-gradient(#f8f1e4,#fdf9f1 50%,#f8f1e4)','important');
    nav.querySelectorAll('button').forEach(button=>{
      const name=names[button.dataset.route]||(button.dataset.action==='menu'?'settings':null);if(!name)return;
      button.querySelector('svg')?.remove();
      if(!button.querySelector('.silk-nav-icon'))button.insertAdjacentHTML('afterbegin',`<img class="silk-nav-icon" src="${UI.assets}nav-a-${name}.png" alt="" draggable="false">`);
    });
  };
})();


