import {AXES,clamp,hash,logistic,distance} from './political-config.js';
import {integerVotes,rankedCount,legislatureSeats} from './elections.js';
export const AGE_BANDS=[[18,25],[25,35],[35,45],[45,55],[55,65],[65,101]];
export const REGIONS=[{id:'capital',name:'Столица',share:.30,urban:.95},{id:'industrial',name:'Промышленный пояс',share:.25,urban:.75},{id:'rural',name:'Аграрные области',share:.25,urban:.25},{id:'periphery',name:'Периферия',share:.20,urban:.4}];
const sum=a=>a.reduce((v,x)=>v+x,0);
function boundedAllocation(total,weights,caps){const out=weights.map(()=>0);let left=total;
  for(let pass=0;pass<weights.length+1&&left>1e-12;pass++){const active=weights.map((w,i)=>caps[i]-out[i]>1e-12?w:0),denominator=sum(active);if(!denominator)break;const requested=left;let used=0;for(let i=0;i<weights.length;i++){const value=Math.min(caps[i]-out[i],requested*active[i]/denominator);out[i]+=Math.max(0,value);used+=Math.max(0,value);}left-=used;}
  return out;
}
const peopleAtAge=(s,lo,hi)=>sum(s.demography.female.slice(lo*12,Math.min(1201,hi*12)))+sum(s.demography.male.slice(lo*12,Math.min(1201,hi*12)));
export function electorateTotals(s){
  const age=AGE_BANDS.map(([lo,hi])=>peopleAtAge(s,lo,hi)),adults=sum(age),p=s.politics;
  const foreign=Math.min(adults*.4,p.citizenship.residents),naturalized=Math.min(adults-foreign,p.citizenship.naturalized);
  return {adults,eligible:adults-foreign,residents:foreign,naturalized,age};
}
export function advanceCitizenship(s,prev){
  const p=s.politics,c=p.citizenship,deathRate=s.demography.deaths/Math.max(prev.population,.001),outflow=Math.max(0,-s.demography.netMigration)/Math.max(prev.population,.001);
  const survival=clamp(1-deathRate-outflow);
  for(const b of c.naturalizations)b.people*=survival;for(const b of c.arrivals)b.people*=survival;
  if(s.demography.netMigration>0)c.arrivals.push({month:s.month,people:s.demography.netMigration*.95});
  let newly=0;for(const b of c.arrivals)if(s.month-b.month>=p.constitution.naturalizationYears*12){const n=b.people*p.parameters.naturalizationUptake;b.people-=n;newly+=n;}
  if(newly>0)c.naturalizations.push({month:s.month,people:newly});c.naturalized=sum(c.naturalizations.map(b=>b.people));c.residents=sum(c.arrivals.map(b=>b.people));c.newlyNaturalized=newly;
  c.arrivals=c.arrivals.filter(b=>b.people>1e-8);
  // Adult-only migration approximation. Bound foreign stocks by observed adults;
  // births and maturation remain in the actual demographic engine.
  const adults=sum(AGE_BANDS.map(([lo,hi])=>peopleAtAge(s,lo,hi)));
  if(c.residents+c.naturalized>adults*.4){const f=adults*.4/(c.residents+c.naturalized);c.naturalized*=f;for(const b of c.naturalizations)b.people*=f;for(const b of c.arrivals)b.people*=f;c.residents*=f;}
  c.integration=c.naturalized>0?sum(c.naturalizations.map(b=>b.people*(1-Math.exp(-(s.month-b.month)/96))))/c.naturalized:1;
}
export function makeElectorate(s){
  const p=s.politics,t=electorateTotals(s),cells=[],foreignAge=[.08,.35,.3,.17,.08,.02];
  const migrantAge=boundedAllocation(t.residents+t.naturalized,foreignAge,t.age),naturalizedAge=migrantAge.map(v=>v*t.naturalized/Math.max(1e-12,t.residents+t.naturalized));
  // Synthetic joint strata, not a survey of a real country. No fixed migrant
  // party or age ideology: within-cell heterogeneity comes from seeded ideals.
  for(let age=0;age<6;age++)for(let income=0;income<5;income++)for(const [region,r] of REGIONS.entries())for(const origin of ['native','naturalized']){
    const native=Math.max(0,t.age[age]-migrantAge[age]);
    const natural=naturalizedAge[age];
    const weight=(origin==='native'?native:natural)*.2*r.share;if(weight<=0)continue;
    const id=`${age}-${income}-${region}-${origin}`,education=clamp(.3+.11*income+.2*r.urban-.02*age);
    const noise=k=>(hash(s.seed,'ideal',id,k)-.5)*1.5;
    const ideal={economy:clamp((income-2)*.22+noise('economy'),-1,1),liberty:clamp(.3+noise('liberty'),-1,1),culture:clamp((r.urban-.5)*.45+noise('culture'),-1,1),environment:clamp(.2+noise('environment'),-1,1),decentralization:clamp(region===3?.65:region===0?-.3:.15+noise('region'),-1,1),openness:clamp(.15+noise('open'),-1,1)};
    const memory=p.groupMemory[id]??{income:0,identity:null};
    const incomeIndex=(s.households[income*2].realIncomeIndex+s.households[income*2+1].realIncomeIndex)/2;
    const reference=p.economicHistory.find(x=>x.month===s.month-12)??p.economicHistory[0];
    const own=Math.log(Math.max(.05,incomeIndex)/Math.max(.05,reference.groups[income])),national=Math.log(Math.max(.05,s.metrics.realIncomeIndex)/Math.max(.05,reference.national));
    const experienced=.65*own+.35*national-.012*Math.max(0,s.metrics.unemployment-9)-.005*Math.max(0,s.metrics.inflationYoY-10);
    const experience=memory.income+(experienced-memory.income)/p.parameters.memoryMonths;
    const occupation=age===5?'retired':region===2&&income<3?'agriculture':region===1&&income<3?'industry':income===4?'business':'services';
    // The foreign age profile is renormalized below to actual eligible totals,
    // preventing a synthetic age profile from creating extra voters.
    cells.push({id,age,income,region,origin,weight,education,urban:r.urban,occupation,ideal,experience,identity:memory.identity});
  }
  const total=sum(cells.map(g=>g.weight));for(const g of cells)g.weight*=t.eligible/Math.max(total,.001);
  return cells;
}
export function governedPlatform(s){const x=s.policy,p=s.politics;
  return {economy:clamp(.8-(x.incomeTax+x.corporateTax)/65-(x.transfers+x.healthcare+x.education)/18,-1,1),liberty:clamp((p.civilFreedom+p.judicialIndependence+p.mediaFreedom)/1.5-1,-1,1),culture:x.associationFreedom?.35:-.35,environment:clamp((x.energyPricing==='market'?.1:0)+x.publicInvestment/20,-1,1),decentralization:clamp(x.municipalInvestmentShare/50-1,-1,1),openness:clamp(x.migrationOpenness/60-1-x.capitalControls/100-x.tariff/30,-1,1)};
}
const responsibilities=(s,id)=>{
  const p=s.politics,c=p.constitution;
  if(c.form==='parliamentary')return p.coalition.includes(id)?1/Math.max(1,p.coalition.length):0;
  return (p.executive.presidentParty===id?.6:0)+(p.coalition.includes(id)?.4/Math.max(1,p.coalition.length):0);
};
export function voterUtility(s,g,party,kind='parliament',district=0){
  const p=s.politics,k=p.parameters,loyal=g.identity===party.id,economic=g.experience*(loyal?1-k.polarization:1);
  const burden=responsibilities(s,party.id),candidate=kind==='president'?party.candidateCompetence:party.competence;
  const shock=p.publicEvents.reduce((v,e)=>v+(e.region===null||e.region===g.region?e.effect*Math.exp(-(s.month-e.month)/9):0),0);
  const local=kind==='district'?(hash(s.seed,'local-candidate',district,party.id)-.5)*.7:0;
  const incumbency=kind==='president'&&p.executive.presidentParty===party.id?.22:0;
  const promise=party.brokenPromises*.14;
  const integration=g.origin==='naturalized'?.6+.4*p.citizenship.integration:1;
  return -k.ideologyWeight*distance(g.ideal,party.platform)+k.identityWeight*(loyal?integration:0)+k.economicWeight*economic*burden+k.competenceWeight*candidate+k.organizationWeight*Math.log(.2+party.organization)+local+incumbency+shock*burden-promise*burden;
}
export function choiceProbabilities(s,g,parties,kind='parliament',district=0){
  const u=parties.map(p=>voterUtility(s,g,p,kind,district)),hi=Math.max(...u),values=u.map(v=>Math.exp(v-hi)),total=sum(values);return values.map(v=>v/total);
}
export function turnout(s,g){const p=s.politics;
  return logistic(p.parameters.turnoutIntercept+.45*g.education+.06*Math.min(g.age,3)-.28*(g.origin==='naturalized'?1-p.citizenship.integration:0)+.35*Math.abs(g.ideal.liberty)+p.publicEvents.reduce((v,e)=>v+e.attention*Math.exp(-(s.month-e.month)/6),0)-.25*Math.abs(g.experience)-.6*(1-p.electoralIntegrity));
}
export function pollElectorate(s,{commitMemory=true}={}){
  const p=s.politics,parties=p.parties.filter(x=>x.active),groups=makeElectorate(s),votes=parties.map(()=>0),candidateVotes=parties.map(()=>0),government=governedPlatform(s);
  let voters=0,approval=0,total=0,presidentApproval=0,cabinetApproval=0;const demographic=AGE_BANDS.map(()=>({eligible:0,voters:0,government:0}));
  for(const g of groups){const t=turnout(s,g),weights=choiceProbabilities(s,g,parties),president=choiceProbabilities(s,g,parties,'president');
    const mixed=p.constitution.form==='semiPresidential',presidentParty=p.parties.find(x=>x.id===p.executive.presidentParty),presidentPlatform=mixed?Object.fromEntries(AXES.map(k=>[k,.6*presidentParty.platform[k]+.4*government[k]])):government;
    const presA=logistic(.85-1.3*distance(g.ideal,presidentPlatform)+p.parameters.economicWeight*g.experience*(mixed?.6:1)-.7*p.corruption+(g.identity===p.executive.presidentParty?.2:0));
    const cabA=logistic(.85-1.3*distance(g.ideal,government)+p.parameters.economicWeight*g.experience*(mixed?.4:1)-.7*p.corruption+(g.identity===p.executive.primeMinisterParty?.2:0));
    const a=p.executive.role==='president'?presA:cabA;presidentApproval+=g.weight*presA;cabinetApproval+=g.weight*cabA;
    voters+=g.weight*t;approval+=g.weight*a;total+=g.weight;demographic[g.age].eligible+=g.weight;demographic[g.age].voters+=g.weight*t;demographic[g.age].government+=g.weight*a;
    for(let i=0;i<parties.length;i++){votes[i]+=g.weight*t*weights[i];candidateVotes[i]+=g.weight*t*president[i];}
    if(commitMemory){let identity=g.identity;if(!identity){let best=0;weights.forEach((v,i)=>{if(v>weights[best])best=i;});identity=parties[best].id;}else if(hash(s.seed,s.month,'switch',g.id)<.006){const best=weights.indexOf(Math.max(...weights));identity=parties[best].id;}
      p.groupMemory[g.id]={income:g.experience,identity};}
  }
  const poll={month:s.month,eligible:total,expectedVoters:voters,turnout:voters/Math.max(total,.001)*100,approval:approval/Math.max(total,.001),presidentApproval:presidentApproval/Math.max(total,.001),cabinetApproval:cabinetApproval/Math.max(total,.001),parties:parties.map((x,i)=>({id:x.id,share:votes[i]/Math.max(voters,.001)*100,candidateShare:candidateVotes[i]/Math.max(voters,.001)*100})),demographic};
  p.poll=poll;return {poll,groups,parties};
}
function officialProbabilities(s,parties,probabilities){
  if(s.policy.competitiveElections)return probabilities;
  const government=s.politics.executive.playerParty,integrity=s.politics.electoralIntegrity,tilt=.65*(1-integrity);
  const altered=probabilities.map((v,i)=>v*(parties[i].id===government?1+tilt*4:1-tilt));const total=sum(altered);return altered.map(v=>v/total);
}
export function conductElection(s,kind,{initial=false}={}){
  const p=s.politics,c=p.constitution,{poll,groups,parties:all}=pollElectorate(s,{commitMemory:false});
  const parties=all.filter(x=>s.policy.competitiveElections||x.id===p.executive.playerParty||x.tolerated),weights=parties.map(()=>0);
  const ballots=[];let expectedVoters=0;
  for(const g of groups){const weight=g.weight*turnout(s,g);expectedVoters+=weight;const prob=officialProbabilities(s,parties,choiceProbabilities(s,g,parties,kind));prob.forEach((x,i)=>weights[i]+=x*weight);
    const ranking=parties.map(x=>({id:x.id,u:voterUtility(s,g,x,'president')+hash(s.seed,g.id,'rank',x.id)*.4+(!s.policy.competitiveElections&&x.id===p.executive.playerParty?(1-p.electoralIntegrity)*1.5:0)})).sort((a,b)=>b.u-a.u).map(x=>x.id);ballots.push({ranking,weight});}
  const eligible=Math.round(poll.eligible*1e6),voters=Math.min(eligible,Math.round(expectedVoters*1e6)),votes=integerVotes(weights,voters);
  const election={id:p.nextElectionId++,month:s.month,kind,initial,competitive:s.policy.competitiveElections&&p.electoralIntegrity>.5,eligible,voters,turnout:eligible?voters/eligible*100:0,system:kind==='president'?c.presidentSystem:c.electoralSystem,results:parties.map((x,i)=>({id:x.id,candidateName:kind==='president'?x.candidateName:null,votes:votes[i],share:voters?votes[i]/voters*100:0,seats:0})),rounds:[],districts:[]};
  if(kind==='president'){
    let order=votes.map((v,i)=>({i,v})).sort((a,b)=>b.v-a.v||a.i-b.i),winner=parties[order[0].i].id;
    election.rounds.push({eligible,voters,results:election.results.map(({id,votes})=>({id,votes}))});
    if(c.presidentSystem==='ranked'){const panelVotes=integerVotes(ballots.map(x=>x.weight),voters),ranked=rankedCount(ballots.map((b,i)=>({...b,weight:panelVotes[i]})),parties.map(x=>x.id));winner=ranked.winner;election.rounds=ranked.rounds.map(r=>({eligible,voters,results:Object.entries(r.votes).map(([id,v])=>({id,votes:v}))}));for(const r of election.results){r.votes=ranked.rounds[0].votes[r.id];r.share=voters?r.votes/voters*100:0;}}
    if(c.presidentSystem==='twoRound'&&order[0].v<=voters/2&&parties.length>1){const finalists=order.slice(0,2).map(o=>parties[o.i]),w=[0,0];for(const g of groups){const prob=officialProbabilities(s,finalists,choiceProbabilities(s,g,finalists,'president'));prob.forEach((v,i)=>w[i]+=v*g.weight*turnout(s,g));}const v=integerVotes(w,voters);winner=finalists[v[0]>=v[1]?0:1].id;election.rounds.push({eligible,voters,results:finalists.map((x,i)=>({id:x.id,votes:v[i]}))});}
    election.winner=winner;election.winnerCandidate=parties.find(x=>x.id===winner).candidateName;
  }else{
    const count=['parallel','mmp'].includes(c.electoralSystem)?Math.floor(c.seats/2):c.electoralSystem==='pr'?0:c.seats,districts=[];
    const regionalCounts=REGIONS.map((_,r)=>Math.floor(count/REGIONS.length)+(r<count%REGIONS.length?1:0));
    const districtTurnout=Array.from({length:count},(_,d)=>sum(groups.filter(g=>g.region===d%REGIONS.length).map(g=>g.weight*turnout(s,g)))/regionalCounts[d%REGIONS.length]);
    const districtVoters=count?integerVotes(districtTurnout,voters):[];
    for(let d=0;d<count;d++){const region=d%REGIONS.length,w=parties.map(()=>0),regional=groups.filter(g=>g.region===region);
      for(const g of regional){const prob=officialProbabilities(s,parties,choiceProbabilities(s,g,parties,'district',d));prob.forEach((v,i)=>w[i]+=v*g.weight*turnout(s,g));}
      const v=integerVotes(w,districtVoters[d]);
      const district={id:d,region,votes:v};if(c.electoralSystem==='twoRound'){const order=v.map((x,i)=>({i,v:x})).sort((a,b)=>b.v-a.v);if(order[0].v<=sum(v)/2){const final=order.slice(0,2).map(x=>parties[x.i]),rw=[0,0];for(const g of regional){const prob=officialProbabilities(s,final,choiceProbabilities(s,g,final,'district',d));prob.forEach((x,i)=>rw[i]+=x*g.weight*turnout(s,g));}const rv=integerVotes(rw,sum(v));district.runoffVotes=parties.map(x=>{const i=final.findIndex(z=>z.id===x.id);return i<0?0:rv[i];});}}districts.push(district);
    }
    if(['plurality','twoRound'].includes(c.electoralSystem)){election.results.forEach((r,i)=>{r.votes=sum(districts.map(d=>d.votes[i]));r.share=voters?r.votes/voters*100:0;});}
    const allocation=legislatureSeats({system:c.electoralSystem,seats:c.seats,threshold:c.threshold,votes,districts});election.totalSeats=allocation.total;election.overhang=allocation.overhang;
    election.results.forEach((r,i)=>r.seats=allocation.seats[i]);election.districts=districts.map((d,i)=>({...d,winner:parties[allocation.districtWinners[i]].id}));
  }
  return election;
}
