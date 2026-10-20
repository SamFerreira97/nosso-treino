import {cpSync,mkdirSync,writeFileSync} from 'node:fs';
import {html} from './embed-page.mjs';
// GitHub Pages hosts the frontend; the existing authenticated room API remains on Workers/D1.
const endpoint='https://nosso-treino-juntos-2026.samuelsillas97.chatgpt.site/api/sync';
mkdirSync('pages-dist',{recursive:true});
cpSync('public','pages-dist',{recursive:true});
writeFileSync('pages-dist/index.html',html.replace('</head>',`<meta name="sync-api" content="${endpoint}"></head>`));
writeFileSync('pages-dist/.nojekyll','');
console.log('GitHub Pages exportado: pages-dist/');
