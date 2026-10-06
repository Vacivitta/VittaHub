import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskWithContext } from '../tasks/task-detail';
import { Home } from './home';
import { RequestsService } from '../requests/requests.service';

describe('Home operational attention', () => {
  const clock = new Date(2026, 8, 30, 10, 23).getTime();
  const hour = 3600000;
  const task = (
    id: string,
    offset: number,
    state: TaskWithContext['business_state'] = 'a_fazer',
  ): TaskWithContext => ({
    id,
    board_id: 'real-board-id',
    column_id: 'column',
    title: id,
    description: null,
    created_by: 'creator',
    assignee_id: 'me',
    due_at: new Date(clock + offset).toISOString(),
    business_state: state,
    is_private: false,
    created_at: new Date(clock).toISOString(),
    board: { id: 'real-board-id', title: 'Quadro operacional' },
    column: null,
  });
  const listMine = vi.fn();
  const decisionCount = signal(0);
  const highlighted = signal<string | null>(null);
  beforeEach(() => {
    decisionCount.set(0);
    highlighted.set(null);
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(clock);
    listMine
      .mockReset()
      .mockResolvedValue([
        task('fora', 48 * hour + 1),
        task('limite', 48 * hour),
        task('amanhã', 24 * hour, 'aguardando_terceiro'),
        task('hoje', hour, 'fazendo'),
        task('agora', 0),
        task('vencida', -hour),
        task('aceite', 100 * hour, 'aguardando_aceite'),
        task('concluída', -2 * hour, 'concluido'),
      ]);
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: RequestsService, useValue: { count: decisionCount, highlighted } },
        { provide: TasksService, useValue: { listMine } },
        { provide: AuthService, useValue: { displayName: signal('Pessoa Atual') } },
      ],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  async function render() {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows exactly four attention cards with independent counts and filter links', async () => {
    const fixture = await render();
    expect(listMine).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.stats().map((s) => s.value)).toEqual([1, 4, 1, 6]);
    const cards = fixture.nativeElement.querySelectorAll(
      '.attention-card',
    ) as NodeListOf<HTMLAnchorElement>;
    expect(cards).toHaveLength(4);
    expect([...cards].map((c) => c.querySelector('.attention-label')?.textContent?.trim())).toEqual(
      ['Vencidas', 'Próximas do vencimento', 'Aguardando aceite', 'Em andamento'],
    );
    expect([...cards].map((c) => c.getAttribute('href'))).toEqual([
      '/minhas-pendencias?filtro=vencidas',
      '/minhas-pendencias?filtro=proximas-vencimento',
      '/minhas-pendencias?filtro=aguardando-aceite',
      '/minhas-pendencias?filtro=em-andamento',
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('Concluídas');
    expect(fixture.nativeElement.textContent).not.toContain('demonstração');
  });

  it('adds decisions only when needed and links to the highlighted item', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('.decisions-card')).toBeNull();
    decisionCount.set(2); highlighted.set('postponement-request-1'); fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.decisions-card');
    expect(card.textContent).toContain('Decisões pendentes');
    expect(card.querySelector('strong').textContent).toBe('2');
    expect(card.getAttribute('href')).toBe('/solicitacoes#postponement-request-1');
    decisionCount.set(0); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.decisions-card')).toBeNull();
  });

  it('uses browser date/time, ticks each minute and clears the timer on destroy', async () => {
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const intervals = vi.spyOn(globalThis, 'setInterval');
    const fixture = await render();
    const time = () => fixture.nativeElement.querySelector('.live-date').textContent;
    expect(time()).toContain('30 de setembro de 2026');
    expect(time()).toContain('10:23');
    vi.advanceTimersByTime(60000);
    fixture.detectChanges();
    expect(time()).toContain('10:24');
    expect(fixture.componentInstance.stats()[0].value).toBe(2);
    const clockIndex = intervals.mock.calls.findIndex((call) => call[1] === 60_000);
    expect(clockIndex).toBeGreaterThanOrEqual(0);
    const clockTimer = intervals.mock.results[clockIndex].value;
    const lastTick = fixture.componentInstance.now();
    fixture.destroy();
    expect(clear).toHaveBeenCalledWith(clockTimer);
    vi.advanceTimersByTime(60_000);
    expect(fixture.componentInstance.now()).toBe(lastTick);
  });

  it('orders overdue before upcoming, limits to five and links the real task and board', async () => {
    const fixture = await render();
    expect(fixture.componentInstance.priorities().map((t) => t.id)).toEqual([
      'vencida',
      'agora',
      'hoje',
      'amanhã',
      'limite',
    ]);
    const item = fixture.nativeElement.querySelector('.priority-item');
    expect(item.textContent).toContain('Quadro operacional');
    expect(item.textContent).toContain('Venceu hoje às 09:23');
    expect(item.querySelector('a').getAttribute('href')).toBe('/pendencias/vencida');
    expect(item.querySelectorAll('a')[1].getAttribute('href')).toBe('/quadros/real-board-id');
    expect(fixture.nativeElement.textContent).toContain('Vence amanhã às 10:23');
  });

  it('orders all priority categories and uses human deadline descriptions', async () => {
    listMine.mockResolvedValue([
      task('aceite', 100 * hour, 'aguardando_aceite'),
      task('breve', 47 * hour),
      task('amanhã', 24 * hour),
      task('hoje', hour),
      task('antiga', -72 * hour),
    ]);
    const fixture = await render();
    expect(fixture.componentInstance.priorities().map((t) => t.id)).toEqual([
      'antiga',
      'hoje',
      'amanhã',
      'breve',
      'aceite',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Vencida há 3 dias');
    expect(fixture.nativeElement.textContent).toContain('Vence hoje às 11:23');
    expect(fixture.nativeElement.textContent).toContain('Vence em breve');
    expect(fixture.nativeElement.textContent).toContain('Aguardando seu aceite');
  });

  it('shows a safe error instead of false zero counts and supports retry', async () => {
    listMine.mockRejectedValueOnce(new Error('internal')).mockResolvedValueOnce([]);
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar');
    expect(fixture.nativeElement.textContent).not.toContain('internal');
    expect(fixture.nativeElement.querySelector('.attention-card > strong').textContent).toBe('—');
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma pendência prioritária');
  });
});
