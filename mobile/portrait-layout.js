/* 750 x 1334 design canvas. This module only arranges existing portrait DOM. */
(() => {
  'use strict';
  const memory = new Map();
  const positions = new Map();
  const heading = node => node.querySelector('h2,h3,summary')?.textContent.trim() || '';
  const create = (tag, className) => { const node=document.createElement(tag);node.className=className;return node; };
  function remember(root) {
    if (!root?.dataset.layoutRoute) return;
    root.querySelectorAll('.page-panel,.panel-scroll').forEach((node,index)=>positions.set(`${root.dataset.layoutRoute}:${node.dataset.panelId || index}`,node.scrollTop));
    const quest=root.querySelector('.quest-brief');
    if(quest) memory.set(root.dataset.layoutRoute+':quest',quest.open);
  }
  function select(root,id,focus=false) {
    const panel=root.querySelector(`[data-panel-id="${id}"]`);
    if(!panel)return;
    memory.set(root.dataset.layoutRoute,id);
    root.querySelectorAll('.page-panel').forEach(node=>node.hidden=node!==panel);
    root.querySelectorAll('[data-page-panel]').forEach(button=>{
      const active=button.dataset.pagePanel===id;
      button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
      if(active&&focus)button.focus();
    });
  }
  function groupsFor(route,nodes) {
    const groups=[];
    const add=(id,label,test)=>{
      const items=nodes.filter(test);nodes=nodes.filter(node=>!items.includes(node));
      if(items.length)groups.push({id,label,items});
    };
    const titled=(...names)=>node=>names.includes(heading(node));
    if(route==='cultivation'){
      add('practice','修炼',()=>true);
    }else if(route==='character'){
      add('attributes','属性',titled('人物属性'));
      add('aptitudes','天资',titled('天资与丹毒'));
      add('equipment','法宝',titled('已装备法宝','法宝与灵兽加成'));
      add('pet','灵兽',()=>true);
    }else if(route==='adventure'){
      add('battle','历练',()=>true);
    }else if(route==='realm'){
      add('breakthrough','突破',node=>node.classList.contains('practice-card'));
      add('materials','宝材',titled('渡劫宝材'));
      add('rules','渡劫说明',()=>true);
    }else if(route==='capture'){
      add('capture','捕兽',node=>!['自动搜兽','捕兽见闻'].includes(heading(node))&&!node.querySelector('[data-action="capture-original"]'));
      add('settings','搜兽策略',titled('自动搜兽'));
      add('log','说明与见闻',()=>true);
    }else if(route==='beasts'){
      add('training','驭兽',titled('喂核驭兽'));
      add('pet','灵兽',titled('上阵灵兽','尚无上阵灵兽'));
      add('settings','材料倍率',titled('驭兽材料倍率'));
      add('log','见闻',()=>true);
    }else if(route==='challenge'){
      add('battle','挑战',titled('修士挑战'));
      add('targets','修士',titled('挑战目标'));
      add('settings','自动挑战',titled('自动接续挑战'));
      add('log','见闻',()=>true);
    }else if(route==='cave'){
      add('building','营造',titled('洞府营造'));
      add('buildings','建筑',titled('洞府建筑'));
      add('queue','待建',titled('洞府待建队列'));
      add('log','记事',()=>true);
    }else if(route==='spirits'){
      add('array','灵阵',titled('洞府灵阵'));
      add('totals','加成',titled('灵阵属性合计'));
      add('items','灵物',titled('纳戒灵物'));
      add('log','记事',()=>true);
    }else if(route==='gathering'||route==='crafting'){
      add('current',route==='gathering'?'采集':'炼制',(_,index)=>index===0);
      add('targets',route==='gathering'?'材料':'配方',()=>true);
    }else if(route==='expedition'){
      add('explore','探索',(_,index)=>index===0);
      add('regions','山河',titled('秘境山河'));
      add('settings','探索设置',()=>true);
    }else if(route==='fate-stones'){
      add('slots','命位',titled('十方命位'));
      add('inventory','入命',titled('纳戒中的命石'));
      add('totals','加成',titled('入命所得'));
      add('rules','规则',()=>true);
    }else if(route==='reincarnation'){
      add('rebirth','转世',node=>heading(node)!=='转世天资');
      add('aptitude','天资',()=>true);
    }else if(route==='reincarnation-preview'){
      add('overview','收益',node=>node.classList.contains('preview-summary')||heading(node)==='转世收益');
      add('trial','试炼',titled('试炼条件参考'));
      add('resets','重置',node=>node.dataset.previewGroup==='rebirth-resets');
      add('retained','保留',node=>node.dataset.previewGroup==='rebirth-retained');
      add('notes','须知',()=>true);
    }else add('overview','总览',()=>true);
    return groups;
  }
  function mount(root,route) {
    root.dataset.layoutRoute=route;
    root.classList.add('game-screen');
    if(route==='estate')return;
    if(route==='inventory'&&root.querySelector('.silk-inventory'))return;
    if(route==='character'&&root.querySelector('.silk-character'))return;
    if(route==='realm'&&root.querySelector('.thunder-realm'))return;
    if(route==='cultivation'&&root.querySelector('.moon-cultivation')){
      const header=root.querySelector('.moon-profile');
      const quest=root.querySelector('.silk-quest .quest-card')||header?.querySelector('.quest-card');
      if(quest){
        const brief=create('details','quest-brief');brief.dataset.stateKey='moon-quest';
        const summary=document.createElement('summary');
        const label=create('span','moon-quest-label');label.textContent='主线 · '+(quest.querySelector('h3')?.textContent||'当前目标');
        const mark=create('span','moon-quest-icon');mark.innerHTML=window.MobileMoonUI?.icon('scroll')||'';summary.append(mark,label);
        const count=create('span','quest-inline-count');
        const current=quest.dataset.questCurrent,required=quest.dataset.questRequired;
        if(current!==''&&Number(required)>0)count.textContent=current+' / '+required;
        const arrow=create('span','moon-quest-arrow');arrow.textContent='›';summary.append(count,arrow);brief.append(summary);
        const copy=create('div','quest-brief-copy');while(quest.firstChild)copy.append(quest.firstChild);
        brief.append(copy);quest.append(brief);
      }
      return;
    }
    if(route==='adventure'&&root.querySelector('.quiet-combat,.tactical-battle,.survivor-arena'))return;
    const children=[...root.children];
    const hero=children.find(node=>node.classList.contains('hero')||node.classList.contains('moon-profile')||node.classList.contains('silk-profile'));
    const quest=children.find(node=>node.classList.contains('quest-card'));
    if(hero&&!hero.classList.contains('moon-profile')&&!hero.classList.contains('silk-profile'))hero.classList.add('status-hero');
    if(quest){
      const brief=create('details','quest-brief');
      const summary=document.createElement('summary');
      summary.textContent='主线 · '+(quest.querySelector('h3')?.textContent || '当前目标');
      const current=Number(quest.dataset.questCurrent),required=Number(quest.dataset.questRequired);
      if(quest.dataset.questCurrent!==''&&required>0&&Number.isFinite(current)){
        const meter=create('span','quest-inline-meter');meter.setAttribute('aria-hidden','true');
        const fill=document.createElement('span');fill.style.width=Math.max(0,Math.min(100,current/required*100))+'%';meter.append(fill);
        const count=create('span','quest-inline-count');count.textContent=current+' / '+required;
        summary.append(meter,count);
      }
      brief.append(summary);
      const copy=create('div','quest-brief-copy');
      while(quest.firstChild)copy.append(quest.firstChild);
      brief.append(copy);quest.append(brief);
      brief.open=Boolean(memory.get(route+':quest'));
    }
    const nodes=children.filter(node=>node!==hero&&node!==quest);
    if(route==='realm'){
      const shortcuts=nodes.find(node=>node.classList.contains('practice-card'))?.querySelector('.action-row');
      if(shortcuts){
        const card=create('section','paper-card');
        const title=document.createElement('h2');title.textContent='仙途指引';
        card.append(title,shortcuts);nodes.push(card);
      }
    }
    if(route==='reincarnation-preview'){
      // The enclosing page tab already expands this list; avoid a second scroll
      // container inside a <details> content box with intrinsic list height.
      nodes.forEach(card=>{
        const detail=card.querySelector('details[data-state-key]');
        const list=detail?.querySelector('.inheritance-list');
        if(!list)return;
        card.dataset.previewGroup=detail.dataset.stateKey;
        const title=create('h2','preview-heading');title.textContent=detail.querySelector('summary').textContent;
        detail.replaceWith(title,list);
      });
    }
    const kindTabs=nodes.find(node=>node.classList.contains('system-tabs'));
    const groups=groupsFor(route,nodes.filter(node=>node!==kindTabs));
    const tabs=create('div','page-tabs');
    tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','本页功能');
    const deck=create('div','page-deck');
    if(kindTabs)root.append(kindTabs);
    groups.forEach(group=>{
      const button=create('button','page-tab');
      button.type='button';button.textContent=group.label;button.dataset.pagePanel=group.id;
      button.id=`page-tab-${group.id}`;button.setAttribute('role','tab');
      button.setAttribute('aria-controls',`page-panel-${group.id}`);
      const panel=create('div','page-panel');
      panel.id=`page-panel-${group.id}`;panel.dataset.panelId=group.id;
      panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
      panel.append(...group.items);tabs.append(button);deck.append(panel);
    });
    if(groups.length>1)root.append(tabs);
    root.append(deck);
    root.querySelectorAll('.collection-list,.market-list,.enemy-list,.method-list,.journey-list,.battle-log,.aptitude-list,.inheritance-list,.construction-queue').forEach(list=>{
      list.classList.add('panel-scroll');
      const card=list.closest('.paper-card');if(card&&list.parentElement===card)card.classList.add('list-card');
    });
    root.querySelectorAll('.page-panel,.panel-scroll').forEach((node,index)=>node.scrollTop=positions.get(`${route}:${node.dataset.panelId || index}`)||0);
    const chosen=memory.get(route);
    select(root,groups.some(group=>group.id===chosen)?chosen:groups[0]?.id);
    // A single panel has no tab strip, but still needs an accessible name.
    if(groups.length===1){deck.firstChild?.removeAttribute('aria-labelledby');deck.firstChild?.setAttribute('aria-label',groups[0].label);}
  }
  document.addEventListener('click',event=>{
    const root=document.getElementById('screen');
    const tab=event.target.closest('[data-page-panel]');
    if(tab){select(root,tab.dataset.pagePanel);return;}
    // Selecting an item returns to the panel that contains its main action.
    const action=event.target.closest('[data-action]')?.dataset.action;
    const destination={'adventure-enemy':'battle','challenge-select':'battle','cave-select':'building','gather-select':'current','craft-select':'current','expedition-select':'explore'}[action];
    if(destination)memory.set(root.dataset.layoutRoute,destination);
  });
  document.addEventListener('keydown',event=>{
    const tab=event.target.closest('[data-page-panel]');
    if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const tabs=[...tab.parentElement.children];let index=tabs.indexOf(tab);
    index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;
    event.preventDefault();select(document.getElementById('screen'),tabs[index].dataset.pagePanel,true);
  });
  window.MobileLayout={mount,remember};
})();
