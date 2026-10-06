import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { TaskAssignmentActions } from './task-assignment-actions';
import { TasksService } from './tasks.service';
import { TaskDetail } from './task-detail';

describe('TaskAssignmentActions', () => {
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'assignee' } });
  const profile = signal({ id: 'assignee', is_active: true, role: 'membro' });
  const service = {
    assignmentCapabilities: vi.fn(),
    listPostponements: vi.fn(),
    listAssignees: vi.fn(),
    refuseAssignment: vi.fn(),
    reassign: vi.fn(),
    requestPostponement: vi.fn(),
    decidePostponement: vi.fn(),
    changeDueAt: vi.fn(),
  };
  const task: TaskDetail = {
    id: 'task',
    board_id: 'board',
    column_id: 'column',
    title: 'Teste',
    description: null,
    created_by: 'creator',
    assignee_id: 'assignee',
    due_at: '2030-01-01T12:00:00Z',
    business_state: 'aguardando_aceite',
    is_private: false,
    created_at: '2026-10-06T12:00:00Z',
  };
  const request = {
    id: 'request',
    task_id: 'task',
    requested_by: 'assignee',
    status: 'pending',
    requested_due_at: '2030-02-01T12:00:00Z',
    justification: 'Dependência externa',
  };

  beforeEach(() => {
    for (const mock of Object.values(service)) mock.mockReset().mockResolvedValue(undefined);
    service.assignmentCapabilities.mockResolvedValue({
      can_manage: false,
      can_change_due_at: false,
    });
    service.listPostponements.mockResolvedValue([]);
    service.listAssignees.mockResolvedValue([{ id: 'creator', display_name: 'Pessoa ativa' }]);
    session.set({ user: { id: 'assignee' } });
    profile.set({ id: 'assignee', is_active: true, role: 'membro' });
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { session, profile } },
        { provide: TasksService, useValue: service },
      ],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function render(changes: Partial<TaskDetail> = {}) {
    const fixture = TestBed.createComponent(TaskAssignmentActions);
    fixture.componentRef.setInput('task', { ...task, ...changes });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  function asUser(id: string, role = 'membro') {
    session.set({ user: { id } });
    profile.set({ id, role, is_active: true });
  }

  it('opens refusal dialog and requires a nonblank justification before calling RPC', async () => {
    const f = await render();
    const c = f.componentInstance;
    const changed = vi.fn();
    c.changed.subscribe(changed);
    (f.nativeElement.querySelector('.actions button') as HTMLButtonElement).click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('dialog').open).toBe(true);
    c.justification.set('  ');
    await c.submit();
    expect(service.refuseAssignment).not.toHaveBeenCalled();
    expect(c.error()).toContain('justificativa');
    c.justification.set('  Sem disponibilidade  ');
    await c.submit();
    expect(service.refuseAssignment).toHaveBeenCalledExactlyOnceWith('task', 'Sem disponibilidade');
    expect(changed).toHaveBeenCalledWith(expect.stringContaining('recusada com sucesso'));
  });

  it('hides refusal for another user and refuses direct UI invocation', async () => {
    asUser('other');
    const f = await render();
    const c = f.componentInstance;
    expect(c.canRefuse()).toBe(false);
    c.open('refuse');
    c.justification.set('Motivo');
    await c.submit();
    expect(service.refuseAssignment).not.toHaveBeenCalled();
  });

  it.each(['creator', 'local-admin', 'global-admin'])(
    'allows %s to reassign using server capabilities',
    async (id) => {
      asUser(id);
      service.assignmentCapabilities.mockResolvedValue({
        can_manage: true,
        can_change_due_at: id === 'global-admin',
      });
      const f = await render({
        awaiting_reassignment: true,
        assignee_id: null,
        refused_assignee_id: 'assignee',
      });
      const c = f.componentInstance;
      expect(f.nativeElement.textContent).toContain('Aguardando reatribuição');
      expect(c.canRefuse()).toBe(false);
      expect(c.canRequest()).toBe(false);
      c.open('reassign');
      await c.submit();
      expect(service.reassign).not.toHaveBeenCalled();
      c.assigneeId.set('creator');
      await c.submit();
      expect(service.reassign).toHaveBeenCalledExactlyOnceWith('task', 'creator');
    },
  );

  it('does not infer board administration from global gestor role', async () => {
    asUser('manager', 'gestor');
    const f = await render({ awaiting_reassignment: true, assignee_id: null });
    expect(f.componentInstance.canReassign()).toBe(false);
    expect(service.listAssignees).not.toHaveBeenCalled();
  });

  it.each(['a_fazer', 'fazendo', 'aguardando_terceiro'] as const)(
    'requests postponement in %s and does not mutate deadline/state',
    async (business_state) => {
      const f = await render({ business_state });
      const c = f.componentInstance;
      c.open('request');
      c.justification.set('Motivo');
      c.dueAt.set('2029-12-01T12:00');
      await c.submit();
      expect(service.requestPostponement).not.toHaveBeenCalled();
      c.dueAt.set('2030-02-01T12:00');
      await c.submit();
      expect(service.requestPostponement).toHaveBeenCalledExactlyOnceWith(
        'task',
        new Date('2030-02-01T12:00').toISOString(),
        'Motivo',
      );
      expect(c.task().due_at).toBe(task.due_at);
      expect(c.task().business_state).toBe(business_state);
    },
  );

  it.each(['aguardando_aceite', 'concluido'] as const)(
    'hides request in %s',
    async (business_state) => {
      const f = await render({ business_state });
      expect(f.componentInstance.canRequest()).toBe(false);
    },
  );

  it('shows pending request and prevents a duplicate request', async () => {
    service.listPostponements.mockResolvedValue([request]);
    const f = await render({ business_state: 'fazendo' });
    expect(f.componentInstance.canRequest()).toBe(false);
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('O prazo atual permanece válido até a aprovação');
    expect(f.nativeElement.textContent).toContain(request.justification);
  });

  it.each(['creator', 'local-admin', 'global-admin'])(
    'lets %s decide with server authority and mandatory rejection reason',
    async (id) => {
      asUser(id);
      service.assignmentCapabilities.mockResolvedValue({
        can_manage: true,
        can_change_due_at: false,
      });
      service.listPostponements.mockResolvedValue([request]);
      const f = await render({ business_state: 'fazendo' });
      const c = f.componentInstance;
      c.open('reject');
      await c.submit();
      expect(service.decidePostponement).not.toHaveBeenCalled();
      c.justification.set('Prazo mantido');
      await c.submit();
      expect(service.decidePostponement).toHaveBeenCalledExactlyOnceWith(
        'task',
        'request',
        false,
        'Prazo mantido',
      );
    },
  );

  it('approves a request without requiring a rejection reason', async () => {
    asUser('creator');
    service.assignmentCapabilities.mockResolvedValue({
      can_manage: true,
      can_change_due_at: false,
    });
    service.listPostponements.mockResolvedValue([request]);
    const f = await render({ business_state: 'fazendo' });
    f.componentInstance.open('approve');
    await f.componentInstance.submit();
    expect(service.decidePostponement).toHaveBeenCalledExactlyOnceWith('task', 'request', true, '');
  });

  it.each(['creator', 'local-admin', 'global-admin'])(
    'never shows self-decision to %s',
    async (id) => {
      asUser(id);
      service.assignmentCapabilities.mockResolvedValue({
        can_manage: true,
        can_change_due_at: true,
      });
      service.listPostponements.mockResolvedValue([{ ...request, requested_by: id }]);
      const f = await render();
      expect(f.componentInstance.canDecide()).toBe(false);
    },
  );

  it('supports direct global deadline edit with mandatory justification', async () => {
    asUser('global', 'administrador');
    service.assignmentCapabilities.mockResolvedValue({ can_manage: true, can_change_due_at: true });
    const f = await render();
    const c = f.componentInstance;
    c.open('deadline');
    c.dueAt.set('2029-12-01T12:00');
    await c.submit();
    expect(service.changeDueAt).not.toHaveBeenCalled();
    c.justification.set('Correção');
    await c.submit();
    expect(service.changeDueAt).toHaveBeenCalledExactlyOnceWith(
      'task',
      new Date('2029-12-01T12:00').toISOString(),
      'Correção',
    );
  });

  it('hides actions for inactive users', async () => {
    profile.set({ id: 'assignee', is_active: false, role: 'administrador' });
    service.assignmentCapabilities.mockResolvedValue({ can_manage: true, can_change_due_at: true });
    const f = await render();
    expect(f.nativeElement.querySelector(':scope > .actions button')).toBeNull();
  });

  it('prevents repeated submits and shows a friendly RPC error', async () => {
    let reject!: (reason: Error) => void;
    service.refuseAssignment.mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const f = await render();
    const c = f.componentInstance;
    c.open('refuse');
    c.justification.set('Motivo');
    const pending = c.submit();
    await c.submit();
    expect(service.refuseAssignment).toHaveBeenCalledTimes(1);
    reject(new Error('secret'));
    await pending;
    expect(c.error()).toContain('Não foi possível');
    expect(c.error()).not.toContain('secret');
    expect(c.busy()).toBe(false);
  });

  it('discards delayed permissions when the session changes', async () => {
    let resolve!: (value: unknown) => void;
    service.assignmentCapabilities.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const f = await render({ awaiting_reassignment: true, assignee_id: null });
    service.assignmentCapabilities.mockResolvedValue(null);
    session.set(null);
    f.detectChanges();
    resolve({ can_manage: true, can_change_due_at: true });
    await f.whenStable();
    expect(f.componentInstance.capabilities()).toBeNull();
    expect(f.componentInstance.canReassign()).toBe(false);
  });
});
