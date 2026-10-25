// Feasibility allocator, not an estimated model of household/firm optimization.
// The former single multiplier reduced exports together with imports: once a
// foreign credit line closed, it could eliminate all production even when
// feasible export receipts could pay for essential imported inputs.
// Separate domestic and export fulfillment permits trade-financed production.
// Within each demand block baskets remain fixed (an explicit coarse assumption).
// The objective is delivered orders at current domestic prices; no party,
// ownership label or country-income category enters the allocation.
export function allocateMarket({matrix,inventory,capacity,domestic,exports,prices,external}){
 const n=capacity.length,variables=n+2,rows=[],rhs=[];
 const add=(a,b)=>{const scale=Math.max(...a.map(Math.abs),Math.abs(b),1e-12);rows.push(a.map(x=>x/scale));rhs.push(Math.max(0,b)/scale);};
 for(let i=0;i<n;i++)add([...capacity.map((q,j)=>(matrix[i][j]-(i===j?1:0))*q),domestic[i],exports[i]],inventory[i]);
 for(let i=0;i<n;i++)add(Array.from({length:variables},(_,j)=>j===i?1:0),1);
 add(Array.from({length:variables},(_,j)=>j===n?1:0),1);
 add(Array.from({length:variables},(_,j)=>j===n+1?1:0),1);
 if(external)add([...capacity.map((q,i)=>q*external.intermediateUnitUSD[i]),external.finalImportsUSD,-external.exportsUSD],external.availableUSD);
 const domesticValue=domestic.reduce((a,v,i)=>a+v*prices[i],0),exportValue=exports.reduce((a,v,i)=>a+v*prices[i],0);
 const objectiveScale=Math.max(domesticValue,exportValue,1e-12),objective=[...capacity.map(()=>0),domesticValue/objectiveScale,exportValue/objectiveScale];
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
  for(let i=0;i<=m;i++)if(i!==leave){const factor=table[i][enter];for(let j=0;j<width;j++)table[i][j]-=factor*table[leave][j];}
  basis[leave]=enter;
 }
 if(!optimal)throw new Error('Распределение заказов не сошлось');
 const solution=Array(variables).fill(0);for(let i=0;i<m;i++)if(basis[i]<variables)solution[basis[i]]=table[i][width-1];
 const alpha=Math.max(0,Math.min(1,solution[n])),exportAlpha=Math.max(0,Math.min(1,solution[n+1]));
 const production=capacity.map((q,i)=>q*Math.max(0,Math.min(1,solution[i])));
 const intermediate=matrix.map(row=>row.reduce((a,v,j)=>a+v*production[j],0));
 const delivered=domestic.map((v,i)=>v*alpha+exports[i]*exportAlpha);
 const ending=production.map((v,i)=>inventory[i]+v-intermediate[i]-delivered[i]);
 const externalNeed=external?production.reduce((a,v,i)=>a+v*external.intermediateUnitUSD[i],0)+alpha*external.finalImportsUSD-exportAlpha*external.exportsUSD:0;
 const scale=Math.max(1,...capacity,...domestic,...exports),tolerance=scale*1e-8;
 if(ending.some(v=>v< -tolerance)||external&&externalNeed>external.availableUSD+Math.max(1,external.availableUSD,Math.abs(external.exportsUSD))*1e-8)throw new Error('Распределение превысило доступные ресурсы');
 return {production,intermediate,ending,alpha,exportAlpha,delivered,feasible:true,externalNeed};
}

// Revision 4 tie-breaking: fulfill orders first. Among equally good allocations,
// preserve opening stocks rather than liquidating them merely because inventory
// carries zero cost in the feasibility LP. If stocks improve deliveries, use them.
export function allocateMarketWithStocks(input){
 const using=allocateMarket(input);
 if(input.inventory.every(v=>v===0))return {...using,inventoryChoice:'none'};
 const preserving=allocateMarket({...input,inventory:input.inventory.map(()=>0)});
 const score=m=>input.domestic.reduce((a,v,i)=>a+v*input.prices[i]*m.alpha,0)+input.exports.reduce((a,v,i)=>a+v*input.prices[i]*m.exportAlpha,0);
 const tolerance=Math.max(1,score(using))*1e-8;
 if(score(preserving)>=score(using)-tolerance){
  preserving.ending=preserving.ending.map((v,i)=>v+input.inventory[i]);
  return {...preserving,inventoryChoice:'preserved'};
 }
 return {...using,inventoryChoice:'used-for-delivery'};
}
