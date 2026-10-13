// SVG charts use the actual seat counts and sector values; they do not mutate state.
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS={socialist:'#b91f38',socialDemocrat:'#dc6273',green:'#84283f',agrarian:'#e79da8',regional:'#8ba7d8',liberal:'#3065b1',conservative:'#174078',national:'#102b50'};
export const partyColor=p=>COLORS[p.family]??'#647caa';
export function hemicycleSeats(parties){
 const groups=parties.filter(p=>p.seats>0).slice().sort((a,b)=>(a.platform?.economy??0)-(b.platform?.economy??0)||String(a.id).localeCompare(String(b.id)));
 const total=groups.reduce((a,p)=>a+p.seats,0);if(!Number.isInteger(total)||groups.some(p=>!Number.isInteger(p.seats)))throw new Error('Invalid seat counts');if(!total)return [];
 const rings=Math.max(2,Math.ceil(Math.sqrt(total)/2.2)),radii=Array.from({length:rings},(_,i)=>72+i*82/(rings-1)),weight=radii.reduce((a,b)=>a+b,0);
 const exact=radii.map(r=>total*r/weight),counts=exact.map(Math.floor),remaining=total-counts.reduce((a,b)=>a+b,0),order=exact.map((v,i)=>({i,fraction:v-counts[i]})).sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
 for(let i=0;i<remaining;i++)counts[order[i].i]++;
 const gap=82/(rings-1),chord=Math.min(...radii.map((r,i)=>counts[i]>1?2*r*Math.sin(Math.PI/(2*counts[i])):gap)),size=Math.min(8,.36*Math.min(gap,chord)),positions=[];
 radii.forEach((radius,ring)=>{for(let i=0;i<counts[ring];i++){const angle=Math.PI-Math.PI*(i+.5)/counts[ring];positions.push({angle,ring,cx:180+Math.cos(angle)*radius,cy:176-Math.sin(angle)*radius,r:size});}});
 positions.sort((a,b)=>b.angle-a.angle||a.ring-b.ring);
 let offset=0;return groups.flatMap(p=>Array.from({length:p.seats},(_,i)=>({...positions[offset++],party:p,index:i+1})));
}
export function parliamentChart(parties,{name,playerParty,coalition=[]}={}){
 const seats=hemicycleSeats(parties),total=seats.length,groups=parties.filter(p=>p.seats>0).slice().sort((a,b)=>(a.platform?.economy??0)-(b.platform?.economy??0)),majority=Math.floor(total/2)+1,coalitionTotal=groups.filter(p=>coalition.includes(p.id)).reduce((a,p)=>a+p.seats,0);
 const label=p=>name?name(p):p.name??p.id;
 return `<figure class="parliament-figure"><div class="parliament-visual"><svg class="parliament-chart" viewBox="0 0 360 218" role="img" aria-label="Парламент: ${total} мест, большинство ${majority}"><title>Состав парламента по партиям</title>${seats.map(s=>`<circle class="parliament-seat" data-party-id="${escape(s.party.id)}" cx="${s.cx.toFixed(3)}" cy="${s.cy.toFixed(3)}" r="${s.r.toFixed(3)}" fill="${partyColor(s.party)}" stroke="${s.party.id===playerParty?'#102b50':'#fff'}" stroke-width="${s.party.id===playerParty?'.8':'.5'}"><title>${escape(label(s.party))}: место ${s.index} из ${s.party.seats}</title></circle>`).join('')}<text class="parliament-total" x="180" y="145" text-anchor="middle">${total}</text><text class="parliament-total-label" x="180" y="165" text-anchor="middle">мест</text><text class="parliament-majority" x="180" y="204" text-anchor="middle">Большинство — ${majority}</text></svg><ul class="chart-legend-list parliament-legend">${groups.map(p=>`<li><span class="chart-color" style="background:${partyColor(p)}"></span><span>${escape(label(p))}${p.id===playerParty?'<small>Ваша партия</small>':''}</span><strong>${p.seats}</strong></li>`).join('')}</ul></div><figcaption>Коалиция: <strong>${coalitionTotal} из ${total} мест</strong></figcaption></figure>`;
}
export function pieSegments(values){
 if(values.some(v=>!Number.isFinite(v)||v<0))return null;const total=values.reduce((a,b)=>a+b,0);if(total<=0)return [];
 let angle=-Math.PI/2;return values.map((value,index)=>{const share=value/total,start=angle;angle+=share*2*Math.PI;return {index,value,share,start,end:angle};});
}
export function productionPie(items,{percent=v=>(v*100).toFixed(1)+'%'}={}){
 const segments=pieSegments(items.map(x=>x.value)),colors=['#174078','#c52b39','#537dbc','#e08b97','#a8bde0'];
 if(segments===null)return `<p class="small muted">Есть отрицательная добавленная стоимость: круговая диаграмма не применяется.</p><ul class="chart-legend-list">${items.map((x,i)=>`<li><span class="chart-color" style="background:${colors[i%colors.length]}"></span><span>${escape(x.label)}</span><strong>${escape(items.reduce((a,b)=>a+b.value,0)>0?percent(x.value/items.reduce((a,b)=>a+b.value,0)):'—')}</strong></li>`).join('')}</ul>`;
 if(!segments.length)return '<p class="small muted">Нет выпуска для диаграммы.</p>';
 const point=a=>`${(150+112*Math.cos(a)).toFixed(4)},${(150+112*Math.sin(a)).toFixed(4)}`;
 return `<figure class="production-figure"><svg class="production-pie" viewBox="0 0 300 300" role="img" aria-label="Доли отраслей в добавленной стоимости"><title>Структура производства</title>${segments.filter(s=>s.value>0).map(s=>{const title=`<title>${escape(items[s.index].label)}: ${escape(percent(s.share))}</title>`,style=`fill="${colors[s.index%colors.length]}" stroke="#fff" stroke-width="2" data-sector="${s.index}"`;return s.share>=1-1e-12?`<circle cx="150" cy="150" r="112" ${style}>${title}</circle>`:`<path d="M150,150 L${point(s.start)} A112,112 0 ${s.share>.5?1:0},1 ${point(s.end)} Z" ${style}>${title}</path>`;}).join('')}</svg><ul class="chart-legend-list production-legend">${segments.map(s=>`<li><span class="chart-color" style="background:${colors[s.index%colors.length]}"></span><span>${escape(items[s.index].label)}</span><strong>${escape(percent(s.share))}</strong></li>`).join('')}</ul></figure>`;
}
