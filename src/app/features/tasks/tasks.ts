import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
    @if (loading()) {
      <div class="panel empty" role="status">Carregando suas pendências…</div>
    } @else if (error()) {
      <section class="panel empty">
        <h2>Não foi possível carregar suas pendências</h2>
        <p role="alert">{{ error() }}</p>
        <button type="button" (click)="load()">Tentar novamente</button>
      </section>
    } @else if (tasks().length) {
      <p class="small muted" aria-live="polite">{{ tasks().length }} pendências abertas</p>
      <div class="tasks-grid">
        @for (task of tasks(); track task.id) {
          <a
            class="task-card-link"
            [routerLink]="['/pendencias', task.id]"
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
                <span>{{
                  task.business_state === 'aguardando_aceite' ? 'Prazo após aceite' : 'Prazo'
                }}</span>
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
        <h2>Nenhuma pendência aberta</h2>
        <p>Você não possui pendências abertas atribuídas no momento.</p>
      </section>
    }
  `,
})
export class Tasks {
  private readonly service = inject(TasksService);
  readonly tasks = signal<TaskWithContext[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly labels = BUSINESS_STATE_LABELS;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.tasks.set(await this.service.listMine());
    } catch {
      this.error.set('Tente novamente em instantes.');
    } finally {
      this.loading.set(false);
    }
  }

  isOverdue(task: TaskWithContext): boolean {
    return (
      task.business_state !== 'aguardando_aceite' &&
      task.business_state !== 'concluido' &&
      new Date(task.due_at).getTime() < Date.now()
    );
  }
}
