export const companyEconomyActive = state =>
  state.scenario?.id==='uk-2000' && state.economy?.revision>=27;

export const OPENING_INDUSTRY_SHARES = [.32,.28,.23,.17];
const industry = [['materials'],['equipment'],['consumer'],['equipment','consumer']];
const services = [['trade','personal','hospitality'],['business','financial','property'],['transport','digital']];
const affinity = (products,id) => products.includes(id)?1:.12;
const sum = values => values.reduce((total,value)=>total+value,0);

export function primaryProducts(company,sector) {
  const sequence=Number(company.id.match(/-(\d+)$/)?.[1]??1)-1;
  if(sector===2)return industry[sequence%industry.length];
  if(sector===3)return ['building'];
  if(sector===4)return company.id.startsWith('press-')?['digital']:services[sequence%services.length];
  return [];
}

// Allocate each existing product market among suppliers. Diversified secondary
// production represents smaller firms that the original representative companies
// subsume. Price competition is strongest among suppliers of the same product.
export function specializedCompanyShares(state,sector,companies,weights) {
  const products=state.productMarkets?.products.filter(product=>product.sector===sector);
  if(!companyEconomyActive(state)||![2,4].includes(sector)||!products?.length)return weights;
  const primary=companies.map(company=>primaryProducts(company,sector));
  const shares=companies.map(()=>0);
  for(const product of products){
    const eligible=weights.map((weight,i)=>weight*affinity(primary[i],product.id));
    const total=sum(eligible);
    if(total>0)eligible.forEach((weight,i)=>{shares[i]+=product.demandShare*weight/total;});
  }
  return shares;
}

export function prepareCompanySpecialization(state,sector,companies) {
  const weights=specializedCompanyShares(state,sector,companies,companies.map(company=>company.volumeWeight));
  const turnover=sum(companies.map((company,i)=>company.price*weights[i]));
  companies.forEach((company,i)=>{
    company.volumeWeight=weights[i];
    company.receiptWeight=turnover>0?company.price*weights[i]/turnover:0;
  });
}

// Installed equipment cannot switch between different lines as quickly as
// orders can. Keep the existing capacity series as the diversified component
// and let the specialized component follow operating firms' installed capital.
export function prepareIndustrialCapacity(state,companies) {
  const products=state.productMarkets.products.filter(product=>product.sector===2);
  const mixes=profiles=>profiles.map(profile=>{
    const weights=products.map(product=>product.referenceShare*affinity(profile,product.id));
    const total=sum(weights);
    return weights.map(weight=>weight/total);
  });
  const opening=mixes(industry);
  const current=mixes(companies.map(company=>primaryProducts(company,2)));
  const capital=companies.map(company=>company.active?company.capital:0);
  const amount=sum(capital);
  if(!amount){
    for(const product of products)delete product.installedShare;
    return;
  }
  const weights=products.map((product,i)=>{
    const reference=sum(opening.map((mix,j)=>mix[i]*OPENING_INDUSTRY_SHARES[j]));
    const installed=sum(current.map((mix,j)=>mix[i]*capital[j]))/amount;
    return product.capacityShare*(.5+.5*installed/reference);
  });
  const total=sum(weights);
  products.forEach((product,i)=>{product.installedShare=weights[i]/total;});
}
