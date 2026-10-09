import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';
import { AuthService } from './auth.service';
const session = { user: { id: 'test-user' }, access_token: 'token' } as Session;
describe('AuthService authorization', () => {
  let listener: (event: AuthChangeEvent, value: Session | null) => void;
  const navigate = vi.fn().mockResolvedValue(true);
  let client: ReturnType<typeof mockClient>;
  function mockClient() {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({
          data: { id: 'test-user', display_name: 'Conta', role: 'membro', is_active: true },
          error: null,
        }),
    };
    return {
      query,
      from: vi.fn().mockReturnValue(query),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      removeAllChannels: vi.fn().mockResolvedValue([]),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { session }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn().mockImplementation((cb) => {
          listener = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
    };
  }
  beforeEach(() => {
    client = mockClient();
    navigate.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE_CLIENT, useValue: client },
        { provide: Router, useValue: { navigateByUrl: navigate } },
      ],
    });
  });
  afterEach(() => vi.useRealTimers());
  async function auth() {
    const a = TestBed.inject(AuthService);
    await a.ready;
    return a;
  }
  it('validates login before allowing access and loads own profile', async () => {
    const a = await auth();
    await a.signIn(' test@example.invalid ', 'pw');
    expect(client.rpc).toHaveBeenCalledWith('employee_access_status');
    expect(a.profile()?.is_active).toBe(true);
    expect(client.query.eq).toHaveBeenCalledWith('id', 'test-user');
    expect(a.session()).toBe(session);
  });
  it('does not resolve restoration until authorization is verified', async () => {
    client.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    let complete!: (v: unknown) => void;
    client.rpc.mockImplementation(() => new Promise((r) => (complete = r)));
    const a = TestBed.inject(AuthService);
    let ready = false;
    void a.ready.then(() => (ready = true));
    await vi.waitFor(() => expect(complete).toBeDefined());
    expect(ready).toBe(false);
    complete({ data: true, error: null });
    await a.ready;
    expect(a.profile()?.is_active).toBe(true);
  });
  it('blocks old JWT after reactivation when the server rejects the session', async () => {
    const a = await auth();
    client.rpc.mockResolvedValue({ data: false, error: null });
    await expect(a.signIn('a@b.invalid', 'pw')).rejects.toThrow('Acesso bloqueado');
    expect(a.session()).toBeNull();
    expect(a.profile()).toBeNull();
    expect(client.removeAllChannels).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
  it('revalidates same-user refresh and clears data on deactivation', async () => {
    const a = await auth();
    await a.signIn('a@b.invalid', 'pw');
    client.rpc.mockResolvedValue({ data: false, error: null });
    listener('TOKEN_REFRESHED', { ...session, access_token: 'new' });
    await vi.waitFor(() => expect(a.session()).toBeNull());
    expect(a.profile()).toBeNull();
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('distinguishes a network failure and fails closed', async () => {
    const a = await auth();
    await a.signIn('a@b.invalid', 'pw');
    client.rpc.mockRejectedValue(new Error('private detail'));
    expect(await a.validateAccess()).toBe(false);
    expect(a.accessMessage()).toContain('conexão');
    expect(a.session()).toBeNull();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });
  it('checks periodically and on visibility restoration', async () => {
    vi.useFakeTimers();
    const a = await auth();
    await a.signIn('a@b.invalid', 'pw');
    client.rpc.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(client.rpc).toHaveBeenCalledTimes(2);
  });
  it('discards profile results after logout', async () => {
    const a = await auth();
    await a.signIn('a@b.invalid', 'pw');
    let complete!: (v: unknown) => void;
    client.query.maybeSingle.mockImplementation(() => new Promise((r) => (complete = r)));
    const validation = a.validateAccess();
    await vi.waitFor(() => expect(complete).toBeDefined());
    await a.signOut();
    complete({ data: { id: 'test-user', is_active: true }, error: null });
    await validation;
    expect(a.profile()).toBeNull();
    expect(a.session()).toBeNull();
  });
  it('does not expose credential errors', async () => {
    const a = await auth();
    client.auth.signInWithPassword.mockRejectedValue(new Error('secret'));
    await expect(a.signIn('a@b.invalid', 'wrong')).rejects.toThrow('Não foi possível entrar.');
    expect(a.session()).toBeNull();
  });
  it('handles cross-tab logout', async () => {
    const a = await auth();
    await a.signIn('a@b.invalid', 'pw');
    listener('SIGNED_OUT', null);
    await vi.waitFor(() => expect(a.session()).toBeNull());
    expect(a.profile()).toBeNull();
  });
});
