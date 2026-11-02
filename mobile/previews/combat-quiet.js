/* Isolated visual prototypes. No original runtime, save or storage access. */
(()=>{
 const $=id=>document.getElementById(id),raw=new URLSearchParams(location.search).get('v'),version=['a','b','c'].includes(raw)?raw:'a';document.querySelector('.phone').dataset.version=version;
 if(version==='b')$('ownSlot').append(document.querySelector('.own-health'));
 let active=false,hp=1000,timer,toastTimer,wins=0;
 const logs=['山风渐息，与乌鬃野猪相遇。','执剑凝神，静待交锋。'];
 function display(){ $('enemyHp').textContent=hp.toLocaleString()+' / 1,000';$('enemyFill').style.width=hp/10+'%';$('status').textContent=active?'历练中':'待战';$('fight').textContent=active?'停止历练':'开始历练';$('recent').replaceChildren(...logs.slice(0,2).map(s=>{const p=document.createElement('p');p.textContent=s;return p;})); }
 function attack(){
  if(!active)return;const damage=Math.min(hp,128);hp-=damage;display();
  const n=document.createElement('span');n.className='damage';n.textContent='−'+damage;$('effects').append(n);const a=n.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,offset:.2},{opacity:0,transform:'translateY(-28px)'}],{duration:750});a.onfinish=()=>n.remove();
  if(!hp){wins++;logs.unshift('战胜乌鬃野猪 · 已完成 '+wins+' 场历练');display();timer=setTimeout(()=>{hp=1000;display();if(active)timer=setTimeout(attack,1000);},1000);}else timer=setTimeout(attack,1250);
 }
 $('fight').onclick=()=>{active=!active;clearTimeout(timer);if(!hp)hp=1000;display();if(active)timer=setTimeout(attack,450);};
 document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>{$('toast').textContent='当前为战斗界面设计预览';$('toast').classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('on'),1600);});
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden&&active)timer=setTimeout(attack,1250);});display();
})();
