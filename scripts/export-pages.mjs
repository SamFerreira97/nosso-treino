import {cpSync,mkdirSync,writeFileSync} from 'node:fs';
import './make-icons.mjs';
import {html} from './embed-page.mjs';
// GitHub Pages hosts the frontend; the existing authenticated room API remains on Workers/D1.
const endpoint='https://nosso-treino-juntos-2026.samuelsillas97.chatgpt.site/api/sync';
const csp=["default-src 'self'","script-src 'self'","style-src 'self' 'unsafe-inline'","img-src 'self' data:",`connect-src 'self' ${new URL(endpoint).origin}`,"worker-src 'self'","manifest-src 'self'","object-src 'none'","base-uri 'none'"].join('; ');
mkdirSync('pages-dist',{recursive:true});
cpSync('public','pages-dist',{recursive:true});
const page=html.replace('<meta charset="utf-8">',`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}">`).replace('</head>',`<meta name="sync-api" content="${endpoint}"></head>`);
if(!page.includes('Content-Security-Policy')||!page.includes('name="sync-api"'))throw new Error('CSP ou endpoint ausente na exportação.');
writeFileSync('pages-dist/index.html',page);
writeFileSync('pages-dist/.nojekyll','');
console.log('GitHub Pages exportado: pages-dist/');
