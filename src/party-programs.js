import {treatyTariff} from './scenario-diplomacy.js';
import {defenseEconomyActive,DEFENSE_ECONOMY_KEYS} from './defense-economy.js';
import {socialActive,SOCIAL_KEYS} from './social-protection.js';
import {localGovernmentActive} from './local-government.js';
import {BASE_POLICY,POLICY_FIELDS,POLICY_CHECKS,POLICY_CHOICES} from './config.js';
import {clamp,hash,CB_KEYS} from './political-config.js';
import {regimeActive,REGIME_POLICY_KEYS} from './regime-dynamics.js';

// Synthetic party archetypes, not empirical estimates of universal positions.
// Every instrument has a preference; independence of the central bank limits
// legislative initiatives. Context adjusts preferences without enacting them.
export function partyPolicyTargets(s,party,numericFields=POLICY_FIELDS){
 const social=socialActive(s);
 const a=party.platform,{economy:e,liberty:l,culture:c,environment:v,decentralization:d,openness:o}=a;
 const family=party.independent?null:party.family,libertarian=family==='libertarian',authoritarian=l<-.5;
 const hawk=({national:1,conservative:.65,authoritarianLeft:.7,communist:.4,green:-.8,libertarian:-.65,socialist:-.3,socialDemocrat:-.1,liberal:0,centerRight:.35,centerLeft:-.1})[family]??clamp(-c*.6,-1,1);
 const war=Boolean(s.defense?.war),threat=Boolean(s.defense?.crisis),inflation=s.metrics.inflationYoY??5;
 const t={
  successionProcedure:authoritarian?(family==='communist'?'council':'designation'):'elections',
  eliteRecruitment:authoritarian?'personal':l>.5?'professional':'balanced',
  securityGovernance:family==='national'?'collegial':authoritarian?'parallel':'professional',
  censorshipScope:authoritarian?'blanket':'complaints',businessAccess:authoritarian?'connections':'open',
  protestResponse:authoritarian?'force':l>.5?'dialogue':'tolerate',
  rate:clamp(Math.max(0,inflation)+3+e*1.5,0,40),inflationTarget:4-e,
  reserveRequirement:7-2*e,bankCapitalRequirement:11-2*e,
  vat:17-2*e,incomeTax:20-9*e,incomeTaxProgressivity:.4-.35*e,corporateTax:26-11*e,
  researchBudget:libertarian?0:clamp(.3-.15*e+.2*v,0,2),taxAdministrationBudget:libertarian?.075:.125,
  royalty:24-12*e,tariff:Math.max(0,5-7*o),taxEnforcement:80,
  governmentConsumption:6-2*e,publicInvestment:4-1.5*e+v,
  militaryBudget:clamp(2+1.4*hawk+(war?2:threat?1:0),.5,7),
  defensePosture:war?'mobilization':threat?'alert':'routine',
  defensePriority:war||threat?'readiness':hawk>.5?'equipment':'balanced',
  transfers:4-3*e,education:3-.8*e+.5*l,healthcare:4-2*e,
  familyBenefits:1.3-.6*e-.6*c,childcareBudget:.7-.4*e+.3*c,
  agricultureProtection:clamp(.20-.15*e+(family==='green'?.25:0)+(family==='agrarian'?.35:0),0,1),
  businessSupport:Math.max(0,.6-.6*e-.3*o),minimumWage:110-35*e,
  parentalLeaveMonths:8-4*e,normalWorkweek:39+3*e,employmentProtection:2.5-2*e,
  corporateBondMarket:e>-.75,privateBusinessEntry:e>-.8,foreignBusinessEntry:o>-.6,fuelPricing:e<-.35?'regulated':'market',fuelTariff:95+10*e,
  energyTariff:95+10*e,energyPricing:e<-.35?'regulated':'market',
  fxIntervention:0,foreignBorrowingShare:clamp(25+15*o,0,80),
  stabilizationSaving:clamp(45+15*e+(s.metrics.debtRatio>80?10:0),0,100),
  registrationProcedures:clamp(4-2*e,1,20),antitrustBudget:libertarian?.025:.15-.05*e,
  courtBudget:.15+.1*Math.max(0,l),soeAuditBudget:.1,
  openProcurement:true,meritAppointments:!authoritarian,boardAutonomy:e>-.5,
  independentSoeAudit:!authoritarian,bankEntry:e>-.75,depositPortability:true,rateDisclosure:true,
  capitalControls:clamp(15-25*o-15*e,0,100),migrationOpenness:clamp(50+40*o,0,100),
  bankRescue:!libertarian,liquiditySupport:!libertarian,automaticRestructuring:true,
  monetaryRegime:libertarian?'freeBanking':e>.25?'rule':'discretion',
  bargainingSystem:e<-.4?'coordinated':e<.15?'sector':'firm',
  infrastructurePricing:e<0?'capped':'market',privateInfrastructureEntry:e>-.7,
  concessionEntry:e>-.55,privateHealthEntry:e>-.6,privateEducationEntry:e>-.6,cooperativeEntry:true,
  localElections:l>-.5,localAdministrationBudget:.05+.025*Math.max(0,d),municipalServicesShare:clamp(35+40*d,0,100),
  infrastructureMaintenance:1,municipalInvestmentShare:clamp(35+40*d,0,100),
  concessionGuarantee:libertarian?0:e>0?15:0,infrastructureFeeCap:100+20*e,
  associationFreedom:!authoritarian,collectiveBargaining:e<.85&&!authoritarian,
  strikeRights:e<.85&&!authoritarian,workerRepresentation:e<.1&&!authoritarian,
  protectedJudges:l>-.2,judicialReview:l>-.2,freeMedia:l>-.2,
  competitiveElections:l>-.5,parliamentOversight:l>-.35,publicDisclosure:!authoritarian,
  meritCivilService:!authoritarian,electionAdministration:.15,securityBudget:.4+.5*Math.max(0,-l),patronageBudget:authoritarian?.3:0
 };
 if(social)Object.assign(t,{
  socialHousingBudget:clamp(.5-.5*e,0,2),housingAllowance:clamp(.4-.3*e,0,2),housingRules:e>.1?'flexible':'normal',privateHousingEntry:e>-.8,
  retirementAge:65+2*e,pensionContribution:8-4*e,pensionIndexation:e<0?'wages':'prices',privatePensions:e>-.7,
  unemploymentReplacement:45-20*e,unemploymentDuration:9-5*e,retrainingBudget:.15+.1*l,privateUnemploymentInsurance:e>-.7,transfers:(4-3*e)*.3
 });
 if((s.economy?.revision??0)>=11)t.privateHealthInsurance=e>-.65;
 if(defenseEconomyActive(s))Object.assign(t,{defenseService:hawk>.4?'mixed':'contract',defenseProcurement:o<-.25?'domestic':'mixed',defensePersonnelTarget:clamp(4+hawk*2,0,30),defenseSalary:clamp(120+15*hawk,50,250)});
 for(const key of DEFENSE_ECONOMY_KEYS)t[key]??=BASE_POLICY[key];
 // Intervention is a response to an observed currency shortage, scaled to the
 // country's economy; a party does not sell unlimited reserves by doctrine.
 if((s.metrics.reservesUSD??0)>0&&inflation>15&&e<.4)t.fxIntervention=Math.min(50,s.base.monthlyGDP/100);
 for(const key of SOCIAL_KEYS)t[key]??=BASE_POLICY[key];
 for(const f of numericFields){if(!social&&SOCIAL_KEYS.includes(f[0]))continue;t[f[0]]??=BASE_POLICY[f[0]];t[f[0]]=clamp(Math.round(t[f[0]]/f[4])*f[4],f[2],f[3]);}
 return t;
}
const programTopics=new Map([
 ...POLICY_CHOICES.map(([key,,topic])=>[key,topic]),
 ...POLICY_CHECKS.map(([key,,topic])=>[key,topic]),
 ...POLICY_FIELDS.map(([key,,,,,,topic])=>[key,topic]),
 ...['militaryBudget','defensePosture','defensePriority',...DEFENSE_ECONOMY_KEYS].map(key=>[key,'Армия']),
]);
export function programTopic(key){return programTopics.get(key)??'Собственность';}
export function programAlignment(s,party,bill){
 const targets=partyPolicyTargets(s,party),base={...s.policy,...Object.fromEntries((bill.articles??[]).filter(a=>a.key in BASE_POLICY).map(a=>[a.key,a.before??s.policy[a.key]]))};
 let total=0,count=0;
 for(const [key,next] of Object.entries(bill.patch??{})){
  const before=base[key],target=targets[key];if(before===next)continue;
  const f=POLICY_FIELDS.find(f=>f[0]===key);
  if(f){const scale=Math.max(f[4]*4,(f[3]-f[2])*.15);total+=clamp((Math.abs(before-target)-Math.abs(next-target))/scale,-1,1)*.18;}
  else total+=((before===target?1:0)-(next===target?1:0))*-.14;
  count++;
 }
 for(const action of bill.actions??[]){
  const market=['privatize','foreignSale','networkSale'].includes(action.kind),publicOwner=['purchase','nationalize','networkPurchase'].includes(action.kind),local=['municipalize','networkMunicipalize'].includes(action.kind);
  if(market||publicOwner||local||action.kind==='cooperatize'){
   const a=party.platform;total+=(local?a.decentralization:action.kind==='cooperatize'?-a.economy:market?a.economy:-a.economy)*.16;count++;
  }
 }
 for(const [key,next] of Object.entries(bill.constitutionPatch??{})){
  if(['independentCB','dissolution','presidentialVeto','termLimit','constitutionalReferendum'].includes(key)){
   const target=key==='independentCB'?party.platform.economy>-.5:key==='termLimit'?2:key==='presidentialVeto'?party.platform.liberty<.3:key==='constitutionalReferendum'?party.platform.decentralization>.4:true;
   total+=((s.politics.constitution[key]===target?1:0)-(next===target?1:0))*-.14;count++;
  }
 }
 return clamp(count?total/Math.sqrt(count):0,-.18,.18);
}
export function programCandidates(s,party,current){
 const targets=partyPolicyTargets(s,party),result=[];
 for(const [key,target] of Object.entries(targets)){
  if(key==='tariff'&&treatyTariff(s)!==undefined)continue;
  if(REGIME_POLICY_KEYS.includes(key)&&!regimeActive(s))continue;
  if(DEFENSE_ECONOMY_KEYS.includes(key)&&!defenseEconomyActive(s))continue;
  if(SOCIAL_KEYS.includes(key)&&!socialActive(s))continue;
  if((s.economy?.revision??0)<6&&['researchBudget','taxAdministrationBudget'].includes(key))continue;
  if((s.economy?.revision??0)>=6&&key==='taxEnforcement')continue;
  if(!localGovernmentActive(s)&&['municipalServicesShare','localAdministrationBudget','localElections'].includes(key))continue;
  if(s.politics.constitution.independentCB&&CB_KEYS.includes(key))continue;
  if(!s.resourceMode&&['royalty','stabilizationSaving'].includes(key))continue;
  if(!s.defense?.enabled&&['militaryBudget','defensePriority','defensePosture'].includes(key))continue;
  if(key==='energyTariff'&&current.energyPricing!=='regulated'||key==='infrastructureFeeCap'&&current.infrastructurePricing!=='capped')continue;
  const f=POLICY_FIELDS.find(f=>f[0]===key),check=POLICY_CHECKS.find(f=>f[0]===key),choice=POLICY_CHOICES.find(f=>f[0]===key);
  let value=target;
  if(f){
   const gap=target-current[key];if(Math.abs(gap)<f[4]*.9)continue;
   const size=Math.max(f[4],Math.min(f[4]*2,(f[3]-f[2])*.05));
   value=clamp(Math.round((current[key]+Math.sign(gap)*Math.min(Math.abs(gap),size))/f[4])*f[4],f[2],f[3]);value=Number(value.toFixed(4));
  }else if(current[key]===target)continue;
  result.push({key,value,label:f?.[1]??check?.[1]??choice?.[1],topic:programTopic(key)});
 }
 // Paid transfers of ownership; these use the same legal and financing checks
 // as player bills. No expropriation, extra money or instant shares are created.
 const e=party.platform.economy,d=party.platform.decentralization;
 for(const [i,f] of s.firms.entries()){
  const goal=clamp(.35-.5*e,0,.9),state=f.ownership.state;
  const kind=state>goal+.08?'privatize':state<goal-.08?'purchase':null;
  if(kind)result.push({key:'ownership.'+i,label:(kind==='privatize'?'Приватизация: ':'Государственный выкуп: ')+f.name,topic:'Собственность',actions:[{id:s.nextActionId,kind,sector:i,points:5,compensation:1}]});
  if(e<-.5&&f.ownership.state>.1&&current.cooperativeEntry)result.push({key:'cooperative.'+i,label:'Выкуп работниками: '+f.name,topic:'Собственность',actions:[{id:s.nextActionId1,kind:'cooperatize',sector:i,points:5,compensation:1}]});
 }
 for(const [i,n] of (s.networks??[]).entries()){
  const total=n.public+n.municipal+n.private+n.concession;if(!total)continue;
  const kind=d>.6&&n.public/total>.2?'networkMunicipalize':e>.3&&n.public/total>.3?'networkSale':e<-.3&&n.private/total>.1?'networkPurchase':null;
  if(kind)result.push({key:'network.'+n.id,label:(kind==='networkSale'?'Продажа инфраструктуры: ':kind==='networkPurchase'?'Выкуп инфраструктуры: ':'Муниципальная инфраструктура: ')+n.name,topic:'Собственность',actions:[{id:s.nextActionId,kind,network:n.id,points:5}]});
 }
 return result;
}
export function chooseProgramArticle(s,party,articles){
 const history=s.politics.bills.filter(b=>b.monthlyInitiative&&b.sponsor===party.id&&b.programTopic);
 const lastTopic=topic=>history.findLast(b=>b.programTopic===topic)?.month??-1000;
 const lastKey=key=>history.findLast(b=>b.programKey===key)?.month??-1000;
 const urgency=x=>x.topic==='Армия'&&(s.defense?.war||s.defense?.crisis)?3:0;
 return articles.slice().sort((a,b)=>(lastTopic(a.topic)-urgency(a)*12)-(lastTopic(b.topic)-urgency(b)*12)||(socialActive(s)?history.findLastIndex(x=>x.programTopic===a.topic)-history.findLastIndex(x=>x.programTopic===b.topic):0)||lastKey(a.key)-lastKey(b.key)||hash(s.politics.nameSeed??s.seed,party.id,s.month,a.key)-hash(s.politics.nameSeed??s.seed,party.id,s.month,b.key))[0];
}
