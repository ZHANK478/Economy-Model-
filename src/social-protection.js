import {familyCompanies,livelihoodsActive} from './livelihoods.js';
import {groupRentFactor} from './settlements.js';
// Revision 9: resource and cash accounts; coefficients are scenario assumptions.
// Housing is an aggregate rental market inside the services producer, not a
// cadastral/mortgage simulation. Private funds hold actual bank deposits.
import './config.js';
const sum=a=>a.reduce((v,x)=>v+x,0),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const socialActive=s=>(s.economy?.revision??0)>=9;
export const SOCIAL_KEYS=['socialHousingBudget','housingAllowance','housingRules','privateHousingEntry','retirementAge','pensionContribution','pensionIndexation','privatePensions','unemploymentReplacement','unemploymentDuration','retrainingBudget','privateUnemploymentInsurance'];
export const socialFunds=s=>socialActive(s)&&s.social?[s.social.pensionFund,s.social.insuranceFund,...(s.social.healthFund?[s.social.healthFund]:[]),...(s.social.investmentFund?[s.social.investmentFund]:[])]:[];
export const socialDeposits=s=>sum(socialFunds(s).map(f=>f.cash));
const ageCount=(s,from,to=1201)=>sum(s.demography.female.slice(Math.round(from*12),Math.round(to*12)).map((v,i)=>v+s.demography.male[Math.round(from*12)+i]));
const housingNeed=s=>sum(s.households.map(h=>s.population*h.population/Math.max(1,h.householdSize)));
const retireeWeights=s=>s.households.map(h=>h.population);
const unemploymentWeights=s=>{const values=s.households.map((h,i)=>h.population*(1.8-i*.15));return values.map(x=>x/sum(values));};
export function initializeSocial(s,transferEnvelope){
 if(!socialActive(s)||s.social)return false;
 const gross=sum(s.firms.map(f=>f.workers*f.wage)),employed=sum(s.firms.map(f=>f.workers)),wage=gross/Math.max(employed,1e-9);
 const oldTransfers=s.base.monthlyGDP*(transferEnvelope??s.policy.transfers)/100*(.6+.4*(s.ageCohorts[2]/s.population)/.07);
 const retirees=ageCount(s,s.policy.retirementAge),weights=retireeWeights(s),u=Math.max(0,s.metrics.laborForce-employed);
 const dw=unemploymentWeights(s),homes=housingNeed(s);
 const fund=()=>({cash:0,bankClaim:0,depositIncome:0});
 s.social={version:1,startedMonth:s.month,assumptions:{housingMonths:24,wear:.01,privateContribution:.02,insurancePremium:.01,privateTopUp:.15,vestingMonths:6,trainingMonths:6,rentSpeed:.025,constructionResponse:.3,formalCoverage:clamp(1-s.institutions.informality,.1,1)},
  pension:{effectiveAge:s.policy.retirementAge,retirees,benefit:weights.map(w=>oldTransfers*.7*w/Math.max(retirees*w,1e-9)),points:s.households.map((h,i)=>35*(.5+i*.12)),lastWage:wage,lastCPI:s.consumerPriceIndex,arrears:0},
  pensionFund:fund(),insuranceFund:fund(),privateAccounts:Array(10).fill(0),insuredMonths:Array(10).fill(0),contributionMonths:Array(10).fill(0),
  unemployment:dw.map((w,i)=>Array.from({length:24},(_,month)=>({people:u*w/24,months:month+1,wage:wage*(.55+i*.10),covered:clamp(1-s.institutions.informality,.1,1),privateCover:0}))),
  training:[],trainedMatch:0,housing:{privateStock:homes*.93,publicStock:homes*.10,constructionPerHome:Math.max(1,s.firms[4].capital*.35/(homes*.93)),rentIndex:1,referenceNeed:homes,privateBook:s.firms[4].capital*.35,publicReceipts:0,lastPrivateRent:0},last:{},history:[]};
 // Preserve the opening transfer envelope: 70% pensions, 30% assistance.
 if(s.month===0)s.provenance.initialSocialTransferEnvelope=transferEnvelope??s.policy.transfers;
 if(transferEnvelope===undefined)s.policy.transfers*=.3;else s.policy.transfers=transferEnvelope*.3;
 if(transferEnvelope===undefined&&s.politics?.lawPolicy){s.politics.lawPolicy.transfers*=.3;}
 return true;
}
export function prepareSocial(s,prev){
 if(!socialActive(s))return;
 const z=s.social,p=s.policy;
 if((s.economy?.revision??0)>=11&&!z.healthFund)z.healthFund={cash:0,bankClaim:0,depositIncome:0};
 if((s.economy?.revision??0)>=11&&!z.investmentFund){z.investmentFund={cash:0,bankClaim:0,depositIncome:0};z.investmentAccounts=Array(10).fill(0);}
 z.last={investmentSaving:Array(10).fill(0),investmentWithdrawal:Array(10).fill(0),healthPremium:Array(10).fill(0),healthReimbursement:Array(10).fill(0),pensions:Array(10).fill(0),unemployment:Array(10).fill(0),housingAid:Array(10).fill(0),privateBenefits:Array(10).fill(0),privatePensionDraw:Array(10).fill(0),pensionSaving:Array(10).fill(0),premiums:Array(10).fill(0),contributions:Array(10).fill(0),publicRent:0,privateRent:0};
 z.pension.effectiveAge+=clamp(p.retirementAge-z.pension.effectiveAge,-.5/12,.5/12);
 const working=ageCount(s,18,65),eligible=ageCount(s,18,z.pension.effectiveAge);
 s.workingAgeShare*=clamp(1+.35*(eligible-working)/Math.max(working,1e-9),.85,1.15);
 const surviving=z.pension.retirees*(1-clamp((s.demography.deaths??0)/Math.max(s.population,1e-9)*2,0,.05));
 const count=Math.max(surviving,ageCount(s,z.pension.effectiveAge)),newRetirees=Math.max(0,count-surviving);
 const wage=prev.metrics.meanWageNominal??z.pension.lastWage;
 const index=p.pensionIndexation==='wages'?wage/Math.max(z.pension.lastWage,1e-9):prev.consumerPriceIndex/Math.max(z.pension.lastCPI,1e-9);
 z.pension.benefit=z.pension.benefit.map((benefit,i)=>(benefit*clamp(index,.8,1.2)*surviving+newRetirees*wage*.45*clamp(z.pension.points[i]/40,.25,2))/Math.max(count,1e-9));
 z.pension.retirees=count;z.pension.lastWage=wage;z.pension.lastCPI=prev.consumerPriceIndex;
 const h=z.housing;h.privateStock*=Math.pow(1-z.assumptions.wear,1/12);h.publicStock*=Math.pow(1-z.assumptions.wear*(1.5-.5*clamp((h.publicReceipts??0)*.3/Math.max(h.publicStock*h.constructionPerHome*z.assumptions.wear/12,1e-9),0,1)),1/12);h.privateBook*=Math.pow(1-z.assumptions.wear,1/12);
 const households=housingNeed(s);
 const vacancy=(h.privateStock+h.publicStock)/Math.max(households,1e-9);
 // Real rent changes slowly; allowances support demand, construction adds stock.
 const rentTarget=clamp(Math.pow(Math.max(.5,vacancy/1.03),-1.5)*(1+p.housingAllowance*.035),.5,2.5);
 h.rentIndex*=Math.exp(z.assumptions.rentSpeed*Math.log(rentTarget/h.rentIndex));
 for(const f of socialFunds(s)){const interest=f.cash*(Math.pow(1+s.bank.depositRate,1/12)-1);f.cash+=interest;s.bank.equity-=interest;f.depositIncome=interest;}
 revaluePrivateAccounts(s);
 for(const job of z.training.filter(x=>x.due<=s.month))z.trainedMatch+=job.people/Math.max(prev.metrics.laborForce,1e-9)*.15;
 z.training=z.training.filter(x=>x.due>s.month);z.trainedMatch*=.995;
}
export function updateUnemployment(s,prev,laborForce){
 if(!socialActive(s))return;
 const z=s.social,weights=unemploymentWeights(s),labor=s.foundation.labor,old=sum(z.unemployment.flat().map(c=>c.people));
 const target=Math.max(0,laborForce-sum(s.firms.map(f=>f.workers))+(livelihoodsActive(s)?sum(familyCompanies(s).filter(c=>c.active&&c.intendedUse==='own-use').map(c=>c.ownerWorkers??0)):0)),exit=clamp((labor.hires??0)/Math.max(old,1e-9),0,1);
 const separations=Math.min(target,labor.separations??0);
 for(let i=0;i<10;i++){
  const groups=z.unemployment[i].map(c=>({...c,people:c.people*(1-exit),months:Math.min(121,c.months+1)}));
  const wage=(prev.metrics.meanWageNominal??z.pension.lastWage)*(.55+i*.10),formal=clamp(1-s.institutions.informality,.1,1);
  const newPeople=Math.max(0,target-sum(z.unemployment.flat().map(c=>c.people))*(1-exit))*weights[i];
  const covered=z.contributionMonths[i]>=z.assumptions.vestingMonths?formal:0;
  if(newPeople>0)groups.push({people:newPeople,months:0,wage,covered:covered*Math.min(1,separations/Math.max(newPeople/weights[i],1e-9)),privateCover:z.insuredMonths[i]>=z.assumptions.vestingMonths?formal*clamp(.1+i*.1,0,1):0});
  // Long-term non-recipients retain their mass in a single exhausted cohort.
  const exhausted=groups.filter(c=>c.months>60),live=groups.filter(c=>c.months<=60);
  if(exhausted.length)live.push({people:sum(exhausted.map(c=>c.people)),months:121,wage,covered:0,privateCover:0});
  z.unemployment[i]=live.filter(c=>c.people>1e-12);
 }
 const total=sum(z.unemployment.flat().map(c=>c.people));if(total>0)for(const c of z.unemployment.flat())c.people*=target/total;
 z.last.unemployed=target;
}
export function socialTransferPlan(s){
 if(!socialActive(s))return null;
 const z=s.social,p=s.policy,weights=retireeWeights(s),base=s.metrics.nominalGDPAnnual/12;
 const pensions=weights.map((w,i)=>z.pension.retirees*w*z.pension.benefit[i]+z.pension.arrears*w);
 const unemployment=z.unemployment.map(cohorts=>sum(cohorts.filter(c=>c.months>=0&&c.months<Math.round(p.unemploymentDuration)).map(c=>c.people*c.covered*c.wage*p.unemploymentReplacement/100*(c.months===0?.75:1))));
 const ranked=s.households.map((h,i)=>({i,income:h.income/Math.max(s.population*h.population,1e-9)})).sort((a,b)=>a.income-b.income).slice(0,4);
 const weightsAid=Array(10).fill(0);for(const {i} of ranked)weightsAid[i]=s.households[i].population;
 const pool=sum(weightsAid),housingAid=weightsAid.map(w=>base*p.housingAllowance/100*w/Math.max(pool,1e-9));
 return {pensions,unemployment,housingAid,total:sum(pensions)+sum(unemployment)+sum(housingAid)};
}
export function paySocialTransfers(s,plan,flow){
 if(!plan)return;
 const total=plan.total,paid=Math.min(Math.max(0,s.government.cash),total),ratio=total>0?paid/total:0;
 for(const key of ['pensions','unemployment','housingAid'])s.social.last[key]=plan[key].map((v,i)=>{const x=v*ratio;s.government.cash-=x;s.households[i].cash+=x;return x;});
 // Included once in the existing aggregate transfer ledger.
 flow.transfers+=paid;flow.pensions=sum(s.social.last.pensions);flow.unemploymentBenefits=sum(s.social.last.unemployment);flow.housingAid=sum(s.social.last.housingAid);
 s.social.pension.arrears=Math.max(0,sum(plan.pensions)-flow.pensions);s.social.last.coverage=1-ratio;
}
export function socialCashBeforeSpending(s){
 if(!socialActive(s))return;
 const z=s.social,p=s.policy;
 // Funded drawdown is the withdrawal of one's own assets, not new income/GDP.
 if(z.investmentFund){
  const f=z.investmentFund,wanted=z.investmentAccounts.map((account,i)=>s.households[i].cash<s.households[i].income*2?account*.03:0);
  if(s.foundation){const room=s.households.map(h=>Math.max(0,h.cash-h.income*3)*.02),capacity=sum(room),sold=Math.min(Math.max(0,sum(wanted)-f.cash),capacity,f.bankClaim);
   if(sold>0){room.forEach((v,i)=>{const value=sold*v/capacity;s.households[i].cash-=value;s.foundation.bankClaims[i]+=value;});f.bankClaim-=sold;f.cash+=sold;}}
  const fraction=Math.min(1,f.cash/Math.max(sum(wanted),1e-12));wanted.forEach((amount,i)=>{const paid=Math.min(f.cash,amount*fraction);f.cash-=paid;z.investmentAccounts[i]-=paid;s.households[i].cash+=paid;z.last.investmentWithdrawal[i]=paid;});
 }
 const total=sum(z.privateAccounts),retired=z.pension.retirees/Math.max(s.population,1e-9);
 if((s.economy?.revision??0)>=11&&s.foundation){
  const needed=Math.max(0,total*retired/180-z.pensionFund.cash),room=s.households.map(h=>Math.max(0,h.cash-h.income*3)*.02),capacity=sum(room);
  const sold=Math.min(needed,capacity,z.pensionFund.bankClaim);
  if(sold>0){room.forEach((v,i)=>{const value=sold*v/capacity;s.households[i].cash-=value;s.foundation.bankClaims[i]+=value;});z.pensionFund.bankClaim-=sold;z.pensionFund.cash+=sold;}
 }
 const wanted=z.privateAccounts.map(v=>v*retired/180),available=Math.min(1,z.pensionFund.cash/Math.max(sum(wanted),1e-9));
 wanted.forEach((v,i)=>{const paid=v*available;z.privateAccounts[i]-=paid;z.pensionFund.cash-=paid;s.households[i].cash+=paid;z.last.privatePensionDraw[i]=paid;});
 const claims=z.unemployment.map(cs=>sum(cs.filter(c=>c.months>=0&&c.months<6).map(c=>c.people*c.privateCover*c.wage*z.assumptions.privateTopUp*(c.months===0?.75:1))));
 const ratio=Math.min(1,z.insuranceFund.cash/Math.max(sum(claims),1e-9));claims.forEach((v,i)=>{const paid=v*ratio;z.insuranceFund.cash-=paid;s.households[i].cash+=paid;z.last.privateBenefits[i]=paid;});
}
export function socialPayroll(s,i,gross,flow){
 if(!socialActive(s))return 0;
 const z=s.social,h=s.households[i],formal=clamp(s.institutions.taxCompliance,0,1);
 const contribution=Math.min(Math.max(0,h.cash),gross*s.policy.pensionContribution/100*formal);
 h.cash-=contribution;s.government.cash+=contribution;flow.tax+=contribution;flow.socialContributions=(flow.socialContributions??0)+contribution;z.last.contributions[i]+=contribution;
 return contribution;
}
export function savePrivateProtection(s,grossByGroup){
 if(!socialActive(s))return;
 const z=s.social,p=s.policy;
 for(let i=0;i<10;i++){
  const h=s.households[i],gross=grossByGroup[i];if(gross>0)z.contributionMonths[i]++;
  const surplus=Math.max(0,h.cash-h.income*2),participation=clamp(.1+i*.1,0,1);
  const saving=p.privatePensions?Math.min(surplus,gross*z.assumptions.privateContribution*participation):0;
  h.cash-=saving;z.pensionFund.cash+=saving;z.privateAccounts[i]+=saving;z.last.pensionSaving[i]=saving;
  if(z.investmentFund){const investment=Math.min(Math.max(0,h.cash-h.income*3),Math.max(0,h.income)*.005*(.1+i*.1));h.cash-=investment;z.investmentFund.cash+=investment;z.investmentAccounts[i]+=investment;z.last.investmentSaving[i]=investment;}
  const premium=p.privateUnemploymentInsurance?Math.min(Math.max(0,h.cash-h.income),gross*z.assumptions.insurancePremium*participation):0;
  h.cash-=premium;z.insuranceFund.cash+=premium;z.last.premiums[i]=premium;
  if(premium>0)z.insuredMonths[i]++;else z.insuredMonths[i]=Math.max(0,z.insuredMonths[i]-1);
  z.pension.points[i]+=Math.max(0,gross)/Math.max(z.pension.lastWage*s.population*h.population,1e-9)/12;
 }
 revaluePrivateAccounts(s);
}
export function revaluePrivateAccounts(s){
 if(!socialActive(s)||!s.social)return;
 const z=s.social,old=sum(z.privateAccounts),assets=z.pensionFund.cash+z.pensionFund.bankClaim;
 if(old>0)z.privateAccounts=z.privateAccounts.map(v=>v*assets/old);
 if(z.investmentFund){const oldFund=sum(z.investmentAccounts),newFund=z.investmentFund.cash+z.investmentFund.bankClaim;if(oldFund>0)z.investmentAccounts=z.investmentAccounts.map(v=>v*newFund/oldFund);}
}
export function socialHousingPrices(s,i,prices,foodShare=0){
 if(!socialActive(s))return prices;
 const h=s.social.housing,share=s.householdEconomy.assumptions.housingServiceShare*(1-foodShare);
 const eligible=i<4?Math.min(1,h.publicStock/Math.max(housingNeed(s)*.4,1e-9)):0;
 const discount=eligible*.45;
 return prices.map((p,j)=>j===4?p*(1-share+share*h.rentIndex*groupRentFactor(s,i)*(1-discount)):p);
}
export function housingPayment(s,i,quantity,basket,importShare,prices,foodShare=0){
 if(!socialActive(s))return 0;
 const h=s.social.housing,share=s.householdEconomy.assumptions.housingServiceShare*(1-foodShare);
 const factor=socialHousingPrices(s,i,prices,foodShare)[4]/prices[4];
 const rent=quantity*basket[4]*(1-importShare)*prices[4]*(factor-1+share)*(1+s.policy.vat/100);
 const publicShare=i<4?Math.min(1,h.publicStock/Math.max(housingNeed(s)*.4,1e-9)):0;
 s.social.last.publicRent+=rent*publicShare/(1+s.policy.vat/100);s.social.last.privateRent+=rent*(1-publicShare)/(1+s.policy.vat/100);
 return rent;
}
export function privateHousingPlan(s,investmentPrice,committed){
 if(!socialActive(s)||!s.policy.privateHousingEntry)return 0;
 const h=s.social.housing,z=s.social,f=s.firms[4];
 const target=housingNeed(s)*1.03,gap=Math.max(0,target-h.privateStock-h.publicStock);
 const rules={strict:.5,normal:1,flexible:1.5}[s.policy.housingRules];
 const yieldRate=h.lastPrivateRent*12/Math.max(h.privateBook*investmentPrice,1e-9),required=Math.max(.02,s.bank.lendingRate-s.expectedInflation)+z.assumptions.wear+.02*(1-s.institutions.contractReliability);
 const viable=clamp(yieldRate/Math.max(required,.01),0,2);
 const desired=(h.privateStock*z.assumptions.wear/12+gap*z.assumptions.constructionResponse/12)*h.constructionPerHome*rules*viable;
 return Math.max(0,Math.min(desired,(f.cash-committed-f.lastRevenue*.2)/Math.max(investmentPrice,1e-9)));
}
export function completeHousing(s,project){
 const h=s.social.housing,volume=project.amount*project.efficiency,homes=volume/h.constructionPerHome;
 if(project.public)h.publicStock+=homes;else{h.privateStock+=homes;h.privateBook+=volume;s.firms[4].capital+=volume;}
}
export function finishSocial(s,flow,privateBuild,publicBuild,investmentPrice,publicPrice=investmentPrice){
 if(!socialActive(s))return;
 const z=s.social;
 const targeted=(flow.territorialPrograms??[]).filter(row=>row.programme==='socialHousing'&&row.paid>0).map(row=>({
   amount:row.paid/publicPrice,public:true,territory:{id:row.territoryId,regionId:row.regionId},
 }));
 const otherPublic=Math.max(0,publicBuild-sum(targeted.map(project=>project.amount)));
 const projects=[{amount:privateBuild,public:false},{amount:otherPublic,public:true},...targeted];
 const due=s.month+Math.round(z.assumptions.housingMonths*({strict:1.3,normal:1,flexible:.8}[s.policy.housingRules]));
 for(const project of projects)if(project.amount>0)s.projects.push({type:'housing',...project,due,
   efficiency:project.public?s.institutions.investmentEfficiency:1,sector:4,legacy:false});
 const trainingPaid=flow.retraining??0;if(trainingPaid>0)z.training.push({people:Math.min(z.last.unemployed??0,trainingPaid/Math.max(z.pension.lastWage*3,1e-9)),due:s.month+z.assumptions.trainingMonths});
 z.housing.lastPrivateRent=z.last.privateRent;z.housing.publicReceipts=z.last.publicRent;
 z.last.privateConstruction=privateBuild*investmentPrice;z.last.publicConstruction=publicBuild*investmentPrice;
 z.history.push({month:s.month,pensions:flow.pensions??0,contributions:flow.socialContributions??0,unemployment:flow.unemploymentBenefits??0,privatePensionAssets:sum(z.privateAccounts),rentIndex:z.housing.rentIndex});z.history=z.history.slice(-240);
}
export function validateSocial(s){
 if(!socialActive(s)){if(s.social)throw new Error('Социальные счета не соответствуют ревизии');return;}
 const z=s.social,nonnegative=v=>Number.isFinite(v)&&v>=0;
 if(s.provenance.initialSocialTransferEnvelope!==undefined&&(!nonnegative(s.provenance.initialSocialTransferEnvelope)||s.provenance.initialSocialTransferEnvelope>20))throw new Error('Повреждён исходный социальный бюджет');
 if(!z||z.version!==1||!Number.isInteger(z.startedMonth)||z.startedMonth<0||z.startedMonth>s.month)throw new Error('Повреждены социальные счета');
 if(!z.assumptions||Object.values(z.assumptions).some(v=>!nonnegative(v)||v>120)||z.assumptions.housingMonths<1||z.assumptions.trainingMonths<1||!Array.isArray(z.training)||z.training.some(t=>!nonnegative(t.people)||!Number.isInteger(t.due)||t.due<=s.month)||!nonnegative(z.trainedMatch))throw new Error('Повреждены параметры социальной защиты');
 for(const key of ['privateAccounts','insuredMonths','contributionMonths'])if(!Array.isArray(z[key])||z[key].length!==10||z[key].some(v=>!nonnegative(v)))throw new Error('Повреждены частные социальные счета');
 for(const f of socialFunds(s))if(!nonnegative(f.cash)||!nonnegative(f.bankClaim))throw new Error('Повреждены резервы страховщика');
 if(z.investmentFund&&(!Array.isArray(z.investmentAccounts)||z.investmentAccounts.length!==10||z.investmentAccounts.some(x=>!nonnegative(x))||Math.abs(sum(z.investmentAccounts)-z.investmentFund.cash-z.investmentFund.bankClaim)>1e-6*Math.max(1,sum(z.investmentAccounts))))throw new Error('Повреждены инвестиционные счета');
 if(Math.abs(sum(z.privateAccounts)-z.pensionFund.cash-z.pensionFund.bankClaim)>1e-6*Math.max(1,sum(z.privateAccounts)))throw new Error('Активы пенсионного фонда не совпали с требованиями вкладчиков');
 if(!Array.isArray(z.unemployment)||z.unemployment.length!==10||z.unemployment.some(cs=>!Array.isArray(cs)||cs.length>63||cs.some(c=>!nonnegative(c.people)||!nonnegative(c.wage)||!Number.isInteger(c.months)||c.months<0||c.months>121||!nonnegative(c.covered)||c.covered>1||!nonnegative(c.privateCover)||c.privateCover>1)))throw new Error('Повреждены страховые периоды');
 if(['privateStock','publicStock','constructionPerHome','privateBook','rentIndex'].some(k=>!nonnegative(z.housing[k]))||z.housing.constructionPerHome===0||z.housing.rentIndex===0||!nonnegative(z.pension.retirees)||!Number.isFinite(z.pension.effectiveAge)||z.pension.effectiveAge<55||z.pension.effectiveAge>75||z.pension.benefit.length!==10||z.pension.benefit.some(v=>!nonnegative(v)))throw new Error('Повреждены жильё или пенсионные права');
}

// Aggregate voluntary medical insurance. Premiums and reimbursement are
// actual transfers within the existing household and bank-deposit ledgers.
export function settlePrivateHealthInsurance(s,plans,alpha,servicePrice){
 if((s.economy?.revision??0)<11||!s.social?.healthFund)return;
 const z=s.social,f=z.healthFund;
 for(const [i,h] of s.households.entries()){
  const participation=s.policy.privateHealthInsurance&&s.policy.privateHealthEntry?Math.min(.65,.08+i*.055):0;
  const premium=Math.min(Math.max(0,h.cash-h.income),Math.max(0,h.income)*.012*participation);
  h.cash-=premium;f.cash+=premium;z.last.healthPremium[i]=premium;
 }
 const claims=plans.map((p,i)=>{const participation=z.last.healthPremium[i]>0?Math.min(.65,.08+i*.055):0;return Math.max(0,p.health*alpha*servicePrice)*participation*.7;});
 const factor=Math.min(1,f.cash/Math.max(sum(claims),1e-12));
 claims.forEach((claim,i)=>{const paid=Math.min(f.cash,claim*factor);f.cash=Math.max(0,f.cash-paid);s.households[i].cash+=paid;z.last.healthReimbursement[i]=paid;});
}

// Secondary-market purchases transfer cash and existing bank ownership; they
// neither create a new share issue nor count as investment in physical GDP.
export function investPensionBankShares(s){
 if((s.economy?.revision??0)<11||!s.foundation||!s.social)return;
 const holders=s.foundation.bankClaims;
 for(const [f,target] of [[s.social.pensionFund,.30],[s.social.investmentFund,.50]]){
  if(!f)continue;const total=sum(holders),assets=f.cash+f.bankClaim,room=Math.max(0,assets*target-f.bankClaim);
  const amount=Math.min(room,f.cash*.1,total*.02);if(!(amount>0))continue;
  holders.forEach((claim,i)=>{const value=amount*claim/total;holders[i]-=value;s.households[i].cash+=value;});
  f.cash-=amount;f.bankClaim+=amount;
 }
 revaluePrivateAccounts(s);
}
