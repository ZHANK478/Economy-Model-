// WDI annual 2000 snapshots; growth expectation = median 1990-1999 real GDP growth.
// Source bytes/URLs in research/national-accounts-2000.json. Not January observations.
export const NATIONAL_ACCOUNTS={"BGD":{"consumptionGDP":75.0081004560836,"governmentConsumptionGDP":4.97312138319291,"investmentGDP":23.8085625731369,"remittancesGDP":3.68659677566545,"trendGrowth":0.0469085904668055,"version":1,"referenceCountry":"BGD","referenceYear":2000,"broadMoneyGDP":30.5539892604712},"MEX":{"consumptionGDP":69.0091905191634,"governmentConsumptionGDP":9.03701601445798,"investmentGDP":22.2649246086997,"remittancesGDP":1.01403249008326,"trendGrowth":0.0418501642951106,"version":1,"referenceCountry":"MEX","referenceYear":2000,"broadMoneyGDP":21.357251506457},"FRA":{"consumptionGDP":53.8448988688494,"governmentConsumptionGDP":22.5671731170038,"investmentGDP":21.8578770673408,"remittancesGDP":0.651713325235688,"trendGrowth":0.023442268225120202,"version":1,"referenceCountry":"FRA","referenceYear":2000,"broadMoneyGDP":null}};
export function validateInitialAccounts(a){
 if(!a||a.version!==1||a.referenceYear!==2000||!['BGD','MEX','FRA'].includes(a.referenceCountry))throw new Error('Повреждены исходные национальные счета');
 if(a.broadMoneyGDP!==null&&(!Number.isFinite(a.broadMoneyGDP)||a.broadMoneyGDP<=0||a.broadMoneyGDP>300))throw new Error('Некорректная денежная масса');
 for(const k of ['consumptionGDP','governmentConsumptionGDP','investmentGDP','remittancesGDP'])if(!Number.isFinite(a[k])||a[k]<0||a[k]>150)throw new Error('Некорректный показатель национальных счетов');
 if(!Number.isFinite(a.trendGrowth)||a.trendGrowth<=-.05||a.trendGrowth>.2)throw new Error('Некорректный исходный тренд');
 return structuredClone(a);
}
