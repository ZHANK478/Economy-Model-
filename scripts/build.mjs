import {createHash} from 'node:crypto';
import {rm,mkdir,copyFile,cp,readFile,writeFile,readdir} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const f of ['index.html','styles.css']) await copyFile(f,`dist/${f}`);
await cp('src','dist/src',{recursive:true});
const digest=createHash('sha256');
for(const file of (await readdir('src')).filter(f=>f.endsWith('.js')&&f!=='calculation-build.js').sort()){digest.update(file+'\0');digest.update(await readFile(`src/${file}`));digest.update('\0');}
await writeFile('dist/src/calculation-build.js',`export const CALCULATION_BUILD=${JSON.stringify(digest.digest('hex'))};\n`);
await cp('docs','dist/docs',{recursive:true});
const manifest=JSON.parse(await readFile('.openai/hosting.json','utf8'));
manifest.static={directory:'dist'};
await writeFile('.openai/hosting.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Static application built in dist/');
