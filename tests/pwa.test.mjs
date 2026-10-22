import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync,readdirSync,statSync } from 'node:fs';
const root=new URL('../public/',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const exists=p=>existsSync(new URL(p,root));
test('Manifest e ícones PWA válidos',()=>{
 const m=JSON.parse(read('manifest.webmanifest'));
 assert.equal(m.display,'standalone');
 assert.equal(m.start_url,'./');
 assert.equal(m.scope,'./');
 assert.ok(m.icons.some(i=>i.sizes==='192x192'));
 assert.ok(m.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'));
 for(const i of m.icons)assert.ok(exists(i.src.replace('./','')),i.src);
 assert.ok(exists('icons/apple-touch-icon.png'));
});
test('HTML declara instalação e app registra SW',()=>{
 const html=readFileSync(new URL('../ui/index.html',import.meta.url),'utf8');
 assert.match(html,/rel="manifest" href="\.\/manifest\.webmanifest"/);
 assert.match(html,/rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png"/);
 assert.match(read('app.js'),/serviceWorker\.register\('\.\/sw\.js'/);
});
test('SW protege API e pré-cacheia arquivos existentes',()=>{
 const sw=read('sw.js');
 const urls=[...sw.matchAll(/'\.\/[^']*'/g)].map(x=>x[0].slice(1,-1));
 assert.ok(urls.length>5);
 for(const url of urls)assert.ok(url==='./'||exists(url.slice(2)),url);
 assert.match(sw,/pathname\.includes\('\/api\/'\)/);
 assert.match(sw,/request\.method!=='GET'/);
});
test('Publicação sem GIFs pesados e dentro do limite de 8 MB',()=>{
 const walk=d=>readdirSync(d).flatMap(n=>{
  const p=new URL(n+(statSync(new URL(n,d)).isDirectory()?'/':''),d);
  return statSync(p).isDirectory()?walk(p):[p];
 });
 const files=walk(root);
 assert.equal(files.filter(f=>f.pathname.endsWith('.gif')).length,0);
 const bytes=files.reduce((n,f)=>n+statSync(f).size,0);
 assert.ok(bytes<8*1024*1024,`public/ tem ${(bytes/1048576).toFixed(1)} MB`);
});

test('Novo avatar do Sam e recursos versionados evitam cache antigo',()=>{
 const html=readFileSync(new URL('../ui/index.html',import.meta.url),'utf8');
 assert.match(html,/style\.css\?v=sam-avatar-3/);
 assert.match(html,/app\.js\?v=sam-avatar-3/);
 const app=read('app.js');
 assert.equal((app.match(/sam-avatar-v3/g)||[]).length,3);
 assert.ok(exists('avatars/sam-avatar-v3.webp'));
 assert.match(read('sw.js'),/nosso-treino-shell-v3/);
 assert.match(read('sw.js'),/cache:'no-store'/);
});
