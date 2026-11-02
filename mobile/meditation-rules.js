/* Each completed group of 50 layers keeps the gains earned at its own rate. */
(() => {
  function total(level, base, modifier=0) {
    if(!Number.isFinite(level)||!Number.isFinite(base)||!Number.isFinite(modifier))return 0;
    const size=globalThis.MobileCultivationTable?.blockSize||50,multiplier=globalThis.MobileCultivationTable?.blockMultiplier||2;
    const count=Math.max(0,Math.floor(level)),blocks=Math.floor(count/size),rest=count%size;
    const unit=Math.max(0,base*(1+modifier/100));
    let sum=0;
    for(let block=0;block<blocks;block++)sum+=size*Math.round(unit*multiplier**block);
    return sum+rest*Math.round(unit*multiplier**blocks);
  }
  const api={total};
  globalThis.MobileMeditation=api;
  if(typeof module!=='undefined')module.exports=api;
})();
