import { SCHEMA,dayCodes,dateKey,normalize,parsePlan,validItem,validateBackup,applyRemote } from './model.js';
import DEMOS from './demos-data.js';
import { calculateRanking } from './ranking.js';

const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SYNC_URL=$('meta[name="sync-api"]')?.content||new URL('./api/sync',location.href).href;
const KEY='nosso-treino-v3',DEFAULT_PLAN=PLAN.map((d,i)=>d[3].map(e=>`${dayCodes[i]}|${e[0]}|${e[1]}x${e[2]}`).join('\n')).join('\n');
const defaults=()=>({'setting:names':['Sam','Gabi'],'setting:plan':DEFAULT_PLAN,'setting:goal':[5,5],'setting:rest':90});
let store={version:SCHEMA,items:defaults(),pending:[],room:null,drafts:{}};
let migrationMessage='',storageOk=true;
try{const raw=localStorage.getItem(KEY);if(raw){const s=JSON.parse(raw);validateBackup(s);store={...store,...s};if(!Array.isArray(store.pending))store.pending=[];if(store.room&&!/^[a-f0-9]{32}$/.test(store.room.code))store.room=null}else migrate();}catch{migrationMessage='Não foi possível ler os dados anteriores. Os arquivos originais no navegador foram preservados.';}
let rankingPeriod='week';
let tab='treino',who=0,day=dayCodes[Math.max(0,Math.min(4,new Date().getDay()-1))],viewDate=dateKey();
let dirtyDraft=false,busy=false,syncMessage='● Salvo neste aparelho',syncTimer=null,channel;
const setting=k=>store.items['setting:'+k],items=prefix=>Object.entries(store.items).filter(([k,v])=>k.startsWith(prefix+':')&&v!==null).map(([,v])=>v);
function persist(){try{localStorage.setItem(KEY,JSON.stringify(store));storageOk=true;}catch{storageOk=false;notify('Não foi possível salvar no aparelho. Gere um backup no Histórico.');}updateStatus();}
function operation(key,value){if(!validItem(key,value))throw Error('Registro inválido.');store.items[key]=value;if(store.room){if(!busy)store.pending=store.pending.filter(o=>o.key!==key);store.pending.push({id:crypto.randomUUID(),key,value});}persist();dirtyDraft=false;channel?.postMessage('updated');scheduleSync();}
function notify(text){$('#message').textContent=text;$('#message').style.display='block';clearTimeout(notify.t);notify.t=setTimeout(()=>$('#message').style.display='none',5500);}
async function ask(title,text){return new Promise(resolve=>{const dialog=$('#confirm');$('#confirm-title').textContent=title;$('#confirm-text').textContent=text;const close=v=>{dialog.close();resolve(v)};$('#confirm-no').onclick=()=>close(false);$('#confirm-yes').onclick=()=>close(true);dialog.oncancel=e=>{e.preventDefault();close(false)};dialog.showModal();});}
function migrate(){
  // Existing keys are never deleted. A fresh v3 snapshot can be exported independently.
  const old=JSON.parse(localStorage.getItem('nosso-treino-v1')||'null');
  if(old?.names?.length===2&&old.logs&&Array.isArray(old.history)){
    store.items['setting:names']=old.names;
    for(const [id,l] of Object.entries(old.logs)){
      const [date,d,p]=id.split('|'),di=+d,person=+p;if(!PLAN[di]||![0,1].includes(person))continue;
      for(const [setId,done] of Object.entries(l.sets||{})){
        if(!done)continue;const [ei,si]=setId.split('-').map(Number),ex=PLAN[di][3][ei];if(!ex)continue;
        const parsed=parsePlan(DEFAULT_PLAN).groups[dayCodes[di]][ei],log={date,person,day:dayCodes[di],exercise:ex[0],exerciseId:parsed.id,set:si,weight:Math.max(0,Number(l.loads?.[ei])||0),reps:Number(parsed.perSet?.[si])||Number((ex[2].match(/\d+/)||[])[0])||1,unit:ex[3]==='plank'?'s':'reps',updatedAt:Number(l.started)||Date.now(),imported:true};
        const key=logKey(log);if(validItem(key,log))store.items[key]=log;
      }
      for(const [ei,text] of Object.entries(l.notes||{})){const ex=PLAN[di][3][+ei];if(!ex||!text)continue;const exid=parsePlan(DEFAULT_PLAN).groups[dayCodes[di]][+ei].id,note={date,person,day:dayCodes[di],exercise:ex[0],exerciseId:exid,text:String(text).slice(0,2000)};store.items[noteKey(note)]=note;}
      if(l.finished){const session={date,person,day:dayCodes[di],sets:Object.values(l.sets||{}).filter(Boolean).length,finishedAt:l.finished};if(validItem(sessionKey(session),session))store.items[sessionKey(session)]=session;}
    }
    migrationMessage='Registros da versão anterior recuperados. Onde não havia repetições registradas, foi usado o valor inicial da ficha; cargas ausentes foram importadas como 0 kg.';
  }
  const v2=JSON.parse(localStorage.getItem('nosso-treino-v2')||'null');
  if(v2&&Array.isArray(v2.logs)&&Array.isArray(v2.sessions)){
    if(validItem('setting:names',v2.names))store.items['setting:names']=v2.names;
    if(Number.isInteger(v2.goal)&&v2.goal>=1&&v2.goal<=7)store.items['setting:goal']=[v2.goal,v2.goal];
    if(validItem('setting:rest',v2.rest))store.items['setting:rest']=v2.rest;
    const p=parsePlan(DEFAULT_PLAN);
    for(const l of v2.logs){const di='Importado-'+(v2.sessions.find(s=>s.d===l.d&&s.p===l.p)?.day||'V2'),ex=Object.values(p.groups).flat().find(e=>normalize(e.name)===normalize(l.e))||{name:l.e,id:normalize(l.e)+'-0'};const n={date:l.d,person:l.p,day:di,exercise:ex.name,exerciseId:ex.id,set:l.i,weight:l.w,reps:l.r,unit:/prancha/i.test(ex.name)?'s':'reps',updatedAt:Date.now(),imported:true};if(validItem(logKey(n),n))store.items[logKey(n)]=n;}
    for(const s of v2.sessions){const session={date:s.d,person:s.p,day:'Importado-'+s.day,sets:Math.max(1,v2.logs.filter(l=>l.d===s.d&&l.p===s.p).length),finishedAt:new Date(s.d+'T12:00:00').getTime()};if(validItem(sessionKey(session),session))store.items[sessionKey(session)]=session;}
    migrationMessage='Dados compatíveis da versão recebida foram recuperados. A ficha de exemplo foi substituída pela ficha real. Os dados originais permanecem neste navegador.';
  }
  localStorage.setItem(KEY,JSON.stringify(store));
}
function logKey(v){return `log:${v.date}|${v.person}|${v.day}|${v.exerciseId}|${v.set}`;}
function sessionKey(v){return `session:${v.date}|${v.person}|${v.day}`;}
function noteKey(v){return `note:${v.date}|${v.person}|${v.day}|${v.exerciseId}`;}
function current(ex,set){return store.items[logKey({date:dateKey(),person:who,day,exerciseId:ex.id,set})]||null;}
function last(ex,set){return items('log').filter(l=>l.person===who&&normalize(l.exercise)===normalize(ex.name)&&l.date<dateKey()).sort((a,b)=>b.date.localeCompare(a.date)||(b.set===set)-(a.set===set)||b.updatedAt-a.updatedAt)[0]||null;}
function best(ex){return items('log').filter(l=>l.person===who&&normalize(l.exercise)===normalize(ex.name)&&l.date<dateKey()).reduce((m,l)=>Math.max(m,l.weight),0);}
function weekBounds(){const d=new Date();d.setDate(d.getDate()-(d.getDay()+6)%7);const start=dateKey(d);d.setDate(d.getDate()+7);return [start,dateKey(d)];}
function render(preserve=false){
  const y=scrollY;const selectedChart=$('#chart-person')?.value,selectedExercise=$('#chart-exercise')?.value;
  if(!$('#tabs').childElementCount)$('#tabs').innerHTML=[['treino','Treino'],['ranking','🏆 Ranking'],['hist','Histórico'],['ficha','Ficha'],['sync','Conectar']].map(([k,label])=>`<button data-tab="${k}">${label}</button>`).join('');
  for(const button of $('#tabs').children){button.classList.toggle('on',button.dataset.tab===tab);button.setAttribute('aria-current',button.dataset.tab===tab?'page':'false');}
  $('#view').innerHTML=tab==='treino'?training():tab==='ranking'?ranking():tab==='hist'?history():tab==='ficha'?sheet():connection();
  if(tab==='hist'){if(selectedChart)$('#chart-person').value=selectedChart;chartOptions(selectedExercise);}
  updateStatus();if(preserve)scrollTo(0,y);
}
function weekCard(){const [start,end]=weekBounds(),sessions=items('session').filter(s=>s.date>=start&&s.date<end);let total=0;return `<details class="week-overview card"><summary class="weektitle"><span><strong>Semana do casal</strong><em>Toque para ver as metas</em></span><small>${start.split('-').slice(1).reverse().join('/')} → ${new Date(new Date(end+'T12:00:00').getTime()-86400000).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</small><span class="week-chevron" aria-hidden="true">⌄</span></summary><div class="week-body">${setting('names').map((n,p)=>{const c=new Set(sessions.filter(s=>s.person===p).map(s=>s.date)).size;total+=c;return `<div class="row"><span style="flex:1">${esc(n)}</span><span class="mu">${c} / ${setting('goal')[p]}</span></div><div class="bar" role="progressbar" aria-label="Meta semanal de ${esc(n)}" aria-valuenow="${c}" aria-valuemin="0" aria-valuemax="${Math.max(c,setting('goal')[p])}"><i style="width:${Math.min(100,c/setting('goal')[p]*100)}%"></i></div>`}).join('')}<div class="mu">${total} de ${setting('goal').reduce((a,b)=>a+b)} dias de treino do casal. Cada dia conta uma vez por pessoa.</div></div></details>`;}
function training(){
  const p=parsePlan(setting('plan'));if(!p.groups[day])day=p.order[0];const exs=p.groups[day],originalIndex=dayCodes.indexOf(day),finished=store.items[sessionKey({date:dateKey(),person:who,day})];
  let completed=0,total=exs.reduce((s,e)=>s+e.sets,0);exs.forEach(e=>{for(let i=0;i<e.sets;i++)if(current(e,i))completed++;});
  const weekend=[0,6].includes(new Date().getDay());
  return weekCard()+`<div class="row profiles" style="margin-bottom:10px">${setting('names').map((n,i)=>`<button class="chip ${who===i?'on':''}" data-person="${i}" aria-pressed="${who===i}"><img class="profile-avatar" src="./avatars/${i===0?'sam':'gabi'}.webp" width="48" height="48" alt=""><span class="profile-copy"><strong>${esc(n)}</strong><small>Perfil ${i+1}</small></span></button>`).join('')}</div>${weekend?'<p class="mu rest-day card">Hoje é dia de descanso na ficha. Se for treinar, escolha o treino abaixo.</p>':''}<div class="workouts" aria-label="Treinos da semana">${p.order.map(d=>`<button class="chip ${day===d?'on':''}" data-day="${esc(d)}">${esc(d)}<small>${dayCodes.includes(d)?['Segunda','Terça','Quarta','Quinta','Sexta'][dayCodes.indexOf(d)]:'Personalizado'}</small></button>`).join('')}</div><div class="day-title"><div><h2>${originalIndex>=0?esc(PLAN[originalIndex][2]):'Seu treino'}</h2><span class="mu">${new Date().toLocaleDateString('pt-BR')} · ${exs.length} exercícios</span></div><span class="tag">${completed}/${total} séries</span></div><div class="bar" role="progressbar" aria-label="Progresso do treino" aria-valuenow="${completed}" aria-valuemin="0" aria-valuemax="${total}"><i style="width:${completed/total*100}%"></i></div><div class="training-tools"><button class="btn s go-next" id="go-next">↓ Próxima série pendente</button><span class="small mu">${Math.round(completed/total*100)}% do treino concluído</span></div><details class="exercise-index"><summary>Ir para um exercício <span>${exs.length} exercícios</span></summary><div class="exercise-links">${exs.map((ex,ei)=>`<button type="button" data-jump="${ei}">${String(ei+1).padStart(2,'0')} · ${esc(ex.name)}</button>`).join('')}</div></details><p class="hint">${finished?'Treino concluído. Desfaça a conclusão para editar as séries.':'Carga e repetições anteriores já preenchidas. No primeiro uso, informe a carga ou use 0 para peso corporal.'}</p><div class="exercise-list">${exs.map((ex,ei)=>exerciseCard(ex,ei,!!finished)).join('')}</div><div class="footer-actions"><button class="btn" id="finish" ${completed!==total||finished?'disabled':''}>${finished?'✓ Treino de hoje concluído':'Concluir treino de hoje'}</button>${finished?'<button class="btn s" id="undo-finish">Desfazer conclusão</button>':''}<div class="mu">${finished?'Parabéns pela constância!':`Faltam ${total-completed} séries para concluir.`}</div></div>`;
}
function exerciseCard(ex,index,finished){const previousMax=best(ex),logs=[];let h='';const original=PLAN.flatMap(d=>d[3]).find(e=>e[0]===ex.name),guide=original?GUIDES[original[3]]:null,unit=/prancha/i.test(ex.name)?'s':'reps';
  for(let i=0;i<ex.sets;i++){
    const cur=current(ex,i),lf=last(ex,i),draft=store.drafts?.[logKey({date:dateKey(),person:who,day,exerciseId:ex.id,set:i})],weight=cur?.weight??draft?.weight??lf?.weight??'',defaultReps=Number(ex.perSet?.[i])||Number((ex.reps.match(/\d+/)||[])[0])||'',reps=cur?.reps??draft?.reps??lf?.reps??defaultReps;
    if(cur)logs.push(cur);
    h+=`<div class="set ${cur?'done':''}" data-exercise="${index}" data-set="${i}"><span class="mu">${i+1}</span><input aria-label="Carga da série ${i+1} de ${esc(ex.name)}, em kg" inputmode="decimal" autocomplete="off" value="${weight}" placeholder="kg" ${finished||cur?'disabled':''}><input aria-label="${unit==='s'?'Segundos':'Repetições'} da série ${i+1} de ${esc(ex.name)}" inputmode="numeric" autocomplete="off" value="${reps}" placeholder="${unit}" ${finished||cur?'disabled':''}><button class="ck" data-check="${index}:${i}" aria-label="${cur?'Desmarcar':'Concluir'} série ${i+1} de ${esc(ex.name)}" aria-pressed="${!!cur}" ${finished?'disabled':''}>${cur?'✓':'○'}</button></div>${lf?`<div class="hint">Último: ${lf.weight} kg · ${lf.reps} ${lf.unit} · ${lf.date.split('-').reverse().join('/')}</div>`:''}`;
  }
  const nk=noteKey({date:dateKey(),person:who,day,exerciseId:ex.id}),note=store.items[nk];
  const demo=DEMOS.find(d=>d[0]===ex.name);
  return `<article id="exercise-${index}" class="card exercise ${logs.length===ex.sets?'exercise-complete':''}" data-index="${index}"><div class="exercise-heading"><h2>${String(index+1).padStart(2,'0')} · ${esc(ex.name)}</h2><span class="exercise-count">${logs.length}/${ex.sets} séries</span></div><div class="mu">${ex.sets} × ${esc(ex.reps)}${unit==='s'?'':' repetições'}${ex.perSet?' · sequência por série':''}</div>${demo?`<button class="demo-preview" data-demo="${index}" aria-label="Ver demonstração de ${esc(ex.name)}"><img src="./demos/${demo[1]}.jpg" alt="Posição de ${esc(ex.name)}" width="100" height="70" loading="lazy" decoding="async"><span><strong>${demo[1]==='Plank'?'Ver postura estática':'▶ Ver GIF do exercício'}</strong><small>${guide?esc(guide[0]):'Execução'} · toque para ampliar</small></span><span aria-hidden="true">↗</span></button>`:'<p class="hint">Demonstração ainda não cadastrada para este exercício personalizado.</p>'}<div class="set-head"><span>SÉRIE</span><span>CARGA · KG</span><span>${unit==='s'?'TEMPO · S':'REPETIÇÕES'}</span><span>✓</span></div>${h}<div class="hint">${previousMax?`Máxima anterior: ${previousMax} kg`:'Primeiro registro deste exercício.'} <span class="pr">${previousMax&&logs.some(l=>l.weight>previousMax)?'🏆 Recorde!':''}</span></div><label class="hint">Observações pessoais<textarea class="note" data-note="${index}" maxlength="2000" placeholder="Como foi o exercício?">${esc(note?.text||'')}</textarea></label>${guide?`<details class="instruction"><summary>Execução e cuidados ▾</summary><ol><li>${guide[1]}</li><li>${guide[2]}</li><li>${guide[3]}</li></ol><p>${guide[4]}</p><p>Respire continuamente; solte o ar no esforço. Use amplitude confortável, sem dor.</p><p>Equipamento: ${esc(original[4])}. Descanso geral da ficha: 60–90 s.</p><p>Orientações educativas complementares. Confirme as variantes com o treinador.</p></details>`:''}</article>`;
}
function ranking(){
  const names=setting('names'),scores=calculateRanking(items('session'),names,setting('goal'),rankingPeriod);
  const leaders=scores.members.filter(m=>m.points===scores.maxPoints);
  const hasPoints=scores.maxPoints>0;
  const winner=hasPoints?(leaders.length>1?'Empate no topo! 🤝':`${esc(leaders[0].name)} está na liderança! 🏆`):'O desafio começa com o primeiro treino!';
  const firstLead=hasPoints&&leaders.length===1 ? leaders[0].person : null;
  const controls=[['week','Esta semana'],['month','Este mês'],['all','Geral']]
    .map(([value,label])=>`<button type="button" data-ranking-period="${value}" class="${rankingPeriod===value?'on':''}" aria-pressed="${rankingPeriod===value}">${label}</button>`).join('');
  const cards=scores.members.map(m=>{
    const goalText=rankingPeriod==='week'
      ?`${m.points} de ${m.goal} dias da meta semanal`
      :`${m.points} ${m.points===1?'dia ativo':'dias ativos'} no período`;
    const width=scores.maxPoints?Math.round(m.points/scores.maxPoints*100):0;
    return `<article class="rank-person ${m.person===firstLead?'rank-leading':''}">
      <div class="rank-place" aria-label="${hasPoints?m.position+'ª posição':'Sem classificação ainda'}">${hasPoints?m.position+'º':'—'}</div>
      <img class="rank-avatar" src="./avatars/${m.person===0?'sam':'gabi'}.webp" alt="" width="64" height="64" loading="lazy">
      <div class="rank-person-info"><h3>${esc(m.name)} ${m.person===firstLead?'<span aria-label="Líder">👑</span>':''}</h3><p>${goalText}</p>
        <div class="rank-track" role="progressbar" aria-label="Pontos de ${esc(m.name)}" aria-valuenow="${m.points}" aria-valuemin="0" aria-valuemax="${Math.max(scores.maxPoints,1)}"><span style="width:${width}%"></span></div>
      </div>
      <div class="rank-score"><strong>${m.points}</strong><small>${m.points===1?'ponto':'pontos'}</small></div>
    </article>`;
  }).join('');
  let calendar='';
  if(rankingPeriod==='week'){
    const [year,month,dayNumber]=scores.start.split('-').map(Number);
    const first=new Date(year,month-1,dayNumber);
    const days=Array.from({length:7},(_,i)=>{
      const dt=new Date(first.getFullYear(),first.getMonth(),first.getDate()+i);
      const key=dateKey(dt);
      const today=key===dateKey();
      const markers=[0,1].map(p=>{
        const member=scores.members.find(m=>m.person===p);
        const done=member.dates.includes(key);
        return `<span class="rank-day-dot ${done?'done person-'+p:''}" title="${esc(member.name)}: ${done?'treino concluído':'sem treino concluído'}" aria-label="${esc(member.name)}: ${done?'treino concluído':'sem treino concluído'}">${done?'✓':'·'}</span>`;
      }).join('');
      return `<div class="rank-day ${today?'today':''}"><span class="rank-day-label">${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i]}</span><strong>${String(dt.getDate()).padStart(2,'0')}</strong><div class="rank-day-pair">${markers}</div></div>`;
    }).join('');
    calendar=`<section class="card ranking-calendar"><h2>Check-ins da semana</h2><p class="mu">Cada ✓ representa um dia de treino concluído de Sam ou Gabi.</p><div class="rank-days">${days}</div><div class="rank-legend"><span><i class="person-0"></i>${esc(names[0])}</span><span><i class="person-1"></i>${esc(names[1])}</span></div></section>`;
  }
  return `<section class="card rank-hero"><div class="rank-eyebrow">DESAFIO DO CASAL · INSPIRADO NO GYMRATS</div><h2>🏆 Ranking de ${esc(names[0])} e ${esc(names[1])}</h2><p>Juntos na evolução, com uma competição saudável pela constância.</p><div class="rank-periods" role="group" aria-label="Período do ranking">${controls}</div><div class="rank-date">${esc(scores.label)}</div></section>
  <section class="card ranking-board"><div class="ranking-heading"><div><h2>Classificação</h2><p class="mu">${winner}</p></div><span class="rank-total">${scores.totalPoints} ${scores.totalPoints===1?'ponto':'pontos'} somados</span></div>
  ${cards}
  ${!hasPoints?'<p class="rank-empty">Concluam um treino na aba Treino para começar a pontuar. Treinos antigos já concluídos também entram no ranking.</p>':''}</section>
  ${calendar}
  <section class="card rank-rules"><h2>Como funciona a pontuação?</h2><p><strong>1 dia de treino concluído = 1 ponto.</strong> Se a mesma pessoa concluir dois treinos no mesmo dia, conta apenas um ponto. Sem pontos extras por carga, volume ou quantidade de séries.</p><p>O ranking é calculado automaticamente com o histórico de treinos, atualizado ao finalizar ou desfazer uma conclusão. Empates compartilham o primeiro lugar. A semana começa na segunda-feira, e o mês no dia 1º.</p><p class="mu">Este é um ranking do Nosso Treino inspirado no modo Dias Ativos do GymRats. Ele não acessa nem sincroniza dados da sua conta GymRats.</p></section>`;
}

function history(){const sessions=items('session').sort((a,b)=>b.finishedAt-a.finishedAt);return `<section class="card"><h2>Treinos concluídos</h2>${sessions.length?sessions.slice(0,100).map(s=>{const logs=items('log').filter(l=>l.date===s.date&&l.person===s.person&&l.day===s.day),notes=items('note').filter(l=>l.date===s.date&&l.person===s.person&&l.day===s.day);return `<article class="record"><div class="row"><strong style="flex:1">${esc(setting('names')[s.person])}</strong><span class="mu">${s.date.split('-').reverse().join('/')} · ${esc(s.day)}</span></div><details><summary>${s.sets} séries · Ver registros</summary>${logs.map(l=>`<p>${esc(l.exercise)} · Série ${l.set+1}: ${l.weight} kg × ${l.reps} ${l.unit}${l.imported?' · importado':''}</p>`).join('')}${notes.map(n=>`<p>${esc(n.exercise)}: ${esc(n.text)}</p>`).join('')}</details></article>`}).join(''):'<p class="mu">Seu primeiro treino concluído aparecerá aqui.</p>'}</section><section class="card"><h2>Evolução de carga</h2><div class="row"><label class="field" style="flex:1">Pessoa<select id="chart-person">${setting('names').map((n,i)=>`<option value="${i}" ${who===i?'selected':''}>${esc(n)}</option>`).join('')}</select></label><label class="field" style="flex:2">Exercício<select id="chart-exercise"></select></label></div><div id="chart"></div></section><section class="card"><h2>Backup por texto</h2><p class="mu">Inclui os dois perfis e a ficha. O código privado do casal não entra no backup.</p><textarea id="backup" class="backup" aria-label="Texto de backup" placeholder="Gere um backup ou cole aqui o texto para restaurar."></textarea><button class="btn s" id="backup-generate">Gerar e copiar backup</button><button class="btn s" id="backup-restore">Restaurar backup</button><p id="backup-status" class="mu" role="status"></p><details class="instruction"><summary>Importar arquivo da primeira versão ▾</summary><p>Seus registros antigos permanecem preservados no navegador. Para migrar um backup JSON da primeira versão, use a mesma origem antes de limpar os dados. Os backups desta versão usam o formato v3 acima.</p></details></section>`;}
function chartOptions(selected){const person=+$('#chart-person').value,names=[...new Set(items('log').filter(l=>l.person===person).map(l=>l.exercise))].sort();$('#chart-exercise').innerHTML=names.length?names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join(''):'<option value="">Sem registros</option>';if(names.includes(selected))$('#chart-exercise').value=selected;drawChart();}
function drawChart(){const person=+$('#chart-person').value,name=$('#chart-exercise').value,by={};for(const l of items('log'))if(l.person===person&&l.exercise===name)by[l.date]=Math.max(by[l.date]??0,l.weight);const ds=Object.keys(by).sort(),vs=ds.map(d=>by[d]);if(ds.length<2){$('#chart').innerHTML='<p class="mu">Registre ao menos dois dias para ver a evolução.</p>';return;}let low=Math.min(...vs),high=Math.max(...vs);if(low===high){low=Math.max(0,low-1);high++;}const pts=ds.map((d,i)=>`${45+i*285/(ds.length-1)},${115-(by[d]-low)/(high-low)*85}`);$('#chart').innerHTML=`<svg viewBox="0 0 360 155" role="img" aria-label="Evolução da carga máxima por dia de ${esc(name)}"><path d="M45 25V120H340" stroke="var(--bd)" fill="none"/><text x="0" y="32" fill="var(--mu)" font-size="10">${high} kg</text><text x="0" y="118" fill="var(--mu)" font-size="10">${low} kg</text><polyline fill="none" stroke="var(--ac)" stroke-width="3" points="${pts.join(' ')}"/>${pts.map((p,i)=>`<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="4" fill="var(--ac)"><title>${ds[i]}: ${vs[i]} kg</title></circle>`).join('')}<text x="45" y="145" fill="var(--mu)" font-size="10">${ds[0].split('-').reverse().join('/')}</text><text x="330" y="145" text-anchor="end" fill="var(--mu)" font-size="10">${ds.at(-1).split('-').reverse().join('/')}</text></svg><details class="instruction"><summary>Ver valores em tabela ▾</summary><table class="chart-table"><thead><tr><th>Data</th><th>Carga máxima</th></tr></thead><tbody>${ds.map(d=>`<tr><td>${d.split('-').reverse().join('/')}</td><td>${by[d]} kg</td></tr>`).join('')}</tbody></table></details>`;}
function sheet(){return `<section class="card"><h2>Seu casal</h2><div class="goals">${setting('names').map((n,i)=>`<label class="field profile-field"><span class="profile-field-head"><img src="./avatars/${i===0?'sam':'gabi'}.webp" width="40" height="40" alt=""><strong>Integrante ${i+1}</strong></span><input id="name${i}" value="${esc(n)}" maxlength="40"></label>`).join('')}</div></section><section class="card"><h2>Ficha do treinador David</h2><p class="mu">36 exercícios originais em cinco dias. A e B têm variações na quinta e sexta; elas foram preservadas em A-volume e B-core.</p><p class="hint">Uma linha por exercício: treino|exercício|séries x repetições.<br>Exemplo: A|Supino Reto com Barra|4x12-10-8-6<br>A sequência 12-10-8-6 indica uma quantidade para cada série.</p><textarea id="plan-editor" aria-label="Ficha de exercícios">${esc(setting('plan'))}</textarea><button id="restore-plan" class="btn s">Repor ficha original</button><p class="mu"><a class="link" href="./ficha-original.pdf" target="_blank" rel="noopener">Abrir PDF original ↗</a></p><p class="hint danger">Aqueça por 5–10 minutos. Descanso original: 60–90 segundos. Em caso de dor ou desconforto, pare. Os campos ausentes na ficha não representam uma prescrição nova.</p></section><section class="card"><h2>Metas e descanso</h2><div class="goals">${setting('names').map((n,i)=>`<label class="field">Meta semanal de ${esc(n)}<input id="goal${i}" type="number" min="1" max="7" value="${setting('goal')[i]}"></label>`).join('')}</div><label class="field">Descanso automático (segundos)<input id="rest-seconds" type="number" min="15" max="600" value="${setting('rest')}"></label><p class="hint">Meta inicial: 5 dias por pessoa. Um dia concluído conta uma vez, mesmo com mais de um treino.</p></section><button class="btn" id="save-sheet">Salvar ficha e configurações</button>`;}
function connection(){return `<section class="card"><h2>Dois celulares, o mesmo casal.</h2><p class="mu">Conecte os aparelhos ao mesmo espaço. Cargas, séries, observações, ficha e histórico passam a ser compartilhados.</p>${store.room?`<p class="connected">Casal conectado</p><p class="mu">Compartilhe este código apenas com a outra pessoa. Quem o possui pode ler e alterar os registros.</p><button class="btn s" id="show-code">Mostrar código do casal</button><div id="code-area" hidden><div class="codebox" id="room-code">${store.room.code}</div><button class="btn s" id="copy-code">Copiar código</button></div><p class="hint">${store.pending.length} alterações aguardando envio. A sincronização ocorre a cada 10 segundos enquanto a página está aberta.</p><button class="btn" id="force-sync">Sincronizar agora</button><button class="btn s" id="disconnect">Desconectar este aparelho</button>`:`<h2>Primeiro celular</h2><p class="mu">Crie o espaço e envie seu código para a outra pessoa. Seus registros atuais serão enviados após a confirmação.</p><button class="btn" id="create-room">Criar espaço do casal</button><h2 style="margin-top:25px">Segundo celular</h2><label class="field">Código recebido<input id="join-code" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Cole o código de 32 caracteres"></label><button class="btn s" id="join-room">Conectar ao casal</button>`}</section><section class="card"><h2>Como a sincronização funciona</h2><p class="mu">Sem internet, as alterações ficam na fila neste aparelho. Ao voltar, elas são enviadas. Alterações em séries diferentes são combinadas. Se ambos editarem a mesma série ou configuração, vale o último envio ao servidor.</p><p class="mu">No segundo celular, os registros já existentes são mantidos. Você escolhe se quer importá-los para o casal; nomes e ficha do espaço conectado têm prioridade.</p><p class="mu">O código é uma chave privada, sem login individual. Guarde-o: não há recuperação por e-mail. Desconectar o aparelho não apaga o histórico compartilhado.</p></section>`;}

$('#tabs').onclick=async e=>{const target=e.target.closest('[data-tab]');if(!target)return;if(tab==='ficha'&&dirtyDraft&&!await ask('Sair sem salvar a ficha?','As edições da ficha ainda não foram salvas.'))return;dirtyDraft=false;tab=target.dataset.tab;render();};
$('#view').oninput=e=>{
  if(tab==='ficha')dirtyDraft=true;
  if(e.target.dataset.note!==undefined){const ex=parsePlan(setting('plan')).groups[day][+e.target.dataset.note],note={date:dateKey(),person:who,day,exercise:ex.name,exerciseId:ex.id,text:e.target.value.slice(0,2000)};operation(noteKey(note),note.text?note:null);}
  const row=e.target.closest('.set');
  if(row){const ex=parsePlan(setting('plan')).groups[day][+row.dataset.exercise],inputs=row.querySelectorAll('input'),key=logKey({date:dateKey(),person:who,day,exerciseId:ex.id,set:+row.dataset.set});store.drafts??={};store.drafts[key]={weight:inputs[0].value,reps:inputs[1].value};persist();}
};
$('#view').onchange=e=>{
  if(e.target.id==='chart-person')chartOptions();
  if(e.target.id==='chart-exercise')drawChart();
};
$('#view').onclick=async e=>{
  const button=e.target.closest('button');if(!button||button.disabled)return;
  try{
    if(button.dataset.rankingPeriod){rankingPeriod=button.dataset.rankingPeriod;render();return;}
    if(button.dataset.demo!==undefined){showDemo(parsePlan(setting('plan')).groups[day][+button.dataset.demo]);return;}
    if(button.dataset.jump!==undefined){const target=document.getElementById('exercise-'+Number(button.dataset.jump));target?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    if(button.id==='go-next'){const target=$('#view .set:not(.done)')||$('#finish');target?.scrollIntoView({behavior:'smooth',block:'center'});target?.querySelector('input:not(:disabled)')?.focus({preventScroll:true});return;}
    if(button.dataset.person!==undefined){who=+button.dataset.person;render();return;}
    if(button.dataset.day!==undefined){day=button.dataset.day;render();return;}
    if(button.dataset.check!==undefined){
      const [ei,set]=button.dataset.check.split(':').map(Number),ex=parsePlan(setting('plan')).groups[day][ei],cur=current(ex,set),key=logKey({date:dateKey(),person:who,day,exerciseId:ex.id,set});
      if(cur){operation(key,null);render(true);return;}
      const inputs=button.parentElement.querySelectorAll('input'),weightText=inputs[0].value.trim().replace(',','.'),repsText=inputs[1].value.trim();
      if(!/^\d+(\.\d{1,3})?$/.test(weightText)||!/^\d+$/.test(repsText)){notify('Informe a carga em kg (0 para peso corporal) e a quantidade de repetições ou segundos.');return;}
      const value={date:dateKey(),person:who,day,exercise:ex.name,exerciseId:ex.id,set,weight:Number(weightText),reps:Number(repsText),unit:/prancha/i.test(ex.name)?'s':'reps',updatedAt:Date.now()};
      if(!validItem(key,value)){notify('Use carga de 0 a 2000 kg e quantidade de 1 a 5000.');return;}
      delete store.drafts?.[key];operation(key,value);const allDone=parsePlan(setting('plan')).groups[day].every(item=>Array.from({length:item.sets},(_,i)=>!!current(item,i)).every(Boolean));if(allDone){stopRest();releaseWake();notify('Todas as séries concluídas! Finalize o treino.');}else{ensureAudio();await wake();startRest(setting('rest'));}render(true);return;
    }
    if(button.id==='finish'){
      const exs=parsePlan(setting('plan')).groups[day],total=exs.reduce((n,ex)=>n+ex.sets,0);let done=0;for(const ex of exs)for(let s=0;s<ex.sets;s++)if(current(ex,s))done++;
      if(done!==total){notify('Conclua todas as séries antes de finalizar.');return;}
      const session={date:dateKey(),person:who,day,sets:done,finishedAt:Date.now()};operation(sessionKey(session),session);stopRest();releaseWake();render(true);
      const both=[0,1].every(p=>items('session').some(s=>s.date===dateKey()&&s.person===p));notify(both?'Vocês dois concluíram! Mais fortes, juntos. ♡':'Treino concluído e registrado. Boa evolução!');return;
    }
    if(button.id==='undo-finish'){if(await ask('Desfazer conclusão?','O treino voltará a ficar aberto para edição; suas séries serão mantidas.')){operation(sessionKey({date:dateKey(),person:who,day}),null);render(true);}return;}
    if(button.id==='save-sheet'){
      const values={names:[$('#name0').value.trim(),$('#name1').value.trim()],plan:$('#plan-editor').value.trim(),goal:[+$('#goal0').value,+$('#goal1').value],rest:+$('#rest-seconds').value};
      parsePlan(values.plan);for(const [k,v]of Object.entries(values))if(!validItem('setting:'+k,v))throw Error('Preencha os dois nomes, metas entre 1 e 7 e descanso entre 15 e 600 segundos.');
      for(const [k,v]of Object.entries(values))if(JSON.stringify(setting(k))!==JSON.stringify(v))operation('setting:'+k,v);
      dirtyDraft=false;tab='treino';render();notify('Ficha e configurações salvas.');return;
    }
    if(button.id==='restore-plan'){if(await ask('Repor a ficha original?','Isso altera o texto do editor. Toque em Salvar para aplicar. Os registros anteriores serão mantidos.')){$('#plan-editor').value=DEFAULT_PLAN;dirtyDraft=true;}return;}
    if(button.id==='backup-generate'){
      $('#backup').value=JSON.stringify({version:SCHEMA,exportedAt:new Date().toISOString(),items:store.items});
      try{await navigator.clipboard.writeText($('#backup').value);$('#backup-status').textContent='Backup copiado. Guarde o texto em local seguro.';}catch{$('#backup').select();$('#backup-status').textContent='Backup gerado. Selecione e copie o texto acima.';}return;
    }
    if(button.id==='backup-restore'){
      const text=$('#backup').value;if(text.length>6000000)throw Error('Backup muito grande.');const data=validateBackup(JSON.parse(text));
      if(!await ask('Restaurar este backup?',store.room?'Os dados atuais serão substituídos pelo backup e as alterações serão sincronizadas com o outro celular. Guarde um backup atual antes de confirmar.':'Os registros atuais deste aparelho serão substituídos pelo backup. Guarde um backup atual antes de confirmar.'))return;
      const oldKeys=new Set(Object.keys(store.items));for(const [k,v]of Object.entries(data.items)){operation(k,v);oldKeys.delete(k);}for(const k of oldKeys)if(/^(log|session|note):/.test(k))operation(k,null);
      store.drafts={};persist();render();notify('Backup restaurado.');return;
    }
    if(button.id==='create-room'){
      if(!await ask('Criar o espaço compartilhado?','Os registros dos dois perfis, nomes e ficha deste aparelho serão enviados ao banco privado do site. Somente quem tiver o código poderá acessá-los.'))return;
      button.disabled=true;const result=await api('POST',{action:'create'},null);store.room={code:result.code,cursor:0};store.pending=Object.entries(store.items).map(([key,value])=>({id:crypto.randomUUID(),key,value}));persist();await sync();render();notify('Espaço criado. Mostre o código e compartilhe com a outra pessoa.');return;
    }
    if(button.id==='join-room'){
      const code=$('#join-code').value.toLowerCase().replace(/\s/g,'');if(!/^[a-f0-9]{32}$/.test(code))throw Error('Cole o código de 32 caracteres do outro celular.');
      button.disabled=true;const remote=await pullAll(code,0),local={...store.items},hasRecords=Object.keys(local).some(k=>/^(log|session|note):/.test(k)&&local[k]);
      const upload=hasRecords&&await ask('Importar os registros deste aparelho?','Se confirmar, os registros locais que ainda não existem no casal serão enviados. Se cancelar, você usará os dados do casal. A cópia local anterior será preservada neste aparelho.');
      localStorage.setItem('nosso-treino-pre-conexao-'+Date.now(),JSON.stringify({version:SCHEMA,items:local}));
      store.items=applyRemote(defaults(),[],remote.events);store.room={code,cursor:remote.cursor};store.pending=[];store.drafts={};
      if(upload)for(const [key,value]of Object.entries(local))if(/^(log|session|note):/.test(key)&&value&&!Object.hasOwn(store.items,key)){store.items[key]=value;store.pending.push({id:crypto.randomUUID(),key,value});}
      persist();await sync();render();notify('Celular conectado ao casal. Escolha seu perfil na aba Treino.');return;
    }
    if(button.id==='show-code'){const area=$('#code-area');area.hidden=!area.hidden;button.textContent=area.hidden?'Mostrar código do casal':'Ocultar código do casal';return;}
    if(button.id==='copy-code'){try{await navigator.clipboard.writeText(store.room.code);notify('Código copiado. Compartilhe apenas com a outra pessoa.');}catch{notify('Selecione e copie o código exibido.');}return;}
    if(button.id==='force-sync'){await sync();render();return;}
    if(button.id==='disconnect'){
      if(store.pending.length&&!await ask('Há alterações não enviadas','Desconectar agora removerá esta fila de envio, mas manterá os registros locais. Deseja desconectar?'))return;
      store.room=null;store.pending=[];syncMessage='● Salvo neste aparelho';persist();render();notify('Aparelho desconectado. Os registros locais foram mantidos.');return;
    }
  }catch(error){notify(error.message||'Não foi possível concluir agora.');if(button.isConnected)button.disabled=false;}
};

async function api(method,body,code=store.room?.code,after=0){
  const response=await fetch(SYNC_URL+(method==='GET'?`?after=${after}`:''),{method,headers:{...(code?{Authorization:'Bearer '+code}:{}),...(method==='POST'?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  let data;try{data=await response.json();}catch{throw Error('Resposta indisponível. Seus registros locais estão preservados.');}
  if(!response.ok)throw Error(data.error||'Falha na sincronização.');return data;
}
async function pullAll(code,after){const events=[];let cursor=after,more=true;while(more){const data=await api('GET',null,code,cursor);events.push(...data.events);cursor=data.cursor;more=data.more;}return {events,cursor};}
function updateStatus(){const text=!storageOk?'⚠ Falha ao salvar no aparelho':store.room?(busy?'↻ Sincronizando…':store.pending.length?`${store.pending.length} alterações aguardando · ${syncMessage}`:syncMessage):'● Salvo neste aparelho';$('#sync-status').textContent=text;$('#sync-now').hidden=!store.room;}
function scheduleSync(){clearTimeout(syncTimer);if(store.room)syncTimer=setTimeout(sync,1000);}
async function sync(){
  if(!store.room||busy)return;busy=true;updateStatus();const code=store.room.code;
  try{
    if(!navigator.onLine)throw Error('Sem conexão · envio pendente');
    // Upload a bounded queue snapshot. New local changes are retained for the next batch.
    const queued=[...store.pending];
    for(let start=0;start<queued.length;start+=100){const batch=queued.slice(start,start+100),result=await api('POST',{action:'push',operations:batch},code);if(store.room?.code!==code)return;const accepted=new Set(result.accepted);store.pending=store.pending.filter(o=>!accepted.has(o.id));persist();}
    const remote=await pullAll(code,store.room.cursor);if(store.room?.code!==code)return;
    const before=JSON.stringify(store.items);store.items=applyRemote(store.items,store.pending,remote.events);store.room.cursor=remote.cursor;syncMessage='● Sincronizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});persist();
    if(before!==JSON.stringify(store.items)){
      const active=document.activeElement,editing=['INPUT','TEXTAREA','SELECT'].includes(active?.tagName)||dirtyDraft;
      if(!editing)render(true);else notify('Dados do casal recebidos. Sua edição atual foi preservada na tela.');
    }
  }catch(error){syncMessage=error.message?.includes('Código')?'⚠ Código não aceito · confira em Conectar':'Sem conexão com o banco · registros locais preservados';}
  finally{busy=false;updateStatus();}
}
$('#sync-now').onclick=sync;window.addEventListener('online',sync);
setInterval(()=>{if(document.visibilityState==='visible')sync();},10000);
try{channel=new BroadcastChannel(KEY);channel.onmessage=()=>{if(busy||dirtyDraft||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;try{const next=JSON.parse(localStorage.getItem(KEY));validateBackup(next);store=next;render(true);}catch{}};}catch{}

let endAt=0,restInterval=null,restHide=null,wakeLock=null,audio=null,restDone=false;
function ensureAudio(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function beep(){try{if(!audio)return;const o=audio.createOscillator(),gain=audio.createGain();gain.gain.value=.1;o.frequency.value=880;o.connect(gain);gain.connect(audio.destination);o.start();o.stop(audio.currentTime+.35);}catch{}}
async function wake(){try{if(navigator.wakeLock&&!wakeLock&&document.visibilityState==='visible'){wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>wakeLock=null);}}catch{}}
function releaseWake(){wakeLock?.release().catch(()=>{});wakeLock=null;}
function formatTime(seconds){const n=Math.max(0,seconds);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function startRest(seconds){clearTimeout(restHide);clearInterval(restInterval);endAt=Date.now()+seconds*1000;restDone=false;$('#rest').classList.add('on');$('#sk').textContent='Pular';restInterval=setInterval(tick,250);tick();}
function stopRest(){clearInterval(restInterval);clearTimeout(restHide);endAt=0;$('#rest').classList.remove('on');}
function tick(){if(!endAt)return;const left=Math.max(0,Math.ceil((endAt-Date.now())/1000));$('#rt').textContent=formatTime(left);if(left===0&&!restDone){restDone=true;clearInterval(restInterval);navigator.vibrate?.([200,100,200]);beep();$('#sk').textContent='Fechar';notify('Descanso concluído. Próxima série!');restHide=setTimeout(stopRest,4000);}}
$('#m15').onclick=()=>{if(restDone)return;endAt=Math.max(Date.now(),endAt-15000);tick();};
$('#p15').onclick=()=>{const remaining=Math.max(0,Math.ceil((endAt-Date.now())/1000));startRest(Math.min(3600,remaining+15));};$('#sk').onclick=stopRest;
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(dateKey()!==viewDate){viewDate=dateKey();day=dayCodes[Math.max(0,Math.min(4,new Date().getDay()-1))];render();}if(endAt)tick();if(items('log').some(l=>l.date===dateKey())&&!items('session').some(s=>s.date===dateKey()&&s.person===who))wake();sync();}});
const themes=['auto','light','dark'];let theme=localStorage.getItem('nosso-treino-theme')||'auto';
let demoCurrent=null,demoPlaying=false;
function showDemo(ex){
  const demo=DEMOS.find(d=>d[0]===ex.name);if(!demo)return;
  demoCurrent=demo;const still=demo[1]==='Plank',reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('#exercise-demo-title').textContent=ex.name;
  $('#exercise-demo-content').innerHTML=`<div class="demo-stage"><img id="demo-full" src="./demos/${demo[1]}.jpg" alt="${esc(ex.name)}: ${still?'postura estática':'demonstração em duas posições'}" decoding="async"></div><p class="demo-variant">${esc(demo[2])}</p><p class="hint">${still?'A prancha é uma sustentação estática. Mantenha a postura durante o tempo indicado.':'GIF em duas posições reais: início e final. O intervalo entre os quadros não indica a velocidade de execução.'}</p><div class="row demo-controls">${!still?`<button class="btn" id="demo-play">▶ Reproduzir GIF</button><button class="btn s" id="demo-steps">Ver posições lado a lado</button>`:''}</div><p id="demo-load-status" class="hint" role="status"></p><p class="hint">Imagens: <a class="link" href="https://github.com/yuhonas/free-exercise-db/tree/main/exercises/${demo[1]}" target="_blank" rel="noopener">Free Exercise DB ↗</a> · <a class="link" href="./demos/SOURCE-LICENSE.txt" target="_blank">Unlicense</a>. Confirme a variante com o treinador.</p>`;
  $('#demo-full').onerror=()=>{$('#demo-load-status').textContent='Não foi possível carregar a demonstração. Tente novamente ou consulte as instruções do exercício.';};
  $('#exercise-demo').showModal();demoPlaying=false;if(!still&&!reduced)playDemo();
}
function playDemo(){if(!demoCurrent||demoCurrent[1]==='Plank')return;const stage=$('#exercise-demo .demo-stage');stage.innerHTML=`<img id="demo-full" src="./demos/${demoCurrent[1]}.gif" alt="${esc(demoCurrent[0])}: GIF em duas posições" decoding="async">`;demoPlaying=true;$('#demo-play').textContent='Ⅱ Pausar GIF';$('#demo-steps').textContent='Ver posições lado a lado';$('#demo-full').onerror=()=>{$('#demo-load-status').textContent='Falha ao carregar o GIF. As instruções do exercício continuam disponíveis.';demoPlaying=false;};}
function pauseDemo(){const img=$('#demo-full');if(!img||!demoCurrent)return;try{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);img.src=canvas.toDataURL('image/png');}catch{img.src=`./demos/${demoCurrent[1]}.jpg`;}demoPlaying=false;if($('#demo-play'))$('#demo-play').textContent='▶ Reproduzir GIF';}
$('#exercise-demo-content').onclick=e=>{const button=e.target.closest('button');if(button?.id==='demo-play'){if(demoPlaying)pauseDemo();else playDemo();}if(button?.id==='demo-steps'){demoPlaying=false;$('#demo-play').textContent='▶ Reproduzir GIF';$('#exercise-demo .demo-stage').innerHTML=`<div class="demo-two"><figure><img src="./demos/${demoCurrent[1]}.jpg" alt="Primeira posição de ${esc(demoCurrent[0])}"><figcaption>Posição 1</figcaption></figure><figure><img src="./demos/${demoCurrent[1]}-1.jpg" alt="Segunda posição de ${esc(demoCurrent[0])}"><figcaption>Posição 2</figcaption></figure></div>`;}};
$('#exercise-demo .demo-close').onclick=()=>$('#exercise-demo').close();
$('#exercise-demo').onclose=()=>{demoPlaying=false;$('#exercise-demo-content').innerHTML='';demoCurrent=null;};
$('#exercise-demo').onclick=e=>{if(e.target===$('#exercise-demo'))$('#exercise-demo').close();};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&demoPlaying)pauseDemo();});
function applyTheme(){if(theme==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme;$('#theme').setAttribute('aria-label','Tema '+({auto:'automático',light:'claro',dark:'escuro'}[theme])+'. Toque para mudar.');}
$('#theme').onclick=()=>{theme=themes[(themes.indexOf(theme)+1)%3];try{localStorage.setItem('nosso-treino-theme',theme);}catch{}applyTheme();};
window.addEventListener('beforeunload',e=>{if(dirtyDraft){e.preventDefault();e.returnValue='';}});
// Atualiza somente perfis com os nomes-padrão antigos; preserva nomes personalizados e os registros.
const legacyNames=setting('names');
if(Array.isArray(legacyNames)&&legacyNames[0]==='Pessoa 1'&&legacyNames[1]==='Pessoa 2'){
  operation('setting:names',['Sam','Gabi']);
}
applyTheme();render();persist();if(migrationMessage)notify(migrationMessage);sync();
