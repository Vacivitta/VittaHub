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
  const profile = signal<{ id: string; display_name: string | null } | null>({ id: 'user-1', display_name: 'Pessoa Atual' });
  const auth = { profile, displayName: signal('Pessoa Atual') };
  const task: TaskWithContext = {
    id, board_id: 'board-1', column_id: 'column-1', title: 'Detalhe real',
    description: 'Descrição persistida', created_by: 'user-3', assignee_id: 'user-2',
    due_at: '2030-01-01T12:00:00Z', business_state: 'aguardando_aceite', is_private: true,
    created_at: '2026-09-28T12:00:00Z', board: { id: 'board-1', title: 'Quadro real' },
    column: { id: 'column-1', title: 'Entrada' },
  };

  beforeEach(() => {
    profile.set({ id: 'user-1', display_name: 'Pessoa Atual' });
    getById.mockReset().mockResolvedValue({ status: 'loaded', task });
    listAssignees.mockReset().mockResolvedValue([
      { id: 'user-2', display_name: 'Responsável visível' },
      { id: 'user-3', display_name: 'Criador visível' },
    ]);
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'pendencias/:id', component: TaskDetailPage }]),
      { provide: TasksService, useValue: { getById, listAssignees } },
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
    expect(text).toContain('Detalhe real');
    expect(text).toContain('Descrição persistida');
    expect(text).toContain('Responsável visível');
    expect(text).toContain('Criador visível');
    expect(text).toContain('Quadro real');
    expect(text).toContain('Entrada');
    expect(text).toContain('Privada');
    expect(harness.routeNativeElement?.querySelector('a[href="/quadros/board-1"]')).not.toBeNull();
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
  });
});
