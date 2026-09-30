import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { minuteClock } from '../../shared/minute-clock';
import { TasksService } from '../tasks/tasks.service';
import { TaskWithContext } from '../tasks/task-detail';
import {
  ATTENTION_FILTERS,
  deadlineText,
  matchesAttention,
  priorityRank,
} from '../tasks/task-attention';
import { BUSINESS_STATE_LABELS } from '../boards/board-detail';
import { PageHeading } from '../../shared/page-heading';
import { Icon } from '../../shared/icon';
@Component({
  imports: [RouterLink, PageHeading, Icon],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  readonly auth = inject(AuthService);
  private readonly service = inject(TasksService);
  readonly now = minuteClock();
  readonly tasks = signal<TaskWithContext[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly labels = BUSINESS_STATE_LABELS;
  readonly date = computed(() =>
    new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(this.now()),
  );
  readonly time = computed(() =>
    new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(this.now()),
  );
  readonly stats = computed(() =>
    ATTENTION_FILTERS.map((filter) => ({
      ...filter,
      value: this.tasks().filter((task) => matchesAttention(task, filter.id, this.now())).length,
    })),
  );
  readonly priorities = computed(() =>
    this.tasks()
      .filter((task) => Number.isFinite(priorityRank(task, this.now())))
      .sort(
        (a, b) =>
          priorityRank(a, this.now()) - priorityRank(b, this.now()) ||
          Date.parse(a.due_at) - Date.parse(b.due_at) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 5),
  );

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.tasks.set(await this.service.listMine());
    } catch {
      this.error.set('Não foi possível carregar suas pendências. Tente novamente.');
    } finally {
      this.loading.set(false);
    }
  }

  deadline(task: TaskWithContext): string {
    return deadlineText(task, this.now());
  }
  overdue(task: TaskWithContext): boolean {
    return matchesAttention(task, 'vencidas', this.now());
  }
  absoluteDeadline(task: TaskWithContext): string {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(task.due_at),
    );
  }
}
