import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { AdminService } from './admin.service';
import { AdminAccessError } from './admin.models';

describe('AdminService', () => {
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'caller' } });
  const access = signal(true);
  const rpc = vi.fn();
  beforeEach(() => {
    session.set({ user: { id: 'caller' } });
    access.set(true);
    rpc.mockReset().mockResolvedValue({ data: [], error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE_CLIENT, useValue: { rpc } },
        {
          provide: AuthService,
          useValue: { session, canAccessAdministration: access, ready: Promise.resolve() },
        },
      ],
    });
  });
  it('uses only the argument-free authorized RPC', async () => {
    const people = [{ id: 'person', department_name: 'Local' }];
    rpc.mockResolvedValue({ data: people, error: null });
    expect(await TestBed.inject(AdminService).listTeamMembers()).toEqual(people);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('list_admin_team_members');
  });
  it.each(['session', 'access'])('rejects missing %s before querying', async (missing) => {
    if (missing === 'session') session.set(null);
    else access.set(false);
    await expect(TestBed.inject(AdminService).listTeamMembers()).rejects.toBeInstanceOf(
      AdminAccessError,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([401, 403])('distinguishes access rejection %s', async (status) => {
    rpc.mockResolvedValue({ data: null, error: {}, status });
    await expect(TestBed.inject(AdminService).listTeamMembers()).rejects.toBeInstanceOf(
      AdminAccessError,
    );
  });
  it('recognizes SQL authorization errors and distinguishes query failure', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(TestBed.inject(AdminService).listTeamMembers()).rejects.toBeInstanceOf(
      AdminAccessError,
    );
    rpc.mockResolvedValue({ data: null, error: { code: '500', message: 'secret' } });
    await expect(TestBed.inject(AdminService).listTeamMembers()).rejects.toThrow(
      'Não foi possível carregar a equipe.',
    );
  });
  it('rejects old responses after session changes', async () => {
    rpc.mockImplementation(async () => {
      session.set({ user: { id: 'other' } });
      return { data: [{ id: 'old' }], error: null };
    });
    await expect(TestBed.inject(AdminService).listTeamMembers()).rejects.toBeInstanceOf(
      AdminAccessError,
    );
  });

  const filters = {
    from: '2026-10-01T00:00:00Z',
    to: '2026-10-03T00:00:00Z',
    actorId: 'actor',
    boardId: 'board',
  };
  it('lists board participants using only the target board ID', async () => {
    await TestBed.inject(AdminService).listBoardMembers('board');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('list_admin_board_members', {
      p_board_id: 'board',
    });
  });
  it.each(['add', 'remove', 'promote'] as const)(
    'sends %s without actor or role claims',
    async (action) => {
      await TestBed.inject(AdminService).changeBoardMember('board', 'target', action);
      expect(rpc).toHaveBeenCalledExactlyOnceWith('manage_admin_board_member', {
        p_board_id: 'board',
        p_user_id: 'target',
        p_action: action,
      });
    },
  );
  it('rejects membership requests without access and SQL denials', async () => {
    access.set(false);
    await expect(TestBed.inject(AdminService).listBoardMembers('board')).rejects.toBeInstanceOf(
      AdminAccessError,
    );
    expect(rpc).not.toHaveBeenCalled();
    access.set(true);
    rpc.mockResolvedValue({ error: { code: '42501' } });
    await expect(
      TestBed.inject(AdminService).changeBoardMember('board', 'target', 'add'),
    ).rejects.toBeInstanceOf(AdminAccessError);
    rpc.mockResolvedValue({ error: { code: '22023', message: 'secret' } });
    await expect(
      TestBed.inject(AdminService).changeBoardMember('board', 'target', 'add'),
    ).rejects.toThrow('Não foi possível concluir');
  });
  it('sends dashboard filters without client authorization claims', async () => {
    rpc.mockResolvedValue({
      data: {
        completed: 0,
        in_progress: 0,
        average_seconds: null,
        duration_samples: 0,
        total_events: 0,
        events: [],
        boards: [],
        people: [],
      },
      error: null,
    });
    expect((await TestBed.inject(AdminService).getActivity(filters)).completed).toBe(0);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_admin_activity', {
      p_from: filters.from,
      p_to: filters.to,
      p_actor_id: 'actor',
      p_board_id: 'board',
    });
  });
  it('distinguishes dashboard authorization failure and query errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(TestBed.inject(AdminService).getActivity(filters)).rejects.toBeInstanceOf(
      AdminAccessError,
    );
    rpc.mockResolvedValue({ data: null, error: { code: '500' } });
    await expect(TestBed.inject(AdminService).getActivity(filters)).rejects.toThrow(
      'Não foi possível carregar as atividades.',
    );
  });
  it('rejects dashboard calls without access and late results after a user change', async () => {
    access.set(false);
    await expect(TestBed.inject(AdminService).getActivity(filters)).rejects.toBeInstanceOf(
      AdminAccessError,
    );
    expect(rpc).not.toHaveBeenCalled();
    access.set(true);
    rpc.mockImplementation(async () => {
      session.set({ user: { id: 'other' } });
      return {
        data: {
          completed: 0,
          in_progress: 0,
          average_seconds: null,
          duration_samples: 0,
          total_events: 0,
          events: [],
          boards: [],
          people: [],
        },
        error: null,
      };
    });
    await expect(TestBed.inject(AdminService).getActivity(filters)).rejects.toBeInstanceOf(
      AdminAccessError,
    );
  });
});
