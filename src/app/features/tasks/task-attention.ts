import { TaskDetail } from './task-detail';

export const ATTENTION_FILTERS = [
  { id: 'vencidas', label: 'Vencidas', detail: 'Precisam da sua atenção', tone: 'danger' },
  {
    id: 'proximas-vencimento',
    label: 'Próximas do vencimento',
    detail: 'Nas próximas 48 horas',
    tone: 'warning',
  },
  {
    id: 'aguardando-aceite',
    label: 'Aguardando aceite',
    detail: 'Atribuídas a você',
    tone: 'acceptance',
  },
  { id: 'em-andamento', label: 'Em andamento', detail: 'Aceitas e ainda ativas', tone: 'progress' },
] as const;
export type AttentionFilter = (typeof ATTENTION_FILTERS)[number]['id'];
const WINDOW_MS = 48 * 60 * 60 * 1000;

export function matchesAttention(task: TaskDetail, filter: string | null, now: number): boolean {
  if (task.business_state === 'concluido') return false;
  const due = new Date(task.due_at).getTime();
  switch (filter) {
    case 'vencidas':
      return due < now;
    case 'proximas-vencimento':
      return due >= now && due <= now + WINDOW_MS;
    case 'aguardando-aceite':
      return task.business_state === 'aguardando_aceite';
    case 'em-andamento':
      return ['a_fazer', 'fazendo', 'aguardando_terceiro'].includes(task.business_state);
    default:
      return true;
  }
}

function calendarDay(time: number): number {
  const date = new Date(time);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

export function priorityRank(task: TaskDetail, now: number): number {
  if (task.business_state === 'concluido') return Infinity;
  const due = new Date(task.due_at).getTime();
  const day = calendarDay(due) - calendarDay(now);
  if (due < now) return 0;
  if (day === 0) return 1;
  if (day === 1) return 2;
  if (due >= now && due <= now + WINDOW_MS) return 3;
  return task.business_state === 'aguardando_aceite' ? 4 : Infinity;
}

export function deadlineText(task: TaskDetail, now: number): string {
  const due = new Date(task.due_at).getTime();
  const day = calendarDay(due) - calendarDay(now);
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(due);
  if (due < now) {
    if (day === 0) return `Venceu hoje às ${time}`;
    return `Vencida há ${-day} ${day === -1 ? 'dia' : 'dias'}`;
  }
  if (day === 0) return `Vence hoje às ${time}`;
  if (day === 1) return `Vence amanhã às ${time}`;
  if (due <= now + WINDOW_MS) return 'Vence em breve';
  return 'Aguardando seu aceite';
}
