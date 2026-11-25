import {createHash} from 'node:crypto';
import {rm,mkdir,copyFile,cp,readFile,writeFile,readdir} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const f of ['index.html','styles.css','main-menu.css','soundtrack.html']) await copyFile(f,`dist/${f}`);
const excludedAssets=new Set(['uk-royal-arms.svg','city-vignettes.webp']);
await cp('assets','dist/assets',{recursive:true,filter:path=>!excludedAssets.has(path.split('/').pop())});
await cp('leader-editor','dist/leader-editor',{recursive:true});
await cp('src','dist/src',{recursive:true});
const digest=createHash('sha256');
for(const file of (await readdir('src')).filter(f=>f.endsWith('.js')&&f!=='calculation-build.js').sort()){digest.update(file+'\0');digest.update(await readFile(`src/${file}`));digest.update('\0');}
await writeFile('dist/src/calculation-build.js',`export const CALCULATION_BUILD=${JSON.stringify(digest.digest('hex'))};\n`);
if(process.argv.includes('--itch')){
  await mkdir('dist/docs',{recursive:true});
  for(const name of ['THIRD-PARTY-NOTICES.txt','THIRD-PARTY-NOTICES.en.txt','SOUNDTRACK-LICENSES.txt','codex-flag-sources.md','codex-reference-images.md','uk-regions.md'])
    await copyFile(`docs/${name}`,`dist/docs/${name}`);
}else await cp('docs','dist/docs',{recursive:true});
const manifest=JSON.parse(await readFile('.openai/hosting.json','utf8'));
manifest.static={directory:'dist'};
await writeFile('.openai/hosting.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Static application built in dist/');
