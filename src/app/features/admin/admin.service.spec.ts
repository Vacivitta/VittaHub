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
});
