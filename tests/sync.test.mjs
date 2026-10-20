import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { handleSync } from '../lib/sync-server.mjs';
import { validItem,validateBackup,applyRemote,parsePlan } from '../public/model.js';

function database(){
  const raw=new DatabaseSync(':memory:');
  for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')))raw.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
  const db={prepare(sql){return {args:[],bind(...args){this.args=args;return this;},async first(){return raw.prepare(sql).get(...this.args)||null;},async all(){return {results:raw.prepare(sql).all(...this.args)};},async run(){return raw.prepare(sql).run(...this.args);}};},async batch(statements){raw.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());raw.exec('COMMIT');return r;}catch(e){raw.exec('ROLLBACK');throw e;}}};return db;
}
async function call(db,method,body,code,after=0,origin){const request=new Request(`https://test.local/api/sync?after=${after}`,{method,headers:{'Content-Type':'application/json',...(code?{Authorization:'Bearer '+code}:{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});const response=await handleSync(request,db);return {status:response.status,data:await response.json()};}
const log=(person=0,set=0,weight=20)=>({person,set,weight,date:'2026-10-20',day:'A',exercise:'Supino Reto com Barra',exerciseId:'supino-reto-com-barra-0',reps:12,unit:'reps',updatedAt:Date.now()});
const key=l=>`log:${l.date}|${l.person}|${l.day}|${l.exerciseId}|${l.set}`;
const op=(k,v)=>({id:crypto.randomUUID(),key:k,value:v});

test('two clients combine independent records, retry safely, and propagate deletions',async()=>{
  const db=database(),created=await call(db,'POST',{action:'create'});assert.equal(created.status,201);const code=created.data.code;assert.match(code,/^[a-f0-9]{32}$/);
  const a=log(0,0),b=log(1,0,15),oa=op(key(a),a),ob=op(key(b),b);
  const results=await Promise.all([call(db,'POST',{action:'push',operations:[oa]},code),call(db,'POST',{action:'push',operations:[ob]},code)]);results.forEach(r=>assert.equal(r.status,200));
  await call(db,'POST',{action:'push',operations:[oa]},code);
  const pulled=await call(db,'GET',null,code);assert.equal(pulled.data.events.length,2);const combined=applyRemote({},[],pulled.data.events);assert.equal(combined[key(a)].weight,20);assert.equal(combined[key(b)].weight,15);
  const cursor=pulled.data.cursor;await call(db,'POST',{action:'push',operations:[op(key(a),null)]},code);const next=await call(db,'GET',null,code,cursor);assert.equal(next.data.events.length,1);assert.equal(applyRemote(combined,[],next.data.events)[key(a)],null);
});
test('room isolation, missing credentials, bad origins and invalid batches',async()=>{
  const db=database(),r1=(await call(db,'POST',{action:'create'})).data.code,r2=(await call(db,'POST',{action:'create'})).data.code;
  assert.equal((await call(db,'GET',null)).status,401);assert.equal((await call(db,'GET',null,'0'.repeat(32))).status,401);
  const l=log(),valid=op(key(l),l),invalid=op(key(l),{...l,weight:-1});
  assert.equal((await call(db,'POST',{action:'push',operations:[valid,invalid]},r1)).status,400);assert.equal((await call(db,'GET',null,r1)).data.events.length,0);
  assert.equal((await call(db,'POST',{action:'push',operations:[valid]},r1,0,'https://evil.local')).status,403);
  await call(db,'POST',{action:'push',operations:[valid]},r1);assert.equal((await call(db,'GET',null,r2)).data.events.length,0);
  assert.equal((await call(null,'GET',null,r1)).status,503);
});
test('offline pending changes survive a pull and last server write resolves same-series edits',async()=>{
  const db=database(),code=(await call(db,'POST',{action:'create'})).data.code,a=log(),k=key(a),changed={...a,weight:30},pending=op(k,changed);
  await call(db,'POST',{action:'push',operations:[op(k,a)]},code);let remote=(await call(db,'GET',null,code)).data;
  assert.equal(applyRemote({[k]:changed},[pending],remote.events)[k].weight,30);
  await call(db,'POST',{action:'push',operations:[pending]},code);remote=(await call(db,'GET',null,code)).data;assert.equal(applyRemote({},[],remote.events)[k].weight,30);
});
test('plan preserves descending reps, ranges, time and unilateral counts; backup validation rejects malformed data',()=>{
  const parsed=parsePlan('A|Supino|4x12-10-8-6\nB|Remada|3x12/lado\nC|Prancha|3x45-60seg\nD|Rosca|3x10-12');
  assert.deepEqual(parsed.groups.A[0].perSet,['12','10','8','6']);assert.equal(parsed.groups.D[0].perSet,null);assert.equal(parsed.groups.C[0].reps,'45-60seg');assert.equal(parsed.groups.B[0].reps,'12/lado');
  assert.throws(()=>parsePlan('A|Supino|0x10'));assert.throws(()=>validateBackup({version:3,items:{}}));assert.equal(validItem('setting:goal',[5,50]),false);assert.equal(validItem('setting:rest',-1),false);
});
test('creation rate is bounded and room code is never stored in database payload',async()=>{
  const db=database();for(let i=0;i<10;i++)assert.equal((await call(db,'POST',{action:'create'})).status,201);assert.equal((await call(db,'POST',{action:'create'})).status,429);
});
