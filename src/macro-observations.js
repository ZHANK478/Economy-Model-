// World Bank WDI, annual 2000 reference observations (retrieved 2026-10-15).
// These describe annual averages, NOT observed January-2000 conditions or
// estimates of equilibrium unemployment / natural interest rates.
// A null lending rate is missing data, not a zero-interest observation.
// https://api.worldbank.org/v2/country/BGD;MEX;FRA/indicator/FP.CPI.TOTL.ZG?date=2000&format=json
// Codes: FP.CPI.TOTL.ZG, SL.UEM.TOTL.ZS, NY.GDP.MKTP.KD.ZG,
// FR.INR.LEND, FR.INR.DPST. Monetary rates below are decimals per year.
export const MACRO_OBSERVATIONS={"BGD":{"version":1,"referenceYear":2000,"inflationAnnual":0.022082562093753498,"unemployment":0.0327,"realGrowthAnnual":0.0529329471892532,"lendingRateAnnual":0.12755,"depositRateAnnual":0.0868666666666666},"MEX":{"version":1,"referenceYear":2000,"inflationAnnual":0.0949156149435402,"unemployment":0.026459999999999997,"realGrowthAnnual":0.0502928399378261,"lendingRateAnnual":0.16928333333333298,"depositRateAnnual":0.08256666666666661},"FRA":{"version":1,"referenceYear":2000,"inflationAnnual":0.0167061991153283,"unemployment":0.10217999999999999,"realGrowthAnnual":0.041409999640291496,"lendingRateAnnual":null,"depositRateAnnual":0.02625}};
export function validateInitialMacro(m){
 if(!m||m.version!==1||m.referenceYear!==2000)throw new Error('Некорректный макроэкономический ориентир');
 for(const key of ['inflationAnnual','realGrowthAnnual'])if(!Number.isFinite(m[key])||m[key]<=-.5||m[key]>1)throw new Error('Некорректная исходная динамика');
 for(const key of ['unemployment','depositRateAnnual'])if(!Number.isFinite(m[key])||m[key]<0||m[key]>=1)throw new Error('Некорректная исходная доля');
 if(m.lendingRateAnnual!==null&&(!Number.isFinite(m.lendingRateAnnual)||m.lendingRateAnnual<0||m.lendingRateAnnual>1))throw new Error('Некорректная исходная ставка');
 return structuredClone(m);
}
