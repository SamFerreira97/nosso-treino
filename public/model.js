export const SCHEMA=3;
export const dayCodes=['A','B','C','A-volume','B-core'];
export const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function parsePlan(text){
  if(typeof text!=='string'||text.length>40000)throw Error('Ficha muito longa.');
  const groups={},order=[];
  text.split('\n').forEach((raw,line)=>{
    if(!raw.trim())return;
    const p=raw.split('|').map(s=>s.trim());
    if(p.length!==3||!p[0]||!p[1]||p[0].length>30||p[1].length>120)throw Error(`Linha ${line+1}: use treino|exercício|séries x reps.`);
    const m=/^(\d{1,2})\s*[x×]\s*(.+)$/i.exec(p[2]);
    if(!m||+m[1]<1||+m[1]>12||m[2].length>40)throw Error(`Linha ${line+1}: informe 1–12 séries e as repetições.`);
    if(!groups[p[0]]){groups[p[0]]=[];order.push(p[0]);}
    if(order.length>10||Object.values(groups).flat().length>=120)throw Error('Limite de 10 treinos e 120 exercícios.');
    const repetitions=m[2].split('-').map(x=>x.trim());
    const perSet=repetitions.length===+m[1]&&repetitions.length>2&&repetitions.every(x=>/^\d+$/.test(x))?repetitions:null;
    groups[p[0]].push({name:p[1],sets:+m[1],reps:m[2],perSet,id:normalize(p[1])+'-'+groups[p[0]].filter(e=>e.name===p[1]).length});
  });
  if(!order.length)throw Error('Adicione pelo menos um exercício.');
  return {groups,order};
}
export function validItem(key,v){
  if(typeof key!=='string'||key.length>350)return false;
  if(v===null)return /^(log|session|note):/.test(key);
  if(key==='setting:names')return Array.isArray(v)&&v.length===2&&v.every(n=>typeof n==='string'&&n.trim().length>0&&n.length<=40);
  if(key==='setting:goal')return Array.isArray(v)&&v.length===2&&v.every(n=>Number.isInteger(n)&&n>=1&&n<=7);
  if(key==='setting:rest')return Number.isInteger(v)&&v>=15&&v<=600;
  if(key==='setting:plan'){try{parsePlan(v);return true}catch{return false}}
  if(!v||typeof v!=='object'||![0,1].includes(v.person)||!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||typeof v.day!=='string'||v.day.length>30)return false;
  if(key.startsWith('session:'))return key===`session:${v.date}|${v.person}|${v.day}`&&Number.isInteger(v.sets)&&v.sets>0&&v.sets<=1440&&Number.isFinite(v.finishedAt)&&v.finishedAt>0;
  if(!['exercise','exerciseId'].every(k=>typeof v[k]==='string'&&v[k].length<=150))return false;
  if(key.startsWith('note:'))return key===`note:${v.date}|${v.person}|${v.day}|${v.exerciseId}`&&typeof v.text==='string'&&v.text.length<=2000;
  return key.startsWith('log:')&&key===`log:${v.date}|${v.person}|${v.day}|${v.exerciseId}|${v.set}`&&Number.isInteger(v.set)&&v.set>=0&&v.set<12&&Number.isFinite(v.weight)&&v.weight>=0&&v.weight<=2000&&Number.isFinite(v.reps)&&v.reps>0&&v.reps<=5000&&typeof v.unit==='string'&&['reps','s'].includes(v.unit)&&Number.isFinite(v.updatedAt)&&v.updatedAt>0;
}
export function validateBackup(o){
  if(!o||o.version!==SCHEMA||!o.items||Array.isArray(o.items)||typeof o.items!=='object'||Object.keys(o.items).length>30000||!Object.entries(o.items).every(([k,v])=>validItem(k,v)))throw Error('Backup inválido ou incompatível.');
  for(const k of ['names','plan','goal','rest'])if(!validItem('setting:'+k,o.items['setting:'+k]))throw Error('Configuração incompleta no backup.');
  return {version:SCHEMA,items:o.items};
}
export function applyRemote(items,pending,events){
  const result={...items},dirty=new Set(pending.map(o=>o.key));
  for(const event of events){if(!dirty.has(event.key)&&validItem(event.key,event.value))result[event.key]=event.value;}
  return result;
}
