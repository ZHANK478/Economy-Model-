import {hash} from './political-config.js';

// Personal net assets, in thousands of pounds at the campaign's opening.
// Medians are game assumptions. The right tails overlap across occupations.
const wealthProfiles={
  child:[28,1.20],partner:[155,1.03],sibling:[100,1.03],
  politician:[180,.94],judge:[440,.78],official:[245,.84],
  civic:[115,1.10],director:[720,1.04],ownerDirector:[2700,1.28],
  monarch:[45000,.86],consort:[6200,1.06],heir:[3400,1.10],
};
const ageAnchors=[[18,.23],[25,.48],[35,.78],[45,1],[60,1.5],[75,1.37]];
function ageFactor(age){
  for(let i=1;i<ageAnchors.length;i++){
    const [older,high]=ageAnchors[i];
    if(age<=older){
      const [younger,low]=ageAnchors[i-1];
      return low+(high-low)*Math.max(0,age-younger)/(older-younger);
    }
  }
  return ageAnchors.at(-1)[1];
}

export function characterWealth(seed,id,role,age){
  const [median,spread]=wealthProfiles[role];
  const radius=Math.sqrt(-2*Math.log1p(-hash(seed,id,'net-assets')));
  const sample=radius*Math.cos(2*Math.PI*hash(seed,id,'net-assets-tail'));
  return Math.round(median*ageFactor(age)*Math.exp(spread*sample));
}

export function directorWealth(seed,id,age,domesticOwnership=0){
  // A domestic firm's director is more likely to hold a meaningful equity
  // stake. This personal holding is independent of the company's gross assets.
  const role=hash(seed,id,'equity-stake')<.12+.38*domesticOwnership?'ownerDirector':'director';
  return characterWealth(seed,id,role,age);
}
