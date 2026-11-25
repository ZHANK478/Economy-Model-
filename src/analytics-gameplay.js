import {POLICY_FIELDS,POLICY_CHECKS,POLICY_CHOICES} from './config.js';
const reforms = new Set([...POLICY_FIELDS,...POLICY_CHECKS,...POLICY_CHOICES].map(([key])=>key));
const approved = new Set(['passed','enacted']);

export function createGameplayObservation(analytics){
  let previous;
  function capture(state){
    const p = state.politics;
    const q = p.parliamentary;
    return {
      month:state.month, defaults:state.government.defaults, own:p.executive?.playerParty,
      cabinetCount:q?.history.length ?? 0, currentCabinet:q?.history.at(-1), phase:q?.phase,
      partners:p.coalition?.length ?? 0, elections:[...(p.elections ?? [])],
      bills:new Map((p.bills ?? []).filter(b=>!b.cabinetAgreement).map(b=>[b.id,{
        status:b.status, voted:Boolean(b.finalVote || b.votes?.some(v=>v.passed!==undefined)),
        considered:Boolean(b.decidedMonth!==undefined || b.finalVote || !b.monthlyInitiative),
        patch:b.patch
      }]))
    };
  }
  return {
    reset(state){ previous = state && capture(state); },
    update(state){
      if (!previous || !analytics.available) return;
      const next = capture(state), old = previous;
      previous = next;
      if(!analytics.enabled)return;
      const count = analytics.count;
      if (next.month > old.month) count('balance.campaignMonths',next.month-old.month);
      if (next.defaults > old.defaults) count('balance.defaults',next.defaults-old.defaults);
      for (const month of [1,3,12]) if (old.month < month && next.month >= month) analytics.stage('month'+month);
      const latestElection = old.elections.at(-1)?.id ?? 0;
      for (const election of next.elections.filter(e=>!e.initial && e.id>latestElection)){
        count('balance.elections');
        if (election.kind==='parliament') {
          analytics.stage('election');
          const own = election.results.find(row=>row.id===next.own)?.seats ?? 0;
          if (election.results.some(row=>row.seats>own)) count('balance.electionLosses');
        } else if (election.kind==='president' && election.winner!==next.own) count('balance.electionLosses');
      }
      const cabinet = next.currentCabinet, last = old.currentCabinet;
      const changed = cabinet && (!last || cabinet.month!==last.month || cabinet.leader!==last.leader || cabinet.members.join()!==last.members.join() || next.cabinetCount!==old.cabinetCount);
      if (last && (old.phase==='government' && next.phase==='forming' || changed && old.phase==='government')) {
        count('balance.cabinetsEnded');
        count('balance.cabinetMonths',Math.max(0,next.month-last.month));
      }
      // Regular elections end a term without being a coalition breakdown.
      if (old.phase==='government' && old.partners>1 && next.elections.length===old.elections.length &&
          (next.partners<old.partners || changed && cabinet.leader!==last?.leader)) count('balance.coalitionBreakups');
      if (changed && cabinet.leader===next.own) analytics.stage(next.elections.some(e=>!e.initial && e.kind==='parliament')?'nextCabinet':'cabinet');

      for (const [id,bill] of next.bills){
        const before = old.bills.get(id);
        if (bill.voted && !before?.voted) analytics.stage('vote');
        if (bill.status===before?.status && bill.considered===before?.considered) continue;
        if (bill.status==='rejected' && bill.voted) {
          const row = state.politics.bills.find(b=>b.id===id);
          const ballot = row?.finalVote ?? row?.articles?.find(a=>a.vote && !a.vote.passed)?.vote;
          const reason = ballot && Number.isInteger(ballot.quorum) && ballot.yes+ballot.no<ballot.quorum?'quorum':'noMajority';
          count('failure.vote.'+reason);
        } else if (bill.status==='blockedByCourt') count('failure.decision.court');
        for (const key of Object.keys(bill.patch ?? {}).filter(k=>reforms.has(k))) {
          if (bill.considered && !before?.considered) count('reform.proposed.'+key);
          if (approved.has(bill.status) && !approved.has(before?.status)) count('reform.passed.'+key);
        }
      }
    }
  };
}
