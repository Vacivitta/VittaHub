import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { minuteClock } from '../../shared/minute-clock';
import { ATTENTION_FILTERS, matchesAttention } from './task-attention';
import { PageHeading } from '../../shared/page-heading';
import { BUSINESS_STATE_LABELS } from '../boards/board-detail';
import { TaskWithContext } from './task-detail';
import { TasksService } from './tasks.service';
import { Icon } from '../../shared/icon';

@Component({
  imports: [PageHeading, RouterLink, DatePipe, Icon],
  template: `
    <app-page-heading
      title="Minhas Pendências"
      description="Acompanhe as pendências atribuídas a você, organizadas por prazo."
    />
    <nav class="attention-filters" aria-label="Filtrar pendências">
      <a
        class="button secondary"
        routerLink="/minhas-pendencias"
        [attr.aria-current]="!activeFilter() ? 'page' : null"
        >Todas abertas</a
      >
      @for (filter of filters; track filter.id) {
        <a
          class="button secondary"
          routerLink="/minhas-pendencias"
          [queryParams]="{ filtro: filter.id }"
          [attr.aria-current]="activeFilter() === filter.id ? 'page' : null"
          >{{ filter.label }}</a
        >
      }
      <a class="button secondary" routerLink="/minhas-pendencias"
        [queryParams]="{ filtro: 'concluidas' }"
        [attr.aria-current]="activeFilter() === 'concluidas' ? 'page' : null">Concluídas</a>
    </nav>
    @if (loading()) {
      <div class="panel empty" role="status">Carregando suas pendências…</div>
    } @else if (error()) {
      <section class="panel empty">
        <h2>Não foi possível carregar suas pendências</h2>
        <p role="alert">{{ error() }}</p>
        <button type="button" (click)="load()">Tentar novamente</button>
      </section>
    } @else if (filteredTasks().length) {
      <p class="small muted" aria-live="polite">{{ filteredTasks().length }} pendências {{ activeFilter() === 'concluidas' ? 'concluídas' : 'abertas' }}</p>
      <div class="tasks-grid">
        @for (task of filteredTasks(); track task.id) {
          <a
            class="task-card-link"
            [routerLink]="['/pendencias', task.id]" [state]="{ taskOrigin: 'tasks' }"
            [attr.aria-label]="'Abrir pendência ' + task.title"
          >
            <article class="task-card">
              <div class="row">
                <span
                  class="badge"
                  [class.private]="task.is_private"
                  [class.shared]="!task.is_private"
                >
                  <app-icon [name]="task.is_private ? 'lock' : 'users'" />{{
                    task.is_private ? 'Privada' : 'Compartilhada'
                  }}
                </span>
                <span class="badge" [attr.data-state]="task.business_state">{{
                  labels[task.business_state]
                }}</span>
              </div>
              <h2>{{ task.title }}</h2>
              <p class="small muted">
                {{ task.board?.title || 'Quadro indisponível' }}
                @if (task.column?.title) {
                  · {{ task.column?.title }}
                }
              </p>
              <div class="task-footer">
                <span>Prazo</span>
                <span [class.overdue]="isOverdue(task)"
                  ><app-icon name="calendar" /> {{ isOverdue(task) ? 'Vencido · ' : ''
                  }}{{ task.due_at | date: 'dd/MM/yyyy HH:mm' }}
                </span>
              </div>
            </article>
          </a>
        }
      </div>
    } @else {
      <section class="panel empty" role="status">
        <h2>
          {{ activeFilter() ? 'Nenhuma pendência neste filtro' : 'Nenhuma pendência aberta' }}
        </h2>
        <p>
          {{
            activeFilter()
              ? 'Escolha outro filtro ou veja todas as pendências abertas.'
              : 'Você não possui pendências abertas atribuídas no momento.'
          }}
        </p>
      </section>
    }
  `,
  styles: `
    .attention-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }
    .attention-filters [aria-current='page'] {
      background: var(--brand-primary-soft);
      border-color: var(--brand-primary);
      box-shadow: inset 0 -2px var(--brand-primary);
    }
  `,
})
export class Tasks {
  private readonly service = inject(TasksService);
  readonly tasks = signal<TaskWithContext[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly labels = { ...BUSINESS_STATE_LABELS, concluido: 'Concluída' };
  readonly filters = ATTENTION_FILTERS;
  readonly now = minuteClock();
  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap);
  readonly activeFilter = computed(() => {
    const value = this.params()?.get('filtro');
    if (value === 'concluidas') return 'concluidas';
    return this.filters.find((filter) => filter.id === value)?.id ?? null;
  });
  readonly filteredTasks = computed(() =>
    this.tasks().filter((task) => this.activeFilter() === 'concluidas'
      ? task.business_state === 'concluido'
      : matchesAttention(task, this.activeFilter(), this.now())),
  );

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.tasks.set(await this.service.listMine(true));
    } catch {
      this.error.set('Tente novamente em instantes.');
    } finally {
      this.loading.set(false);
    }
  }

  isOverdue(task: TaskWithContext): boolean {
    return matchesAttention(task, 'vencidas', this.now());
  }
}
