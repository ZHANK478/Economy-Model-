import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,advanceMonth,copy,replayJournal,exportSimulation,importSimulation,executePolitical} from '../src/engine.js';
import {newGameOptions} from '../src/start-presets.js';
import {makeElectorate,pollElectorate} from '../src/electorate.js';
import {createBill,enactBills,presidentialDecision} from '../src/legislation.js';
import {recordPolicyStances,recordPolicyImplementation,policyReputationUtility,initializePolicyReputation,validatePolicyReputation,lawResponsibility} from '../src/policy-reputation.js';
import {performanceExperience} from '../src/electoral-performance.js';
const start=()=>{const o=newGameOptions();o.politicalOptions.nameSeed=42;o.politicalOptions.livingWorld=false;return createSimulation({...o,defenseMode:false});};
const groups=s=>makeElectorate(s,{advanceMemory:false});
const fake=(s,patch={incomeTax:30})=>({id:900,sponsor:s.politics.majorPartyIds[1],patch,articles:Object.entries(patch).map(([key,value])=>({key,value,before:s.policy[key]})),votes:[],actions:[],constitutionPatch:{},status:'passed',kind:'ordinary'});
test('a tax position attracts some voters and repels others, repetition earns nothing and reputation persists',()=>{
 const s=start(),id=s.politics.executive.presidentParty,b=fake(s);recordPolicyStances(s,b,{decision:'accept'});
 const gs=groups(s),values=gs.map(g=>policyReputationUtility(s,g,id));assert.ok(values.some(x=>x>0));assert.ok(values.some(x=>x<0));
 const before=copy(s.politics.policyReputation);for(let i=0;i<40;i++)recordPolicyStances(s,b,{decision:'accept'});assert.deepEqual(s.politics.policyReputation,before);
 s.month+=36;assert.deepEqual(gs.map(g=>policyReputationUtility(s,g,id)),values);
 // Choosing the opposite position reverses the signal, not a universal veto bonus.
 const t=start();recordPolicyStances(t,fake(t),{decision:'reject'});for(let i=0;i<gs.length;i++)assert.equal(policyReputationUtility(t,gs[i],id),-values[i]||0);
});
test('conflicting public positions dilute a partisan reputation instead of accumulating accept bonuses',()=>{
 const s=start(),id=s.politics.executive.presidentParty,b=fake(s),g=groups(s).find(g=>g.ideal.economy>.6);
 recordPolicyStances(s,b,{decision:'accept'});const first=policyReputationUtility(s,g,id);recordPolicyStances(s,b,{decision:'reject'});assert.ok(Math.abs(policyReputationUtility(s,g,id))<Math.abs(first));
 assert.equal(Object.keys(s.politics.policyReputation.implementation).length,0);
});
test('final affirmative votes share responsibility; veto overridden is not implementation by the president',()=>{
 const s=start(),p=s.politics,own=p.executive.presidentParty,rival=p.majorPartyIds[1],ind=p.independentPartyId,b=fake(s);
 b.finalVote={parties:[{id:own,yes:20,no:20,abstain:0},{id:rival,yes:40,no:0,abstain:0},{id:ind,yes:20,no:20,abstain:0}]};
 let w=lawResponsibility(s,b);assert.ok(w[rival]>w[own]);assert.ok(w[ind]>0);assert.ok(Math.abs(Object.values(w).reduce((a,x)=>a+x,0)-1)<1e-12);
 b.vetoOverridden=true;b.presidentDecision={decision:'veto'};b.overrideVote={override:true,passed:true,parties:[{id:own,yes:0,no:40,abstain:0},{id:rival,yes:40,no:0,abstain:0},{id:ind,yes:40,no:0,abstain:0}]};
 w=lawResponsibility(s,b);assert.equal(w[own],undefined);recordPolicyImplementation(s,b);assert.equal(s.politics.policyReputation.implementation.incomeTax.contributions[own],undefined);validatePolicyReputation(s);
});
test('implementation starts only on enactment; reversal cancels credit and court-blocked laws get none',()=>{
 const s=start(),b=fake(s);s.politics.bills.push(b);recordPolicyStances(s,b,{decision:'accept'});assert.deepEqual(s.politics.policyReputation.implementation,{});
 enactBills(s,[]);const row=s.politics.policyReputation.implementation.incomeTax;assert.equal(row.current,30);assert.equal(b.status,'enacted');
 const inverse=fake(s,{incomeTax:row.baseline});inverse.id++;recordPolicyImplementation(s,inverse);assert.ok(Object.values(row.contributions).every(x=>Math.abs(x)<1e-10));validatePolicyReputation(s);
 const z=start(),blocked=fake(z,{incomeTax:30,freeMedia:false});z.politics.bills.push(blocked);enactBills(z,[]);assert.equal(blocked.status,'blockedByCourt');assert.deepEqual(z.politics.policyReputation.implementation,{});
});
test('political reputation never changes economic experience or household accounts',()=>{
 const s=start(),g=groups(s)[0],before=performanceExperience(s,g.income,g.id),households=copy(s.households);recordPolicyStances(s,fake(s),{decision:'reject'});recordPolicyImplementation(s,fake(s));assert.equal(performanceExperience(s,g.income,g.id),before);assert.deepEqual(s.households,households);
});
test('revision is saved, roundtrips, and new and migrated histories replay exactly',()=>{
 for(const legacy of [false,true]){
  const o=newGameOptions();o.politicalOptions.nameSeed=42;o.politicalOptions.livingWorld=false;if(legacy)delete o.politicalOptions.reputationRevision;
  let s=createSimulation({...o,defenseMode:false});executePolitical(s,{kind:'chooseLaw',patch:{incomeTax:16}});s=advanceMonth(s);
  executePolitical(s,{kind:'chooseLaw',patch:{education:3.5}});s=advanceMonth(s);validatePolicyReputation(s);
  const r=replayJournal(s);assert.deepEqual(r.politics,s.politics);assert.deepEqual(r.metrics,s.metrics);
  const loaded=importSimulation(exportSimulation(s));assert.deepEqual(advanceMonth(loaded),advanceMonth(s));
 }
});
test('activating the revision alone does not rewrite the current poll or history',()=>{
 const s=start();delete s.politics.policyReputation;const before=copy(s.politics.partyHistory),a=pollElectorate(s,{commitMemory:false,assignPoll:false}).poll;initializePolicyReputation(s);assert.deepEqual(pollElectorate(s,{commitMemory:false,assignPoll:false}).poll,a);assert.deepEqual(s.politics.partyHistory,before);
});
