// Downloads two public-domain exercise positions; animation is performed in the browser.
// No invented intermediate posture, cropping, watermark removal or form alteration.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
const root=fileURLToPath(new URL('..',import.meta.url));
const mapping=JSON.parse(await fs.readFile(path.join(root,'public/demos.json'),'utf8'));
const destination=path.join(root,'public/demos');await fs.mkdir(destination,{recursive:true});
const source='https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
async function download(url){let last;for(let attempt=0;attempt<3;attempt++){try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);return Buffer.from(await r.arrayBuffer());}catch(e){last=e;}}throw last;}
const records=[];
// Bounded concurrency for the photo source.
let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<mapping.length){const [name,id,variant]=mapping[next++],posterPath=path.join(destination,id+'.jpg');
  const photos=await Promise.all([0,1].map(i=>download(source+id+'/'+i+'.jpg')));
  // Keep both source photos intact in the loop. Plank is an isometric hold, so only use the stable base pose.
  await fs.writeFile(posterPath,photos[id==='Plank'?1:0]);
  if(id!=='Plank')await fs.writeFile(path.join(destination,id+'-1.jpg'),photos[1]);

  const meta=await sharp(posterPath).metadata();
  records.push({name,id,variant,width:meta.width,height:meta.height,source:source+id+(id==='Plank'?'/1.jpg':'/0.jpg'),license:'Unlicense / public domain (as distributed by source)',frames:id==='Plank'?1:2});
  console.log(name+' · '+(id==='Plank'?'postura estática':'2 posições'));
}}));
await fs.writeFile(path.join(destination,'sources.json'),JSON.stringify(records,null,2)+'\n');
const license=await download('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/LICENSE.md');
await fs.writeFile(path.join(destination,'SOURCE-LICENSE.txt'),license);
console.log('Demonstrações preparadas: '+records.length);
