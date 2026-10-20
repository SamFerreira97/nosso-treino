import { validItem } from '../public/model.js';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
export async function handleSync(request,db){
  const origin=request.headers.get('Origin'),url=new URL(request.url);
  const permitted=!origin||origin===url.origin||origin==='https://samferreira97.github.io';
  if(!permitted)return json({error:'Origem não permitida.'},403);
  const cors=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}});
  const response=await handleRequest(request,db);
  for(const [key,value]of Object.entries(cors))response.headers.set(key,value);
  return response;
}
async function handleRequest(request,db){
  try{
    if(!db)return json({error:'Banco temporariamente indisponível. Os registros locais estão preservados.'},503);
    const url=new URL(request.url);
    if(!['GET','POST'].includes(request.method))return json({error:'Método não permitido.'},405);
    let body={};
    if(request.method==='POST'){
      if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Envie JSON.'},415);
      const raw=await request.text();if(raw.length>500000)return json({error:'Envie menos registros por vez.'},413);
      try{body=JSON.parse(raw)}catch{return json({error:'JSON inválido.'},400)}
    }
    if(request.method==='POST'&&body.action==='create'){
      const now=Date.now(),bucket=Math.floor(now/3600000),ip=await hash(request.headers.get('CF-Connecting-IP')||'unknown');
      const rate=await db.prepare('INSERT INTO rate_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(`${ip}:${bucket}`,now+3600000).first();
      if(rate.count>10)return json({error:'Limite de criação atingido. Tente novamente em uma hora.'},429);
      const rooms=await db.prepare('SELECT count(*) AS n FROM rooms').first();if(rooms.n>=10000)return json({error:'Criação temporariamente indisponível.'},503);
      const code=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
      await db.prepare('INSERT INTO rooms(hash,created_at) VALUES (?,?)').bind(await hash(code),now).run();
      await db.prepare('DELETE FROM rate_limits WHERE expires < ?').bind(now-3600000).run();
      return json({code},201);
    }
    const code=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
    if(!/^[a-f0-9]{32}$/.test(code))return json({error:'Código do casal inválido.'},401);
    const room=await hash(code);
    if(!await db.prepare('SELECT hash FROM rooms WHERE hash=?').bind(room).first())return json({error:'Código do casal não encontrado.'},401);
    if(request.method==='GET'){
      const after=Number(url.searchParams.get('after')||0);if(!Number.isSafeInteger(after)||after<0)return json({error:'Cursor inválido.'},400);
      const {results}=await db.prepare('SELECT seq,item_key,payload FROM sync_events WHERE room=? AND seq>? ORDER BY seq LIMIT 250').bind(room,after).all();
      return json({events:results.map(r=>({seq:r.seq,key:r.item_key,value:JSON.parse(r.payload)})),cursor:results.at(-1)?.seq??after,more:results.length===250});
    }
    if(body.action!=='push'||!Array.isArray(body.operations)||body.operations.length>100)return json({error:'Operações inválidas.'},400);
    const ops=body.operations;
    if(!ops.every(o=>o&&typeof o.id==='string'&&/^[a-f0-9-]{36}$/.test(o.id)&&validItem(o.key,o.value)))return json({error:'Há registros inválidos. Nada foi alterado.'},400);
    const n=await db.prepare('SELECT count(*) AS n FROM sync_events WHERE room=?').bind(room).first();
    if(n.n+ops.length>100000)return json({error:'Limite do espaço atingido. Exporte um backup.'},409);
    if(ops.length)await db.batch(ops.map(o=>db.prepare('INSERT INTO sync_events(room,operation,item_key,payload) VALUES (?,?,?,?) ON CONFLICT(operation) DO NOTHING').bind(room,`${room}:${o.id}`,o.key,JSON.stringify(o.value))));
    return json({accepted:ops.map(o=>o.id)});
  }catch{return json({error:'Não foi possível sincronizar agora. Seus registros locais estão preservados.'},503)}
}
