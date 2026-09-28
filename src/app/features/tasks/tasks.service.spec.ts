import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'user-1' } });
  const auth = { session, ready: Promise.resolve() };
  const returns = vi.fn();
  const query = { select: vi.fn(), eq: vi.fn(), neq: vi.fn(), order: vi.fn(), maybeSingle: vi.fn(), returns };
  const client = { from: vi.fn(), rpc: vi.fn() };
  const task = {
    id: 'task-1', board_id: 'board-1', column_id: 'column-1', title: 'Pendência real',
    description: null, created_by: 'user-1', assignee_id: 'user-2', due_at: '2030-01-01T12:00:00Z',
    business_state: 'aguardando_aceite', is_private: false, created_at: '2026-09-28T12:00:00Z',
  };

  beforeEach(() => {
    session.set({ user: { id: 'user-1' } });
    auth.ready = Promise.resolve();
    client.from.mockReset().mockReturnValue(query);
    client.rpc.mockReset();
    query.select.mockReset().mockReturnValue(query);
    query.eq.mockReset().mockReturnValue(query);
    query.neq.mockReset().mockReturnValue(query);
    query.order.mockReset().mockReturnValue(query);
    query.maybeSingle.mockReset();
    returns.mockReset().mockResolvedValue({ data: [task], error: null });
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: auth },
      { provide: SUPABASE_CLIENT, useValue: client },
    ] });
  });

  it('loads real tasks for one board under RLS', async () => {
    expect(await TestBed.inject(TasksService).list('board-1')).toEqual([task]);
    expect(client.from).toHaveBeenCalledExactlyOnceWith('tasks');
    expect(query.eq).toHaveBeenCalledExactlyOnceWith('board_id', 'board-1');
    expect(query.order).toHaveBeenCalledExactlyOnceWith('created_at', { ascending: true });
  });

  it('loads only the bounded assignee RPC result', async () => {
    const people = [{ id: 'user-1', display_name: 'Pessoa Um' }];
    client.rpc.mockResolvedValue({ data: people, error: null });
    expect(await TestBed.inject(TasksService).listAssignees('board-1')).toEqual(people);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('list_board_assignees', { p_board_id: 'board-1' });
  });

  it('loads only open tasks assigned to the authenticated user in stable due-date order', async () => {
    const mine = [{ ...task, assignee_id: 'user-1', board: { id: 'board-1', title: 'Quadro' }, column: null }];
    returns.mockResolvedValue({ data: mine, error: null });
    expect(await TestBed.inject(TasksService).listMine()).toEqual(mine);
    expect(query.eq).toHaveBeenCalledExactlyOnceWith('assignee_id', 'user-1');
    expect(query.neq).toHaveBeenCalledExactlyOnceWith('business_state', 'concluido');
    expect(query.order.mock.calls).toEqual([
      ['due_at', { ascending: true }], ['id', { ascending: true }],
    ]);
  });

  it('loads one visible task by ID and keeps an absent task indistinguishable', async () => {
    const detailed = { ...task, board: { id: 'board-1', title: 'Quadro' }, column: { id: 'column-1', title: 'Entrada' } };
    query.maybeSingle.mockResolvedValueOnce({ data: detailed, error: null, status: 200 });
    expect(await TestBed.inject(TasksService).getById('11111111-1111-4111-8111-111111111111')).toEqual({ status: 'loaded', task: detailed });
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null, status: 200 });
    expect(await TestBed.inject(TasksService).getById('22222222-2222-4222-8222-222222222222')).toEqual({ status: 'unavailable' });
  });

  it('does not query malformed task IDs', async () => {
    expect(await TestBed.inject(TasksService).getById('inexistente')).toEqual({ status: 'unavailable' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('creates through the controlled RPC without creator or state fields', async () => {
    client.rpc.mockResolvedValue({ data: 'task-new', error: null });
    const input = {
      boardId: 'board-1', columnId: 'column-1', title: ' Nova pendência ', description: ' Detalhes ',
      assigneeId: 'user-2', dueAt: '2030-01-01T12:00:00.000Z', isPrivate: true,
    };
    expect(await TestBed.inject(TasksService).create(input)).toBe('task-new');
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('create_task', {
      p_board_id: 'board-1', p_column_id: 'column-1', p_title: 'Nova pendência',
      p_assignee_id: 'user-2', p_due_at: '2030-01-01T12:00:00.000Z', p_is_private: true,
      p_description: 'Detalhes',
    });
    expect(client.rpc.mock.calls[0][1]).not.toHaveProperty('created_by');
    expect(client.rpc.mock.calls[0][1]).not.toHaveProperty('business_state');
  });

  it.each(['list', 'assignees', 'create'])('hides internal errors from %s', async (operation) => {
    if (operation === 'list') {
      returns.mockResolvedValue({ data: null, error: { message: 'secret' } });
      await expect(TestBed.inject(TasksService).list('board-1')).rejects.toThrow('Não foi possível carregar as pendências.');
    } else if (operation === 'assignees') {
      client.rpc.mockResolvedValue({ data: null, error: { message: 'secret' } });
      await expect(TestBed.inject(TasksService).listAssignees('board-1')).rejects.toThrow('Não foi possível carregar os responsáveis disponíveis.');
    } else {
      client.rpc.mockResolvedValue({ data: null, error: { message: 'secret' } });
      await expect(TestBed.inject(TasksService).create({
        boardId: 'board-1', columnId: 'column-1', title: 'Teste', description: null,
        assigneeId: 'user-1', dueAt: '2030-01-01T12:00:00Z', isPrivate: false,
      })).rejects.toThrow('Não foi possível criar a pendência.');
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
    await expect(TestBed.inject(TasksService).list('board-1')).rejects.toThrow('Não foi possível carregar as pendências.');
  });
});
