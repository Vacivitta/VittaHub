import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';
import { AuthService } from './auth.service';

const session = { user: { id: 'test-user' }, access_token: 'test-token' } as Session;

describe('AuthService', () => {
  let auth: AuthService;
  let listener: (event: AuthChangeEvent, session: Session | null) => void;
  let client: ReturnType<typeof mockClient>;
  const navigateByUrl = vi.fn().mockResolvedValue(true);

  function mockClient() {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'test-user', display_name: 'Conta Local' }, error: null }),
    };
    const unsubscribe = vi.fn();
    return {
      query,
      unsubscribe,
      from: vi.fn().mockReturnValue(query),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { session }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn().mockImplementation((callback) => {
          listener = callback;
          return { data: { subscription: { unsubscribe } } };
        }),
      },
    };
  }

  beforeEach(() => {
    navigateByUrl.mockClear();
    client = mockClient();
    TestBed.configureTestingModule({ providers: [
      { provide: SUPABASE_CLIENT, useValue: client },
      { provide: Router, useValue: { navigateByUrl } },
    ] });
  });

  async function initialize() {
    auth = TestBed.inject(AuthService);
    await auth.ready;
  }

  it('signs in and reads only the authenticated user profile', async () => {
    await initialize();
    await auth.signIn(' local@example.invalid ', 'test-password');
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'local@example.invalid', password: 'test-password' });
    expect(auth.session()).toBe(session);
    await vi.waitFor(() => expect(auth.displayName()).toBe('Conta Local'));
    expect(client.from).toHaveBeenCalledExactlyOnceWith('profiles');
    expect(client.query.select).toHaveBeenCalledWith('id, display_name');
    expect(client.query.eq).toHaveBeenCalledWith('id', 'test-user');
  });

  it('restores the stored session before becoming ready', async () => {
    client.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    await initialize();
    expect(auth.session()).toBe(session);
    await vi.waitFor(() => expect(auth.displayName()).toBe('Conta Local'));
  });

  it('fails closed when session restoration fails', async () => {
    client.auth.getSession.mockRejectedValue(new Error('internal detail'));
    await initialize();
    expect(auth.session()).toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each(['credentials', 'network', 'missing-session'])('handles %s login failure safely', async (failure) => {
    await initialize();
    if (failure === 'network') client.auth.signInWithPassword.mockRejectedValue(new Error('internal detail'));
    else client.auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: failure === 'credentials' ? { message: 'internal detail' } : null });
    await expect(auth.signIn('local@example.invalid', 'wrong')).rejects.toThrow('Não foi possível entrar.');
    expect(auth.session()).toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('clears the session and profile on logout and redirects to login', async () => {
    await initialize();
    await auth.signIn('local@example.invalid', 'test-password');
    await vi.waitFor(() => expect(auth.profile()).not.toBeNull());
    await auth.signOut();
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(auth.session()).toBeNull();
    expect(auth.profile()).toBeNull();
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('reports logout failure without claiming the session ended', async () => {
    await initialize();
    await auth.signIn('local@example.invalid', 'test-password');
    client.auth.signOut.mockResolvedValue({ error: { message: 'internal detail' } });
    await expect(auth.signOut()).rejects.toThrow('Não foi possível sair.');
    expect(auth.session()).toBe(session);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('reacts to session refresh and signout from another tab', async () => {
    await initialize();
    listener('SIGNED_IN', session);
    await vi.waitFor(() => expect(auth.displayName()).toBe('Conta Local'));
    const refreshed = { ...session, access_token: 'refreshed' };
    listener('TOKEN_REFRESHED', refreshed);
    expect(auth.session()).toBe(refreshed);
    expect(client.from).toHaveBeenCalledTimes(1);
    listener('SIGNED_OUT', null);
    expect(auth.session()).toBeNull();
    expect(auth.profile()).toBeNull();
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('discards a profile response that arrives after logout', async () => {
    let resolve!: (value: unknown) => void;
    client.query.maybeSingle.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await initialize();
    await auth.signIn('local@example.invalid', 'test-password');
    await vi.waitFor(() => expect(resolve).toBeDefined());
    await auth.signOut();
    resolve({ data: { id: 'test-user', display_name: 'Old profile' }, error: null });
    await Promise.resolve();
    expect(auth.profile()).toBeNull();
  });

  it('handles profile errors without exposing server details', async () => {
    client.query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'internal detail' } });
    await initialize();
    await auth.signIn('local@example.invalid', 'test-password');
    await vi.waitFor(() => expect(auth.profileError()).toBe('Não foi possível carregar seu perfil.'));
    expect(auth.displayName()).toBe('Minha conta');
    expect(auth.session()).toBe(session);
  });

  it('unsubscribes from auth events on destruction', async () => {
    await initialize();
    TestBed.resetTestingModule();
    expect(client.unsubscribe).toHaveBeenCalledOnce();
  });
});
