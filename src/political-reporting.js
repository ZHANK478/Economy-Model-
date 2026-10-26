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
