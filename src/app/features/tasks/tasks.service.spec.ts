import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'user-1' } });
  const auth = { session, ready: Promise.resolve() };
  const returns = vi.fn();
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), returns };
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
    query.order.mockReset().mockReturnValue(query);
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
