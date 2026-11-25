import {integerVotes} from './elections.js';
import {distance} from './political-config.js';

const sum = values => values.reduce((a, b) => a + b, 0);
const winner = votes => votes.indexOf(Math.max(...votes));
const compatible = (a, b) => !a.independent && !b.independent && distance(a.platform, b.platform) <= .65;
const deadline = p => Math.min(p.nextParliamentElection, p.scheduledParliament ?? Infinity);
const enabled = s => s.politics.electoralPactRevision === 1 && s.politics.executive.inOffice &&
  s.politics.constitution.electoralSystem === 'plurality' && s.policy.competitiveElections &&
  s.politics.electoralIntegrity > .5;

function districtKeys(districts) {
  const byTerritory = new Map();
  return districts.map(district => {
    if (!district.territoryId) return String(district.id);
    const index = byTerritory.get(district.territoryId) ?? 0;
    byTerritory.set(district.territoryId, index + 1);
    return district.territoryId + ':' + index;
  });
}

// Reallocate only the withdrawn candidate's supporters. Programmatic proximity,
// local competitiveness and the endorsement affect the choice. Some stay home.
function transferVotes(votes, parties, donor, endorsed) {
  const weights = parties.map((party, i) => i === donor ? 0 :
    Math.sqrt(votes[i]) * Math.exp(-3 * distance(parties[donor].platform, party.platform)) * (i === endorsed ? 3 : 1));
  if (!sum(weights)) return [...votes];
  const abstention = Math.round(votes[donor] * (.15 + .2 * Math.min(1, distance(parties[donor].platform, parties[endorsed].platform))));
  const transfers = integerVotes(weights, votes[donor] - abstention);
  return votes.map((votesBefore, i) => i === donor ? 0 : votesBefore + transfers[i]);
}

export function forecastElectoralPacts(parties, districts, poll) {
  const projected = Array(parties.length).fill(0);
  districts.forEach(({votes}) => projected[winner(votes)]++);
  const pollLeader = [...poll].sort((a, b) => b.share - a.share)[0];
  const majority = projected.findIndex(seats => seats > districts.length / 2);
  const leader = pollLeader?.share > 60 ? parties.findIndex(p => p.id === pollLeader.id) : majority;
  if (leader < 0) return [];

  const opportunities = new Map();
  const keys = districtKeys(districts);
  districts.forEach(({votes}, index) => {
    if (winner(votes) !== leader || votes[leader] > sum(votes) / 2) return;
    const challenger = winner(votes.map((v, i) => i === leader ? -1 : v));
    parties.forEach((party, donor) => {
      if (donor === leader || donor === challenger || !votes[donor] || !compatible(party, parties[challenger])) return;
      const after = transferVotes(votes, parties, donor, challenger);
      if (after[challenger] <= Math.max(...after.filter((_, i) => i !== challenger))) return;
      const key = donor + ':' + challenger;
      if (!opportunities.has(key)) opportunities.set(key, []);
      opportunities.get(key).push({district:keys[index], donor:party.id, endorsed:parties[challenger].id,
        margin:(after[challenger] - after[leader]) / Math.max(1, sum(after))});
    });
  });

  const pairs = [];
  for (const [key, moves] of opportunities) {
    const [a, b] = key.split(':').map(Number);
    const reciprocal = opportunities.get(b + ':' + a);
    if (a >= b || !reciprocal) continue;
    pairs.push({a, b, moves, reciprocal, gains:Math.min(moves.length, reciprocal.length),
      proximity:distance(parties[a].platform, parties[b].platform)});
  }
  pairs.sort((a, b) => b.gains - a.gains || a.proximity - b.proximity || a.a - b.a || a.b - b.b);
  const committed = new Set(), assigned = new Set(), agreements = [];
  const strongest = (a, b) => b.margin - a.margin || a.district.localeCompare(b.district);
  for (const {a, b, moves, reciprocal} of pairs) {
    if (committed.has(a) || committed.has(b)) continue;
    const available = moves.filter(move => !assigned.has(move.district)).sort(strongest);
    const other = reciprocal.filter(move => !assigned.has(move.district)).sort(strongest);
    const count = Math.min(available.length, other.length, 24);
    if (!count) continue;
    const terms = [...available.slice(0, count), ...other.slice(0, count)].map(({margin, ...move}) => move);
    agreements.push({parties:[parties[a].id, parties[b].id], terms});
    committed.add(a);
    committed.add(b);
    terms.forEach(move => assigned.add(move.district));
  }
  return agreements;
}

export function prepareElectoralPacts(s, forecast) {
  const p = s.politics, due = deadline(p);
  if (!enabled(s) || due !== s.month + 1 || p.electoralPact?.due === due) return;
  const election = forecast();
  const parties = election.results.map(row => p.parties.find(party => party.id === row.id));
  const agreements = forecastElectoralPacts(parties, election.districts, p.poll.parties);
  p.electoralPact = {due, agreements:agreements.map(agreement => ({...agreement,
    status:agreement.parties.includes(p.executive.playerParty) ? 'pending' : 'accepted'}))};
}

export function pendingElectoralPact(s) {
  const pact = s.politics.electoralPact;
  if (!enabled(s) || !pact || pact.due !== deadline(s.politics) || pact.due !== s.month + 1) return null;
  return pact.agreements.find(agreement => agreement.status === 'pending') ?? null;
}

export function answerElectoralPact(s, choice) {
  const agreement = pendingElectoralPact(s);
  if (!agreement || !['accepted','rejected'].includes(choice)) throw new Error('Предвыборное соглашение недоступно.');
  agreement.status = choice;
}

export function applyElectoralPacts(s, parties, districts) {
  const pact = s.politics.electoralPact;
  if (!enabled(s) || pact?.due !== s.month) return [];
  const keys = districtKeys(districts);
  const byDistrict = new Map(keys.map((key, i) => [key, districts[i]]));
  const applied = [];
  for (const agreement of pact.agreements.filter(agreement => agreement.status === 'accepted')) {
    const rows = agreement.parties.map(id => parties.find(party => party.id === id));
    if (rows.some(row => !row)) continue;
    const terms = agreement.terms.filter(term => byDistrict.has(term.district));
    const each = Math.min(...agreement.parties.map(id => terms.filter(term => term.donor === id).length));
    if (!each) continue;
    const settled = agreement.parties.flatMap(id => terms.filter(term => term.donor === id).slice(0, each));
    for (const term of settled) {
      const district = byDistrict.get(term.district);
      const donor = parties.findIndex(party => party.id === term.donor);
      const endorsed = parties.findIndex(party => party.id === term.endorsed);
      district.votes = transferVotes(district.votes, parties, donor, endorsed);
    }
    applied.push({parties:agreement.parties, districts:settled.length});
  }
  return applied;
}

export function validateElectoralPact(p, month) {
  const pact = p.electoralPact;
  if (p.electoralPactRevision !== undefined && p.electoralPactRevision !== 1) throw new Error('Повреждены правила предвыборных соглашений.');
  if (pact === undefined) return;
  const districts = new Set(), parties = new Set();
  const invalid = !Number.isInteger(pact?.due) || pact.due !== month + 1 || !Array.isArray(pact.agreements) ||
    pact.agreements.length > 8 || pact.agreements.some(agreement => {
      const ids = agreement.parties;
      if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1] ||
          ids.some(id => parties.has(id) || !p.parties.some(party => party.id === id)) ||
          !['pending','accepted','rejected'].includes(agreement.status) ||
          (agreement.status === 'pending' && !ids.includes(p.executive.playerParty)) ||
          !Array.isArray(agreement.terms) || !agreement.terms.length || agreement.terms.length > 48) return true;
      ids.forEach(id => parties.add(id));
      return agreement.terms.some(({district, donor, endorsed}) => {
        if (typeof district !== 'string' || districts.has(district) || !ids.includes(donor) ||
            !ids.includes(endorsed) || donor === endorsed) return true;
        districts.add(district);
        return false;
      }) || ids.some(id => agreement.terms.filter(term => term.donor === id).length * 2 !== agreement.terms.length);
    });
  if (invalid) throw new Error('Повреждено предвыборное соглашение.');
}
