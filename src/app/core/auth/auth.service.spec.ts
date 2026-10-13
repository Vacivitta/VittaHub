import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthApiError, AuthChangeEvent, AuthRetryableFetchError, Session } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';
import { AuthService, LOGIN_MESSAGES } from './auth.service';
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
    await expect(a.signIn('a@b.invalid', 'pw')).rejects.toThrow(LOGIN_MESSAGES.unauthorized);
    expect(a.accessMessage()).not.toMatch(/bloquead|inativa|reativação/);
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
  it.each([
    [new AuthApiError('private detail', 400, 'invalid_credentials'), LOGIN_MESSAGES.credentials],
    [new AuthApiError('private detail', 403, 'user_banned'), LOGIN_MESSAGES.inactive],
    [new AuthApiError('private detail', 400, 'email_not_confirmed'), LOGIN_MESSAGES.unauthorized],
    [new AuthApiError('private detail', 503, 'unexpected_failure'), LOGIN_MESSAGES.unavailable],
    [new AuthRetryableFetchError('private detail', 0), LOGIN_MESSAGES.unavailable],
    [new TypeError('private detail'), LOGIN_MESSAGES.unavailable],
    [new Error('private detail'), LOGIN_MESSAGES.generic],
  ])('maps authentication errors to safe guidance: %s', async (error, message) => {
    const a = await auth();
    client.auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error });
    await expect(a.signIn('a@b.invalid', 'pw')).rejects.toThrow(message);
    expect(a.accessMessage()).toBe(message);
    expect(a.accessMessage()).not.toContain('private detail');
    expect(a.session()).toBeNull();
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it('does not reuse a previous denial for a new invalid-credentials attempt and clears it on success', async () => {
    const a = await auth();
    client.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(a.signIn('a@b.invalid', 'pw')).rejects.toThrow(LOGIN_MESSAGES.unauthorized);
    client.auth.signInWithPassword.mockRejectedValueOnce(new AuthApiError('private detail', 400, 'invalid_credentials'));
    await expect(a.signIn('another@b.invalid', 'wrong')).rejects.toThrow(LOGIN_MESSAGES.credentials);
    expect(a.accessMessage()).toBe(LOGIN_MESSAGES.credentials);
    await a.signIn('a@b.invalid', 'pw');
    expect(a.accessMessage()).toBe('');
    expect(a.session()).toBe(session);
  });
  it.each([
    [null, null, LOGIN_MESSAGES.unauthorized],
    [{ id: 'test-user', is_active: false }, null, LOGIN_MESSAGES.inactive],
    [null, { message: 'private detail' }, LOGIN_MESSAGES.verification],
  ])('distinguishes missing profile, confirmed inactivity and profile request errors', async (data, error, message) => {
    const a = await auth();
    client.query.maybeSingle.mockResolvedValue({ data, error });
    await expect(a.signIn('a@b.invalid', 'pw')).rejects.toThrow(message);
    expect(a.accessMessage()).toBe(message);
    expect(a.session()).toBeNull();
    expect(a.profile()).toBeNull();
    expect(client.removeAllChannels).toHaveBeenCalled();
    // Preserve the existing cleanup policy for a failed profile verification.
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });
  it('handles cross-tab logout', async () => {
    const a = await auth();
    await a.signIn('a@b.invalid', 'pw');
    listener('SIGNED_OUT', null);
    await vi.waitFor(() => expect(a.session()).toBeNull());
    expect(a.profile()).toBeNull();
  });
});
