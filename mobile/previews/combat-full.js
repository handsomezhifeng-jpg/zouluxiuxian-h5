/* Isolated design prototype: sample battle data; no runtime or storage access. */
(()=>{
 const $=id=>document.getElementById(id),version=new URLSearchParams(location.search).get('v')==='b'?'b':'a';
 document.querySelector('.phone').dataset.version=version;
 let active=false,hp=1000,wins=2,timer,toastTimer;
 const logs=['月照青山，行至驿道，发现乌鬃野猪。','执剑凝神，静待交锋。'];
 const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
 function journal(){ $('recent').innerHTML=logs.slice(0,2).map(s=>'<p>'+esc(s)+'</p>').join(''); }
 function notice(s){$('toast').textContent=s;$('toast').classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('on'),1800);}
 function sheet(title,html){$('sheetTitle').textContent=title;$('sheetContent').innerHTML=html;$('overlay').hidden=false;$('close').focus();}
 function update(){ $('fight').textContent=active?'停止历练':'开始历练';$('status').textContent=active?'交战中':'蓄势待发';$('actionHint').textContent=active?'剑出随心 · 持续历练':'战胜后将继续历练';$('enemyHp').textContent=hp.toLocaleString()+'/1,000';$('enemyFill').style.width=(hp/10)+'%';$('wins').textContent='已胜 '+wins+' 场'; }
 function strike(){
  if(!active)return;
  const damage=Math.min(hp,128);hp-=damage;update();
  const light=document.createElement('i');light.className='sword-light';$('effects').append(light);
  const slash=light.animate([{opacity:0,transform:'rotate(-35deg) scale(.5)'},{opacity:1,offset:.3},{opacity:0,transform:'rotate(10deg) scale(1.3)'}],{duration:420});slash.onfinish=()=>light.remove();
  const hit=document.createElement('b');hit.className='hit-number';hit.textContent='−'+damage;$('effects').append(hit);
  const fall=hit.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,offset:.2},{opacity:0,transform:'translateY(-40px)'}],{duration:800});fall.onfinish=()=>hit.remove();
  document.querySelector('.battle-art').animate([{filter:'brightness(1)'},{filter:'brightness(1.15)',offset:.4},{filter:'brightness(1)'}],{duration:240});
  if(!hp){wins++;logs.unshift('战胜乌鬃野猪，历练胜场 '+wins+'。');journal();update();timer=setTimeout(()=>{hp=1000;update();if(active)timer=setTimeout(strike,950);},900);}
  else timer=setTimeout(strike,1100);
 }
 $('fight').onclick=()=>{active=!active;clearTimeout(timer);update();if(active){if(!hp)hp=1000;timer=setTimeout(strike,350);}};
 $('leave').onclick=()=>{active=false;clearTimeout(timer);update();notice('已收剑，停止本次历练');};
 $('allLogs').onclick=()=>sheet('历练见闻',logs.map(s=>'<p>'+esc(s)+'</p>').join(''));
 $('close').onclick=()=>{$('overlay').hidden=true;};$('overlay').onclick=e=>{if(e.target===$('overlay'))$('overlay').hidden=true;};
 document.addEventListener('keydown',e=>{if(e.key==='Escape')$('overlay').hidden=true;});
 document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>notice('当前为历练界面预览'));
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);}else if(active){timer=setTimeout(strike,1100);}});
 update();
})();