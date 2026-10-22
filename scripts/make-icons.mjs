// Gera os quatro ícones PNG usados por PWA e iOS a partir do símbolo original.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const out=path.join(root,'public/icons');
mkdirSync(out,{recursive:true});
const glyph='<path d="M12 32h40M18 21v22M25 17v30M39 17v30M46 21v22" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none"/>';
const rounded=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#e8453c"/>${glyph}</svg>`;
const full=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#e8453c"/><g transform="translate(32 32) scale(.62) translate(-32 -32)">${glyph}</g></svg>`;
for(const [name,svg,size] of [['icon-192.png',rounded,192],['icon-512.png',rounded,512],['icon-maskable-512.png',full,512],['apple-touch-icon.png',full,180]]){
 await sharp(Buffer.from(svg),{density:Math.ceil(72*size/64*2)}).resize(size,size).png({compressionLevel:9}).toFile(path.join(out,name));
}
