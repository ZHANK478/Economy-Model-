import {FOREIGN_PROGRAMMES,FOREIGN_STEPS,foreignStepDone} from './foreign-programme.js';
import {parliamentary,playerExecutive} from './parliamentary-state.js';
import {euExportVolume} from './trade-course.js';
import {euOutside} from './trade-partners.js';

const lowerIncome=s=>(s.households[0].realIncomeIndex+s.households[1].realIncomeIndex)/2;
const gdp=s=>s.metrics.gdpPerCapitaReal;
const exports=euExportVolume;
const income=s=>s.metrics.realIncomeIndex;
export const GOVERNMENT_GOALS={
 production:{title:'Сильная экономика',label:'Реальный ВВП на человека +25%',growth:25,value:gdp,milestones:{
  gdp:{label:'Реальный ВВП на человека +4%',growth:4,value:gdp},
  productivity:{label:'Производительность +4%',growth:4,value:s=>s.metrics.productivity}
 }},
 europe:{title:'Британия на европейском рынке',label:'Реальный экспорт в ЕС +30% при членстве в союзе',growth:30,value:exports,eligible:s=>!euOutside(s),milestones:{
  exports:{label:'Реальный экспорт в ЕС +6%',growth:6,value:exports},
  gdp:{label:'Реальный ВВП на человека +4%',growth:4,value:gdp}
 }},
 households:{title:'Рост благосостояния',label:'Реальные доходы нижних 20% +25%',growth:25,value:lowerIncome,milestones:{
  lowerIncome:{label:'Реальные доходы нижних 20% +5%',growth:5,value:lowerIncome},
  income:{label:'Реальные доходы по стране +5%',growth:5,value:income}
 }}
};

for(const [id,programme] of Object.entries(FOREIGN_PROGRAMMES)){
 const milestones=Object.fromEntries(Object.entries(FOREIGN_STEPS).filter(([,step])=>step.goal===id).map(([key,step])=>
  [key,{label:step.title,required:1,value:s=>Number(foreignStepDone(s,key))}]));
 const required=Object.keys(milestones).filter(key=>key!=='erm');
 GOVERNMENT_GOALS[id]={...programme,milestones,required:required.length,
  value:s=>required.filter(key=>foreignStepDone(s,key)).length};
}
export const remainingMilestones=(s,goal)=>Object.entries(goal.milestones)
 .filter(([id,milestone])=>!milestone.required||!foreignStepDone(s,id));

const supported=s=>s.scenario?.id==='uk-2000'&&parliamentary(s);
const termEnds=s=>Math.min(s.politics.nextParliamentElection,s.politics.scheduledParliament??Infinity);
const definition=(catalog,id)=>Object.hasOwn(catalog,id)?catalog[id]:null;
const target=(s,metric)=>metric.required??Math.max(1e-9,metric.value(s))*(1+metric.growth/100);
const meets=(s,metric,progress,exports)=>(metric.eligible?.(s)??true)&&metric.value(s,exports)>=progress.target;

export function enableGovernmentGoals(s,foreign=false){
 if(!supported(s)||s.politics.governmentProgrammeRetired)return;
 s.politics.governmentGoals??={};
 if(foreign)s.politics.foreignGoalsEnabled=true;
 // Preserve historical journal entries while retiring the old course going forward.
 if(s.politics.scenarioDiplomacy)delete s.politics.scenarioDiplomacy.tradeCourse;
}

function setMilestone(s,program,goal,id){
 const metric=definition(goal.milestones,id),deadline=termEnds(s);
 if(!metric||metric.required&&foreignStepDone(s,id)||deadline<=s.month)throw new Error('Выберите подцель на срок кабинета');
 program.milestone={id,target:target(s,metric),deadline,status:'active'};
}

export function setCabinetProgram(s,goalId,milestoneId){
 if(goalId==null&&milestoneId==null)return;
 const program=s.politics.governmentGoals,goal=definition(GOVERNMENT_GOALS,goalId);
 if(s.politics.governmentProgrammeRetired||!program||!goal||goal.required&&!s.politics.foreignGoalsEnabled||playerExecutive(s)||program.id&&program.id!==goalId||program.milestone?.status==='active')
  throw new Error('Программу можно выбрать при формировании кабинета');
 if(!program.id||remainingMilestones(s,goal).length)setMilestone(s,program,goal,milestoneId);
 if(!program.id)Object.assign(program,{id:goalId,target:target(s,goal),completedMonth:null});
}

export function canChooseGovernmentMilestone(s){
 return !s.politics.governmentProgrammeRetired&&s.politics.governmentGoals?.milestone?.status==='completed'&&
  s.politics.executive.inOffice&&playerExecutive(s)&&s.month<termEnds(s)&&remainingMilestones(s,GOVERNMENT_GOALS[s.politics.governmentGoals.id]).length>0;
}

export function chooseGovernmentMilestone(s,id){
 if(!canChooseGovernmentMilestone(s))throw new Error('Следующая подцель доступна после выполнения текущей');
 const program=s.politics.governmentGoals;
 setMilestone(s,program,GOVERNMENT_GOALS[program.id],id);
}

export function expireGovernmentMilestone(s){
 const milestone=s.politics.governmentGoals?.milestone;
 if(milestone?.status==='active')milestone.status='expired';
}

export function advanceGovernmentGoals(s,events,exports){
 const program=s.politics.governmentGoals,goal=GOVERNMENT_GOALS[program?.id];
 if(!goal||s.politics.governmentProgrammeRetired)return;
 if(program.completedMonth===null&&meets(s,goal,program,exports)){
  program.completedMonth=s.month;
  events.push('Достигнута долгосрочная цель «'+goal.title+'».');
 }
 const milestone=program.milestone;
 if(milestone.status!=='active')return;
 milestone.deadline=Math.min(milestone.deadline,termEnds(s));
 if(!playerExecutive(s)||!s.politics.executive.inOffice){expireGovernmentMilestone(s);return;}
 const metric=goal.milestones[milestone.id];
 if(meets(s,metric,milestone,exports)){
  milestone.status='completed';
  events.push('Подцель правительства выполнена. Можно выбрать следующую.');
 }else if(s.month>=milestone.deadline)expireGovernmentMilestone(s);
}

export function validateGovernmentGoals(s){
 const program=s.politics.governmentGoals;
 if(program===undefined)return;
 const invalid=()=>{throw new Error('Повреждены данные программы правительства');};
 if(!supported(s)||!program||typeof program!=='object'||Array.isArray(program)||s.politics.scenarioDiplomacy?.tradeCourse)invalid();
 if(!Object.keys(program).length)return;
 const goal=definition(GOVERNMENT_GOALS,program.id),milestone=program.milestone;
 const validTarget=item=>Number.isFinite(item.target)&&item.target>0;
 if(!goal||!validTarget(program)||!milestone||!definition(goal.milestones,milestone.id)||!validTarget(milestone)||
  !Number.isInteger(milestone.deadline)||milestone.deadline<0||!['active','completed','expired'].includes(milestone.status)||
  !(program.completedMonth===null||Number.isInteger(program.completedMonth)&&program.completedMonth>=0&&program.completedMonth<=s.month))invalid();
}
