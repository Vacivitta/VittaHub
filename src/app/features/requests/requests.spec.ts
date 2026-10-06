import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { TaskAssignmentActions } from '../tasks/task-assignment-actions';
import { TasksService } from '../tasks/tasks.service';
import { RequestItem, RequestKind } from './request-item';
import { Requests } from './requests';
import { RequestsService } from './requests.service';

describe('Requests central', () => {
  const task = {
    id: 'task-1',
    board_id: 'board-1',
    column_id: 'column',
    title: 'Pendência da central',
    description: null,
    created_by: 'creator',
    assignee_id: 'me',
    due_at: '2030-01-01T12:00:00Z',
    business_state: 'aguardando_aceite' as const,
    is_private: false,
    created_at: '2026-10-06T12:00:00Z',
  };
  const request = {
    id: 'request-1',
    task_id: 'task-1',
    requested_by: 'other',
    previous_due_at: task.due_at,
    requested_due_at: '2030-02-01T12:00:00Z',
    justification: 'Dependência externa',
    created_at: '2026-10-06T12:00:00Z',
    status: 'pending' as const,
    decided_by: null,
    decided_at: null,
    decision_justification: null,
  };
  const item = (kind: RequestKind, area: 'decide' | 'waiting' = 'decide'): RequestItem => ({
    item_key: kind + '-item',
    kind,
    area,
    task: {
      ...task,
      business_state: kind === 'postponement' ? 'fazendo' : 'aguardando_aceite',
      assignee_id: kind === 'reassignment' ? null : 'me',
      awaiting_reassignment: kind === 'reassignment',
    },
    request: kind === 'postponement' ? request : null,
    creator_name: 'Pessoa criadora',
    assignee_name: 'Pessoa responsável',
    requester_name: 'Pessoa solicitante',
    refused_assignee_name: 'Pessoa que recusou',
    justification: kind === 'acceptance' ? null : 'Motivo registrado',
  });
  let rows: RequestItem[];
  const rpc = vi.fn();
  const tasks = {
    assignmentCapabilities: vi.fn(),
    listPostponements: vi.fn(),
    listAssignees: vi.fn(),
    accept: vi.fn(),
    refuseAssignment: vi.fn(),
    decidePostponement: vi.fn(),
    reassign: vi.fn(),
  };
  beforeEach(() => {
    rows = [item('acceptance')];
    rpc.mockReset().mockImplementation(async () => ({ data: rows, error: null }));
    for (const mock of Object.values(tasks)) mock.mockReset();
    tasks.assignmentCapabilities.mockResolvedValue({ can_manage: true, can_change_due_at: false });
    tasks.listPostponements.mockImplementation(async () =>
      rows.filter((r) => r.request).map((r) => r.request),
    );
    tasks.listAssignees.mockResolvedValue([{ id: 'other', display_name: 'Participante ativo' }]);
    for (const mock of [
      tasks.accept,
      tasks.refuseAssignment,
      tasks.decidePostponement,
      tasks.reassign,
    ])
      mock.mockImplementation(async () => {
        rows = [];
      });
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
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'solicitacoes', component: Requests }]),
        {
          provide: AuthService,
          useValue: {
            session: signal({ user: { id: 'me' } }),
            profile: signal({ id: 'me', is_active: true }),
          },
        },
        { provide: SUPABASE_CLIENT, useValue: { rpc } },
        { provide: TasksService, useValue: tasks },
      ],
    });
  });

  async function render(fragment = '') {
    const harness = await RouterTestingHarness.create('/solicitacoes' + fragment);
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(TestBed.inject(RequestsService).loading()).toBe(false);
    });
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  it('shows separate decisions and waiting areas with useful names, dates and task links', async () => {
    rows = [item('acceptance'), item('postponement', 'waiting')];
    const h = await render();
    const sections = h.routeNativeElement!.querySelectorAll('section');
    expect(sections[0].textContent).toContain('Para você decidir');
    expect(sections[1].textContent).toContain('Aguardando retorno');
    expect(sections[0].textContent).toContain('Pessoa responsável');
    expect(sections[1].textContent).toContain('Pessoa solicitante');
    expect(sections[1].textContent).toContain('01/02/2030');
    expect(sections[1].textContent).toContain('Motivo registrado');
    expect(sections[1].querySelector('app-task-assignment-actions')).toBeNull();
    expect(sections[0].querySelector('h3 a')?.getAttribute('href')).toBe('/pendencias/task-1');
    expect(TestBed.inject(RequestsService).count()).toBe(1);
  });

  it.each([
    ['acceptance', 'accept', 'accept'],
    ['acceptance', 'refuse', 'refuseAssignment'],
    ['postponement', 'approve', 'decidePostponement'],
    ['postponement', 'reject', 'decidePostponement'],
    ['reassignment', 'reassign', 'reassign'],
  ] as const)('resolves %s/%s in place and updates the counter', async (kind, action, method) => {
    rows = [item(kind)];
    const h = await render();
    const child = h.routeDebugElement!.query(By.directive(TaskAssignmentActions))
      .componentInstance as TaskAssignmentActions;
    await vi.waitFor(() => {
      expect(child.capabilities()).not.toBeNull();
    });
    if (action === 'accept') await child.accept();
    else {
      child.open(action);
      if (action === 'refuse' || action === 'reject') {
        await child.submit();
        expect(tasks[method]).not.toHaveBeenCalled();
        expect(child.error()).toContain('justificativa');
      }
      child.justification.set('Motivo obrigatório');
      child.assigneeId.set('other');
      await child.submit();
    }
    await h.fixture.whenStable();
    h.detectChanges();
    expect(tasks[method]).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(Router).url).toBe('/solicitacoes');
    expect(TestBed.inject(RequestsService).count()).toBe(0);
    expect(h.routeNativeElement!.querySelector('.request-card')).toBeNull();
    const feedback = h.routeNativeElement!.querySelector('[role="status"]');
    expect(feedback?.textContent).toContain('sucesso');
    expect(feedback?.querySelector('a')?.textContent).toBe('Abrir pendência');
    expect(feedback?.querySelector('a')?.getAttribute('href')).toBe('/pendencias/task-1');
  });

  it('focuses and scrolls the exact card identified by the Home fragment', async () => {
    rows = [
      item('acceptance'),
      { ...item('postponement', 'waiting'), task: { ...task, id: 'task-2' } },
    ];
    const h = await render('#postponement-item');
    await vi.waitFor(() => {
      h.detectChanges();
      expect(document.activeElement?.id).toBe('postponement-item');
    });
    expect(
      h.routeNativeElement!.querySelector('#postponement-item')?.classList.contains('highlighted'),
    ).toBe(true);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      behavior: 'instant',
    });
  });

  it('shows distinct empty states', async () => {
    rows = [];
    const h = await render();
    expect(h.routeNativeElement!.textContent).toContain('Nenhuma decisão pendente para você');
    expect(h.routeNativeElement!.textContent).toContain('Nenhuma solicitação aguardando retorno');
  });

  it('shows a safe loading error with retry instead of false empty messages', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'secret' } });
    const h = await render();
    expect(h.routeNativeElement!.textContent).toContain('Não foi possível carregar');
    expect(h.routeNativeElement!.textContent).not.toContain('Nenhuma decisão');
    expect(h.routeNativeElement!.textContent).not.toContain('secret');
    rpc.mockResolvedValue({ data: [], error: null });
    await TestBed.inject(RequestsService).refresh();
    h.detectChanges();
    expect(h.routeNativeElement!.textContent).toContain('Nenhuma decisão pendente');
  });
});
