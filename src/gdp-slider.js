import {interfaceNumberFormatter} from './localization.js';
const format=interfaceNumberFormatter({minimumFractionDigits:2,maximumFractionDigits:5});
export const formatGDPPercent=value=>format.format(Number(value)||0)+'% ВВП';

// Small budget shares need finer steps than large ones.
const bands=[[.01,.0001],[1,.01],[10,.1],[100,1]];
function positionForShare(share,precision){
  let position=0,lower=0;
  for(const [limit,step] of bands.slice(precision==='fine'?0:1)){
    position+=(Math.min(share,limit)-lower)/step;
    if(share<=limit)return Math.round(position);
    lower=limit;
  }
  return position;
}

export function gdpSliderShare(slider){
  let position=Number(slider.value),lower=0;
  for(const [limit,step] of bands.slice(slider.dataset.gdpSlider==='fine'?0:1)){
    const width=(limit-lower)/step;
    if(position<=width)return Number((lower+position*step).toFixed(4));
    position-=width;
    lower=limit;
  }
  return lower;
}

export function gdpSlider({value=0,disabled=false,label='Доля ВВП страны',precision='standard',maximum=100}){
  return `<label class="field gdp-slider"><span>${label} <output>${formatGDPPercent(value)}</output></span>
    <input type="range" aria-label="${label}" aria-valuetext="${formatGDPPercent(value)}" min="0" max="${positionForShare(Math.max(value,maximum),precision)}" step="1"
      value="${positionForShare(value,precision)}" data-gdp-slider="${precision}" ${precision==='fine'?'aria-keyshortcuts="Enter"':''} ${disabled?'disabled':''}></label>`;
}
