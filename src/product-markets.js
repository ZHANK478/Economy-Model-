import {worldDecisionEffects} from './world-decisions.js';
import {importPartnerTerms} from './trade-partners.js';
import {servicesDetailed,serviceDemandWeights} from './service-industries.js';
// Revision 17: twelve operating submarkets consolidated into the five legacy
// national-account sectors. Submarkets are NOT additional deposits or GDP.
// All shares, substitution and adjustment speeds below are scenario assumptions.
const sum=a=>a.reduce((a,b)=>a+b,0),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const detailedProductsActive=s=>(s.economy?.revision??0)>=17;
export const PRODUCTS=[
 ['grain','Зерно и сельхозсырьё',0,.40,.15,.65],['food','Пищевые продукты',0,.60,.05,.25],
 ['raw','Добывающее сырьё',1,.30,.10,.55],['fuel','Топливо и нефтепереработка',1,.40,.75,.20],['power','Электроэнергия',1,.30,.50,.05],
 ['consumer','Потребительские изделия',2,.40,.20,.15],['equipment','Машины и оборудование',2,.35,.20,.30],['materials','Промышленные материалы',2,.25,.35,.45],
 ['building','Строительные работы',3,1,.35,.25],
 ['transport','Транспорт и логистика',4,.20,.60,.05],['business','Деловые услуги',4,.30,.12,.05],['personal','Потребительские услуги',4,.50,.15,.05]
];
export const SERVICE_PRODUCTS=[
 ['transport','Транспорт и логистика',4,.20,.60,.05],['business','Профессиональные и деловые услуги',4,.15,.08,.03],['personal','Бытовые и персональные услуги',4,.12,.15,.05],
 ['trade','Торговля',4,.18,.15,.05],['digital','Информация и связь',4,.09,.12,.02],['financial','Финансовые услуги · явные комиссии',4,.06,.04,.01],['hospitality','Гостиницы и общественное питание',4,.10,.30,.12],['property','Недвижимость и управление',4,.10,.12,.08]
];
export const productCatalog=s=>servicesDetailed(s)?[...PRODUCTS.slice(0,9),...SERVICE_PRODUCTS.map((r,i)=>s.initialServiceShares?r.map((v,j)=>j===3?s.initialServiceShares[i]:v):r)]:PRODUCTS;
function expandServices(s){
 const m=s.productMarkets;if(!servicesDetailed(s)||m.version===2)return;
 const old=m.products,parents={transport:['transport',.20],business:['business',.30],personal:['personal',.50],trade:['personal',.50],digital:['business',.30],financial:['business',.30],hospitality:['personal',.50],property:['personal',.50]};
 const amounts=['referenceShare','capacityShare','demandShare','inventory','production','capacity','sold','revenue','openingInventory'];
 m.products=productCatalog(s).map(([id,name,sector,share,energy,raw])=>{if(sector!==4)return old.find(p=>p.id===id);const [parent,den]=parents[id],p=structuredClone(old.find(p=>p.id===parent)),ratio=share/den;
 for(const key of amounts)if(p[key]!==undefined)p[key]*=ratio;
 return {...p,id,name,referenceShare:share,energyExposure:energy,rawExposure:raw,last:null};});m.version=2;m.serviceExpansionMonth=s.month;
}
export const sectorProducts=(s,i)=>s.productMarkets?.products.filter(p=>p.sector===i)??[];
const normalize=a=>{const t=sum(a);return a.map(x=>t>0?x/t:1/a.length);};
export function initializeProductMarkets(s){
 if(!detailedProductsActive(s))return;
 if(s.productMarkets){expandServices(s);return;}
 s.productMarkets={version:servicesDetailed(s)?2:1,startedMonth:s.month,assumptions:{priceSpeed:.045,capacityReallocation:1/48,substitution:.35},products:productCatalog(s).map(([id,name,sector,share,energy,raw])=>({id,name,sector,referenceShare:share,capacityShare:share,demandShare:share,energyExposure:energy,rawExposure:raw,price:s.firms[sector].price,importPrice:s.exchangeRate*s.worldPriceIndex/100,inventory:s.firms[sector].inventory*share,production:0,capacity:0,sold:0,revenue:0,transactionPrice:null,last:null})),last:null};
 const ratio=clamp((s.lastReport.gdp?.investment??s.base.investment)/Math.max(1,s.lastReport.gdp?.consumption??s.base.consumption),.05,.8);
 for(let i=0;i<5;i++){const rows=sectorProducts(s,i),shares=normalize(rows.map(p=>p.referenceShare*(p.id==='equipment'?1+ratio:p.id==='consumer'?1-ratio*.35:1)));rows.forEach((p,j)=>{p.capacityShare=shares[j];p.demandShare=shares[j];p.inventory=s.firms[i].inventory*shares[j];});}
}
export function prepareProductMarkets(s){
 if(!detailedProductsActive(s))return;
 const investment=s.lastReport.gdp?.investment??s.base.investment,consumption=s.lastReport.gdp?.consumption??s.base.consumption;
 const capitalDemand=clamp(investment/Math.max(1,consumption),.05,.8);
 for(let sector=0;sector<5;sector++){
  const rows=sectorProducts(s,sector),f=s.firms[sector];
  const mean=sum(rows.map(p=>p.capacityShare*p.price));
  // Preserve the sector's already quoted level; relative prices retain their
  // independent history. The composite is what existing purchasers settle.
  for(const p of rows)p.price*=f.price/Math.max(mean,1e-9);
  const demandWeights=sector===4?serviceDemandWeights(s,rows):rows.map(p=>p.referenceShare);
  const demand=normalize(rows.map((p,j)=>demandWeights[j]*(p.id==='equipment'?1+capitalDemand:p.id==='consumer'?1-capitalDemand*.35:1)*Math.pow(f.price/p.price,s.productMarkets.assumptions.substitution)));
  for(const [i,p] of rows.entries()){p.demandShare=demand[i];p.openingInventory=p.inventory;p.openingPrice=p.price;}
 }
}
const installedShare = product => product.installedShare??product.capacityShare;
export function productCapacityFactor(s,sector){
 if(!detailedProductsActive(s))return 1;
 return Math.min(1,...sectorProducts(s,sector).map(p=>installedShare(p)/Math.max(1e-9,p.demandShare)));
}
export function productImportPrices(s,w){
 const base=s.exchangeRate*s.worldPriceIndex/100*(importPartnerTerms(s)?.index??1);
 const {premium,freight}=worldDecisionEffects(s);
 return productCatalog(s).map(([id, , , ,e,r])=>base*((1-e-r)+e*w.energyPrice/100+r*w.commodityPrice/100)*(1+freight)*(id==='equipment'?1+premium:1));
}
export function compositeImportPrices(s,w){
 const prices=productImportPrices(s,w);
 return s.firms.map((_,i)=>sum(productCatalog(s).map((p,j)=>p[2]===i?p[3]*prices[j]:0)));
}
export function updateProductPrices(s,sector,macroPrice,w){
 if(!detailedProductsActive(s))return macroPrice;
 const rows=sectorProducts(s,sector),a=s.productMarkets.assumptions;
 const oldComposite=sum(rows.map(p=>p.capacityShare*p.price));
 const previous=s.lastReport.world??s.world;
 const fuel=s.productMarkets.products.find(p=>p.id==='fuel'),raw=s.productMarkets.products.find(p=>p.id==='raw');
 const fuelChange=fuel.last?Math.log(fuel.price/fuel.last.quote):0,rawChange=raw.last?Math.log(raw.price/raw.last.quote):0;
 const averageEnergy=sum(rows.map(p=>p.capacityShare*p.energyExposure)),averageRaw=sum(rows.map(p=>p.capacityShare*p.rawExposure));
 for(const p of rows){
  const pressure=Math.log(Math.max(.1,p.demandShare/installedShare(p)));
  const external=p.energyExposure*Math.log(w.energyPrice/Math.max(1,previous.energyPrice))+p.rawExposure*Math.log(w.commodityPrice/Math.max(1,previous.commodityPrice));
  const regulated=p.id==='fuel'&&s.policy.fuelPricing==='regulated'||p.id==='power'&&s.policy.energyPricing==='regulated';
  const target=p.id==='fuel'?s.policy.fuelTariff:s.policy.energyTariff;
  const tariff=regulated?.18*Math.log(Math.max(.05,target/100)/p.price):0;
  const differentiatedInputs=sector>1?.15*((p.energyExposure-averageEnergy)*fuelChange+(p.rawExposure-averageRaw)*rawChange):0;
  p.price*=macroPrice/Math.max(oldComposite,1e-9)*Math.exp(clamp(a.priceSpeed*pressure+.12*external+tariff+differentiatedInputs,-.08,.08));
 }
 return sum(rows.map(p=>p.capacityShare*p.price));
}
export function completeProductCapacity(s,sector,investment){
 if(!detailedProductsActive(s)||!(investment>0)||servicesDetailed(s)&&sector===4)return;
 const rows=sectorProducts(s,sector),fraction=Math.min(.10,investment/Math.max(1,s.firms[sector].capital));
 for(const p of rows)p.capacityShare+=(p.demandShare-p.capacityShare)*fraction;
 const shares=normalize(rows.map(p=>p.capacityShare));rows.forEach((p,i)=>p.capacityShare=shares[i]);
}
export function settleProductMarkets(s,{production,capacity,revenue,inputs,sectorValueAdded,w}){
 if(!detailedProductsActive(s))return;
 const imports=productImportPrices(s,w),report=[];
 for(let sector=0;sector<5;sector++){
  const rows=sectorProducts(s,sector),available=sum(rows.map(p=>p.openingInventory+production[sector]*p.demandShare));
  const ending=s.firms[sector].inventory,sold=Math.max(0,available-ending),saleRatio=available>0?sold/available:0;
  const nominalShares=normalize(rows.map(p=>(p.openingInventory+production[sector]*p.demandShare)*p.openingPrice));
  rows.forEach((p,i)=>{
   p.production=production[sector]*p.demandShare;
   p.capacity=capacity[sector]/Math.max(1e-9,productCapacityFactor(s,sector))*installedShare(p);
   p.sold=(p.openingInventory+p.production)*saleRatio;p.inventory=(p.openingInventory+p.production)*(1-saleRatio);
   p.revenue=revenue[sector]*nominalShares[i];p.transactionPrice=p.sold>0?p.revenue/p.sold:null;
   p.importPrice=imports[productCatalog(s).findIndex(x=>x[0]===p.id)];
   p.last={month:s.month,openingInventory:p.openingInventory,production:p.production,sold:p.sold,endingInventory:p.inventory,revenue:p.revenue,inputCost:inputs[sector]*nominalShares[i],valueAdded:sectorValueAdded[sector]*p.demandShare,capacity:p.capacity,quote:p.price,transactionPrice:p.transactionPrice,importPrice:p.importPrice,capacityShare:p.capacityShare,demandShare:p.demandShare};
   report.push({id:p.id,name:p.name,sector,...p.last});
  });
 }
 s.productMarkets.last={month:s.month,products:report,accounting:'Subsector amounts consolidate into five sectors; no additional money or GDP.'};
 s.lastReport.products=report;
}
export function validateProductMarkets(s){
 if(!detailedProductsActive(s))return;
 const m=s.productMarkets;if(!m||m.version!==(servicesDetailed(s)?2:1)||!Array.isArray(m.products)||m.products.length!==productCatalog(s).length)throw new Error('Повреждены товарные рынки');
 for(const [i,p] of m.products.entries())if(p.id!==productCatalog(s)[i][0]||p.sector!==productCatalog(s)[i][2]||['price','importPrice','capacityShare','demandShare'].some(k=>!Number.isFinite(p[k])||p[k]<=0)||['inventory','production','capacity','sold','revenue'].some(k=>!Number.isFinite(p[k])||p[k]<-1e-7))throw new Error('Повреждён товар '+p.id);
 const installed=sectorProducts(s,2).filter(product=>product.installedShare!==undefined);
 if(installed.length&&(!installed.every(product=>Number.isFinite(product.installedShare)&&product.installedShare>0)||Math.abs(sum(installed.map(installedShare))-1)>1e-8))throw new Error('Повреждены мощности промышленного рынка');
 for(let i=0;i<5;i++){const rows=sectorProducts(s,i);if(Math.abs(sum(rows.map(p=>p.capacityShare))-1)>1e-8||Math.abs(sum(rows.map(p=>p.demandShare))-1)>1e-8||Math.abs(sum(rows.map(p=>p.inventory))-s.firms[i].inventory)>Math.max(1e-6,s.firms[i].inventory*1e-8))throw new Error('Нарушена консолидация товаров');}
}
