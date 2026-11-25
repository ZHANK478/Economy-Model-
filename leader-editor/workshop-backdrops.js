export const backdropNames=['Архивный оливковый','Кобальтовый','Бордовый бархат','Золотая охра','Изумрудный','Небесно-голубой','Светлый пергамент'];
const palettes=[
  ['#73795b','#30372a','#1c221c'], ['#558cd2','#204b86','#112748'],
  ['#ad5755','#6e293b','#371723'], ['#f2c665','#ad662a','#664125'],
  ['#64ac85','#2c6f58','#163b35'], ['#c7e3ed','#6da6c5','#3a6d94'],
  ['#f4e3b6','#c4ac77','#866c4c'],
];

export function createBackdrops(width,height) {
  return palettes.map(([light,base,shadow])=>{
    const canvas=document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const gradient=ctx.createRadialGradient(width*.39,height*.29,0,width*.48,height*.4,height*.68);
    gradient.addColorStop(0,light);
    gradient.addColorStop(.54,base);
    gradient.addColorStop(1,shadow);
    ctx.fillStyle=gradient;
    ctx.fillRect(0,0,width,height);
    return canvas;
  });
}

// One third of portraits get any tobacco accessory. The rest are unadorned.
export function randomMouthItem(random=Math.random) {
  const slot=Math.floor(random()*9);
  return slot<6?0:slot-5;
}
