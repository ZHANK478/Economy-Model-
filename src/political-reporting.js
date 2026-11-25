import {accountable} from './political-accountability.js';
import {pollElectorate} from './electorate.js';
import {partyDisplayName,PARTY_DESCRIPTIONS} from './political-config.js';
export {partyDisplayName,PARTY_DESCRIPTIONS};
export function presidentialStanding(s){
 const p=s.politics,player=p.executive.playerParty;
 const candidates=(p.poll?.parties??[]).filter(x=>!p.electionExperience||p.constitution.form!=='presidential'||p.majorPartyIds.includes(x.id)).slice().sort((a,b)=>b.candidateShare-a.candidateShare);
 return {share:candidates.find(x=>x.id===player)?.candidateShare??0,rank:candidates.findIndex(x=>x.id===player)+1,candidates};
}
export function electionOutcome(s){
 const p=s.politics,e=p.elections?.filter(x=>x.kind==='president'&&!x.initial).at(-1);
 if(!p.executive.inOffice&&!String(p.executive.reason).includes('президентских выборах'))return {reason:p.executive.reason};
 if(!e)return null;
 const player=p.executive.playerParty,first=e.results.find(x=>x.id===player),rank=e.results.slice().sort((a,b)=>b.votes-a.votes).findIndex(x=>x.id===player)+1;
 const final=e.rounds.at(-1),votes=final?.results??e.results,total=votes.reduce((v,x)=>v+x.votes,0),own=votes.find(x=>x.id===player),winner=votes.find(x=>x.id===e.winner);
 return {election:e,firstShare:first?.share??0,rank,inFinal:Boolean(own),playerVotes:own?.votes??0,playerShare:total?(own?.votes??0)/total*100:0,winnerVotes:winner?.votes??0,winnerShare:total?(winner?.votes??0)/total*100:0,won:e.winner===player,reason:e.system==='twoRound'&&e.rounds.length>1&&!own?'Ваш кандидат не вошёл в двух лидеров первого тура и не участвовал во втором.':e.winner!==player?'В решающем подсчёте соперник получил больше голосов.':'Ваш кандидат получил необходимое большинство.'};
}

// Counterfactual attribution uses the same voter calculation as the displayed
// poll. Each item removes ONE factor; interactions mean items are not additive.
export function ratingExplanation(s,kind='president'){
 if(!accountable(s))return null;
 const p=s.politics,id=p.executive.playerParty,key=kind==='president'?'candidateShare':'share';
 const calculate=state=>pollElectorate(state,{commitMemory:false,trackGroups:false,assignPoll:false}).poll.parties.find(x=>x.id===id)?.[key]??0;
 const current=calculate(s),labels={positions:'Позиции и последовательность партий',implementation:'Ответственность за действующие законы',program:'Близость партийных программ',identity:'Привычная поддержка партий',economy:'Доходы, занятость и цены',decisions:'Ваши законы и вето',campaign:'Предвыборная кампания',mediaAccess:'Неравный доступ к СМИ'};
 const factors=Object.entries(labels).map(([factor,label])=>({factor,label,impact:current-calculate({...s,politics:{...p,ratingOmission:factor}})})).sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact));
 const groups=(p.poll.groups??[]).filter(g=>g.dimension==='income').map(g=>({label:g.label,share:(kind==='president'?g.candidates:g.parties)[id]??0})).sort((a,b)=>a.share-b.share);
 const own=p.parties.find(x=>x.id===id),recent=p.bills.filter(b=>b.publicReaction&&Number.isFinite(b.publicReaction.presidentDelta)).slice(-1)[0];
 const reference=p.economicHistory.find(h=>h.month===s.month-12)??p.economicHistory[0];
 const actions=[];
 if(reference&&s.metrics.unemployment>(reference.unemployment??s.metrics.unemployment)+.5)actions.push('Поддержку ослабляет рост безработицы: проверяйте занятость после экономических решений.');
 if(s.metrics.inflationYoY< -2)actions.push('Падение цен ниже −2% в год учитывается как ценовой стресс.');
 if(s.metrics.inflationYoY>5)actions.push('Инфляция выше 5% в год ослабляет экономическую оценку.');
 if(own.executiveLoyalty<.5)actions.push('Депутаты вашей партии недовольны отказами: поддержите близкую её программе инициативу, чтобы восстановить отношения.');
 if(groups[0])actions.push(`Слабее всего вас поддерживает группа «${groups[0].label}»: смотрите её доходы и доступность услуг, а также позиции партии.`);
 return {current,factors,groups,loyalty:own.executiveLoyalty,recent:recent?{title:recent.title,delta:recent.publicReaction[kind==='president'?'presidentDelta':'partyDelta']}:null,actions:actions.slice(0,2)};
}
