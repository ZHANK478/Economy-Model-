// Public service capacity and paid private services; sector 4 delivers the latter.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sum=a=>a.reduce((x,v)=>x+v,0);
export function initializeServices(s){s.services={publicHealthCapacity:1,publicEducationCapacity:1,publicHealthDelivered:1,publicEducationDelivered:1,
  healthCoverage:1,educationCoverage:1,childcareAccess:.5,housingBurden:s.parameters.initialHousingBurden,
  privateHealth:0,privateEducation:0,privateChildcare:0,healthByGroup:Array(10).fill(1),educationByGroup:Array(10).fill(1)};}
export function privateServicePlans(s,ordinaryBudget,servicePrice){
  const a=s.services,p=s.policy,k=s.parameters;
  return s.households.map((h,i)=>{
    const healthGap=Math.max(0,1-a.publicHealthCapacity),schoolGap=Math.max(0,1-a.publicEducationCapacity);
    const health=p.privateHealthEntry?ordinaryBudget[i]*clamp(k.privateHealthDemand+.11*healthGap,0,.20):0;
    const education=p.privateEducationEntry?ordinaryBudget[i]*clamp(k.privateEducationDemand+.08*schoolGap,0,.15):0;
    const care=p.privateEducationEntry?ordinaryBudget[i]*.006*(1-a.childcareAccess):0;
    const fee=ordinaryBudget[i]*Math.min(.15,.024*s.metrics.corporateInfrastructureShare/20*s.networks.reduce((v,n)=>v+n.fee*n.weight,0));
    return {health:health/servicePrice,education:education/servicePrice,care:care/servicePrice,
      fee:fee/servicePrice,total:(health+education+care+fee)/servicePrice};
  });
}
export function settleServices(s,prev,flow,plans,alpha,price,publicPrice=price){
  const a=s.services,k=s.parameters;
  const publicHealth=flow.healthcare/publicPrice/Math.max(s.population*10,1);
  const pupilRatio=(s.ageCohorts[0]/s.population)/.28;
  const publicSchool=flow.education/publicPrice/Math.max(s.population*7.5*pupilRatio,1);
  a.publicHealthCapacity+=k.serviceCapacityAdjustment*(clamp(publicHealth,0,2)-a.publicHealthCapacity);
  a.publicEducationCapacity+=k.serviceCapacityAdjustment*(clamp(publicSchool,0,2)-a.publicEducationCapacity);
  a.publicHealthDelivered=Math.min(a.publicHealthCapacity,publicHealth);
  a.publicEducationDelivered=Math.min(a.publicEducationCapacity,publicSchool);
  const firm=s.firms[4];
  const privateCapacity=clamp(firm.capital/Math.max(firm.initialCapital,1)*firm.managementEfficiency,.1,5);
  const health=sum(plans.map(p=>p.health))*alpha,school=sum(plans.map(p=>p.education))*alpha,care=sum(plans.map(p=>p.care))*alpha;
  a.privateHealth=health*price;a.privateEducation=school*price;a.privateChildcare=care*price;
  a.healthByGroup=plans.map((p,i)=>clamp(a.publicHealthDelivered+Math.min(privateCapacity,p.health*alpha/Math.max(s.population*s.households[i].population*10,1e-6)),0,1));
  a.educationByGroup=plans.map((p,i)=>clamp(a.publicEducationDelivered+Math.min(privateCapacity,p.education*alpha/Math.max(s.population*s.households[i].population*7.5*pupilRatio,1e-6)),0,1));
  a.healthCoverage=sum(a.healthByGroup.map((v,i)=>v*s.households[i].population));
  a.educationCoverage=sum(a.educationByGroup.map((v,i)=>v*s.households[i].population));
  const careTarget=clamp((flow.childcare/publicPrice+care)/Math.max(s.ageCohorts[0]*2.5,1),0,1);
  a.childcareAccess+=k.serviceCapacityAdjustment*(careTarget-a.childcareAccess);
  // Housing is a stylised burden proxy; there is no housing asset/land market yet.
  const housingTarget=clamp(k.initialHousingBurden*Math.pow(Math.max(.2,prev.metrics.realIncomeIndex/100),-.15)
    *Math.pow(Math.max(.2,s.population/s.base.initialPopulation),.25),.1,.55);
  a.housingBurden+=1/60*(housingTarget-a.housingBurden);
}
export function servicesMetrics(s){const a=s.services;
  return {publicHealthCapacity:a.publicHealthCapacity*100,publicEducationCapacity:a.publicEducationCapacity*100,
    totalHealthAccess:a.healthCoverage*100,totalEducationAccess:a.educationCoverage*100,childcareAccess:a.childcareAccess*100,
    privateHealthSpending:a.privateHealth,privateEducationSpending:a.privateEducation,
    healthAccessBottom:a.healthByGroup[0]*100,healthAccessTop:a.healthByGroup.at(-1)*100,
    educationAccessBottom:a.educationByGroup[0]*100,educationAccessTop:a.educationByGroup.at(-1)*100,housingBurden:a.housingBurden*100};
}
