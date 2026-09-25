import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';

interface OwnProfile {
  id: string;
  display_name: string | null;
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
  readonly displayName = computed(() => this.profile()?.display_name?.trim() || 'Minha conta');
  readonly ready: Promise<void>;

  constructor() {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      // Never await Supabase calls inside its auth callback (the auth lock is held).
      if (event === 'INITIAL_SESSION') return;
      this.setSession(session);
      if (!session) void this.router.navigateByUrl('/login');
    });
    inject(DestroyRef).onDestroy(() => {
      data.subscription.unsubscribe();
      this.revision++;
    });
    this.ready = this.restoreSession();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.ready;
    try {
      const { data, error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session) throw new Error();
      this.setSession(data.session);
    } catch {
      throw new Error('Não foi possível entrar. Confira e-mail e senha e tente novamente.');
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
      if (revision === this.revision) this.setSession(data.session);
    } catch {
      if (revision === this.revision) this.setSession(null);
    }
  }

  private setSession(session: Session | null): void {
    const previousId = this.currentSession()?.user.id;
    this.currentSession.set(session);
    // Refresh events for the same user must not clear a profile already loaded.
    if (session && session.user.id === previousId) return;
    const revision = ++this.revision;
    this.currentProfile.set(null);
    this.profileError.set('');
    if (session) {
      // Defer the query until the synchronous auth callback has returned.
      queueMicrotask(() => void this.loadOwnProfile(session.user.id, revision));
    }
  }

  private async loadOwnProfile(userId: string, revision: number): Promise<void> {
    if (revision !== this.revision) return;
    try {
      const { data, error } = await this.client.from('profiles')
        .select('id, display_name').eq('id', userId).maybeSingle<OwnProfile>();
      if (error || !data || data.id !== userId) throw new Error();
      if (revision === this.revision) this.currentProfile.set(data);
    } catch {
      if (revision === this.revision) {
        this.profileError.set('Não foi possível carregar seu perfil.');
      }
    }
  }
}
