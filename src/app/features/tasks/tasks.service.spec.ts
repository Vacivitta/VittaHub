import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { TasksService } from './tasks.service';
import { TaskChanges } from './task-changes';

describe('TasksService', () => {
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'user-1' } });
  const auth = { session, ready: Promise.resolve() };
  const returns = vi.fn();
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    returns,
  };
  const client = { from: vi.fn(), rpc: vi.fn() };
  const task = {
    id: 'task-1',
    board_id: 'board-1',
    column_id: 'column-1',
    title: 'Pendência real',
    description: null,
    created_by: 'user-1',
    assignee_id: 'user-2',
    due_at: '2030-01-01T12:00:00Z',
    business_state: 'aguardando_aceite',
    is_private: false,
    created_at: '2026-09-28T12:00:00Z',
  };

  beforeEach(() => {
    session.set({ user: { id: 'user-1' } });
    auth.ready = Promise.resolve();
    client.from.mockReset().mockReturnValue(query);
    client.rpc.mockReset();
    query.select.mockReset().mockReturnValue(query);
    query.eq.mockReset().mockReturnValue(query);
    query.neq.mockReset().mockReturnValue(query);
    query.in.mockReset().mockReturnValue(query);
    query.order.mockReset().mockReturnValue(query);
    query.maybeSingle.mockReset();
    returns.mockReset().mockResolvedValue({ data: [task], error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: SUPABASE_CLIENT, useValue: client },
      ],
    });
  });

  it('loads real tasks for one board under RLS', async () => {
    expect(await TestBed.inject(TasksService).list('board-1')).toEqual([task]);
    expect(client.from).toHaveBeenCalledExactlyOnceWith('tasks');
    expect(query.eq).toHaveBeenCalledExactlyOnceWith('board_id', 'board-1');
    expect(query.order).toHaveBeenCalledExactlyOnceWith('created_at', { ascending: true });
  });

  it('checks editing authority and sends only the three editable fields without caller claims', async () => {
    const service = TestBed.inject(TasksService);
    client.rpc.mockResolvedValue({ data: true, error: null });
    expect(await service.canEdit('task-1')).toBe(true);
    expect(await service.edit('task-1', '  Título  ', '  ', false)).toBe(true);
    expect(client.rpc.mock.calls).toEqual([
      ['can_edit_task', { p_task_id: 'task-1' }],
      ['edit_task', { p_task_id: 'task-1', p_title: 'Título', p_description: null, p_is_private: false }],
    ]);
    client.rpc.mockResolvedValue({ data: false, error: null });
    expect(await service.edit('task-1', 'Título', '', false)).toBe(false);
    client.rpc.mockResolvedValue({ data: null, error: { message: 'denied' } });
    await expect(service.edit('task-1', 'Título', '', false)).rejects.toThrow();
    await expect(service.canEdit('task-1')).rejects.toThrow();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('checks reopening permission and sends only task and justification to its RPC', async () => {
    const service = TestBed.inject(TasksService);
    const changes = TestBed.inject(TaskChanges);
    client.rpc.mockResolvedValue({ data: true, error: null });
    expect(await service.canReopen('task-1')).toBe(true);
    expect(changes.revision()).toBe(0);
    await service.reopen('task-1', '  Revisar  ');
    expect(client.rpc.mock.calls).toEqual([
      ['can_reopen_task', { p_task_id: 'task-1' }],
      ['reopen_task', { p_task_id: 'task-1', p_justification: 'Revisar' }],
    ]);
    expect(changes.revision()).toBe(1);
    client.rpc.mockResolvedValue({ data: null, error: { message: 'denied' } });
    await expect(service.reopen('task-1', 'Revisar')).rejects.toThrow();
    await expect(service.canReopen('task-1')).rejects.toThrow();
    expect(changes.revision()).toBe(1);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('invalidates the requests read model only after successful mutations', async () => {
    const changes = TestBed.inject(TaskChanges);
    const service = TestBed.inject(TasksService);
    client.rpc.mockResolvedValue({ data: null, error: null });
    await service.assignmentCapabilities('task-1');
    expect(changes.revision()).toBe(0);
    await service.accept('task-1');
    await service.refuseAssignment('task-1', 'Motivo');
    await service.reassign('task-1', 'other');
    await service.decidePostponement('task-1', 'request-1', true, '');
    expect(changes.revision()).toBe(4);
    client.rpc.mockResolvedValue({ data: null, error: { message: 'denied' } });
    await expect(service.accept('task-1')).rejects.toThrow();
    expect(changes.revision()).toBe(4);
  });

  it('routes assignment/deadline actions to bounded RPCs without caller identity or role', async () => {
    client.rpc.mockResolvedValue({ data: null, error: null });
    const service = TestBed.inject(TasksService);
    await service.refuseAssignment('task-1', '  Motivo  ');
    await service.reassign('task-1', 'new-assignee');
    await service.requestPostponement('task-1', '2030-02-01T12:00:00Z', '  Motivo  ');
    await service.decidePostponement('task-1', 'request-1', false, '  Motivo  ');
    await service.decidePostponement('task-1', 'request-1', true, '');
    await service.changeDueAt('task-1', '2030-03-01T12:00:00Z', '  Motivo  ');
    expect(client.rpc.mock.calls).toEqual([
      ['refuse_task_assignment', { p_task_id: 'task-1', p_justification: 'Motivo' }],
      ['reassign_refused_task', { p_task_id: 'task-1', p_assignee_id: 'new-assignee' }],
      ['request_task_postponement', { p_task_id: 'task-1', p_due_at: '2030-02-01T12:00:00Z', p_justification: 'Motivo' }],
      ['decide_task_postponement', { p_task_id: 'task-1', p_request_id: 'request-1', p_approve: false, p_justification: 'Motivo' }],
      ['decide_task_postponement', { p_task_id: 'task-1', p_request_id: 'request-1', p_approve: true, p_justification: null }],
      ['change_task_due_at', { p_task_id: 'task-1', p_due_at: '2030-03-01T12:00:00Z', p_justification: 'Motivo' }],
    ]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('loads decision authority from PostgreSQL and requests under task-scoped RLS', async () => {
    const permissions = { can_manage: true, can_change_due_at: false };
    client.rpc.mockResolvedValue({ data: permissions, error: null });
    expect(await TestBed.inject(TasksService).assignmentCapabilities('task-1')).toEqual(permissions);
    expect(client.rpc).toHaveBeenCalledWith('task_assignment_capabilities', { p_task_id: 'task-1' });
    returns.mockResolvedValue({ data: [], error: null });
    await TestBed.inject(TasksService).listPostponements('task-1');
    expect(client.from).toHaveBeenCalledWith('task_postponement_requests');
    expect(query.eq).toHaveBeenCalledWith('task_id', 'task-1');
  });

  it('hides assignment RPC errors and rejects stale session responses', async () => {
    client.rpc.mockResolvedValue({ data: null, error: { message: 'secret' } });
    await expect(TestBed.inject(TasksService).refuseAssignment('task-1', 'Motivo')).rejects.toThrow('Não foi possível executar a ação.');
    client.rpc.mockImplementation(async () => {
      session.set({ user: { id: 'another' } }); return { data: null, error: null };
    });
    await expect(TestBed.inject(TasksService).changeDueAt('task-1', '2030-01-01Z', 'Motivo')).rejects.toThrow();
  });

  it('loads only the bounded assignee RPC result', async () => {
    const people = [{ id: 'user-1', display_name: 'Pessoa Um' }];
    client.rpc.mockResolvedValue({ data: people, error: null });
    expect(await TestBed.inject(TasksService).listAssignees('board-1')).toEqual(people);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('list_board_assignees', {
      p_board_id: 'board-1',
    });
  });

  it('loads only open tasks assigned to the authenticated user in stable due-date order', async () => {
    const mine = [
      { ...task, assignee_id: 'user-1', board: { id: 'board-1', title: 'Quadro' }, column: null },
    ];
    returns.mockResolvedValue({ data: mine, error: null });
    expect(await TestBed.inject(TasksService).listMine()).toEqual(mine);
    expect(query.eq).toHaveBeenCalledExactlyOnceWith('assignee_id', 'user-1');
    expect(query.neq).toHaveBeenCalledExactlyOnceWith('business_state', 'concluido');
    expect(query.order.mock.calls).toEqual([
      ['due_at', { ascending: true }],
      ['id', { ascending: true }],
    ]);
  });

  it('includes completed tasks only when requested while retaining the assignee restriction', async () => {
    const completed = { ...task, assignee_id: 'user-1', business_state: 'concluido' };
    returns.mockResolvedValue({ data: [completed], error: null });
    expect(await TestBed.inject(TasksService).listMine(true)).toEqual([completed]);
    expect(query.eq).toHaveBeenCalledExactlyOnceWith('assignee_id', 'user-1');
    expect(query.neq).not.toHaveBeenCalled();
  });

  it('loads one visible task by ID and keeps an absent task indistinguishable', async () => {
    const detailed = {
      ...task,
      board: { id: 'board-1', title: 'Quadro' },
      column: { id: 'column-1', title: 'Entrada' },
    };
    query.maybeSingle.mockResolvedValueOnce({ data: detailed, error: null, status: 200 });
    expect(
      await TestBed.inject(TasksService).getById('11111111-1111-4111-8111-111111111111'),
    ).toEqual({ status: 'loaded', task: detailed });
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null, status: 200 });
    expect(
      await TestBed.inject(TasksService).getById('22222222-2222-4222-8222-222222222222'),
    ).toEqual({ status: 'unavailable' });
  });

  it('loads named history through the RPC and structured deadline details under event RLS', async () => {
    const events = [
      {
        id: 'event-1',
        task_id: 'task-1',
        event_type: 'accepted',
        content: 'Pendência aceita',
        actor_id: 'user-1',
        is_system: true,
        created_at: '2026-09-28T12:00:00Z',
      },
    ];
    client.rpc.mockResolvedValue({ data: events, error: null });
    returns.mockResolvedValue({ data: [{ id: 'event-1', details: { previous_due_at: '2030-01-01Z' } }], error: null });
    expect(await TestBed.inject(TasksService).listHistory('task-1')).toEqual([
      { ...events[0], details: { previous_due_at: '2030-01-01Z' } },
    ]);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('list_task_history', {
      p_task_id: 'task-1',
    });
    expect(client.from).toHaveBeenCalledExactlyOnceWith('task_events');
    expect(query.select).toHaveBeenLastCalledWith('id, details');
    expect(query.eq).toHaveBeenLastCalledWith('task_id', 'task-1');
    expect(query.in).toHaveBeenCalledExactlyOnceWith('event_type', [
      'postponement_requested', 'postponement_approved', 'postponement_rejected', 'due_at_changed',
    ]);
  });

  it('loads comments in stable chronological order', async () => {
    const comments = [
      {
        id: 'comment-1',
        task_id: 'task-1',
        author_id: 'user-1',
        content: 'Comentário',
        created_at: '2026-09-28T12:00:00Z',
      },
    ];
    returns.mockResolvedValue({ data: comments, error: null });
    expect(await TestBed.inject(TasksService).listComments('task-1')).toEqual(comments);
    expect(client.from).toHaveBeenCalledExactlyOnceWith('task_comments');
    expect(query.eq).toHaveBeenCalledExactlyOnceWith('task_id', 'task-1');
    expect(query.order.mock.calls).toEqual([
      ['created_at', { ascending: true }],
      ['id', { ascending: true }],
    ]);
  });

  it('adds a trimmed comment through the controlled RPC', async () => {
    client.rpc.mockResolvedValue({ data: 'comment-new', error: null });
    expect(await TestBed.inject(TasksService).addComment('task-1', '  Texto manual  ')).toBe(
      'comment-new',
    );
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('add_task_comment', {
      p_task_id: 'task-1',
      p_content: 'Texto manual',
    });
  });

  it.each([
    ['accept', 'accept_task'],
    ['start', 'start_task'],
    ['complete', 'complete_task'],
    ['resume', 'resume_task'],
  ] as const)('%s uses only its controlled RPC', async (method, rpc) => {
    client.rpc.mockResolvedValue({ data: null, error: null });
    await TestBed.inject(TasksService)[method]('task-1');
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith(rpc, { p_task_id: 'task-1' });
  });

  it('hides transition database errors', async () => {
    client.rpc.mockResolvedValue({ data: null, error: { message: 'private detail' } });
    await expect(TestBed.inject(TasksService).accept('task-1')).rejects.toThrow(
      'Não foi possível atualizar a pendência. Tente novamente.',
    );
  });

  it('sends a trimmed third-party explanation through its controlled RPC', async () => {
    client.rpc.mockResolvedValue({ data: null, error: null });
    await TestBed.inject(TasksService).waitForThirdParty('task-1', '  Fornecedor externo  ');
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('wait_task_for_third_party', {
      p_task_id: 'task-1',
      p_content: 'Fornecedor externo',
    });
  });

  it('does not query malformed task IDs', async () => {
    expect(await TestBed.inject(TasksService).getById('inexistente')).toEqual({
      status: 'unavailable',
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('creates through the controlled RPC without creator or state fields', async () => {
    client.rpc.mockResolvedValue({ data: 'task-new', error: null });
    const input = {
      boardId: 'board-1',
      columnId: 'column-1',
      title: ' Nova pendência ',
      description: ' Detalhes ',
      assigneeId: 'user-2',
      dueAt: '2030-01-01T12:00:00.000Z',
      isPrivate: true,
    };
    expect(await TestBed.inject(TasksService).create(input)).toBe('task-new');
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('create_task', {
      p_board_id: 'board-1',
      p_column_id: 'column-1',
      p_title: 'Nova pendência',
      p_assignee_id: 'user-2',
      p_due_at: '2030-01-01T12:00:00.000Z',
      p_is_private: true,
      p_description: 'Detalhes',
    });
    expect(client.rpc.mock.calls[0][1]).not.toHaveProperty('created_by');
    expect(client.rpc.mock.calls[0][1]).not.toHaveProperty('business_state');
  });

  it('moves a task using only task and target column IDs', async () => {
    client.rpc.mockResolvedValue({ data: null, error: null });
    await TestBed.inject(TasksService).moveToColumn('task-1', 'column-2');
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('move_task_to_column', {
      p_task_id: 'task-1',
      p_target_column_id: 'column-2',
    });
    expect(client.rpc.mock.calls[0][1]).not.toHaveProperty('business_state');
  });

  it.each(['list', 'assignees', 'create'])('hides internal errors from %s', async (operation) => {
    if (operation === 'list') {
      returns.mockResolvedValue({ data: null, error: { message: 'secret' } });
      await expect(TestBed.inject(TasksService).list('board-1')).rejects.toThrow(
        'Não foi possível carregar as pendências.',
      );
    } else if (operation === 'assignees') {
      client.rpc.mockResolvedValue({ data: null, error: { message: 'secret' } });
      await expect(TestBed.inject(TasksService).listAssignees('board-1')).rejects.toThrow(
        'Não foi possível carregar os responsáveis disponíveis.',
      );
    } else {
      client.rpc.mockResolvedValue({ data: null, error: { message: 'secret' } });
      await expect(
        TestBed.inject(TasksService).create({
          boardId: 'board-1',
          columnId: 'column-1',
          title: 'Teste',
          description: null,
          assigneeId: 'user-1',
          dueAt: '2030-01-01T12:00:00Z',
          isPrivate: false,
        }),
      ).rejects.toThrow('Não foi possível criar a pendência.');
    }
  });

  it('does not query without a current session', async () => {
    session.set(null);
    await expect(TestBed.inject(TasksService).list('board-1')).rejects.toThrow('Sessão inválida.');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('discards a response after the authenticated user changes', async () => {
    returns.mockImplementation(async () => {
      session.set({ user: { id: 'user-2' } });
      return { data: [task], error: null };
    });
    await expect(TestBed.inject(TasksService).list('board-1')).rejects.toThrow(
      'Não foi possível carregar as pendências.',
    );
  });

  it('hides history query errors and rejects late results after session changes', async () => {
    client.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'secret' } });
    await expect(TestBed.inject(TasksService).listHistory('hidden')).rejects.toThrow(
      'Não foi possível carregar o histórico',
    );
    client.rpc.mockImplementation(async () => {
      session.set({ user: { id: 'other' } });
      return { data: [{ actor_display_name: 'Previous person' }], error: null };
    });
    await expect(TestBed.inject(TasksService).listHistory('task-1')).rejects.toThrow();
  });
});
