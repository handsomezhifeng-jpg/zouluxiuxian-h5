/* Local performance diagnostics; never reads or modifies save data. */
(() => {
  const stages={},dialogues=[];let pending=null;
  const publish=()=>{if(document.body)document.body.dataset.performanceState=JSON.stringify({stages,dialogues});};
  window.MobilePerf={mark(name){if(stages[name]===undefined){stages[name]=Math.round(performance.now());publish();}},dialogueClick(uid){pending={uid,start:performance.now()};},dialogueShown(uid){if(pending&&uid!==pending.uid){dialogues.push({milliseconds:Math.round(performance.now()-pending.start)});pending=null;publish();}},get stages(){return stages;}};
  document.addEventListener('DOMContentLoaded',()=>window.MobilePerf.mark('domReady'));
})();
