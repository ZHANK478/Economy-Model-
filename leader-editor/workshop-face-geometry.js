const smooth = (start,end,value) => {
  const t=Math.min(1,Math.max(0,(value-start)/(end-start)));
  return t*t*(3-2*t);
};
const band=(value,min,lower,upper,max)=>smooth(min,lower,value)*(1-smooth(upper,max,value));

// The collar and the back of the skull stay fixed. Parts over the face use
// the same deformation field as the skin so eyes, brows and frames stay aligned.
const features=[
  (x,y,z)=>[Math.sign(x)*.086*smooth(0,.17,Math.abs(x))*(1-smooth(.48,.82,Math.abs(x)))*band(z,.86,1.07,1.58,1.81)*(1-smooth(-1.10,-.77,y)),0,0],
  (x,y,z)=>[0,0,.28*(Math.abs(x)-.30)*band(Math.abs(x),.06,.16,.52,.70)*band(z,.93,1.10,1.55,1.72)*(1-smooth(-1.10,-.77,y))],
  (x,y,z)=>[x*.47*band(z,.03,.24,.39,.58)*(1-smooth(-.97,-.55,y)),0,0],
  (x,y,z)=>[0,-.17*(1-smooth(.07,.26,Math.abs(x)))*band(z,.81,.95,1.19,1.40)*(1-smooth(-1.32,-1.10,y)),0],
];

export function faceMorphs(record,positions,normals){
  if(record.name!=='Head and continuous neck'&&
    !['hair','glasses','beardStyle','mouthItem','age'].includes(record.variant?.[0])&&
    !/^(Eye|Brow hair)/.test(record.name))return [];
  const step=.001;
  return features.map((offset,index)=>{
    const position=new Int16Array(positions.length),normal=new Int16Array(normals.length);
    for(let i=0;i<positions.length;i+=3){
      const x=positions[i],y=positions[i+1],z=positions[i+2];
      const d=offset(x,y,z);
      if(!d.some(Boolean))continue;
      const dx=offset(x+step,y,z),dy=offset(x,y+step,z),dz=offset(x,y,z+step);
      for(let axis=0;axis<3;axis++){
        position[i+axis]=Math.round(d[axis]*30000);
        // First-order inverse transpose of the deformation Jacobian.
        const shifted=[dx,dy,dz][axis];
        const correction=shifted.reduce((sum,value,j)=>sum+(d[j]-value)*normals[i+j]/step,0);
        normal[i+axis]=Math.round(Math.max(-2.7,Math.min(2.7,correction))*12000);
      }
    }
    return [8+index,position,normal];
  });
}
