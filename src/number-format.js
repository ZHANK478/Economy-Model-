import {interfaceLocale} from './localization.js';

// Reuse Intl formatters across render calls.
const formatters=new Map();
export function formatNumber(value,digits=1){
 const number=Number(value);if(!Number.isFinite(number))return '—';
 const locale=interfaceLocale(), key=locale+':'+digits;
 let formatter=formatters.get(key);
 if(!formatter){formatter=new Intl.NumberFormat(locale,{minimumFractionDigits:digits,maximumFractionDigits:digits});formatters.set(key,formatter);}
 return formatter.format(number);
}
