// Bargaining, rent sharing and employer wage-setting power; coefficients are assumptions.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sum=a=>a.reduce((x,v)=>x+v,0);
export function initializeLabor(s){s.firms.forEach(f=>{f.labor={density:.18,coverage:.25,power:.25,
  wageFactor:1,strikeShare:0,turnover:.025};f.referenceWage=f.wage;});}
export function advanceLabor(s,prev,events){
  const p=s.policy,k=s.parameters;
  s.firms.forEach((f,i)=>{
    const a=f.labor,old=prev.firms[i].labor;
    const freedom=s.politics.civilFreedom*Number(p.associationFreedom);
    const incentive=clamp(.20+.5*k.laborMarkdown+.12*Math.max(0,prev.metrics.inflationYoY-5)/100+.1*Number(p.workerRepresentation),.05,.7);
    a.density+=k.unionAdjustment*(freedom*incentive-a.density);
    const targetCoverage=p.collectiveBargaining?clamp(a.density*(p.bargainingSystem==='firm'?1.2:2.5),0,.9):0;
    a.coverage+=k.unionAdjustment*(targetCoverage-a.coverage);
    const outsideOption=clamp(1-prev.metrics.unemployment/30,.05,1);
    a.power=clamp(a.density*.8+outsideOption*.25+.10*Number(p.workerRepresentation),0,.8)*Number(p.collectiveBargaining);
    const payroll=Math.max(1,f.workers*f.wage*p.normalWorkweek/40),rents=Math.max(0,f.lastProfit)/payroll;
    const markdown=k.laborMarkdown*(1-s.institutions.competition);
    const coordinated=p.bargainingSystem==='coordinated'?.7:1;
    const realWageLoss=clamp(Math.log(f.referenceWage*prev.consumerPriceIndex/100*f.productivity/Math.max(f.wage,1e-9)),0,.10);
    const targetFactor=1+a.coverage*a.power*(markdown+k.unionRentSharing*Math.min(.5,rents)+k.unionConflictSensitivity*realWageLoss)*coordinated;
    a.wageFactor+=.08*(targetFactor-a.wageFactor);
    const surprise=Math.max(0,prev.metrics.inflationMonthly/100-Math.log1p(prev.expectedInflation)/12);
    const dispute=Math.max(0,targetFactor-a.wageFactor-.005)+k.unionConflictSensitivity*surprise+.05*Math.min(1,f.arrears/Math.max(f.lastRevenue,1));
    a.strikeShare=p.strikeRights?clamp(a.coverage*dispute*(p.bargainingSystem==='coordinated'?.35:1),0,.04):0;
    a.turnover=clamp(.03-.012*a.coverage-.002*p.employmentProtection,.005,.05);
    if(a.strikeShare>.002&&old.strikeShare<=.002)events.push(`${f.name}: трудовой конфликт, потеря ${(a.strikeShare*100).toFixed(1)}% рабочих часов.`);
  });
}
export function laborWageShares(s,f,groups){
  const compression=s.parameters.unionWageCompression*f.labor.coverage;
  const values=groups.map(g=>Math.pow(g.wageShare,1-compression));const total=sum(values);
  return values.map(x=>x/total);
}
export function laborMetrics(s){const weights=s.firms.map(f=>f.workers),total=Math.max(sum(weights),.001);
  const average=key=>sum(s.firms.map((f,i)=>f.labor[key]*weights[i]))/total*100;
  return {unionDensity:average('density'),bargainingCoverage:average('coverage'),bargainingPower:average('power'),
    strikeHours:average('strikeShare'),workerTurnover:average('turnover')};
}
