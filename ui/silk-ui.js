/* Composition of approved screenshot-derived components. No game rules live here. */
(() => {
  const UI=window.SilkUI;
  UI.assets=new URL('assets/',document.currentScript.src).href;
  const legacy=window.MobileMoonUI.render;
  UI.render=(snapshot,context)=>{
    // Retain the tested method picker and breakthrough contracts as live controls.
    const template=document.createElement('template');template.innerHTML=legacy(snapshot,context);
    const methods=window.MobileMethodPicker.render(snapshot,context);
    const breakthrough=snapshot.tribulation?.entryAvailable===true?(template.content.querySelector('.moon-breakthrough')?.outerHTML||''):'';
    return `<section class="moon-cultivation silk-cultivation" aria-label="修炼洞府" data-ui-component="cultivation-page">${UI.profile(snapshot,context)}${UI.quest(snapshot,context)}${UI.scene()}${UI.practice(snapshot,context,breakthrough)}${methods}</section>`;
  };
  window.MobileMoonUI.render=UI.render;
  window.MobileMoonUI.profile=UI.profile;
  addEventListener('DOMContentLoaded',()=>{document.body.dataset.uiTheme='silk';UI.navigation();});
})();
