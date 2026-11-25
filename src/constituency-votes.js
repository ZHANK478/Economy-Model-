import {integerVotes} from './elections.js';
import {hash} from './political-config.js';

const sum = values => values.reduce((total, value) => total + value, 0);

// The opening map assigns each seat a local base. Its strength varies from
// marginal seats to strongholds and stays fixed between elections.
export function applyConstituencyProfiles(seed, opening, parties, districts){
  if (!opening?.districts?.length || !districts.length) return;
  const openingById = new Map(opening.districts.map(row => [row.id, row]));
  const turnout = districts.map(row => sum(row.votes));
  const nationalVotes = parties.map((_, i) => districts.reduce((total, row) => total + row.votes[i], 0));
  const votes = districts.map(row => {
    const base = openingById.get(row.id);
    const strength = hash(seed, row.id, 'constituency-strength');
    return row.votes.map((value, i) => {
      const id = parties[i].id;
      const local = .65 + 1.2 * hash(seed, row.id, id, 'constituency-party');
      const stronghold = base?.winner === id ? 2 + 16 * strength ** 2 : 1;
      return value * local * stronghold;
    });
  });

  // Fit the local preferences to the turnout of each district and to the
  // national vote totals. Local strongholds affect where votes land.
  for (let pass = 0; pass < 24; pass++){
    const totals = parties.map((_, i) => votes.reduce((total, row) => total + row[i], 0));
    const scale = totals.map((total, i) => total ? nationalVotes[i] / total : 0);
    for (const [d, row] of votes.entries()){
      for (let i = 0; i < row.length; i++) row[i] *= scale[i];
      const total = sum(row);
      if (!total) continue;
      for (let i = 0; i < row.length; i++) row[i] *= turnout[d] / total;
    }
  }

  districts.forEach((district, i) => { district.votes = integerVotes(votes[i], turnout[i]); });
}
