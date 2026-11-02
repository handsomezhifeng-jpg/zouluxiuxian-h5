/* Display terminology only. Original engine identifiers and persisted saves stay untouched. */
(()=>{
 const display=value=>String(value??'').replace(/真气/g,'气血');
 function combatPower(stats){const values=[stats?.maxQi,stats?.attack,stats?.defense];return values.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)?Math.round(values[0]/10+values[1]*2*(Number.isFinite(stats?.speed)?stats.speed/100:1)+values[2]):null;}
 function translate(root){
  if(root.nodeType===3){if(root.nodeValue.includes('真气'))root.nodeValue=display(root.nodeValue);return;}
  if(root.nodeType!==1||/^(SCRIPT|STYLE|TEXTAREA|IFRAME)$/.test(root.tagName))return;
  for(const key of ['title','aria-label','placeholder','alt']){const v=root.getAttribute(key);if(v?.includes('真气'))root.setAttribute(key,display(v));}
  for(const child of root.childNodes)translate(child);
 }
 const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='characterData'||r.type==='attributes')translate(r.target);else for(const node of r.addedNodes)translate(node);}});
 function start(){translate(document.body);observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','alt']});}
 window.MobilePresentation={display,combatPower};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
