// Orthographic triangle rasterizer for browsers without WebGL.
export function createSoftwareRenderer(canvas, model, matrix) {
  const ctx = canvas.getContext('2d',{alpha:true});
  if (!ctx) throw Error('Отрисовка портрета недоступна в этом браузере.');
  const width = canvas.width, height = canvas.height;
  const image = ctx.createImageData(width,height);
  const pixels = image.data, depth = new Float32Array(width*height);
  const key = [-.52,-.64,.57], fill = [.61,-.63,.18], rim = [.50,.79,.52];
  const normalize = p => {
    const length=Math.hypot(...p);
    return p.map(v=>v/length);
  };
  const [kl,fl,rl] = [key,fill,rim].map(normalize);
  const half = normalize([kl[0]+.14,kl[1]-.98,kl[2]+.05]);
  const gamma = v => Math.min(255,Math.pow(Math.max(0,v),1/2.2)*255);
  const meshes = model.meshes.map(mesh => ({
    ...mesh,
    transformed:new Float32Array(mesh.p.length),
    front:new Float32Array(mesh.p.length),
    back:new Float32Array(mesh.p.length),
  }));

  function project(mesh) {
    const p = mesh.workP, screen = mesh.transformed;
    for (let i=0;i<p.length;i+=3) {
      const x=p[i], y=p[i+1], z=p[i+2];
      screen[i] = (matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12]+1)*width*.5;
      screen[i+1] = (1-matrix[1]*x-matrix[5]*y-matrix[9]*z-matrix[13])*height*.5;
      screen[i+2] = matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14];
    }
  }

  function shade(mesh, color, spec) {
    const n=mesh.workN, front=mesh.front, back=mesh.back;
    for (let i=0;i<n.length;i+=3) {
      const magnitude=Math.hypot(n[i],n[i+1],n[i+2]) || 1;
      const x=n[i]/magnitude, y=n[i+1]/magnitude, z=n[i+2]/magnitude;
      const k=x*kl[0]+y*kl[1]+z*kl[2];
      const f=x*fl[0]+y*fl[1]+z*fl[2];
      const r=x*rl[0]+y*rl[1]+z*rl[2];
      const h=x*half[0]+y*half[1]+z*half[2];
      for (const sign of [1,-1]) {
        const a=Math.max(0,k*sign), b=Math.max(0,f*sign), c=Math.max(0,r*sign);
        const highlight=Math.pow(Math.max(0,h*sign),38)*spec;
        const out=sign===1?front:back;
        out[i]=gamma(color[0]*(.31+.70*a+.17*b+.16*c)+highlight);
        out[i+1]=gamma(color[1]*(.32+.60*a+.22*b+.12*c)+highlight);
        out[i+2]=gamma(color[2]*(.35+.46*a+.29*b+.08*c)+highlight);
      }
    }
  }

  function rasterize(mesh, indices, checked) {
    const s = mesh.transformed, points=mesh.workP;
    for (let i=0;i<indices.length;i+=3) {
      const a=indices[i]*3, b=indices[i+1]*3, c=indices[i+2]*3;
      const ax=s[a], ay=s[a+1], bx=s[b], by=s[b+1], cx=s[c], cy=s[c+1];
      const area=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
      if (Math.abs(area)<.00001) continue;
      const left=Math.max(0,Math.floor(Math.min(ax,bx,cx)));
      const right=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx)));
      const top=Math.max(0,Math.floor(Math.min(ay,by,cy)));
      const bottom=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
      const colors=area<0 ? mesh.front : mesh.back;
      const uStep=(by-cy)/area, vStep=(cy-ay)/area;
      for (let y=top;y<=bottom;y++) {
        let u=((by-cy)*(left+.5-cx)+(cx-bx)*(y+.5-cy))/area;
        let v=((cy-ay)*(left+.5-cx)+(ax-cx)*(y+.5-cy))/area;
        for (let x=left;x<=right;x++,u+=uStep,v+=vStep) {
          const w=1-u-v;
          if (u<-.00001 || v<-.00001 || w<-.00001) continue;
          const pos=y*width+x;
          const z=s[a+2]*u+s[b+2]*v+s[c+2]*w;
          if (z>=depth[pos]) continue;
          depth[pos]=z;
          const j=pos*4;
          let check=0;
          if(checked){
            const vx=(points[a]*u+points[b]*v+points[c]*w)*4.2;
            const vz=(points[a+2]*u+points[b+2]*v+points[c+2]*w)*4.5;
            const offset=Math.min(Math.abs(vx-Math.floor(vx)-.5),Math.abs(vz-Math.floor(vz)-.5));
            check=Math.max(0,1-offset*18)*18;
          }
          pixels[j]=colors[a]*u+colors[b]*v+colors[c]*w+check;
          pixels[j+1]=colors[a+1]*u+colors[b+1]*v+colors[c+1]*w+check*.8;
          pixels[j+2]=colors[a+2]*u+colors[b+2]*v+colors[c+2]*w+check*.6;
          pixels[j+3]=255;
        }
      }
    }
  }

  function draw(character,palette) {
    pixels.fill(0);
    depth.fill(Infinity);
    const key=character.shape.join(',');
    for (const mesh of meshes) {
      if (mesh.variant && character[mesh.variant[0]]!==mesh.variant[1]) continue;
      if (mesh.lastShape!==key) {
        mesh.applyShape(character.shape,key);
        project(mesh);
      }
      for (const group of mesh.groups) {
        shade(mesh,palette[group.role] ?? group.color,group.spec);
        rasterize(mesh,group.indices,character.suitStyle===6&&(group.role==='suit'||group.role==='vest'));
      }
    }
    ctx.putImageData(image,0,0);
  }
  return {draw,features:model.features};
}
