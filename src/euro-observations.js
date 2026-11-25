// Annual USD per euro, Fed G.5A (FRED AEXUSEU), 2000–2025.
const dollars=[.9232,.8952,.9454,1.1321,1.2438,1.2449,1.2563,1.3711,1.4726,1.3935,1.3261,1.3931,1.2859,1.3281,1.3297,1.1096,1.1072,1.1301,1.1817,1.1194,1.1410,1.1830,1.0534,1.0817,1.0820,1.1306];
// Selected ECB main refinancing rate changes, applied at monthly resolution.
const rates=[
 [2000,1,3],[2000,4,3.75],[2000,6,4.25],[2000,10,4.75],[2001,5,4.5],[2001,11,3.25],
 [2002,12,2.75],[2003,6,2],[2005,12,2.25],[2006,12,3.5],[2007,6,4],[2008,7,4.25],
 [2008,10,3.75],[2008,12,2.5],[2009,5,1],[2011,7,1.5],[2011,12,1],[2012,7,.75],
 [2013,11,.25],[2014,9,.05],[2016,3,0],[2022,7,.5],[2022,12,2.5],[2023,9,4.5],
 [2024,6,4.25],[2024,9,3.65],[2025,6,2.15],[2026,6,2.4],[2026,9,2.65],
];

export const euroCalendar=(s)=>((s.startYear??2000)-2000)*12+s.month;
export function dollarsPerEuro(s){
 const elapsed=Math.max(0,euroCalendar(s))/12;
 const year=Math.min(dollars.length-1,Math.floor(elapsed));
 return dollars[year]+((dollars[year+1]??dollars[year])-dollars[year])*(elapsed-Math.floor(elapsed));
}
export function ecbRate(s){
 const month=euroCalendar(s);
 return rates.findLast(([y,m])=>12*(y-2000)+m-1<=month)?.[2]??rates[0][2];
}
