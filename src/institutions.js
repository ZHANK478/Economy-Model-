// These are synthetic service/contestability proxies, NOT observed governance,
// concentration or corruption indices. See docs/INSTITUTIONS.md for assumptions.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const total=a=>a.reduce((v,x)=>v+x,0);
export const INSTITUTION_REFERENCE_BUDGETS={antitrustBudget:.05,courtBudget:.08,soeAuditBudget:.025};

export function initializeInstitutions(s) {
  Object.assign(s.institutions,{antitrustCapacity:.65,courtCapacity:.65,soeAuditCapacity:.65,
    contractReliability:.65,registrationDays:18,contractDelayDays:180,bankContestability:.60});
  s.base.initialPublicCapital=total(s.firms.map(f=>f.capital*f.ownership.state));
}

// Rules use previously accumulated capacity. Today's promised budget cannot
// improve today's outcomes: new services are paid later in the monthly ledger.
export function advanceInstitutionOutcomes(s) {
  const i=s.institutions,p=s.policy,k=s.parameters;
  i.registrationDays=p.registrationProcedures*(2+.65/Math.max(i.antitrustCapacity,.05));
  i.contractDelayDays=180*.65/Math.max(i.courtCapacity,.05)*(1+i.ownershipRisk);
  i.contractReliability=clamp(i.courtCapacity*(1-i.ownershipRisk),0,.98);
  const entryBarrier=Math.log(18/Math.max(i.registrationDays,1));
  const target=clamp(.60+k.entryCompetitionElasticity*entryBarrier
    +k.antitrustEffectiveness*(i.antitrustCapacity-.65)
    +k.procurementCompetitionEffect*Number(p.openProcurement)*i.contractReliability/.65,.05,.98);
  i.competition+=k.competitionAdjustment*(target-i.competition);
  // One consolidated bank remains: this estimates ease of switching/entry,
  // not HHI or the number of competitors. Entry is conditional on profitability,
  // credibility, property reliability and the health of the banking system.
  const viability=clamp(1-s.bank.npl/.30,0,1)*clamp(i.confidence/.68,0,1)
    *clamp(i.contractReliability/.65,0,1);
  const bankingTarget=clamp(.30+.20*Number(p.bankEntry)*viability
    +.15*Number(p.depositPortability)*viability+.13*Number(p.rateDisclosure),.05,.95);
  i.bankContestability+=k.bankContestabilityAdjustment*(bankingTarget-i.bankContestability);
}

// The public/private label alone carries no productivity bonus or penalty.
// Public appointment/autonomy rules are effective only to the extent audited
// and enforceable; private governance responds to the same market/legal context.
export function governanceTarget(s,f) {
  const i=s.institutions,p=s.policy;
  const accountability=i.soeAuditCapacity*Number(p.independentSoeAudit)
    *clamp(i.contractReliability/.65,0,1);
  const ruleExecution=accountability/.65*(.5*Number(p.meritAppointments)+Number(p.boardAutonomy)/3+1/6);
  const publicGovernance=.65+s.parameters.publicAccountabilityEffect*(ruleExecution-1);
  const common=.10*(i.competition-.60)+.10*(i.contractReliability-.65);
  return clamp(f.ownership.state*publicGovernance+(1-f.ownership.state)*.65+common,.05,.98);
}

// GDP includes purchases once. This function makes NO cash transfers: the
// engine has already settled actual purchases and allocated their service share.
export function fundInstitutionServices(s,flow,servicePrice) {
  const i=s.institutions,k=s.parameters;
  const populationScale=s.population/s.base.initialPopulation;
  const portfolioScale=Math.max(.1,total(s.firms.map(f=>f.capital*f.ownership.state))
    /Math.max(s.base.initialPublicCapital,1));
  for(const [budget,capacity,paid,scale] of [
    ['antitrustBudget','antitrustCapacity','antitrust',populationScale],
    ['courtBudget','courtCapacity','courts',populationScale],
    ['soeAuditBudget','soeAuditCapacity','soeAudits',portfolioScale]
  ]) {
    const reference=s.base.monthlyGDP*INSTITUTION_REFERENCE_BUDGETS[budget]/100*scale;
    const realPaid=Math.max(0,flow[paid])/Math.max(servicePrice,1e-9);
    const ratio=realPaid/Math.max(reference,1e-9);
    const target=clamp(k.institutionServiceProductivity*2*ratio/(1+ratio),0,.98);
    i[capacity]+=k.institutionCapacityAdjustment*(target-i[capacity]);
  }
}

export function institutionMetrics(s) {
  const i=s.institutions;
  return {marketContestability:i.competition*100,bankContestability:i.bankContestability*100,
    contractReliability:i.contractReliability*100,registrationDays:i.registrationDays,
    contractDelayDays:i.contractDelayDays,antitrustCapacity:i.antitrustCapacity*100,
    courtCapacity:i.courtCapacity*100,soeAuditCapacity:i.soeAuditCapacity*100};
}
