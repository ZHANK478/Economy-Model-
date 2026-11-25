import {playerExecutive} from './parliamentary-state.js';

export const PILOTS={
 eu:{organization:'eu',months:2,options:{
  forms:{name:'Сократить бумажную отчётность',minimum:.000015},
  smallFirms:{name:'Подключить малых экспортёров',minimum:.00003},
 }},
 global:{organization:'trade-promotion',months:3,options:{
  canada:{name:'Открыть программу в Канаде',minimum:.000015,market:'ca'},
  australia:{name:'Открыть программу в Австралии',minimum:.000015,market:'au'},
 }},
};

export const pilotRecord=(s,id)=>s.politics?.scenarioDiplomacy?.pilots?.[id];
export const pilotOption=(id,choice)=>Object.hasOwn(PILOTS,id)&&Object.hasOwn(PILOTS[id].options,choice)?PILOTS[id].options[choice]:null;

export function startScenarioPilot(s,id,choice){
 const diplomacy=s.politics.scenarioDiplomacy;
 if(s.scenario?.id!=='uk-2000'||!diplomacy||!s.economy||!s.politics.executive.inOffice||!playerExecutive(s))
  throw new Error('Программу запускает действующий кабинет.');
 if(!pilotOption(id,choice)||pilotRecord(s,id))throw new Error('Эта программа недоступна.');
 if(id==='eu'&&diplomacy.euTrade?.exitDue!=null)throw new Error('Программа ЕС недоступна после начала выхода.');
 (diplomacy.pilots??={})[id]={choice,start:s.month,paidMonths:0};
}

export function settleScenarioPilots(s,ledger,events){
 for(const [id,record] of Object.entries(s.politics.scenarioDiplomacy.pilots??{})){
  if(record.finished!==undefined||s.month<=record.start)continue;
  const program=PILOTS[id],entry=ledger[program.organization];
  const minimum=pilotOption(id,record.choice).minimum;
  if(!(id==='eu'&&s.politics.scenarioDiplomacy.euTrade?.exitDue!=null)&&entry?.funded>=.999&&
    (entry.share??0)>=minimum)record.paidMonths++;
  if(record.paidMonths>=program.months||s.month-record.start>=6){
   record.finished=s.month;
   record.completed=record.paidMonths>=program.months;
   if(id==='global'&&!record.completed){
    const diplomacy=s.politics.scenarioDiplomacy;
    delete diplomacy.shares?.[program.organization];
    delete diplomacy.budgeted?.[program.organization];
    delete diplomacy.levels[program.organization];
   }
   events.push(pilotHeadline(id,record.completed));
  }
 }
}

export function pilotHeadline(id,completed){
 return id==='eu'?(completed?'Экспортная программа с ЕС заработала':'Европейский пилот завершился без запуска'):
  (completed?'Британские экспортёры получили поддержку на новом рынке':'Торговая программа завершилась без запуска');
}

export function pilotExportFactor(s,market){
 const record=pilotRecord(s,'global');
 if(!record?.completed||pilotOption('global',record.choice).market!==market)return 1;
 const payment=s.politics.scenarioDiplomacy.ledger['trade-promotion'];
 const minimum=pilotOption('global',record.choice).minimum;
 return payment?.share>=minimum?1-.005*payment.funded:1;
}

export function validateScenarioPilots(s){
 const rows=s.politics.scenarioDiplomacy.pilots;
 if(rows===undefined)return;
 const invalid=()=>{throw new Error('Повреждены данные сценарных программ.');};
 if(s.scenario?.id!=='uk-2000'||!rows||typeof rows!=='object'||Array.isArray(rows))invalid();
 for(const [id,row] of Object.entries(rows)){
  if(!pilotOption(id,row?.choice)||!Number.isInteger(row.start)||row.start<0||row.start>s.month||
    !Number.isInteger(row.paidMonths)||row.paidMonths<0||row.paidMonths>PILOTS[id].months||row.paidMonths>s.month-row.start)invalid();
  if(row.finished===undefined){if(row.completed!==undefined||row.paidMonths===PILOTS[id].months)invalid();continue;}
  if(!Number.isInteger(row.finished)||row.finished<=row.start||row.finished>s.month||row.finished>row.start+6||
    row.completed!==(row.paidMonths===PILOTS[id].months)||(!row.completed&&row.finished!==row.start+6))invalid();
 }
}
