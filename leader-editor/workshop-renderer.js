import {faceFeatures} from './workshop-appearance.js';
import {faceMorphs} from './workshop-face-geometry.js';
import {createSoftwareRenderer} from './workshop-software.js';

const VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uViewProjection;
varying vec3 normal;
varying vec3 point;
void main() {
  normal = aNormal;
  point = aPosition;
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
}`;

const FRAGMENT = `
precision mediump float;
uniform vec3 uColor;
uniform vec3 uEye;
uniform float uShine;
uniform float uCheck;
varying vec3 normal;
varying vec3 point;
void main() {
  vec3 n = normalize(normal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 key = normalize(vec3(-0.52,-0.64,0.57));
  vec3 fill = normalize(vec3(0.61,-0.63,0.18));
  vec3 rim = normalize(vec3(0.50,0.79,0.52));
  vec3 view = normalize(uEye - point);
  vec3 light = vec3(0.31,0.32,0.35)
    + max(dot(n,key),0.0) * vec3(0.70,0.60,0.46)
    + max(dot(n,fill),0.0) * vec3(0.17,0.22,0.29)
    + max(dot(n,rim),0.0) * vec3(0.16,0.12,0.08);
  float spec = pow(max(dot(n,normalize(key+view)),0.0),38.0) * uShine;
  vec2 grid = abs(fract(point.xz * vec2(4.2, 4.5)) - 0.5);
  float check = (1.0 - smoothstep(0.018,0.055,min(grid.x,grid.y))) * uCheck;
  gl_FragColor = vec4(pow(max(vec3(0.0),(uColor + vec3(.027,.021,.013)*check)*light+spec),vec3(1.0/2.2)),1.0);
}`;

const subtract = (a,b) => a.map((x,i) => x-b[i]);
const dot = (a,b) => a.reduce((sum,x,i) => sum+x*b[i],0);
const unit = a => a.map(x => x/Math.hypot(...a));
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

function cameraMatrix(camera, aspect) {
  const forward = unit(subtract(camera.target,camera.eye));
  const right = unit(cross(forward,[0,0,1]));
  const up = cross(right,forward);
  const width = camera.height*aspect;
  return new Float32Array([
    2*right[0]/width,2*up[0]/camera.height,forward[0]*2/39.9,0,
    2*right[1]/width,2*up[1]/camera.height,forward[1]*2/39.9,0,
    2*right[2]/width,2*up[2]/camera.height,forward[2]*2/39.9,0,
    -2*dot(right,camera.eye)/width,-2*dot(up,camera.eye)/camera.height,
    (-2*dot(forward,camera.eye)-40.1)/39.9,1,
  ]);
}

function decode(encoded, Type) {
  const bytes = Uint8Array.from(atob(encoded), byte => byte.charCodeAt(0));
  return new Type(bytes.buffer);
}

function createProgram(gl) {
  function shader(type, source) {
    const value = gl.createShader(type);
    gl.shaderSource(value,source);
    gl.compileShader(value);
    if (!gl.getShaderParameter(value,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(value));
    return value;
  }
  const program = gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,VERTEX));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  return program;
}

function prepareMesh(record) {
  const p=decode(record.positions,Float32Array), n=decode(record.normals,Float32Array);
  const morphs=Object.entries(record.morphs).map(([i,[dp,dn]]) =>
    [Number(i),decode(dp,Int16Array),decode(dn,Int16Array)]);
  morphs.push(...faceMorphs(record,p,n));
  const mesh={p,n,morphs,workP:new Float32Array(p),workN:new Float32Array(n),
    variant:record.variant,lastShape:null,groups:record.groups.map(group =>
      ({...group,indices:decode(group.indices,Uint16Array)}))};
  mesh.applyShape = function(shape,key) {
    mesh.workP.set(p);
    mesh.workN.set(n);
    for (const [index,dp,dn] of morphs) {
      const weight=shape[index]??0;
      const wp=weight/30000, wn=weight/12000;
      if (!wp) continue;
      for (let i=0;i<dp.length;i++) {
        mesh.workP[i] += wp*dp[i];
        mesh.workN[i] += wn*dn[i];
      }
    }
    this.lastShape=key;
  };
  return mesh;
}

export async function createRenderer(canvas) {
  const [response,wardrobe] = await Promise.all([fetch(new URL('./assets/rig3d/portrait-v2.json.gz',import.meta.url)),fetch(new URL('./assets/rig3d/wardrobe.json',import.meta.url))]);
  if (!wardrobe.ok) throw Error('Не удалось загрузить гардероб.');
  if (!response.ok || !response.body) throw Error('Не удалось загрузить модель.');
  const bytes=new Uint8Array(await response.arrayBuffer());
  const body=bytes[0]===0x1f&&bytes[1]===0x8b
    ?new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    :bytes;
  const data=await new Response(body).json();
  const model = {...data,features:[...data.features,...faceFeatures.slice(6)],meshes:[...data.meshes,...await wardrobe.json()].map(prepareMesh)};
  const matrix = cameraMatrix(model.camera,canvas.width/canvas.height);
  const gl = canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true});
  if (!gl) return createSoftwareRenderer(canvas,model,matrix);
  const program = createProgram(gl);
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0,0,0,0);
  gl.viewport(0,0,canvas.width,canvas.height);
  const position = gl.getAttribLocation(program,'aPosition');
  const normal = gl.getAttribLocation(program,'aNormal');
  gl.enableVertexAttribArray(position);
  gl.enableVertexAttribArray(normal);
  const uniform = key => gl.getUniformLocation(program,key);
  const color = uniform('uColor'), shine = uniform('uShine'), check = uniform('uCheck');
  gl.uniformMatrix4fv(uniform('uViewProjection'),false,matrix);
  gl.uniform3fv(uniform('uEye'),model.camera.eye);

  function buffer(target, array, usage) {
    const value = gl.createBuffer();
    gl.bindBuffer(target,value);
    gl.bufferData(target,array,usage);
    return value;
  }

  const meshes = model.meshes.map(mesh => ({
    ...mesh,
    vertex:buffer(gl.ARRAY_BUFFER,mesh.p,gl.DYNAMIC_DRAW),
    normal:buffer(gl.ARRAY_BUFFER,mesh.n,gl.DYNAMIC_DRAW),
    groups:mesh.groups.map(group => ({...group,count:group.indices.length,
      index:buffer(gl.ELEMENT_ARRAY_BUFFER,group.indices,gl.STATIC_DRAW)})),
  }));

  function update(mesh, shape, shapeKey) {
    if (!mesh.morphs.length || mesh.lastShape === shapeKey) return;
    mesh.applyShape(shape,shapeKey);
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vertex);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh.workP);
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.normal);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh.workN);
  }

  function draw(character, palette) {
    const key = character.shape.join(',');
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    for (const mesh of meshes) {
      if (mesh.variant && character[mesh.variant[0]] !== mesh.variant[1]) continue;
      update(mesh,character.shape,key);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vertex);
      gl.vertexAttribPointer(position,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.normal);
      gl.vertexAttribPointer(normal,3,gl.FLOAT,false,0,0);
      for (const group of mesh.groups) {
        gl.uniform3fv(color,palette[group.role] ?? group.color);
        gl.uniform1f(shine,group.spec);
        gl.uniform1f(check,Number(character.suitStyle===6&&(group.role==='suit'||group.role==='vest')));
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,group.index);
        gl.drawElements(gl.TRIANGLES,group.count,gl.UNSIGNED_SHORT,0);
      }
    }
  }
  return {draw,features:model.features};
}
