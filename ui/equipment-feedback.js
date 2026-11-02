/* Confirmed equipment deltas: attributes first, then the shared character power. */
(()=>{'use strict';
let active=null,timer=0,pending=null;
const format=v=>Math.abs(Math.round(v)).toLocaleString('zh-CN');
const signed=v=>(v<0?'−':'+')+format(v);
function clear(){clearTimeout(timer);active?.remove();active=null;pending=null;}
function show(before,after){
 const R=MobileEquipmentRolls,power=MobilePresentation.combatPower;
 const rows=R.attributes.map(a=>({label:a.name,value:Math.round((after[a.key]||0)-(before[a.key]||0))})).filter(a=>a.value);
 const delta=power(after)-power(before);if(!rows.length&&!delta)return;
 const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document.querySelector('.app-shell');if(!root)return;
 if(active){if(pending)pending.after=after;else pending={before,after};return;}
 const overlay=document.createElement('div');overlay.className='equipment-change-overlay';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
 const scale=root.getBoundingClientRect().width/948;overlay.style.setProperty('--feedback-unit',scale+'px');
 const attribute=document.createElement('div');attribute.className='equipment-change-phase equipment-change-attributes';
 if(rows.length>6)attribute.classList.add('is-many');
 const list=document.createElement('div');list.className='equipment-change-lines';
 rows.forEach(row=>{const line=document.createElement('div');line.className=row.value<0?'is-loss':'is-gain';line.textContent=row.label+' '+signed(row.value)+' '+(row.value<0?'↓':'↑');list.append(line);});
 attribute.append(list);
 const powerPhase=document.createElement('div');powerPhase.className='equipment-change-phase equipment-change-power'+(delta<0?' is-loss':'');const powerText=document.createElement('span');powerText.textContent='战力 '+signed(delta);powerPhase.append(powerText);
 const delay=rows.length?1600:0;powerPhase.style.animationDelay=delay+'ms';
 if(rows.length)overlay.append(attribute);if(delta)overlay.append(powerPhase);
 overlay.dataset.phase='attributes';active=overlay;root.append(overlay);
 overlay.addEventListener('animationstart',e=>{if(e.target===powerPhase)overlay.dataset.phase='power';});
 const close=()=>{if(active===overlay){clear();}};root.addEventListener('close',close,{once:true});
 timer=setTimeout(()=>{root.removeEventListener('close',close);overlay.remove();active=null;const next=pending;pending=null;if(next)show(next.before,next.after);},delta?delay+1550:1550);
}
document.addEventListener('equipment-replaced',e=>{if(e.detail.before&&e.detail.after)show(e.detail.before,e.detail.after);});
window.MobileEquipmentFeedback={show,clear};
})();
