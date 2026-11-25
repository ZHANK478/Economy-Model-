import {partyDisplayName} from './political-config.js';
import {electionStory} from './election-ui.js';
import {pilotHeadline} from './scenario-pilots.js';
import {FOREIGN_STEPS} from './foreign-programme.js';
import {worldDecisionAnnouncements,worldDecisionNews} from './world-decisions.js';
import {historicalNews} from './historical-world.js';
import {activeLanguage} from './localization.js';
import {interfaceNumberFormatter} from './localization.js';
import {NEWSPAPERS,pressCompanies,pressEnabled} from './press-market.js';
import {newspaperCandidates,updateNewspaper} from './newspaper.js';
import {euTradeStatus} from './trade-partners.js';
import {OUTLOOK_LIMITS} from './country-outlook.js';

const republic={id:'republic',name:'Вестник республики',beat:'Общенациональная газета'};
const papersFor=s=>pressEnabled(s)?NEWSPAPERS:[republic];
const destination=issue=>issue.key==='world'?'press-dispatch':
  ['default','banking','borrowing','warning','payment-risk','recovery'].includes(issue.key)?'press-ledger':
  issue.key==='output'?'press-workers':'press-chronicle';

export const latestPressIssue=(press,paper)=>press.editions?.[paper]?.at(-1);
export const pressUnread=(press,id)=>Boolean(latestPressIssue(press,id)&&press.readEditions?.[id]!==latestPressIssue(press,id).id);
export const unreadPressCount=(s,press)=>papersFor(s).filter(paper=>pressUnread(press,paper.id)).length;
export function defaultPressPaper(s,press){
  const papers=papersFor(s);
  return papers.find(paper=>pressUnread(press,paper.id))?.id??papers.reduce((latest,paper)=>
    (latestPressIssue(press,paper.id)?.month??-1)>(latestPressIssue(press,latest.id)?.month??-1)?paper:latest,papers[0]).id;
}
export function latestPressHeadline(s,press){
  const headlines=papersFor(s).flatMap(paper=>{
    const issue=latestPressIssue(press,paper.id);
    return issue?[{paper,issue,unread:pressUnread(press,paper.id)}]:[];
  });
  return headlines.sort((a,b)=>b.issue.month-a.issue.month||Number(b.unread)-Number(a.unread))[0]??null;
}
export function readPressPaper(press,id){
  const issue=latestPressIssue(press,id);
  if(!issue||!pressUnread(press,id))return false;
  (press.readEditions??={})[id]=issue.id;
  return true;
}

export function updatePress(s,press) {
  const previousIssue=press.issue, previousPending=press.pending;
  const incoming=updateNewspaper(s,press);
  let changed=false;
  const publish=(paper,id,month,title,text,critical=false,english=null)=>{
    if(press.published?.includes(id)||press.editions?.[paper]?.some(issue=>issue.id===id))return;
    if(critical&&pressCompanies(s).some(c=>c.id===paper&&!c.active))
      paper=papersFor(s).find(p=>!pressCompanies(s).some(c=>c.id===p.id&&!c.active))?.id??paper;
    if(pressCompanies(s).some(c=>c.id===paper&&!c.active))return;
    const archive=((press.editions??={})[paper]??=[]);
    archive.push({id,month,title,text:text.filter(Boolean),...(english?{english}:{})});
    if(archive.length>48)archive.shift();
    press.published=[...(press.published??[]),id].slice(-160);
    changed=true;
  };
  const uk=pressEnabled(s);
  // Keep the latest special edition from earlier saves. Regular reports were
  // rendered on demand and were never written to the save.
  const special=incoming??(!press.editions?previousIssue:null);
  if(special){
    const lead=special.key==='output'?'За месяц предприятия резко сократили выпуск. Для работников многое зависит от того, как долго продлится спад.':special.lead;
    const paper=uk?destination(special):republic.id;
    publish(paper,special.id,special.month,special.title,[lead,special.body],special.priority>=95);
    if(!incoming&&!previousPending)readPressPaper(press,paper);
  }
  // An unread edition stays in the archive without blocking future events.
  press.pending=false;
  const national=uk?'press-chronicle':republic.id;
  const ruOutcomes={approved:'Мера утверждена',rejected:'Палата отклонила предложение',pending:'Предложение на рассмотрении',declined:'Предложение отклонено'};
  const enOutcomes={approved:'Measure approved',rejected:'Commons rejects the proposal',pending:'Proposal under consideration',declined:'Proposal declined'};
  for(const item of press.ministerialResults??[]){
    const speaker=item.person?item.person+' · ':'';
    publish(national,item.id,item.month,ruOutcomes[item.outcome],[speaker+item.title],true,
      {enTitle:enOutcomes[item.outcome],enText:speaker+item.en});
  }
  if(s.politics?.historicalWorldStart!==undefined&&press.historicalCheckedMonth!==s.month){
    for(const event of historicalNews(s).filter(event=>event.start>(press.historicalCheckedMonth??s.month-1)))
      publish(uk?'press-dispatch':national,event.id,event.start,event.title,[event.text],true);
    press.historicalCheckedMonth=s.month;
  }
  for(const item of [...worldDecisionAnnouncements(s).filter(item=>item.start===s.month),...worldDecisionNews(s)])publish(uk?'press-dispatch':national,item.id,item.start,item.title,[item.text],true);
  for(const item of s.politics?.foreignProgramme?.news??[]){
    const title=item.passed?'Палата общин одобрила проект':'Палата общин отклонила проект';
    publish(uk?'press-dispatch':national,'treaty:'+item.id+':'+item.month,item.month,title,[FOREIGN_STEPS[item.id].title],true);
  }
  for(const [id,pilot] of Object.entries(s.politics?.scenarioDiplomacy?.pilots??{})){
    if(pilot.finished===undefined)continue;
    const headline=pilotHeadline(id,pilot.completed);
    publish(uk?'press-dispatch':national,'pilot:'+id,pilot.finished,headline,[],true);
  }
  if(uk&&s.month===0){
    const growth=interfaceNumberFormatter({maximumFractionDigits:1}).format(s.metrics.gdpGrowthYoY);
    publish(national,'millennium:0',0,'Британия входит в новое десятилетие',
      [`К началу 2000 года экономика выросла на ${growth}% за год. Вестминстер готовится к работе в новом созыве.`]);
  }
  if(press.criticalCheckedMonth!==s.month){
    press.criticalCheckedMonth=s.month;
    for(const issue of newspaperCandidates(s).filter(row=>row.priority>=95||row.key==='output')){
      if(issue.key==='default'&&issue.id!=='default:'+s.month)continue;
      publish(uk?destination(issue):national,issue.id,issue.month,issue.title,[issue.lead,issue.body],true);
    }
    const rows=s.history?.filter(row=>!row.synthetic&&row.month>=0&&row.month<s.month).slice(-3)??[];
    const banking=s.metrics.liquidityCoverage;
    if(rows.at(-1)?.month===s.month-1&&rows.at(-1).liquidityCoverage>=50&&banking<50){
      publish(uk?'press-ledger':national,'bank-liquidity:'+s.month,s.month,'Банкам резко не хватает ликвидности',
        ['У банков всё меньше средств для срочных расчётов. Показатель покрытия ликвидности упал ниже 50%, и отдельные платежи могут задержаться.'],true);
    }
    const limits=[
      ['mediaFreedom',OUTLOOK_LIMITS.freedom[0],'Свобода прессы резко сократилась','Возможности редакций работать независимо существенно сузились.'],
      ['judicialIndependence',OUTLOOK_LIMITS.freedom[0],'Независимость судов ослабла','Судебная система испытывает сильное внешнее влияние.'],
    ];
    if(rows.length===3&&rows.every((row,i)=>row.month===s.month-3+i)){
      for(const [key,limit,title,detail] of limits){
        if(rows[0][key]>=limit&&[rows[1][key],rows[2][key],s.metrics[key]].every(value=>value<limit)){
          publish(national,key+':'+s.month,s.month,title,[detail,'Ухудшение подтверждается данными трёх месяцев.'],true);
        }
      }
    }
  }
  const disclosures=s.rentSeeking?.cases?.filter(row=>row.detectedMonth===s.month&&row.status!=='unobserved')??[];
  if(disclosures.length){
    publish(uk?'press-ledger':national,'public-audit:'+s.month,s.month,'Проверка выявила скрытые нарушения',
      ['Контрольные органы начали расследование после того, как проверка выявила признаки нарушений в госзаказах или при выдаче разрешений.'],true);
  }
  for(const event of s.territorialEvents?.news??[]){
    const paper=uk?event.id.includes(':arrears:')?'press-ledger':'press-workers':national;
    publish(paper,event.id,event.month,event.title,[event.detail],true);
  }
  for(const election of s.politics?.elections?.filter(e=>e.month===s.month&&(!e.initial||s.scenario?.id==='uk-2000'))??[]){
    const issue=electionStory(s,election,{english:false});
    publish(national,electionIssueId(election),s.month,issue.title,issue.text,true);
  }
  if(!uk)return changed;


  const cabinet=s.politics.parliamentary?.history?.at(-1);
  if(cabinet?.month===s.month&&s.month>0&&cabinet.leader!==cabinet.previous){
    const leader=s.politics.parties.find(p=>p.id===cabinet.leader);
    if(leader)publish(national,'cabinet:'+s.month+':'+leader.id,s.month,'В Вестминстере сменилось правительство',
      [`«${partyDisplayName(leader)}» возглавила правительство. Теперь новому кабинету предстоит провести свою программу через Палату общин.`]);
  }
  const eu=euTradeStatus(s);
  if(eu?.exitDue===s.month+24)
    publish('press-dispatch','eu-notice:'+s.month,s.month,'Лондон объявил о выходе из ЕС',
      ['Лондон запустил процедуру выхода. На время переходного периода Британия сохраняет доступ к единому рынку и продолжает вносить взносы.']);
  if(eu?.exitMonth===s.month)
    publish('press-dispatch','eu-exit:'+s.month,s.month,'Британия покинула единый рынок',
      ['Для торговли с ЕС вступили в силу новые таможенные правила. Экспортёрам предстоит пересмотреть условия поставок, а Лондон сможет устанавливать собственные внешние пошлины.']);
  for(const notice of s.defense?.notices??[]){
    if(notice.month!==s.month||!['crisis','war','settlement','withdrawal','alliance','alliance-lapse','defeat'].includes(notice.type))continue;
    publish('press-dispatch',notice.id,notice.month,notice.title,[notice.text.replace(/ Решение — в разделе армии\.$/,'')]);
  }
  const recent=s.history?.filter(row=>!row.synthetic&&row.month>=0&&row.month<s.month).slice(-3)??[];
  if(s.month>=3&&recent.length===3&&s.metrics.unemployment>=10&&recent.every(row=>row.unemployment<10))
    publish('press-workers','unemployment:'+s.month,s.month,'Безработица достигла двузначного уровня',
      ['После нескольких месяцев ниже отметки в 10% без работы остался как минимум каждый десятый участник рынка труда. Дальнейшие увольнения увеличат нагрузку на систему пособий.']);
  return changed;
}

const electionIssueId=election=>'election:'+election.kind+':'+election.month;

export function electionNewspaper(s,election,{esc,date}){
 const issue=electionStory(s,election),en=activeLanguage()==='en';
 const paper=pressEnabled(s)?NEWSPAPERS.find(paper=>paper.id==='press-chronicle'):republic;
 return `<dialog id="election-headline-dialog" data-election-id="${election.id}" class="newspaper-popup press-reader" aria-labelledby="election-headline-heading">
  <article class="newspaper-sheet">
   <header class="newspaper-masthead"><strong>${esc(paper.name)}</strong><div><span>${en?'Special edition':'Специальный выпуск'}</span><time>${date(election.month,true)}</time></div></header>
   <h2 id="election-headline-heading" tabindex="-1" autofocus>${esc(issue.title)}</h2>
   ${issue.text.map(line=>`<p>${esc(line)}</p>`).join('')}
   <footer><button type="button" data-action="election-open" data-election-id="${election.id}">${en?'Full results':'Полные результаты'}</button>
   <button type="button" data-action="election-ack" data-election-id="${election.id}">${en?'Continue':'Продолжить'}</button></footer>
  </article>
 </dialog>`;
}

export function pressDialog(s,selected,press,{esc,date,issueId}){
  const papers=papersFor(s);
  const paper=papers.find(p=>p.id===selected)??papers[0];
  const archive=press.editions?.[paper.id]??[];
  const issue=(issueId?archive.find(issue=>issue.id===issueId):null)??archive.at(-1);
  const position=issue?archive.indexOf(issue):-1;
  const election=issue&&s.politics?.elections?.find(e=>electionIssueId(e)===issue.id);
  const electionArticle=election?electionStory(s,election):null;
  const story=issue&&[...historicalNews(s),...worldDecisionAnnouncements(s),...worldDecisionNews(s)].find(event=>event.id===issue.id);
  const english=activeLanguage()==='en'&&issue?(issue.english??story):null;
  const stopped=pressCompanies(s).some(c=>c.id===paper.id&&!c.active);
  return `<dialog id="world-news-dialog" class="newspaper-popup press-reader" aria-labelledby="world-news-heading">
    ${papers.length>1?`<nav class="press-tabs" aria-label="Газеты">${papers.map(p=>`<button type="button" data-press-paper="${esc(p.id)}" aria-pressed="${p.id===paper.id}">${esc(p.name)}${pressUnread(press,p.id)?' <span aria-label="Новый выпуск">●</span>':''}</button>`).join('')}</nav>`:''}
    <article class="newspaper-sheet"><header class="newspaper-masthead"><strong>${esc(paper.name)}</strong><div><span>${esc(paper.beat)}</span>${issue?`<time>${date(issue.month,true)}</time>`:''}</div></header>
    <h2 id="world-news-heading" tabindex="-1">${issue?esc(electionArticle?.title??english?.enTitle??story?.title??issue.title):stopped?'Выпуск приостановлен':'Пока без выпусков'}</h2>
    ${issue?(electionArticle?.text??(english?[english.enText]:story?[story.text]:issue.text)).map(p=>`<p>${esc(p)}</p>`).join(''):''}
    <footer><div class="press-edition-nav">${position>0?`<button data-press-issue="${esc(archive[position-1].id)}">← Предыдущий выпуск</button>`:''}
    ${position>=0&&position<archive.length-1?`<button data-press-issue="${esc(archive[position+1].id)}">Следующий выпуск →</button>`:''}</div>
    ${election?`<button type="button" data-action="election-open" data-election-id="${election.id}">${activeLanguage()==='en'?'Full results':'Полные результаты'}</button>`:''}
    <button data-close-button data-action="world-news-close" aria-label="Закрыть газеты">Закрыть <span aria-hidden="true">×</span></button></footer>
    </article></dialog>`;
}
