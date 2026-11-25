import {POLICY_FIELDS} from './config.js';
import {partyPolicyTargets,programTopic} from './party-programs.js';
import {clamp,clone} from './political-config.js';

// An issue record, not a pile of popularity bonuses. Parameters are explicit
// scenario assumptions, not estimated effects from the studies in the report.
export const REPUTATION_KEYS=new Set(['vat','incomeTax','incomeTaxProgressivity','corporateTax','royalty','tariff','governmentConsumption','transfers','familyBenefits','childcareBudget','healthcare','education','infrastructureMaintenance','publicInvestment','minimumWage','militaryBudget','socialHousingBudget','housingAllowance','retirementAge','pensionContribution','unemploymentReplacement','unemploymentDuration','retrainingBudget','researchBudget','taxAdministrationBudget']);
const reputationFields=POLICY_FIELDS.filter(([key])=>REPUTATION_KEYS.has(key));
const fields=new Map(reputationFields.map(f=>[f[0],f]));
const scale=key=>{const f=fields.get(key);return Math.max(f[4]*4,(f[3]-f[2])*.15);};
export const reputationActive=s=>s.politics?.policyReputation?.revision===1;
export function initializePolicyReputation(s){
 if(!s.politics.enabled||reputationActive(s))return;
 s.politics.policyReputation={revision:1,startedMonth:s.month,positions:{},implementation:{},assumptions:{positionWeight:.32,implementationWeight:.24,signalsPerIssue:8,proposalShare:.5,voteShare:.3,signatureShare:.2},status:'policy preferences and legislative responsibility; not causal GDP attribution'};
}
const patchEntries=b=>Object.entries(b.patch??{}).filter(([k,v])=>REPUTATION_KEYS.has(k)&&Number.isFinite(v));
function beforeValue(s,b,key){return b.articles?.find(a=>a.key===key)?.before??s.politics.lawPolicy[key]??s.policy[key];}
function observe(s,id,key,before,next,stance,clarity){
 if(!id||!Number.isFinite(before)||before===next||Math.abs(stance)<1e-12)return;
 const r=s.politics.policyReputation,party=r.positions[id]??=( {} ),row=party[key]??={signals:[]};
 const signal={before,next,stance:clamp(stance,-1,1),clarity:clamp(clarity),month:s.month};
 // Re-submitting an identical proposal or veto cannot reinforce the signal.
 const duplicate=row.signals.find(x=>x.before===before&&x.next===next&&x.stance===signal.stance);
 if(duplicate){duplicate.clarity=Math.max(duplicate.clarity,signal.clarity);return;}
 row.signals.push(signal);if(row.signals.length>r.assumptions.signalsPerIssue)row.signals.shift();
}
export function recordPolicyStances(s,b,{decision=null,vote=null,article=null}={}){
 if(!reputationActive(s))return;
 if(decision&&!vote)vote=b.finalVote;
 const p=s.politics,entries=patchEntries(b).filter(([k])=>!article||article.key===k);
 for(const [key,next] of entries){const before=beforeValue(s,b,key);
  observe(s,b.sponsor,key,before,next,1,.7);
  for(const x of vote?.parties??[]){const total=x.yes+x.no+x.abstain;if(total)observe(s,x.id,key,before,next,(x.yes-x.no)/total,.8);}
  // President's signature and veto are observable choices, even when overridden.
  if(decision&&p.executive.role==='president')observe(s,p.executive.presidentParty,key,before,next,decision==='accept'?1:decision==='reject'?-1:0,1);
 }
}
export function lawResponsibility(s,b){
 const p=s.politics,k=p.policyReputation.assumptions,weights={};
 const add=(id,n)=>{if(id&&n>0)weights[id]=(weights[id]??0)+n;};
 const vote=b.overrideVote?.passed?b.overrideVote:[...(b.votes??[])].reverse().find(v=>v.override&&v.passed)??b.finalVote;
 const overridden=Boolean(b.vetoOverridden||vote?.override&&vote.passed);
 add(b.sponsor,k.proposalShare);
 const yes=(vote?.parties??[]).reduce((n,x)=>n+x.yes,0);
 for(const x of vote?.parties??[])if(yes)add(x.id,k.voteShare*x.yes/yes);
 // Do not give implementation credit to a vetoing president. Decrees have
 // no fictitious parliamentary supporters. Remaining shares are normalized.
 const response=b.presidentDecision?.decision??b.executiveResponse?.decision;
 if(p.constitution.form!=='parliamentary'&&!overridden&&!['reject','veto','vetoed'].includes(response))add(p.executive.presidentParty,k.signatureShare);
 const total=Object.values(weights).reduce((a,x)=>a+x,0);
 return Object.fromEntries(Object.entries(weights).map(([id,x])=>[id,x/total]));
}
export function recordPolicyImplementation(s,b){
 if(!reputationActive(s))return;
 const r=s.politics.policyReputation,weights=lawResponsibility(s,b);b.policyResponsibility={month:s.month,weights:clone(weights),basis:'proposal, affirmative final votes, signature; actual enactment'};
 for(const [key,next] of patchEntries(b)){
  const before=s.politics.lawPolicy[key]??s.policy[key];if(!Number.isFinite(before)||before===next)continue;
  const row=r.implementation[key]??={baseline:before,current:before,contributions:{}};
  let movement=next-row.current;
  // Reversals first unwind the old stock proportionally: a cut/increase cycle
  // cannot leave implementation credit after policy returns to its baseline.
  const opposite=Object.entries(row.contributions).filter(([,x])=>x*movement<0),available=opposite.reduce((n,[,x])=>n+Math.abs(x),0),cancel=Math.min(Math.abs(movement),available);
  if(available)for(const [id,x] of opposite)row.contributions[id]=x*(1-cancel/available)||0;
  movement-=Math.sign(movement)*cancel;
  for(const [id,w] of Object.entries(weights))row.contributions[id]=(row.contributions[id]??0)+movement*w||0;
  row.current=next;row.billId=b.id;row.month=s.month;
 }
}
const targetCache=new WeakMap();
function targets(s,g){let cached=targetCache.get(g);if(!cached){cached=partyPolicyTargets(s,{platform:g.ideal,family:null},reputationFields);targetCache.set(g,cached);}return cached;}
const proximity=(key,target,before,next)=>clamp((Math.abs(before-target)-Math.abs(next-target))/scale(key),-1,1);
function themeScore(rows){const themes=new Map();for(const [key,value] of rows){const name=programTopic(key),row=themes.get(name)??{sum:0,n:0};row.sum+=value;row.n++;themes.set(name,row);}return [...themes.values()].reduce((n,x)=>n+x.sum/x.n,0)/3;}
export function policyReputationUtility(s,g,id,kind='positions'){
 if(!reputationActive(s)||!id)return 0;
 const r=s.politics.policyReputation,positions=kind==='positions';
 const entries=Object.entries((positions?r.positions[id]:r.implementation)??{});
 if(!entries.length||!positions&&entries.every(([,row])=>!row.contributions[id]))return 0;
 const t=targets(s,g),rows=[];
 if(positions){
  for(const [key,row] of entries){
   let n=0,d=0;row.signals.forEach((x,i)=>{const w=Math.pow(.7,row.signals.length-1-i);n+=w*x.clarity*x.stance*proximity(key,t[key],x.before,x.next);d+=w;});
   rows.push([key,d?n/d:0]);
  }
 }else for(const [key,row] of entries){
  const net=row.current-row.baseline,share=Math.abs(net)>1e-10?(row.contributions[id]??0)/net:0;
  rows.push([key,share*proximity(key,t[key],row.baseline,row.current)]);
 }
 return (kind==='positions'?r.assumptions.positionWeight:r.assumptions.implementationWeight)*Math.tanh(themeScore(rows));
}
export function validatePolicyReputation(s){
 const r=s.politics?.policyReputation;if(r===undefined)return;
 if(r.revision!==1||!Number.isInteger(r.startedMonth)||r.startedMonth>s.month||!r.positions||!r.implementation||!r.assumptions)throw new Error('Повреждена политическая репутация');
 const finite=x=>{if(!Number.isFinite(x))throw new Error('Недопустимое число политической репутации');};
 for(const x of Object.values(r.assumptions))finite(x);
 for(const party of Object.values(r.positions))for(const [key,row] of Object.entries(party)){
  if(!REPUTATION_KEYS.has(key)||!Array.isArray(row.signals)||row.signals.length>8)throw new Error('Повреждена история позиции');
  for(const x of row.signals){for(const v of Object.values(x))finite(v);if(Math.abs(x.stance)>1||x.clarity<0||x.clarity>1||x.month>s.month)throw new Error('Повреждена позиция');}
 }
 for(const [key,row] of Object.entries(r.implementation)){
  if(!REPUTATION_KEYS.has(key)||!row.contributions)throw new Error('Повреждена ответственность за закон');
  for(const v of [row.baseline,row.current,...Object.values(row.contributions)])finite(v);
  if(Math.abs(Object.values(row.contributions).reduce((a,x)=>a+x,0)-(row.current-row.baseline))>1e-7)throw new Error('Не сходятся доли ответственности за закон');
 }
}
