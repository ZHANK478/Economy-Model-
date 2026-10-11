// Disaggregated institutional proxies. NOT estimated V-Dem scores or causal GDP coefficients.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fiscalKeys=['vat','incomeTax','corporateTax','governmentConsumption','publicInvestment','transfers','healthcare','education'];
export function initializePolitics(s){
  const p=s.policy;
  s.politics={judicialIndependence:p.protectedJudges?.65:.20,mediaFreedom:p.freeMedia?.70:.20,
    electoralIntegrity:p.competitiveElections?.70:.15,legislativeConstraint:p.parliamentOversight?.65:.15,
    civilFreedom:p.associationFreedom?.75:.25,civilService:.65,corruption:.22,
    publicSupport:.58,parliamentSupport:.60,nextElection:48,elections:[],lastReview:[]};
}
export function reviewPolicy(s,prev,requested,events){
  const accepted={...requested},a=s.politics;
  const change=fiscalKeys.reduce((v,key)=>v+Math.abs(requested[key]-prev.policy[key]),0);
  // A rejection is a legislative constraint, never an extra economic penalty.
  if(prev.policy.parliamentOversight&&a.legislativeConstraint>.5&&a.parliamentSupport<.38&&change>12){
    for(const key of fiscalKeys)accepted[key]=prev.policy[key];
    events.push('Парламент отклонил резкий бюджетный пакет: недостаточно поддержки. Более узкие изменения можно внести следующим ходом.');
  }
  a.lastReview=Object.keys(requested).filter(key=>accepted[key]!==requested[key]).map(key=>({key,requested:requested[key],accepted:accepted[key],reason:'parliament'}));
  return accepted;
}
export function advancePolitics(s,prev,events){
  const a=s.politics,p=s.policy,k=s.parameters,step=k.politicalAdjustment;
  const targets={judicialIndependence:p.protectedJudges?.85:.15,mediaFreedom:p.freeMedia?.85:.12,
    electoralIntegrity:p.competitiveElections?.85:.10,legislativeConstraint:p.parliamentOversight?.85:.10,
    civilFreedom:p.associationFreedom?.85:.15,civilService:p.meritCivilService?.80:.30};
  for(const [key,target] of Object.entries(targets))a[key]+=step*(target-a[key]);
  const detection=Number(p.publicDisclosure)*a.mediaFreedom*s.institutions.soeAuditCapacity
    *a.judicialIndependence*s.institutions.courtCapacity;
  const corruptionTarget=clamp(.35-.22*detection-.12*a.civilService,0,.5);
  a.corruption+=step*(corruptionTarget-a.corruption);
  const incomeChange=Math.log(Math.max(.1,s.metrics.realIncomeIndex)/Math.max(.1,prev.metrics.realIncomeIndex));
  const supportTarget=clamp(.58+incomeChange*4-.008*(s.metrics.unemployment-9)
    -.004*Math.max(0,s.metrics.inflationYoY-10)-.35*a.corruption
    +.08*(s.services?.healthCoverage??1)-.12*(s.government.defaultActive?1:0),.1,.9);
  a.publicSupport+=.03*(supportTarget-a.publicSupport);
  if(s.month>=a.nextElection){
    const competitive=a.electoralIntegrity>.5&&p.competitiveElections;
    const mandate=competitive?clamp(.50+.8*(a.publicSupport-.5),.15,.85):.85;
    a.parliamentSupport=mandate;
    a.elections.push({month:s.month,competitive,publicSupport:a.publicSupport,governmentSeatShare:mandate});
    events.push(competitive?`Выборы: поддержка правительства в парламенте ${(mandate*100).toFixed(0)}%. Вы продолжаете управлять государством.`:'Очередной электоральный цикл без конкурентной смены власти.');
    a.nextElection+=48;
  }else a.parliamentSupport+=.008*(a.publicSupport-a.parliamentSupport);
}
export function politicsMetrics(s){const a=s.politics;
  return {judicialIndependence:a.judicialIndependence*100,mediaFreedom:a.mediaFreedom*100,
    electoralIntegrity:a.electoralIntegrity*100,legislativeConstraint:a.legislativeConstraint*100,civilFreedom:a.civilFreedom*100,
    corruptionRisk:a.corruption*100,publicSupport:a.publicSupport*100,parliamentSupport:a.parliamentSupport*100,
    electoralDemocracyProxy:(a.electoralIntegrity*a.civilFreedom*a.mediaFreedom)**(1/3)*100,
    executiveConstraintProxy:Math.sqrt(a.legislativeConstraint*a.judicialIndependence)*100};
}
