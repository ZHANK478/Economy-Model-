const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const fixedExchange=s=>['currencyBoard','dollarized'].includes(s.policy.monetaryRegime);
export const hasDiscretionaryCB=s=>['discretion','rule'].includes(s.policy.monetaryRegime);
export function initializeMonetary(s){
  const regime=s.policy.monetaryRegime;
  const rate=regime==='discretion'?s.policy.rate:regime==='rule'?s.parameters.neutralRealRate*100+s.policy.inflationTarget+1.5*((s.initialAccounts?s.initialMacro.inflationAnnual*100:8)-s.policy.inflationTarget)-(s.initialAccounts?0:4)
    :fixedExchange(s)?s.world.globalRate:s.world.globalRate+6;
  s.monetary={effectiveRate:clamp(rate,0,40),peg:s.exchangeRate,previousRegime:regime};
}
export function advanceMonetary(s,prev,w,events){
  const regime=s.policy.monetaryRegime;
  if(regime!==prev.policy.monetaryRegime){
    s.monetary.peg=prev.exchangeRate;
    events.push('Изменён денежный режим. Существующие номинальные договоры сохраняются; их ставка пересматривается с задержкой.');
  }
  const independent=s.politics.enabled&&s.politics.constitution.independentCB;
  if(regime==='discretion'&&!independent)s.monetary.effectiveRate=s.policy.rate;
  else if(regime==='rule'||regime==='discretion'&&independent)s.monetary.effectiveRate=clamp(s.parameters.neutralRealRate*100+s.policy.inflationTarget
    +1.5*(prev.metrics.inflationYoY-s.policy.inflationTarget)+.5*prev.metrics.outputGap,0,40);
  else if(fixedExchange(s))s.monetary.effectiveRate=w.globalRate;
  else s.monetary.effectiveRate=clamp(w.globalRate+prev.expectedInflation*100-2
    +Math.max(0,25-prev.metrics.bankLiquidity)*.08,0,40);
  s.monetary.previousRegime=regime;
}
export function monetaryMetrics(s){return {effectivePolicyRate:s.monetary.effectiveRate,
  monetaryReserveCoverage:s.government.reservesUSD*s.exchangeRate/Math.max(s.bank.reserves,1)*100};}
