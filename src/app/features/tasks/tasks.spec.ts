import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TaskWithContext } from './task-detail';
import { Tasks } from './tasks';
import { TasksService } from './tasks.service';

describe('Tasks', () => {
  const listMine = vi.fn();
  const openTask: TaskWithContext = {
    id: '11111111-1111-4111-8111-111111111111', board_id: 'board-1', column_id: 'column-1',
    title: 'Pendência aberta', description: null, created_by: 'user-2', assignee_id: 'user-1',
    due_at: '2000-01-02T12:00:00Z', business_state: 'a_fazer', is_private: true,
    created_at: '2026-09-28T12:00:00Z', board: { id: 'board-1', title: 'Quadro real' },
    column: { id: 'column-1', title: 'Entrada' },
  };
  const awaitingTask: TaskWithContext = {
    ...openTask, id: '22222222-2222-4222-8222-222222222222', title: 'Aguardando resposta',
    due_at: '2000-01-01T12:00:00Z', business_state: 'aguardando_aceite', is_private: false,
  };

  beforeEach(() => {
    listMine.mockReset().mockResolvedValue([awaitingTask, openTask]);
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'minhas-pendencias', component: Tasks }]),
      { provide: TasksService, useValue: { listMine } },
    ] });
  });

  async function render() {
    const harness = await RouterTestingHarness.create('/minhas-pendencias');
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  it('shows loading while the real request is pending', async () => {
    let resolve!: (tasks: TaskWithContext[]) => void;
    listMine.mockImplementation(() => new Promise<TaskWithContext[]>((done) => { resolve = done; }));
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

  it('does not mark awaiting acceptance as overdue', async () => {
    const harness = await render();
    const cards = harness.routeNativeElement!.querySelectorAll('.task-card');
    expect(cards[0].textContent).toContain('Prazo após aceite');
    expect(cards[0].querySelector('.overdue')).toBeNull();
    expect(cards[1].querySelector('.overdue')?.textContent).toContain('Vencido');
  });

  it('opens the shared detail route from an item', async () => {
    const harness = await render();
    expect(harness.routeNativeElement?.querySelector('.task-card-link')?.getAttribute('href'))
      .toBe('/pendencias/22222222-2222-4222-8222-222222222222');
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
    expect(harness.routeNativeElement?.textContent).toContain('Não foi possível carregar suas pendências');
    expect(harness.routeNativeElement?.textContent).not.toContain('private detail');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('button')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(listMine).toHaveBeenCalledTimes(2);
    expect(harness.routeNativeElement?.textContent).toContain('Nenhuma pendência aberta');
  });
});
