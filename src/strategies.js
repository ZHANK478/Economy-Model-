import {BASE_POLICY} from './config.js';

// A strategy is a reproducible sequence of government decisions, never an AI
// prediction. Only the stabilization strategy changes its rate endogenously.
export const STRATEGIES=[
  {id:'baseline',name:'Исходная политика',description:'Все решения исходной страны остаются постоянными.',patch:{}},
  {id:'stabilization',name:'Денежная стабилизация',description:'Ежемесячная ставка по правилу: точная ставка для ожидаемой инфляции и нейтральных 3%, плюс 0,5 отклонения инфляции от цели, минус 0,2 превышения безработицы над 9%. Сглаживание 25% за месяц.',patch:{},rule:true},
  {id:'cheap-credit',name:'Дешёвый кредит',description:'Ключевая ставка 2%, остальная политика исходная.',patch:{rate:2}},
  {id:'fiscal-stimulus',name:'Бюджетное стимулирование',description:'Закупки 15%, инфраструктура 6%, пособия 6% годовой базы ВВП.',patch:{governmentConsumption:15,publicInvestment:6,transfers:6}},
  {id:'consolidation',name:'Бюджетная консолидация',description:'НДС 22%, доходы 22%, прибыль 28%; закупки 4%, инфраструктура 2%, пособия 2%.',patch:{vat:22,incomeTax:22,corporateTax:28,governmentConsumption:4,publicInvestment:2,transfers:2}},
  {id:'infrastructure',name:'Инфраструктура и образование',description:'Инфраструктура 8%, образование 3%; остальные решения исходные.',patch:{publicInvestment:8,education:3}},
  {id:'social',name:'Здоровье и семьи',description:'Здравоохранение 5%, поддержка семей 3%, пособия 5%, образование 3%.',patch:{healthcare:5,familyBenefits:3,transfers:5,education:3}},
  {id:'tax-cuts',name:'Снижение налогов',description:'НДС 8%, доходы 6%, прибыль 10%; расходы исходные.',patch:{vat:8,incomeTax:6,corporateTax:10}},
  {id:'protection',name:'Пошлины и ограничения капитала',description:'Пошлина 20%, ограничения капитала 70/100.',patch:{tariff:20,capitalControls:70}},
  {id:'institutions',name:'Налоговое администрирование и конкуренция',description:'Налоговый контроль 95/100, конкуренция 95/100, с их бюджетной стоимостью.',patch:{taxEnforcement:95,competition:95}}
];
export function strategyPolicy(strategy,state) {
  const policy={...BASE_POLICY,...strategy.patch};
  if(strategy.rule) {
    const neutral=((1+state.expectedInflation)*(1+state.parameters.neutralRealRate)-1)*100;
    const target=Math.max(0,Math.min(40,neutral+.5*(state.metrics.inflationYoY-policy.inflationTarget)-.2*(state.metrics.unemployment-9)));
    policy.rate=state.policy.rate+.25*(target-state.policy.rate);
  }
  return policy;
}
