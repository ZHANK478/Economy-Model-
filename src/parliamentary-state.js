// Revision-gated so old journals retain their original institutional rules.
export const parliamentary=s=>s.politics?.parliamentaryRevision===1&&s.politics.constitution.form==='parliamentary';
export const playerExecutive=s=>!parliamentary(s)||s.politics.executive.primeMinisterParty===s.politics.executive.playerParty&&s.politics.parliamentary.phase==='government';
export const cabinetParty=s=>parliamentary(s)?s.politics.executive.primeMinisterParty:s.politics.executive.playerParty;
