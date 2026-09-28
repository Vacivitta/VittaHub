import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../../core/auth/auth.service';
import { TaskDetailPage } from './task';
import { TaskResult, TaskWithContext } from './task-detail';
import { TasksService } from './tasks.service';

describe('TaskDetailPage', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const getById = vi.fn();
  const listAssignees = vi.fn();
  const listHistory = vi.fn();
  const accept = vi.fn();
  const start = vi.fn();
  const complete = vi.fn();
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'user-1' } });
  const profile = signal<{ id: string; display_name: string | null } | null>({ id: 'user-1', display_name: 'Pessoa Atual' });
  const auth = { session, profile, displayName: signal('Pessoa Atual') };
  const task: TaskWithContext = {
    id, board_id: 'board-1', column_id: 'column-1', title: 'Detalhe real',
    description: 'Descrição persistida', created_by: 'user-3', assignee_id: 'user-2',
    due_at: '2030-01-01T12:00:00Z', business_state: 'aguardando_aceite', is_private: true,
    created_at: '2026-09-28T12:00:00Z', board: { id: 'board-1', title: 'Quadro real' },
    column: { id: 'column-1', title: 'Entrada' },
  };

  beforeEach(() => {
    profile.set({ id: 'user-1', display_name: 'Pessoa Atual' });
    session.set({ user: { id: 'user-1' } });
    getById.mockReset().mockResolvedValue({ status: 'loaded', task });
    listAssignees.mockReset().mockResolvedValue([
      { id: 'user-2', display_name: 'Responsável visível' },
      { id: 'user-3', display_name: 'Criador visível' },
    ]);
    listHistory.mockReset().mockResolvedValue([]);
    accept.mockReset().mockResolvedValue(undefined);
    start.mockReset().mockResolvedValue(undefined);
    complete.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'pendencias/:id', component: TaskDetailPage }]),
      { provide: TasksService, useValue: { getById, listAssignees, listHistory, accept, start, complete } },
      { provide: AuthService, useValue: auth },
    ] });
  });

  async function render() {
    const harness = await RouterTestingHarness.create(`/pendencias/${id}`);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  it('shows loading while the RLS query is pending', async () => {
    let resolve!: (result: TaskResult) => void;
    getById.mockImplementation(() => new Promise<TaskResult>((done) => { resolve = done; }));
    const harness = await RouterTestingHarness.create(`/pendencias/${id}`);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Carregando pendência');
    resolve({ status: 'unavailable' });
    await harness.fixture.whenStable();
  });

  it('renders an accessible real task and only safely available related names', async () => {
    const harness = await render();
    const text = harness.routeNativeElement!.textContent!;
    expect(getById).toHaveBeenCalledExactlyOnceWith(id);
    expect(listAssignees).toHaveBeenCalledExactlyOnceWith('board-1');
    expect(listHistory).toHaveBeenCalledExactlyOnceWith(id);
    expect(text).toContain('Detalhe real');
    expect(text).toContain('Descrição persistida');
    expect(text).toContain('Responsável visível');
    expect(text).toContain('Criador visível');
    expect(text).toContain('Quadro real');
    expect(text).toContain('Entrada');
    expect(text).toContain('Privada');
    expect(harness.routeNativeElement?.querySelector('a[href="/quadros/board-1"]')).not.toBeNull();
  });

  it('shows an action only to the assignee in the exact applicable state', async () => {
    session.set({ user: { id: 'user-2' } });
    const harness = await render();
    expect(harness.routeNativeElement?.querySelector('.task-action button')?.textContent).toContain('Aceitar pendência');

    session.set({ user: { id: 'user-1' } });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('.task-action')).toBeNull();
  });

  it.each([
    ['a_fazer', 'Iniciar pendência'], ['fazendo', 'Concluir pendência'], ['concluido', null],
  ] as const)('shows the correct action for %s', async (state, label) => {
    session.set({ user: { id: 'user-2' } });
    getById.mockResolvedValue({ status: 'loaded', task: { ...task, business_state: state } });
    const harness = await render();
    const button = harness.routeNativeElement?.querySelector('.task-action button');
    if (label) expect(button?.textContent).toContain(label);
    else expect(button).toBeNull();
  });

  it('accepts once and refreshes state and history without changing the column', async () => {
    session.set({ user: { id: 'user-2' } });
    const harness = await render();
    const refreshed = { ...task, business_state: 'a_fazer' as const, accepted_at: '2026-09-28T13:00:00Z' };
    getById.mockResolvedValue({ status: 'loaded', task: refreshed });
    listHistory.mockResolvedValue([{ id: 'event-1', task_id: id, event_type: 'accepted',
      content: 'Pendência aceita', actor_id: 'user-2', is_system: true, created_at: '2026-09-28T13:00:00Z' }]);
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.task-action button')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(accept).toHaveBeenCalledExactlyOnceWith(id);
    expect(harness.routeNativeElement?.textContent).toContain('A fazer');
    expect(harness.routeNativeElement?.textContent).toContain('Pendência aceita');
    expect((harness.routeDebugElement!.componentInstance as TaskDetailPage).task()?.column_id).toBe('column-1');
  });

  it('prevents duplicate action while loading', async () => {
    session.set({ user: { id: 'user-2' } });
    let resolve!: () => void;
    accept.mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as TaskDetailPage;
    const pending = page.runAction();
    await page.runAction();
    expect(accept).toHaveBeenCalledTimes(1);
    expect(page.transitioning()).toBe(true);
    resolve();
    await pending;
  });

  it('shows a friendly transition error and keeps the action available', async () => {
    session.set({ user: { id: 'user-2' } });
    accept.mockRejectedValue(new Error('private detail'));
    const harness = await render();
    (harness.routeDebugElement!.componentInstance as TaskDetailPage).runAction();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Não foi possível atualizar a pendência.');
    expect(harness.routeNativeElement?.textContent).not.toContain('private detail');
    expect(harness.routeNativeElement?.querySelector('.task-action button')).not.toBeNull();
  });

  it('completes an in-progress task and clearly updates the detail', async () => {
    session.set({ user: { id: 'user-2' } });
    const doing = { ...task, business_state: 'fazendo' as const };
    getById.mockResolvedValueOnce({ status: 'loaded', task: doing });
    const harness = await render();
    getById.mockResolvedValue({ status: 'loaded', task: {
      ...doing, business_state: 'concluido', completed_at: '2026-09-28T14:00:00Z',
    } });
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.task-action button')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(complete).toHaveBeenCalledExactlyOnceWith(id);
    expect(harness.routeNativeElement?.textContent).toContain('Concluído');
    expect(harness.routeNativeElement?.textContent).toContain('Pendência concluída com sucesso.');
    expect(harness.routeNativeElement?.querySelector('.task-action')).toBeNull();
  });

  it('omits an unavailable creator name instead of exposing an identifier', async () => {
    listAssignees.mockResolvedValue([{ id: 'user-2', display_name: 'Responsável visível' }]);
    const harness = await render();
    expect(harness.routeNativeElement?.textContent).not.toContain('Criador');
    expect(harness.routeNativeElement?.textContent).not.toContain('user-3');
  });

  it.each(['unavailable', 'error'])('handles the %s state without leaking task existence', async (status) => {
    getById.mockResolvedValue({ status });
    const harness = await render();
    if (status === 'unavailable') {
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Pendência não encontrada ou sem acesso');
    } else {
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Não foi possível carregar a pendência');
    }
    expect(listAssignees).not.toHaveBeenCalled();
    expect(listHistory).not.toHaveBeenCalled();
  });
});
