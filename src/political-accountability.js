import {reputationActive,REPUTATION_KEYS,recordPolicyStances} from './policy-reputation.js';
import {performanceActive,MATERIAL_KEYS} from './electoral-performance.js';
import {parliamentary} from './parliamentary-state.js';
import {programAlignment} from './party-programs.js';
import {AXES,clamp,hash} from './political-config.js';

// Revision is explicit: historical saves/replays keep their original equations
// until the recorded upgrade command. These are bounded gameplay assumptions,
// not estimated electoral effects or probabilities from real-world surveys.
export const accountable=s=>s.politics?.accountabilityRevision===1;
export const presidential=s=>accountable(s)&&s.politics.constitution.form==='presidential';
export function independentPlatform(s,member){
 const axes=[[-.65,.7,.3,.3,.6,.2],[.65,.65,.1,.1,.6,.6],[.1,.2,-.6,0,.7,-.2]];
 const group=Math.floor(hash(s.seed,'independent-view',member.id)*axes.length);
 return Object.fromEntries(AXES.map((key,i)=>[key,axes[group][i]]));
}
export function clearPresidentialCoalition(s){
 if(!presidential(s))return;
 const p=s.politics;p.coalition=[];p.coalitionAgreements=[];p.executive.formationDeadline=null;
 for(const x of p.parties){x.cabinetPosts=0;x.coalitionGrievance=0;}
 p.parliamentSupport=(p.parties.find(x=>x.id===p.executive.playerParty)?.seats??0)/Math.max(1,p.totalSeats);
}
export function activateAccountability(s){
 const p=s.politics;if(accountable(s))return;
 p.accountabilityRevision=1;
 for(const h of p.economicHistory??[]){h.unemployment??=s.metrics.unemployment;h.inflation??=s.metrics.inflationYoY;}
 for(const x of p.parties){x.promises=[];x.brokenPromises=0;}
 clearPresidentialCoalition(s);
}
// Directional reactions reflect policy content and beneficiary groups, never
// a reward for clicking Accept. Fiscal/income consequences still run through
// the economic engine in subsequent months. A single decision is capped.
export function groupBillImpact(s,g,bill){
 const base=Object.fromEntries((bill.articles??[]).filter(a=>a.key in s.policy).map(a=>[a.key,a.before??s.policy[a.key]]));
 let value=0;const economy=g.ideal.economy,low=1-g.income/4,high=g.income/4;
 for(const [key,next] of Object.entries(bill.patch??{})){
  const before=base[key]??s.policy[key];if(before===next)continue;
  const delta=typeof next==='number'?(next-before):Number(next)-Number(before);
  if(['incomeTax','corporateTax','vat','tariff'].includes(key))value+=-delta/20*(.5+.6*economy+(key==='corporateTax'?.6*high:key==='vat'?.25*low:.2*high));
  else if(['transfers','familyBenefits','childcareBudget'].includes(key))value+=delta/5*(.3+low-.5*economy);
  else if(['healthcare','education','infrastructureMaintenance','publicInvestment'].includes(key))value+=delta/6*(.55+.6*low-.65*economy);
  else if(['freeMedia','protectedJudges','judicialReview','associationFreedom','competitiveElections','parliamentOversight','publicDisclosure','openProcurement','meritCivilService'].includes(key))value+=delta*.12*(.5+g.ideal.liberty);
  else if(key==='migrationOpenness')value+=delta/100*g.ideal.openness;
  else if(key==='capitalControls')value-=delta/100*g.ideal.openness;
  else if(key==='minimumWage')value+=delta/200*(low-.4*economy);
  else if(key==='militaryBudget')value+=delta/10*(-g.ideal.culture+.15)-Math.abs(delta)/60;
 }
 for(const a of bill.actions??[])if(['privatize','nationalize','cooperatize','municipalize','networkSale','networkPurchase','networkMunicipalize'].includes(a.kind)){
  const direction=['privatize','networkSale'].includes(a.kind)?1:['municipalize','networkMunicipalize'].includes(a.kind)?0:-1;
  value+=direction*.05*economy*Math.min(1,(a.points??0)/20)+(direction===0?.04*g.ideal.decentralization:0);
 }
 for(const [key,next] of Object.entries(bill.constitutionPatch??{}))if(['termLimit','presidentialVeto','independentCB'].includes(key)){
  const old=s.politics.constitution[key];value+=(key==='termLimit'?Number(next>0)-Number(old>0):key==='presidentialVeto'?Number(old)-Number(next):Number(next)-Number(old))*.08*g.ideal.liberty;
 }
 return clamp(value,-.18,.18);
}
export function decisionUtility(s,g,partyId=null){
 if(!accountable(s))return 0;
 const revised=performanceActive(s),v=s.politics.performanceVoting;
 const events=revised?[...v.legacyDecisionEvents,...s.politics.publicEvents.filter(e=>e.month>=v.startedMonth&&e.performanceRevision===1)]:s.politics.publicEvents;
 return clamp(events.filter(e=>e.type==='decision').reduce((sum,e)=>{
  const effect=e.effects[g.id]??0,weight=e.partyWeights?(partyId===null?(e.cabinetWeight??0):(e.partyWeights[partyId]??0)):partyId===null?e.presidentWeight:partyId===e.presidentParty?e.presidentWeight:partyId===e.sponsor?e.sponsorWeight:0;
  return sum+effect*weight*Math.exp(-((revised&&e.performanceRevision!==1?v.startedMonth:s.month)-e.month)/18);
 },0),-.6,.6);
}
export function decisionAudience(s,bill,groups){
 const rows=Array.from({length:5},(_,i)=>({label:['Низкие доходы','Доходы ниже среднего','Средние доходы','Доходы выше среднего','Высокие доходы'][i],income:i,total:0,impact:0}));
 for(const g of groups){rows[g.income].total+=g.weight;rows[g.income].impact+=g.weight*groupBillImpact(s,g,bill);}
 return rows.map(r=>({...r,impact:r.impact/Math.max(.001,r.total)}));
}
export function partyBillAlignment(s,party,bill){
 if(s.politics.partyProgramRevision===1)return programAlignment(s,party,bill);
 const g={income:2,ideal:party.platform};return groupBillImpact(s,g,bill);
}
export function recordDecision(s,bill,decision,groups){
 if(!accountable(s)||bill.publicReaction||!['accept','reject',...(parliamentary(s)?['abstain']:[])].includes(decision))return;
 recordPolicyStances(s,bill,{decision});
 const passed=['passed','enacted'].includes(bill.status),refused=decision==='reject';
 if(parliamentary(s)){
  const p=s.politics,stance=decision==='accept'?1:decision==='reject'?-1:0,effects=Object.fromEntries(groups.map(g=>[g.id,groupBillImpact(s,g,performanceActive(s)?{...bill,patch:Object.fromEntries(Object.entries(bill.patch).filter(([key])=>!MATERIAL_KEYS.has(key)&&!(reputationActive(s)&&REPUTATION_KEYS.has(key))))}:bill)]));
  const partyWeights={[p.executive.playerParty]:stance*.5};
  if(bill.sponsor!==p.executive.playerParty)partyWeights[bill.sponsor]=.4;
  p.publicEvents.push({month:s.month,type:'decision',...(performanceActive(s)?{performanceRevision:1}:{}),billId:bill.id,effects,partyWeights,presidentWeight:0,sponsorWeight:0,cabinetWeight:passed?1:0,region:null,effect:0,attention:0});
  bill.publicReaction={decision,passed,audiences:decisionAudience(s,performanceActive(s)?{...bill,patch:Object.fromEntries(Object.entries(bill.patch).filter(([key])=>!MATERIAL_KEYS.has(key)&&!(reputationActive(s)&&REPUTATION_KEYS.has(key))))}:bill,groups),summary:passed?'Закон принят. Ваша фракция '+(stance>0?'поддержала':stance<0?'отклонила':'воздержалась при голосовании по')+' проект.':'Парламент отклонил законопроект.'};return;
 }

 // A failed vote delivers no law and must not be credited as enacted policy.
 if(!passed&&!refused){bill.publicReaction={decision,passed:false,effect:0,summary:'Парламент отклонил проект: закон не вступит в силу.'};return;}
 const sign=refused?-1:1,p=s.politics;
 if(bill.monthlyInitiative&&!bill.partyReaction){const x=p.parties.find(x=>x.id===bill.sponsor);if(x&&!x.independent){const before=x.executiveLoyalty??.5;x.executiveLoyalty=clamp(before+(refused?-.14:.1));bill.partyReaction={partyId:x.id,decision,before,after:x.executiveLoyalty,delta:x.executiveLoyalty-before};p.lastActions.push({kind:'initiativeResponse',billId:bill.id,...bill.partyReaction});}}
 // Other parties judge the substance too; vetoing an opponent's proposal
 // is not automatically a betrayal of your own party (or a popularity loss).
 bill.contentReactions=[];
 for(const x of p.parties.filter(x=>x.active&&!x.independent)){
  if(bill.monthlyInitiative&&x.id===bill.sponsor)continue;
  const before=x.executiveLoyalty??.5,delta=clamp(sign*partyBillAlignment(s,x,bill)*.8,-.08,.08);
  x.executiveLoyalty=clamp(before+delta);bill.contentReactions.push({partyId:x.id,before,after:x.executiveLoyalty,delta:x.executiveLoyalty-before});
 }
 const material=performanceActive(s);
 const evaluated=material?{...bill,patch:Object.fromEntries(Object.entries(bill.patch).filter(([key])=>!MATERIAL_KEYS.has(key)&&!(reputationActive(s)&&REPUTATION_KEYS.has(key))))}:bill;
 const effects=Object.fromEntries(groups.map(g=>[g.id,(sign*groupBillImpact(s,g,evaluated)||0)]));
 const presidentWeight=1,sponsorWeight=bill.sponsor===p.executive.playerParty?0:(passed?.4:-.15);
 p.publicEvents.push({month:s.month,type:'decision',...(performanceActive(s)?{performanceRevision:1}:{}),billId:bill.id,presidentParty:p.executive.presidentParty,sponsor:bill.sponsor,presidentWeight,sponsorWeight,effects,region:null,effect:0,attention:0});
 bill.publicReaction={decision,passed,audiences:decisionAudience(s,performanceActive(s)?{...bill,patch:Object.fromEntries(Object.entries(bill.patch).filter(([key])=>!MATERIAL_KEYS.has(key)&&!(reputationActive(s)&&REPUTATION_KEYS.has(key))))}:bill,groups).map(r=>({label:r.label,impact:sign*r.impact||0})),summary:refused?(p.parties.find(x=>x.id===bill.sponsor)?.independent?'Избиратели оценивают содержание вето.':'Избиратели оценивают содержание вето; отношения с автором инициативы ухудшаются.'):'Избиратели оценивают содержание закона; экономические последствия появятся после его вступления в силу.'};
}
