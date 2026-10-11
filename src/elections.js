// Exact seat counting; synthetic vote preferences are calculated separately.
import {hash} from './political-config.js';
export function apportion(votes,seats,method='dhondt',threshold=0){
  if(!Number.isInteger(seats)||seats<0||!votes.length||votes.some(x=>!Number.isFinite(x)||x<0))throw new Error('Неверные голоса или число мест');
  const total=votes.reduce((a,b)=>a+b,0),eligible=votes.map(v=>total>0&&v/total*100>=threshold);
  const out=votes.map(()=>0);if(!total)return out;
  // Explicit simulation fallback if everybody misses the statutory threshold:
  // the largest list qualifies. This is a selectable-country convention, not
  // a claim that all real constitutions use the same contingency.
  if(!eligible.some(Boolean))eligible[votes.indexOf(Math.max(...votes))]=true;
  for(let n=0;n<seats;n++){let best=-1,q=-1;for(let i=0;i<votes.length;i++){if(!eligible[i])continue;const d=method==='sainteLague'?2*out[i]+1:out[i]+1;const value=votes[i]/d;if(value>q){q=value;best=i;}}out[best]++;}return out;
}
export function integerVotes(weights,total){
  const sum=weights.reduce((a,b)=>a+b,0);if(sum<=0)return weights.map(()=>0);
  const quotas=weights.map(v=>v/sum*total),out=quotas.map(Math.floor),left=total-out.reduce((a,b)=>a+b,0);
  const order=quotas.map((q,i)=>({i,r:q-out[i]})).sort((a,b)=>b.r-a.r||a.i-b.i);for(let n=0;n<left;n++)out[order[n].i]++;return out;
}
export function rankedCount(ballots,candidates){
  const remaining=new Set(candidates),rounds=[];let winner=null;
  while(remaining.size){const votes=Object.fromEntries([...remaining].map(id=>[id,0]));for(const b of ballots){const id=b.ranking.find(x=>remaining.has(x));if(id)votes[id]+=b.weight;}
    const order=Object.keys(votes).sort((a,b)=>votes[b]-votes[a]||a.localeCompare(b)),total=Object.values(votes).reduce((a,b)=>a+b,0);rounds.push({votes,total});
    if(order.length===1||votes[order[0]]>total/2){winner=order[0];break;}remaining.delete(order.at(-1));
  }return {winner,rounds};
}
export function legislatureSeats({system,seats,threshold,votes,districts}){
  const list=apportion(votes,seats,'dhondt',threshold),n=votes.length;
  if(system==='pr')return {seats:list,total:seats,overhang:0,districtWinners:[]};
  const districtCount=system==='parallel'||system==='mmp'?Math.floor(seats/2):seats;
  if(districts.length!==districtCount)throw new Error('Число округов не соответствует избирательной системе');
  const districtSeats=Array(n).fill(0),districtWinners=[];
  for(const d of districts){const v=system==='twoRound'&&d.runoffVotes?d.runoffVotes:d.votes;let win=0;for(let i=1;i<n;i++)if(v[i]>v[win])win=i;districtSeats[win]++;districtWinners.push(win);}
  if(system==='parallel'){const remainder=apportion(votes,seats-districtCount,'dhondt',threshold);return {seats:remainder.map((v,i)=>v+districtSeats[i]),total:seats,overhang:0,districtWinners};}
  if(system==='mmp'){
    // Guaranteed district mandates; compensatory list seats with overhang.
    // Threshold exemption for a party winning at least one district is explicit.
    const totalVotes=votes.reduce((a,b)=>a+b,0),eligible=votes.map((v,i)=>districtSeats[i]>0||totalVotes>0&&v/totalVotes*100>=threshold);
    const v=votes.map((x,i)=>eligible[i]?x:0),target=apportion(v,seats);
    const result=target.map((x,i)=>Math.max(x,districtSeats[i]));return {seats:result,total:result.reduce((a,b)=>a+b,0),overhang:result.reduce((a,b)=>a+b,0)-seats,districtWinners};
  }
  return {seats:districtSeats,total:seats,overhang:0,districtWinners};
}
export const tieBreak=(seed,id)=>hash(seed,'electoral-tie',id);
