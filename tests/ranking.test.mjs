import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRanking, getPeriodBounds } from '../public/ranking.js';
const ref = new Date(2026, 9, 22, 14, 0);
const s=(date,person,day='A')=>({ date,person,day,sets:4,finishedAt:1 });
test('um dia ativo vale um ponto mesmo com dois treinos',()=>{
  const r=calculateRanking([s('2026-10-20',0),s('2026-10-20',0,'B'),s('2026-10-21',1)],['Sam','Gabi'],[5,5],'week',ref);
  assert.equal(r.members[0].points,1);
  assert.equal(r.members[1].points,1);
  assert.equal(r.members[0].position,1);
  assert.equal(r.members[1].position,1);
  assert.equal(r.totalPoints,2);
});
test('sem registros não há pontos nem líder de verdade',()=>{
  const r=calculateRanking([],['Sam','Gabi'],[5,5],'week',ref);
  assert.equal(r.maxPoints,0);
  assert.equal(r.totalPoints,0);
});
test('semana começa segunda e exclui treinos fora do intervalo',()=>{
  const r=calculateRanking([s('2026-10-18',0),s('2026-10-19',0),s('2026-10-26',1)],['Sam','Gabi'],[5,5],'week',ref);
  assert.deepEqual([r.start,r.end],['2026-10-19','2026-10-26']);
  assert.equal(r.members.find(x=>x.person===0).points,1);
  assert.equal(r.members.find(x=>x.person===1).points,0);
});
test('mês filtra pelo primeiro dia e preserva total geral',()=>{
  const data=[s('2026-09-30',0),s('2026-10-01',1),s('2026-10-22',1),s('2026-11-01',0)];
  const r=calculateRanking(data,undefined,undefined,'month',ref);
  assert.deepEqual([r.start,r.end],['2026-10-01','2026-11-01']);
  assert.equal(r.members[0].person,1);
  assert.equal(r.members[0].points,2);
  assert.equal(r.members[1].position,2);
  assert.equal(calculateRanking(data,undefined,undefined,'all',ref).totalPoints,4);
});
test('semana de virada de ano permanece correta',()=>{
  const r=getPeriodBounds('week',new Date(2027,0,1));
  assert.deepEqual([r.start,r.end],['2026-12-28','2027-01-04']);
});
test('ignora registros inválidos sem duplicar dias',()=>{
  const r=calculateRanking([s('2026-10-22',0),{...s('2026-10-22',0),sets:0},null,{...s('2026-10-22',0),person:2}],['Sam','Gabi'],[5,5],'week',ref);
  assert.equal(r.totalPoints,1);
});
