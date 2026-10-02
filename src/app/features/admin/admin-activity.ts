import { Component, DestroyRef, effect, inject, OnInit, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AdminService } from './admin.service';
import { AdminAccessError, AdminActivityDashboard } from './admin.models';

@Component({
  selector: 'app-admin-activity',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './admin-activity.html',
  styleUrl: './admin-activity.scss',
})
export class AdminActivity implements OnInit {
  private readonly service = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly initialUser = this.auth.session()?.user.id;
  private revision = 0;
  private filterTimer: ReturnType<typeof setTimeout> | undefined;
  readonly accessDenied = output<void>();
  readonly data = signal<AdminActivityDashboard | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly updatedAt = signal<Date | null>(null);
  readonly boards = signal<AdminActivityDashboard['boards']>([]);
  readonly people = signal<AdminActivityDashboard['people']>([]);
  from = this.localDate(-29);
  to = this.localDate(0);
  actorId = '';
  boardId = '';
  readonly labels: Record<string, string> = {
    accepted: 'Aceite',
    started: 'Início',
    column_moved: 'Movimentação',
    waiting_third_party: 'Espera por terceiro',
    resumed: 'Retomada',
    completed: 'Conclusão',
  };

  constructor() {
    this.destroyRef.onDestroy(() => this.cancelFilterTimer());
    effect(() => {
      if (
        !this.auth.canAccessAdministration() ||
        this.auth.session()?.user.id !== this.initialUser
      ) {
        this.clearAccess();
      }
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  private localDate(offset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private clearAccess(): void {
    this.cancelFilterTimer();
    this.revision++;
    this.data.set(null);
    this.boards.set([]);
    this.people.set([]);
    this.accessDenied.emit();
  }

  async load(): Promise<void> {
    this.cancelFilterTimer();
    if (!this.auth.canAccessAdministration() || this.auth.session()?.user.id !== this.initialUser)
      return;
    const revision = ++this.revision;
    const current = () =>
      !this.destroyRef.destroyed &&
      revision === this.revision &&
      this.auth.session()?.user.id === this.initialUser &&
      this.auth.canAccessAdministration();
    this.data.set(null);
    this.error.set('');
    const from = new Date(`${this.from}T00:00:00`);
    const to = new Date(`${this.to}T00:00:00`);
    if (!this.from || !this.to || !Number.isFinite(+from) || !Number.isFinite(+to) || from > to) {
      this.loading.set(false);
      this.error.set('Informe um período válido, com a data inicial antes da final.');
      return;
    }
    to.setDate(to.getDate() + 1);
    this.loading.set(true);
    try {
      const data = await this.service.getActivity({
        from: from.toISOString(),
        to: to.toISOString(),
        actorId: this.actorId || null,
        boardId: this.boardId || null,
      });
      if (current()) {
        this.data.set(data);
        this.boards.set(data.boards);
        this.people.set(data.people);
        this.updatedAt.set(new Date());
      }
    } catch (error) {
      if (current()) {
        this.boards.set([]);
        this.people.set([]);
        if (error instanceof AdminAccessError) this.clearAccess();
        else this.error.set('Não foi possível carregar as atividades. Tente novamente.');
      }
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  duration(seconds: number | null): string {
    if (seconds === null) return 'Não disponível';
    if (seconds < 60) return 'Menos de 1 min';
    const minutes = Math.floor(seconds / 60);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return `${days ? days + ' d ' : ''}${hours ? hours + ' h ' : ''}${minutes % 60} min`;
  }

  filtersChanged(): void {
    // Invalidate immediately, including responses arriving during the debounce window.
    this.revision++;
    this.cancelFilterTimer();
    this.data.set(null);
    this.error.set('');
    this.loading.set(true);
    this.filterTimer = setTimeout(() => void this.load(), 250);
  }

  private cancelFilterTimer(): void {
    clearTimeout(this.filterTimer);
    this.filterTimer = undefined;
  }

  clearFilters(): void {
    this.actorId = '';
    this.boardId = '';
    this.from = this.localDate(-29);
    this.to = this.localDate(0);
    // load cancels pending debounce and invalidates any older request.
    void this.load();
  }
}
