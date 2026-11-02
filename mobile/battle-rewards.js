/* Receipts come from native settlement; the delay uses wall time, not game months. */
(()=>{
 let receipt=null,serial=0;
 const plain=text=>String(text??'').replace(/\[\/?[^\]]+\]/g,'');
 function settle(text,won=true){
  const copy=plain(text),rewards=[];
  const insight=copy.match(/参悟\+([^！!]+)/);if(insight)rewards.push('参悟 +'+insight[1]);
  const loot=copy.match(/获得(.+?)(?:！|!|$)/);if(loot)rewards.push(loot[1]);
  receipt={id:++serial,won,rewards,until:Date.now()+3000};
 }
 self.MobileBattleRewards={settle,reset(){receipt=null;},extra(text){if(receipt&&Date.now()<receipt.until)receipt.rewards.push(plain(text).replace(/^.*?获得/,'').replace(/[！!]$/,''));},ready:()=>!receipt||Date.now()>=receipt.until,
 snapshot(){return receipt?{...receipt,rewards:[...receipt.rewards],remaining:Math.max(0,receipt.until-Date.now()),cooling:Date.now()<receipt.until}:null;}};
})();
