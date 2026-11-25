// Feasibility allocator, not an estimated model of household/firm optimization.
// The former single multiplier reduced exports together with imports: once a
// foreign credit line closed, it could eliminate all production even when
// feasible export receipts could pay for essential imported inputs.
// Separate domestic and export fulfillment permits trade-financed production.
// Domestic orders remain a fixed basket (an explicit coarse assumption).
// Revision 7 separates export orders by sector: an agricultural shortfall is
// transmitted through the input matrix and currency budget, not an export bundle.
// The objective is delivered orders at current domestic prices; no party,
// ownership label or country-income category enters the allocation.
export function allocateMarket({matrix,inventory,capacity,domestic,exports,prices,external,sectorExports=false}){
 const n=capacity.length,exportCount=sectorExports?n:1,variables=n+1+exportCount,rows=[],rhs=[];
 const add=(a,b)=>{const scale=Math.max(...a.map(Math.abs),Math.abs(b),1e-12);rows.push(a.map(x=>x/scale));rhs.push(Math.max(0,b)/scale);};
 for(let i=0;i<n;i++)add([...capacity.map((q,j)=>(matrix[i][j]-(i===j?1:0))*q),domestic[i],...Array.from({length:exportCount},(_,j)=>!sectorExports||i===j?exports[i]:0)],inventory[i]);
 for(let i=0;i<n;i++)add(Array.from({length:variables},(_,j)=>j===i?1:0),1);
 add(Array.from({length:variables},(_,j)=>j===n?1:0),1);
 for(let i=0;i<exportCount;i++)add(Array.from({length:variables},(_,j)=>j===n+1+i?1:0),1);
 const domesticValue=domestic.reduce((a,v,i)=>a+v*prices[i],0),exportValue=exports.reduce((a,v,i)=>a+v*prices[i],0);
 const exportValues=sectorExports?exports.map((v,i)=>v*prices[i]):[exportValue];
 const exportUSD=exportValues.map(v=>external?external.exportsUSD*(exportValue>0?v/exportValue:0):0);
 if(external)add([...capacity.map((q,i)=>q*external.intermediateUnitUSD[i]),external.finalImportsUSD,...(sectorExports?exportUSD.map(v=>-v):[-external.exportsUSD])],external.availableUSD);
 const objectiveScale=Math.max(domesticValue,exportValue,1e-12),objective=[...capacity.map(()=>0),domesticValue/objectiveScale,...exportValues.map(v=>v/objectiveScale)];
 const m=rows.length,width=variables+m+1;
 const table=rows.map((a,i)=>[...a,...Array.from({length:m},(_,j)=>i===j?1:0),rhs[i]]);
 table.push([...objective.map(x=>-x),...Array(m+1).fill(0)]);
 const basis=Array.from({length:m},(_,i)=>variables+i),eps=1e-11;
 let optimal=false;
 for(let step=0;step<500;step++){
  // Bland's rule makes degeneracy deterministic and avoids cycling.
  const enter=table[m].findIndex((v,j)=>j<width-1&&v< -eps);
  if(enter<0){optimal=true;break;}
  let leave=-1,ratio=Infinity;
  for(let i=0;i<m;i++)if(table[i][enter]>eps){const r=table[i][width-1]/table[i][enter];if(r<ratio-eps||Math.abs(r-ratio)<=eps&&(leave<0||basis[i]<basis[leave])){ratio=r;leave=i;}}
  if(leave<0)throw new Error('Невозможно ограничить распределение заказов');
  const divisor=table[leave][enter];for(let j=0;j<width;j++)table[leave][j]/=divisor;
  for(let i=0;i<=m;i++)if(i!==leave){const factor=table[i][enter];if(factor===0)continue;for(let j=0;j<width;j++)table[i][j]-=factor*table[leave][j];}
  basis[leave]=enter;
 }
 if(!optimal)throw new Error('Распределение заказов не сошлось');
 const solution=Array(variables).fill(0);for(let i=0;i<m;i++)if(basis[i]<variables)solution[basis[i]]=table[i][width-1];
 const alpha=Math.max(0,Math.min(1,solution[n]));
 const sectorFulfillment=exports.map((_,i)=>Math.max(0,Math.min(1,solution[n+1+(sectorExports?i:0)])));
 const exportAlpha=sectorExports?(exportValue>0?exports.reduce((v,q,i)=>v+q*prices[i]*sectorFulfillment[i],0)/exportValue:1):Math.max(0,Math.min(1,solution[n+1]));
 const production=capacity.map((q,i)=>q*Math.max(0,Math.min(1,solution[i])));
 const intermediate=matrix.map(row=>row.reduce((a,v,j)=>a+v*production[j],0));
 const delivered=domestic.map((v,i)=>v*alpha+exports[i]*sectorFulfillment[i]);
 const ending=production.map((v,i)=>inventory[i]+v-intermediate[i]-delivered[i]);
 const externalNeed=external?production.reduce((a,v,i)=>a+v*external.intermediateUnitUSD[i],0)+alpha*external.finalImportsUSD-exportAlpha*external.exportsUSD:0;
 const scale=Math.max(1,...capacity,...domestic,...exports),tolerance=scale*1e-8;
 if(ending.some(v=>v< -tolerance)||external&&externalNeed>external.availableUSD+Math.max(1,external.availableUSD,Math.abs(external.exportsUSD))*1e-8)throw new Error('Распределение превысило доступные ресурсы');
 return {production,intermediate,ending,alpha,exportAlpha,delivered,feasible:true,externalNeed,...(sectorExports?{sectorExportFulfillment:sectorFulfillment}: {})};
}

// Revision 4 tie-breaking: fulfill orders first. Among equally good allocations,
// preserve opening stocks rather than liquidating them merely because inventory
// carries zero cost in the feasibility LP. If stocks improve deliveries, use them.
export function allocateMarketWithStocks(input){
 const using=allocateMarket(input);
 if(input.inventory.every(v=>v===0))return {...using,inventoryChoice:'none'};
 const preserving=allocateMarket({...input,inventory:input.inventory.map(()=>0)});
 const score=m=>input.domestic.reduce((a,v,i)=>a+v*input.prices[i]*m.alpha,0)+input.exports.reduce((a,v,i)=>a+v*input.prices[i]*(m.sectorExportFulfillment?.[i]??m.exportAlpha),0);
 const tolerance=Math.max(1,score(using))*1e-8;
 if(score(preserving)>=score(using)-tolerance){
  preserving.ending=preserving.ending.map((v,i)=>v+input.inventory[i]);
  return {...preserving,inventoryChoice:'preserved'};
 }
 return {...using,inventoryChoice:'used-for-delivery'};
}

// Revision 5: if preserving EVERY stock is impossible, revision 4's fallback
// can liquidate unrelated sectors' stocks in a degenerate LP solution. Reserve
// as much of each released stock as possible while retaining feasible deliveries.
// This is deterministic lexicographic stock reservation (sector order), not an
// estimated inventory policy or a global welfare optimum. Money postings still
// use actual production/delivery and the full physical inventory balance.
export function allocateMarketWithReservedStocks(input){
 // Release finished goods only where planned orders exceed feasible sector
 // production. A shortage elsewhere is not permission to liquidate this stock
 // and idle this sector merely to maximize this month's delivered basket.
 const n=input.capacity.length;
 let planned=input.domestic.map((v,i)=>v+input.exports[i]);
 for(let k=0;k<100;k++){
  const next=input.domestic.map((v,i)=>v+input.exports[i]+input.matrix[i].reduce((a,x,j)=>a+x*planned[j],0));
  const fixed=next.every((v,i)=>v===planned[i]);planned=next;
  if(fixed)break; // Exact fixed point only: preserve all floating-point results.
 }
 const feasible=planned.map((v,i)=>Math.min(v,input.capacity[i]));
 const released=input.inventory.map((v,i)=>Math.min(v,Math.max(0,input.domestic[i]+input.exports[i]+input.matrix[i].reduce((a,x,j)=>a+x*feasible[j],0)-feasible[i])));
 const reserved=input.inventory.map((v,i)=>v-released[i]);
 input={...input,inventory:released};
 const finish=m=>({...m,ending:m.ending.map((v,i)=>v+reserved[i])});
 const first=allocateMarketWithStocks(input);
 if(first.inventoryChoice!=='used-for-delivery')return finish(first);
 const score=m=>input.domestic.reduce((v,q,i)=>v+q*input.prices[i]*m.alpha,0)
  +input.exports.reduce((v,q,i)=>v+q*input.prices[i]*(m.sectorExportFulfillment?.[i]??m.exportAlpha),0);
 const target=score(first),tolerance=Math.max(1,target)*1e-9;
 const budget=[...input.inventory];let chosen=first;
 for(let i=0;i<budget.length;i++){
  if(budget[i]===0)continue;
  let lo=0,hi=budget[i];
  const at=value=>allocateMarket({...input,inventory:budget.map((v,j)=>j===i?value:v)});
  const zero=at(0);
  if(score(zero)>=target-tolerance){budget[i]=0;chosen=zero;continue;}
  for(let j=0;j<28;j++){
   const mid=(lo+hi)/2,candidate=at(mid);
   if(score(candidate)>=target-tolerance){hi=mid;chosen=candidate;}else lo=mid;
  }
  budget[i]=hi;chosen=at(hi);
 }
 chosen.ending=chosen.ending.map((v,i)=>v+input.inventory[i]-budget[i]);
 return finish({...chosen,inventoryChoice:'reserved-unneeded-stocks',inventoryDrawBudget:budget});
}
