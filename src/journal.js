const clone=x=>JSON.parse(JSON.stringify(x));
export const changesBetween=(a,b)=>Object.keys(b).filter(k=>JSON.stringify(a?.[k])!==JSON.stringify(b[k])).map(key=>({key,from:a?.[key]??null,to:clone(b[key])}));
export function initializeJournal(s) {
  s.journal=[];s.pendingActions=[];s.nextActionId=1;s.pendingNote='';
  s.provenance={version:s.version,seed:s.seed,resourceMode:s.resourceMode,modelProfile:s.modelProfile,
    initialPolicy:clone(s.policy),initialParameters:clone(s.parameters),initialWorld:clone(s.world),initialStochastic:s.stochastic,coverageStartMonth:0};
}
export function appendJournal(s,prev,actions,effectiveWorld) {
  const before=s.journal.at(-1);
  s.journal.push({month:s.month,decisionMonth:prev.month,version:s.version,
    requestedPolicy:clone(s.requestedPolicy??s.policy),policyReview:clone(s.politics.lastReview),
    policy:clone(s.policy),policyChanges:changesBetween(before?.policy??s.provenance.initialPolicy,s.policy),
    parameters:clone(s.parameters),parameterChanges:changesBetween(before?.parameters??s.provenance.initialParameters,s.parameters),
    world:clone(s.world),worldChanges:changesBetween(before?.world??s.provenance.initialWorld,s.world),
    stochastic:s.stochastic,shocks:clone(s.shocks),effectiveWorld:clone(effectiveWorld),
    actions:clone(actions),submittedActions:clone(s.politics.enabled?s.politics.lastSubmittedActions:prev.pendingActions),nextActionId:prev.nextActionId,
    politicalCommands:clone(s.politics.enabled?s.politics.lastCommands:[]),nextCommandId:s.politics.nextCommandId??null,
    politicalResults:clone(s.politics.enabled?s.politics.lastActions:[]),politicalElections:clone(s.politics.elections.filter(e=>e.month===s.month)),
    politicalRollCalls:clone(s.politics.enabled?s.politics.rollCalls.filter(e=>e.month===s.month):[]),
    politicalState:s.politics.enabled?{role:s.politics.executive.role,inOffice:s.politics.executive.inOffice,coalition:clone(s.politics.coalition),constitution:clone(s.politics.constitution),parameters:clone(s.politics.parameters),partyPrograms:s.politics.parties.map(x=>({id:x.id,platform:clone(x.platform)}))}:null,
    note:s.pendingNote,events:clone(s.lastReport.events),outcome:clone(s.metrics)});
  s.pendingNote='';s.pendingActions=[];
}
