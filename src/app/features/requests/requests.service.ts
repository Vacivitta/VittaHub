import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { TaskChanges } from '../tasks/task-changes';
import { RequestItem } from './request-item';

@Injectable({ providedIn: 'root' })
export class RequestsService {
  private readonly auth = inject(AuthService);
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly changes = inject(TaskChanges);
  private readonly stored = signal<{ userId: string; items: RequestItem[] } | null>(null);
  private revision = 0;
  readonly loading = signal(false);
  readonly error = signal('');
  readonly activeUserId = computed(() => {
    const id = this.auth.session()?.user.id;
    const profile = this.auth.profile();
    return id && profile?.id === id && profile.is_active ? id : null;
  });
  readonly items = computed(() =>
    this.stored()?.userId === this.activeUserId() ? (this.stored()?.items ?? []) : [],
  );
  readonly decisions = computed(() => this.items().filter((item) => item.area === 'decide'));
  readonly waiting = computed(() => this.items().filter((item) => item.area === 'waiting'));
  readonly count = computed(() => this.decisions().length);
  readonly highlighted = computed(() => this.decisions()[0]?.item_key ?? null);

  constructor() {
    effect(() => {
      this.activeUserId();
      this.changes.revision();
      untracked(() => void this.refresh());
    });
  }

  async refresh(): Promise<void> {
    const revision = ++this.revision;
    const userId = this.activeUserId();
    this.error.set('');
    if (!userId) {
      this.stored.set(null);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    try {
      const { data, error } = await this.client.rpc('list_my_requests');
      if (revision !== this.revision || this.activeUserId() !== userId) return;
      if (error) throw new Error();
      this.stored.set({ userId, items: (data ?? []) as RequestItem[] });
    } catch {
      if (revision === this.revision && this.activeUserId() === userId) {
        this.stored.set(null);
        this.error.set('Não foi possível carregar as solicitações. Tente novamente.');
      }
    } finally {
      if (revision === this.revision) this.loading.set(false);
    }
  }

  resolved(itemKey: string): void {
    // Remove immediately after a successful RPC; refresh also adds any resulting item.
    this.stored.update((current) =>
      current
        ? { ...current, items: current.items.filter((item) => item.item_key !== itemKey) }
        : null,
    );
    void this.refresh();
  }
}
