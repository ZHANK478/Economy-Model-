// Country data and geographical identity are separate from economic equations.
const clone=x=>JSON.parse(JSON.stringify(x));
export function validateScenarioDefinition(d){
 if(!d||d.version!==1||typeof d.id!=='string'||!/^[a-z0-9-]+$/.test(d.id)||typeof d.name!=='string'||!Number.isInteger(d.referenceYear)||!Array.isArray(d.evidence)||!Array.isArray(d.limitations))throw Error('Повреждено описание сценария');
 for(const e of d.evidence)if(typeof e.key!=='string'||!['observed','derived','assumption','missing'].includes(e.status)||typeof e.source!=='string'||(e.status==='observed'&&(!Number.isFinite(e.value)||!Number.isInteger(e.year))))throw Error('Повреждён источник сценария');
 const geo=d.geography;if(!geo||geo.version!==1||!Array.isArray(geo.territories)||!Array.isArray(geo.layers))throw Error('Повреждена география сценария');
 const ids=new Set(geo.territories.map(t=>t.id));if(ids.size!==geo.territories.length)throw Error('Повтор территории');
 for(const t of geo.territories){if(typeof t.id!=='string'||typeof t.name!=='string'||!geo.layers.some(l=>l.id===t.layer)||t.parent!==null&&!ids.has(t.parent))throw Error('Повреждена территория');let parent=t.parent,seen=new Set([t.id]);while(parent!==null){if(seen.has(parent))throw Error('Цикл территорий');seen.add(parent);parent=geo.territories.find(x=>x.id===parent).parent;}}
 for(const layer of geo.layers)if(!['territorial','administrative','electoral'].includes(layer.kind)||!Number.isInteger(layer.validFrom)||layer.validTo!==null&&(!Number.isInteger(layer.validTo)||layer.validTo<layer.validFrom))throw Error('Повреждён слой границ');
 return clone(d);
}
export function initializeScenario(s,definition){const d=validateScenarioDefinition(definition);s.scenario=d;s.provenance.scenario=clone(d);}
export function validateScenario(s){
 if(s.provenance?.initialFinancialStocks)validateOpeningStocks(s.provenance.initialFinancialStocks);
 if(s.initialServiceShares||s.provenance?.initialServiceShares){const a=s.initialServiceShares;if(!Array.isArray(a)||a.length!==8||a.some(x=>!Number.isFinite(x)||x<=0)||Math.abs(a.reduce((x,y)=>x+y,0)-1)>1e-9||JSON.stringify(a)!==JSON.stringify(s.provenance.initialServiceShares))throw Error('Изменена исходная структура услуг');}
 if(!s.scenario&&!s.provenance?.scenario)return;
 validateScenarioDefinition(s.scenario);
 if(JSON.stringify(s.scenario)!==JSON.stringify(s.provenance.scenario))throw Error('Изменены исходные данные сценария');
 if(s.base.initialPopulation!==s.provenance.initialPopulation)throw Error('Изменено исходное население сценария');
}
export function aggregateTerritoryObservations(records,territories,key){
 // Only recorded, additive, same-date observations may be summed. Missing is null.
 if(new Set(territories).size!==territories.length||!territories.length)return null;
 const rows=territories.map(id=>{const matches=records.filter(r=>r.territoryId===id&&r.key===key);return matches.length===1?matches[0]:null;});
 if(rows.some(r=>!r||!Number.isFinite(r.value))||new Set(rows.map(r=>r.date)).size!==1)return null;
 return rows.reduce((v,r)=>v+r.value,0);
}
export function validateOpeningStocks(d){
 if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Некорректные стартовые балансы');
 const keys=['domesticDebtGDP','externalDebtGDP','governmentCashGDP','reservesGDP','domesticCoupon','externalCoupon'];
 for(const [k,v] of Object.entries(d))if(!keys.includes(k)||!Number.isFinite(v)||v<0||v>(k.endsWith('Coupon')?1:500))throw Error('Некорректный стартовый баланс: '+k);
 return clone(d);
}
export function applyOpeningStocks(s,d,annualGDP){
 validateOpeningStocks(d);
 for(const [field,key,coupon] of [['domesticBonds','domesticDebtGDP','domesticCoupon'],['externalBonds','externalDebtGDP','externalCoupon']]){
  const rows=s.government[field];if(d[key]!==undefined){const total=rows.reduce((v,b)=>v+b.principal,0),desired=annualGDP*d[key]/100/(field==='externalBonds'?s.exchangeRate:1);rows.forEach(b=>b.principal=total>0?b.principal/total*desired:desired/rows.length);}
  if(d[coupon]!==undefined)rows.forEach(b=>b.rate=d[coupon]);
 }
 if(d.governmentCashGDP!==undefined)s.government.cash=annualGDP*d.governmentCashGDP/100;
 if(d.reservesGDP!==undefined)s.government.reservesUSD=annualGDP*d.reservesGDP/100/s.exchangeRate;
 s.provenance.initialFinancialStocks=clone(d);
}
