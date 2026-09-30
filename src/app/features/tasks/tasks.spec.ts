import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TaskWithContext } from './task-detail';
import { Tasks } from './tasks';
import { TasksService } from './tasks.service';

describe('Tasks', () => {
  const listMine = vi.fn();
  const openTask: TaskWithContext = {
    id: '11111111-1111-4111-8111-111111111111',
    board_id: 'board-1',
    column_id: 'column-1',
    title: 'Pendência aberta',
    description: null,
    created_by: 'user-2',
    assignee_id: 'user-1',
    due_at: '2000-01-02T12:00:00Z',
    business_state: 'a_fazer',
    is_private: true,
    created_at: '2026-09-28T12:00:00Z',
    board: { id: 'board-1', title: 'Quadro real' },
    column: { id: 'column-1', title: 'Entrada' },
  };
  const awaitingTask: TaskWithContext = {
    ...openTask,
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Aguardando resposta',
    due_at: '2000-01-01T12:00:00Z',
    business_state: 'aguardando_aceite',
    is_private: false,
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
    listMine.mockReset().mockResolvedValue([awaitingTask, openTask]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'minhas-pendencias', component: Tasks }]),
        { provide: TasksService, useValue: { listMine } },
      ],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  async function render() {
    const harness = await RouterTestingHarness.create('/minhas-pendencias');
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  it('shows loading while the real request is pending', async () => {
    let resolve!: (tasks: TaskWithContext[]) => void;
    listMine.mockImplementation(
      () =>
        new Promise<TaskWithContext[]>((done) => {
          resolve = done;
        }),
    );
    const harness = await RouterTestingHarness.create('/minhas-pendencias');
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Carregando suas pendências');
    resolve([]);
    await harness.fixture.whenStable();
  });

  it('renders the ordered open tasks returned by the authenticated query', async () => {
    const harness = await render();
    const cards = harness.routeNativeElement!.querySelectorAll('.task-card');
    expect(listMine).toHaveBeenCalledOnce();
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Aguardando resposta');
    expect(cards[1].textContent).toContain('Pendência aberta');
    expect(cards[1].textContent).toMatch(/Quadro real\s+· Entrada/);
    expect(cards[1].textContent).toContain('Privada');
  });

  it('marks all non-completed overdue tasks, including awaiting acceptance', async () => {
    const harness = await render();
    const cards = harness.routeNativeElement!.querySelectorAll('.task-card');
    expect(cards[0].querySelector('.overdue')?.textContent).toContain('Vencido');
    expect(cards[1].querySelector('.overdue')?.textContent).toContain('Vencido');
  });

  it.each([
    ['vencidas', ['Aguardando resposta', 'Pendência aberta']],
    ['proximas-vencimento', ['Agora', 'Fazendo', 'Terceiro', 'Limite']],
    ['aguardando-aceite', ['Aguardando resposta']],
    ['em-andamento', ['Pendência aberta', 'Agora', 'Fazendo', 'Terceiro', 'Limite', 'Fora']],
  ])('applies the %s query filter with exact temporal boundaries', async (filter, titles) => {
    const now = Date.now();
    const extra = (
      title: string,
      offset: number,
      state: TaskWithContext['business_state'] = 'a_fazer',
    ) => ({
      ...openTask,
      id: title,
      title,
      due_at: new Date(now + offset).toISOString(),
      business_state: state,
    });
    listMine.mockResolvedValue([
      awaitingTask,
      openTask,
      extra('Agora', 0),
      extra('Fazendo', 3600000, 'fazendo'),
      extra('Terceiro', 7200000, 'aguardando_terceiro'),
      extra('Limite', 48 * 3600000),
      extra('Fora', 48 * 3600000 + 1),
      extra('Concluída', -1, 'concluido'),
      extra('Concluída futura', 1, 'concluido'),
    ]);
    const harness = await RouterTestingHarness.create('/minhas-pendencias?filtro=' + filter);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(
      [...harness.routeNativeElement!.querySelectorAll('.task-card h2')].map((el) =>
        el.textContent?.trim(),
      ),
    ).toEqual(titles);
    await harness.navigateByUrl('/minhas-pendencias?filtro=aguardando-aceite');
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelectorAll('.task-card')).toHaveLength(1);
    expect(listMine).toHaveBeenCalledOnce();
  });

  it('opens the shared detail route from an item', async () => {
    const harness = await render();
    expect(harness.routeNativeElement?.querySelector('.task-card-link')?.getAttribute('href')).toBe(
      '/pendencias/22222222-2222-4222-8222-222222222222',
    );
  });

  it('shows the real empty state', async () => {
    listMine.mockResolvedValue([]);
    const harness = await render();
    expect(harness.routeNativeElement?.textContent).toContain('Nenhuma pendência aberta');
    expect(harness.routeNativeElement?.querySelector('.task-card')).toBeNull();
  });

  it('shows a friendly error and retries', async () => {
    listMine.mockRejectedValueOnce(new Error('private detail')).mockResolvedValueOnce([]);
    const harness = await render();
    expect(harness.routeNativeElement?.textContent).toContain(
      'Não foi possível carregar suas pendências',
    );
    expect(harness.routeNativeElement?.textContent).not.toContain('private detail');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('button')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(listMine).toHaveBeenCalledTimes(2);
    expect(harness.routeNativeElement?.textContent).toContain('Nenhuma pendência aberta');
  });
});
