/**
 * Ranking do casal inspirado no modo "Dias Ativos" do GymRats.
 * Uma pessoa ganha um ponto por dia civil com um treino concluído.
 * Os resultados são derivados do histórico existente; nenhum ponto é salvo à parte.
 */
const localDateKey = d => [
  d.getFullYear(),
  String(d.getMonth() + 1).padStart(2, '0'),
  String(d.getDate()).padStart(2, '0')
].join('-');

export function getPeriodBounds(period = 'week', now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'all') return { start: null, end: null, label: 'Desde o primeiro treino' };
  if (period === 'month') {
    start.setDate(1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return {
      start: localDateKey(start),
      end: localDateKey(end),
      label: new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(start)
    };
  }
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  return {
    start: localDateKey(start),
    end: localDateKey(end),
    label: `${start.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })} a ${last.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}`
  };
}

export function calculateRanking(sessions, names = ['Sam', 'Gabi'], goals = [5, 5], period = 'week', now = new Date()) {
  const bounds = getPeriodBounds(period, now);
  const people = [new Set(), new Set()];
  for (const session of sessions ?? []) {
    if (!session || ![0, 1].includes(session.person)
      || typeof session.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(session.date)
      || !Number.isInteger(session.sets) || session.sets < 1
      || (bounds.start !== null && session.date < bounds.start)
      || (bounds.end !== null && session.date >= bounds.end)) continue;
    people[session.person].add(session.date);
  }
  const members = people.map((days, person) => ({
    person,
    name: String(names[person] ?? `Pessoa ${person + 1}`),
    points: days.size,
    goal: Number(goals[person]) || 5,
    dates: [...days].sort()
  })).sort((a,b) => b.points - a.points || a.person - b.person);
  members.forEach((member, index) => {
    member.position = index && member.points === members[index - 1].points
      ? members[index - 1].position
      : index + 1;
  });
  return { ...bounds, period, members, maxPoints: members[0].points, totalPoints: members.reduce((n,m)=>n+m.points,0) };
}
