import {hash} from './political-config.js';
// Seeded scenario shocks; frequency and amplitudes are gameplay assumptions.
const SCENARIOS=[
 {title:'Мировой спад',text:'Зарубежный спрос сократился. Экспортёрам станет труднее продавать товары.',key:'foreignDemand',multiplier:.85},
 {title:'Подъём мировой экономики',text:'Зарубежный спрос растёт. У экспортёров появились новые возможности.',key:'foreignDemand',multiplier:1.15},
 {title:'Энергетический кризис',text:'Импортная энергия подорожала. Издержки предприятий и давление на цены возрастают.',key:'energyPrice',multiplier:1.3},
 {title:'Энергия становится дешевле',text:'Снижение мировых цен на энергию уменьшает издержки импортёров.',key:'energyPrice',multiplier:.8},
 {title:'Сырьевой бум',text:'Мировые цены на сырьё выросли. Выиграют экспортёры, а импортёрам придётся платить больше.',key:'commodityPrice',multiplier:1.3},
 {title:'Падение сырьевых цен',text:'Выручка сырьевых экспортёров окажется под давлением.',key:'commodityPrice',multiplier:.75},
 {title:'Сбои международных поставок',text:'Импортные компоненты стали менее доступны. Некоторые предприятия столкнутся с нехваткой материалов.',key:'importAvailability',multiplier:.8},
 {title:'Восстановление международных поставок',text:'Доступность импортных компонентов улучшилась.',key:'importAvailability',multiplier:1.15},
 {title:'Неурожай',text:'Неблагоприятный сезон снижает сельскохозяйственный выпуск и усиливает давление на цены еды.',key:'weather',multiplier:.8},
 {title:'Благоприятный сельскохозяйственный сезон',text:'Высокая урожайность поддерживает выпуск и предложение продовольствия.',key:'weather',multiplier:1.15}
];
export function worldEvent(s){
 const anchor=s.politics?.livingWorldStart??0;
 if(!s.politics?.livingWorld||s.month<=anchor)return null;
 const block=Math.floor((s.month-anchor-1)/30),start=anchor+block*30+5+Math.floor(hash(s.seed,'world-start',block)*12),duration=6+Math.floor(hash(s.seed,'world-duration',block)*9);
 if(s.month<start||s.month>=start+duration)return null;
 const scenario=SCENARIOS[Math.floor(hash(s.seed,'world-kind',block)*SCENARIOS.length)];
 return {id:`world:${s.seed}:${anchor}:${block}`,start,duration,...scenario};
}
