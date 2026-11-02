(()=>{
 const count=target=>target%10===0||target>1&&(target-1)%10===0?9:3+2*Math.min(2,Math.floor(((target-1)%10)/3));
 const damage=(power,defense,index,total)=>Math.max(1,Math.round((power*(.8+total*.035)*(1+index*.045))-defense*.85));
 const api={count,damage};if(typeof self!=='undefined')self.MobileThunderRules=api;if(typeof module!=='undefined')module.exports=api;
})();
