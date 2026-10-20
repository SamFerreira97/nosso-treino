import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
mkdirSync('ui',{recursive:true});
const demoDialog='<dialog id="exercise-demo" aria-labelledby="exercise-demo-title"><button class="demo-close icon" aria-label="Fechar demonstração">×</button><h2 id="exercise-demo-title"></h2><div id="exercise-demo-content"></div></dialog>';
writeFileSync('ui/page-html.ts','export default '+JSON.stringify(readFileSync('ui/index.html','utf8').replace('<dialog id="confirm">',demoDialog+'<dialog id="confirm">'))+';\n');
writeFileSync('public/demos-data.js','export default '+readFileSync('public/demos.json','utf8')+';\n');
