import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';

interface OwnProfile {
  id: string;
  display_name: string | null;
  role: 'membro' | 'gestor' | 'administrador';
  is_active: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly router = inject(Router);
  private readonly currentSession = signal<Session | null>(null);
  private readonly currentProfile = signal<OwnProfile | null>(null);
  private revision = 0;
  readonly session = this.currentSession.asReadonly();
  readonly profile = this.currentProfile.asReadonly();
  readonly profileError = signal('');
  readonly accessMessage = signal('');
  private validation: Promise<boolean> | null = null;
  readonly canAccessAdministration = computed(() => {
    const profile = this.profile();
    return (
      !!this.session() &&
      profile?.id === this.session()?.user.id &&
      profile?.is_active === true &&
      (profile.role === 'gestor' || profile.role === 'administrador')
    );
  });
  readonly displayName = computed(() => this.profile()?.display_name?.trim() || 'Minha conta');
  readonly ready: Promise<void>;

  constructor() {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      // Never await Supabase calls inside its auth callback (the auth lock is held).
      if (event === 'INITIAL_SESSION') return;
      queueMicrotask(() => {
        this.setSession(session);
        if (session) void this.validateAccess();
      });
      if (!session) void this.router.navigateByUrl('/login');
    });
    inject(DestroyRef).onDestroy(() => {
      data.subscription.unsubscribe();
      this.revision++;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    });
    const visible = () => {
      if (document.visibilityState === 'visible') void this.recheck();
    };
    const timer = setInterval(() => void this.recheck(), 60_000);
    document.addEventListener('visibilitychange', visible);
    this.ready = this.restoreSession();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.ready;
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.session) throw new Error();
      this.setSession(data.session);
      if (!(await this.validateAccess())) throw new Error();
    } catch {
      throw new Error(
        this.accessMessage() ||
          'Não foi possível entrar. Confira e-mail e senha e tente novamente.',
      );
    }
  }

  async signOut(): Promise<void> {
    await this.ready;
    try {
      const { error } = await this.client.auth.signOut({ scope: 'local' });
      if (error) throw new Error();
    } catch {
      throw new Error('Não foi possível sair. Tente novamente.');
    }
    this.setSession(null);
    await this.router.navigateByUrl('/login');
  }

  private async restoreSession(): Promise<void> {
    const revision = this.revision;
    try {
      const { data, error } = await this.client.auth.getSession();
      if (error) throw new Error();
      if (revision === this.revision) {
        this.setSession(data.session);
        if (data.session) await this.validateAccess();
      }
    } catch {
      if (revision === this.revision) this.setSession(null);
    }
  }

  private setSession(session: Session | null): void {
    const previousId = this.currentSession()?.user.id;
    this.currentSession.set(session);
    // Refresh events for the same user must not clear a profile already loaded.
    if (session && session.user.id === previousId) return;
    ++this.revision;
    this.validation = null;
    this.currentProfile.set(null);
    this.profileError.set('');
  }

  private async recheck(): Promise<void> {
    if (this.session()) await this.validateAccess();
  }

  async validateAccess(): Promise<boolean> {
    if (this.validation) return this.validation;
    const session = this.session();
    if (!session) return false;
    const revision = this.revision;
    const pending = (async () => {
      try {
        const { data, error } = await this.client.rpc('employee_access_status');
        if (revision !== this.revision || this.session()?.user.id !== session.user.id) return false;
        if (error) throw new Error();
        if (data !== true) {
          this.accessMessage.set('Acesso bloqueado. Após a reativação, entre novamente.');
          await this.blockAccess(true);
          return false;
        }
        await this.loadOwnProfile(session.user.id, revision);
        if (revision !== this.revision) return false;
        if (!this.profile()?.is_active || this.profileError()) throw new Error();
        this.accessMessage.set('');
        return true;
      } catch {
        if (revision === this.revision) {
          this.accessMessage.set(
            'Não foi possível verificar seu acesso. Confira a conexão e entre novamente.',
          );
          await this.blockAccess(false);
        }
        return false;
      }
    })();
    this.validation = pending;
    try {
      return await pending;
    } finally {
      if (this.validation === pending) this.validation = null;
    }
  }

  private async blockAccess(administrative: boolean): Promise<void> {
    this.setSession(null);
    // Clear application state before any network-dependent cleanup.
    const cleanup = this.client.removeAllChannels().catch(() => undefined);
    void this.router.navigateByUrl('/login');
    if (administrative) void this.client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await cleanup;
  }

  private async loadOwnProfile(userId: string, revision: number): Promise<void> {
    if (revision !== this.revision) return;
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('id, display_name, role, is_active')
        .eq('id', userId)
        .maybeSingle<OwnProfile>();
      if (error || !data || data.id !== userId) throw new Error();
      if (revision === this.revision) this.currentProfile.set(data);
    } catch {
      if (revision === this.revision) {
        this.profileError.set('Não foi possível carregar seu perfil.');
      }
    }
  }
}
