/* Display confirmed layer completion before wrapping. Never changes game time or levels. */
(() => {
  'use strict';
  let cycle=null;
  const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
  function update(s,raw=s.progress,now=performance.now()) {
    const node=document.querySelector('[data-moon-progress]');
    if(!node){cycle=null;return;}
    if(s.studying&&s.practiceArt){const a=s.practiceArt;cycle=null;const value=clamp(a.requiredInsight>0?a.insight/a.requiredInsight*100:0);node.style.width=value+'%';const label=document.querySelector('[data-moon-progress-label]');if(label)label.textContent=Math.floor(value)+'%';node.closest('[role="progressbar"]')?.setAttribute('aria-valuenow',value.toFixed(1));return;}
    const method=s.methods?.find(m=>m.id===s.selectedMethod)||s.methods?.find(m=>m.unlocked)||s.methods?.[0];
    const key=`${s.currentSlot??''}:${method?.id??''}`;
    const target=clamp(raw),level=Number(method?.level)||0;
    if(!cycle||cycle.key!==key){cycle={key,raw:target,level,active:s.cultivating,value:target,time:now,phase:null};}
    const advanced=level>cycle.level;
    const wrapped=s.cultivating&&cycle.active&&target+0.5<cycle.raw;
    const completed=wrapped||(advanced&&!cycle.awaitingLevel);
    if(wrapped)cycle.awaitingLevel=true;
    if(advanced)cycle.awaitingLevel=false;
    if(completed&&!cycle.phase){cycle.phase={start:now,from:cycle.value};}
    if(cycle.phase){
      const elapsed=now-cycle.phase.start;
      if(elapsed<80)cycle.value=cycle.phase.from+(100-cycle.phase.from)*elapsed/80;
      else if(elapsed<180)cycle.value=100;
      else{cycle.phase=null;cycle.value=target;}
    }else{
      // Short linear catch-up: avoids the old 400ms easing lag on short layers.
      const fraction=Math.min(1,Math.max(0,(now-cycle.time)/55));
      cycle.value=target<cycle.value?target:cycle.value+(target-cycle.value)*fraction;
      if(Math.abs(target-cycle.value)<.1)cycle.value=target;
    }
    cycle.raw=target;cycle.level=level;cycle.active=s.cultivating;cycle.time=now;
    node.style.width=cycle.value+'%';
    const label=document.querySelector('[data-moon-progress-label]');
    if(label)label.textContent=(label.closest('.silk-progress-row')?'':'修炼进度 ')+(cycle.value===100?100:Math.floor(cycle.value))+'%';
    node.closest('[role="progressbar"]')?.setAttribute('aria-valuenow',cycle.value.toFixed(1));
  }
  window.MobileCultivationProgress={update};
})();
