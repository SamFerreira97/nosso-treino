// Shell offline do Nosso Treino: nenhuma requisição externa de sincronização é interceptada.
// Rede primeiro para código; cache primeiro para fotografias e avatares.
const SHELL='nosso-treino-shell-v2', MEDIA='nosso-treino-media-v2';
const SHELL_URLS=['./','./style.css','./data.js','./model.js','./ranking.js','./app.js','./demos-data.js','./favicon.svg','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./avatars/sam.webp','./avatars/gabi.webp'];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(SHELL);
  await cache.addAll(SHELL_URLS.map(url=>new Request(url,{cache:'reload'})));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('nosso-treino-')&&![SHELL,MEDIA].includes(key)).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
function isMedia(url){return /\/(demos|avatars)\/[^/]+\.(jpg|webp|png)$/i.test(url.pathname);}
async function networkFirst(request,event){
 const cache=await caches.open(SHELL);
 try{
  const response=await Promise.race([
   fetch(request),
   new Promise((_,reject)=>setTimeout(()=>reject(new Error('Timeout de rede')),4000))
  ]);
  if(response.ok)event.waitUntil(cache.put(request,response.clone()));
  return response;
 }catch(error){
  const cached=await cache.match(request,{ignoreSearch:true});
  if(cached)return cached;
  if(request.mode==='navigate'){
   const home=await cache.match('./',{ignoreSearch:true});
   if(home)return home;
  }
  throw error;
 }
}
async function cacheFirst(request,event){
 const cache=await caches.open(MEDIA);
 const saved=await cache.match(request);
 if(saved)return saved;
 const response=await fetch(request);
 if(response.ok)event.waitUntil(cache.put(request,response.clone()));
 return response;
}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/')||request.headers.has('range'))return;
 event.respondWith(isMedia(url)?cacheFirst(request,event):networkFirst(request,event));
});
