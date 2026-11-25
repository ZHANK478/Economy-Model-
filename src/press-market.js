import {hash} from './political-config.js';
import {britishName} from './leader-names.js';

export const NEWSPAPERS = [
  {id:'press-chronicle',name:'The National Chronicle',beat:'Общенациональная газета',control:'state',share:.22},
  {id:'press-ledger',name:'The Financial Ledger',beat:'Экономика и финансы',control:'private',share:.29},
  {id:'press-dispatch',name:'The Foreign Dispatch',beat:'Международная политика',control:'private',share:.25},
  {id:'press-workers',name:'The Workers’ Gazette',beat:'Труд и социальная политика',control:'cooperative',share:.24}
];
export const pressEnabled = s => s.politics?.pressRevision===1;
export const pressTitle = id => NEWSPAPERS.find(p=>p.id===id);
export const pressCompanies = s => s.firmMarkets?.markets.find(m=>m.sector===4)?.companies.filter(c=>pressTitle(c.id))??[];

export function pressControl(company) {
  const shares=company.ownership;
  return Object.keys(shares).reduce((leading,key)=>shares[key]>shares[leading]?key:leading,'state');
}
export const pressControlLabel = type => ({state:'Государственное издание',domestic:'Частное издание',foreign:'Издание с иностранным капиталом',municipal:'Муниципальное издание',cooperative:'Кооперативное издание'})[type];

export function publisher(s,company) {
  const control=pressControl(company);
  if(control!=='domestic'&&control!=='foreign')return null;
  const family=s.wealthOwners?.families.reduce((largest,f)=>
    (f.stakes[company.id]??0)>(largest?.stakes[company.id]??0)?f:largest,null);
  if(control==='domestic'&&!family)return null;
  const id=control==='domestic'?'press-owner-'+family.id:'press-owner-'+company.id;
  const seed=s.characters?.seed??s.politics.characterSeed??s.seed;
  const profile=Number(hash(seed,id,'profile')<.48);
  return {id,profile,name:britishName(seed,id,profile)};
}

// The publishers inherit a small part of an existing services firm. Existing
// capital, jobs, cash, loans and claims are reallocated inside the same sector.
export function carveNewspapers(s,market,claims) {
  if(!pressEnabled(s)||market.companies.some(c=>pressTitle(c.id)))return;
  const donor=market.companies.find(c=>c.active&&c.capital>0);
  if(!donor)return;
  const fields=['cash','loanLC','loanFX','capital','inventory','workers','production','lastRevenue','lastProfit','lastInvestment','expectedRevenue','receiptWeight','volumeWeight','knowledgeCapital'];
  const starting=Object.fromEntries(fields.map(key=>[key,donor[key]??0]));
  const claim=claims.get(donor.id)??0;
  for(const paper of NEWSPAPERS){
    const fraction=.018*paper.share;
    const group=7+Math.floor(hash(s.seed,paper.id,'publisher-group')*3);
    const ownership={state:Number(paper.control==='state'),municipal:0,foreign:0,cooperative:Number(paper.control==='cooperative'),domestic:Number(paper.control==='private')};
    const company={id:paper.id,name:paper.name,sector:4,active:true,ownership,
      domesticOwners:s.households.map((_,i)=>i===group?ownership.domestic:0),
      workerOwners:s.households.map(h=>h.wageShare*ownership.cooperative),
      price:donor.price,relativeProductivity:1,averageRate:donor.averageRate,
      depositIncome:0,interestPaid:0,foreignEquityUSD:0,fundedInvestment:0,bankruptcies:0,last:null,
      foundedMonth:-12*(45+Math.floor(hash(s.seed,paper.id,'founding')*50)),
      equityReturn:s.parameters.neutralRealRate,fixedDebtShare:.5,debtMonthsRemaining:36,debtMaturityMonths:36};
    for(const key of fields){company[key]=starting[key]*fraction;donor[key]=starting[key]*(1-.018);}
    market.companies.push(company);
    claims.set(company.id,claim*fraction);
    if(s.wealthOwners&&ownership.domestic){
      const owner=s.wealthOwners.families.find(f=>f.group===group&&f.kind==='owner');
      if(owner)owner.stakes[company.id]=1;
    }
  }
  claims.set(donor.id,claim*(1-.018));
}
