import {pressTitle} from './press-market.js';
import {SECTORS} from './config.js';
import {sectorCompanies} from './enterprise-market.js';

const sum=(rows,measure)=>rows.reduce((total,row)=>total+(measure(row)||0),0);
// Each ratio is measured against its own inclusion threshold. It is not a
// forecast of disruption, and assets and monthly sales are never added.
const relative=(amount,total,threshold)=>total>0&&amount>0?amount/(total*threshold):0;

export function codexMarket(state){
  const {metrics}=state;
  const employment=metrics.employment;
  const sales=sum(state.firms,firm=>firm.lastRevenue);
  const annualOutput=metrics.nominalGDPAnnual;
  const actors=[];
  for(const [index,sector] of SECTORS.entries()){
    for(const company of sectorCompanies(state,index)){
      if(pressTitle(company.id)||company.agricultureProtectionClaim||company.familyGroup!==undefined)continue;
      const {ownership}=company;
      if((ownership?.domestic??0)+(ownership?.foreign??0)+(ownership?.cooperative??0)<=.5)continue;
      const jobs=relative(company.workers,employment,.02);
      const turnover=relative(company.lastRevenue,sales,.03);
      actors.push({id:company.id,sector:sector.id,archived:!company.active,
        foundedMonth:company.foundedMonth,domesticOwnership:ownership.domestic,scale:Math.max(jobs,turnover),influence:jobs>=turnover?
          'От её работы зависит заметная доля рабочих мест в стране.':
          'На компанию приходится заметная доля оборота предприятий страны.'});
    }
  }
  // The model stores public ownership for the banking sector as a whole.
  const banks=state.foundation?.banks??[];
  if(state.bank.stateOwnership<.5){
    const deposits=sum(banks,bank=>bank.deposits),loans=sum(banks,bank=>bank.loans);
    for(const bank of banks){
      const scale=Math.max(relative(bank.deposits,deposits,.05),relative(bank.loans,loans,.05));
      actors.push({id:'bank-'+bank.id,sector:'bank',archived:!bank.operating,scale,
        influence:'Через банк проходит заметная часть вкладов и кредитов страны.'});
    }
  }
  for(const network of state.networks??[]){
    if(!network.operator)continue;
    const managed=network.private+network.concession;
    const networkShare=relative(managed,managed+network.public+network.municipal,.10);
    const assets=relative(managed*(metrics.investmentPrice??state.consumerPriceIndex/100),annualOutput,.005);
    actors.push({id:'network-'+network.id,sector:'network',scale:Math.min(networkShare,assets),
      influence:'От работы оператора зависит доступность части инфраструктурных услуг.'});
  }
  const funds=[
    ['pension',state.social?.pensionFund,'Фонд распоряжается пенсионными накоплениями домохозяйств. Его решения влияют на объём средств, доступных для будущих выплат.'],
    ['investment',state.social?.investmentFund,'Через фонд домохозяйства размещают часть своих долгосрочных сбережений.'],
    ['insurance',state.social?.insuranceFund,'Фонд объединяет взносы и финансирует страховые выплаты при потере работы.'],
    ['health',state.social?.healthFund,'Фонд аккумулирует взносы и возмещает часть расходов на медицинскую помощь.'],
  ];
  for(const [kind,fund,influence] of funds){
    if(!fund)continue;
    actors.push({id:'fund-'+kind,sector:'fund',scale:relative(fund.cash+fund.bankClaim,annualOutput,.005),influence});
  }
  return actors.filter(actor=>actor.scale>=1);
}
