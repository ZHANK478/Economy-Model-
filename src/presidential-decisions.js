import {clamp} from './political-config.js';
import {partyBillAlignment} from './political-accountability.js';

// Explicit revision preserves old decisions and journal replay. The presentation
// layer only sees an override result when the constitutional vote has succeeded.
export const revisedDecisions=s=>s.politics?.presidentialDecisionRevision===1;
export const overrideAllowed=s=>revisedDecisions(s)&&s.politics.executive.role==='president'&&s.politics.constitution.regime==='democracy'&&s.policy.competitiveElections&&s.policy.parliamentOversight&&s.politics.constitution.presidentialVeto&&s.politics.constitution.vetoOverrideAllowed!==false;
export function overrideRequested(s,b){
 if(!overrideAllowed(s)||b.status!=='vetoed'||b.kind==='constitutional'||b.overrideAttempt)return false;
 return s.politics.parties.some(x=>x.active&&x.seats>0&&!x.independent&&(x.executiveLoyalty??.5)<.6&&(x.id===b.sponsor||partyBillAlignment(s,x,b)>.001));
}
export function resultNotice(b){
 if(b.playerVote)return 'ordinary';
 if(b.executiveResponse?.decision==='ignored')return null;
 if(b.executiveResponse?.decision==='reject')return b.vetoOverridden===true&&b.overrideVote?.passed===true&&['passed','enacted'].includes(b.status)&&b.overrideVote.yes>=b.overrideVote.required?'override':null;
 return ['vetoed','declined'].includes(b.status)?null:'ordinary';
}
export function policyNumber(value,min,max,step){
 if(String(value).trim()==='')return null;
 const parsed=Number(String(value).replace(/\s/g,'').replace(',','.'));if(!Number.isFinite(parsed))return null;
 return clamp(parsed,min,max);
}
