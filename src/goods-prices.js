import {importPartnerTerms} from './trade-partners.js';
import {detailedProductsActive,compositeImportPrices} from './product-markets.js';
// Category prices in model currency per base-year unit. Exposure coefficients
// are scenario assumptions; no product price or competition bonus is observed data.
export const GOODS=[['food','Продовольствие'],['energy','Энергия и сырьё'],['manufactures','Промышленные товары и оборудование'],['materials','Строительные материалы'],['services','Услуги']];
export const priceAt=(prices,i)=>Array.isArray(prices)?prices[i]:prices;
export const basketPrice=(weights,prices)=>weights.reduce((v,w,i)=>v+w*priceAt(prices,i),0);
export function importGoodsPrices(s,w){
 if(detailedProductsActive(s))return compositeImportPrices(s,w);
 const base=s.exchangeRate*s.worldPriceIndex/100*(importPartnerTerms(s)?.index??1);
 if((s.economy?.revision??0)<15)return GOODS.map(()=>base*(.70+.18*w.energyPrice/100+.12*w.commodityPrice/100));
 const energy=w.energyPrice/100,raw=w.commodityPrice/100;
 return [1,energy,.85+.10*energy+.05*raw,.65+.15*energy+.20*raw,1].map(x=>base*x);
}
export function goodsPriceView(s,{n}){
 const rows=s.lastReport?.goodsPrices;
 if(detailedProductsActive(s)&&s.productMarkets?.products)return `<details class="goods-prices"><summary>Цены товаров</summary><div class="small">Индексы цен: начало игры = 100. Местные и импортные товары, с налогами.</div><table><thead><tr><th>Товар</th><th>Местные</th><th>Импорт</th></tr></thead><tbody>${s.productMarkets.products.map(p=>`<tr><td>${p.name}</td><td>${n(p.price*100*(1+s.policy.vat/100)/1.18,1)}</td><td>${n(p.importPrice*100*(1+s.policy.tariff/100)*(1+s.policy.vat/100)/1.18,1)}</td></tr>`).join('')}</tbody></table></details>`;
 if(!rows)return '';
 return `<details class="goods-prices"><summary>Цены товаров</summary><div class="small">Индексы в национальной валюте: цены начала игры = 100. С налогами. Импорт и местное производство.</div><table><thead><tr><th>Категория</th><th>Местные</th><th>Импорт</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${GOODS[i][1]}</td><td>${n(r.domestic*100,1)}</td><td>${n(r.imported*100,1)}</td></tr>`).join('')}</tbody></table></details>`;
}
