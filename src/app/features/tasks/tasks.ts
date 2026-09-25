import { Component, computed, signal } from '@angular/core';
import { BOARDS, DEMO_USER, STATE_LABELS, TASKS } from '../../core/demo-data';
import { PageHeading } from '../../shared/page-heading';
import { TaskCard } from '../../shared/task-card';
import { RouterLink } from '@angular/router';
@Component({
  imports: [PageHeading, TaskCard, RouterLink],
  template: `
    <app-page-heading
      title="Minhas Pendências"
      description="Tudo o que está atribuído a você, com clareza sobre cada prazo."
    />
    <div class="toolbar">
      <label class="search-field"
        >Buscar pendência<input
          type="search"
          placeholder="Busque pelo título"
          [value]="query()"
          (input)="query.set($any($event.target).value)" /></label
      ><label
        >Estado<select [value]="state()" (change)="state.set($any($event.target).value)">
          <option value="">Todos os estados</option>
          @for (entry of states; track entry.key) {
            <option [value]="entry.key">{{ entry.label }}</option>
          }
        </select></label
      >
    </div>
    <p class="small muted" aria-live="polite">
      {{ filtered().length }} pendências · Pessoa Demo · Referência: 24/09/2026
    </p>
    <div class="tasks-grid">
      @for (task of filtered(); track task.id) {
        <div>
          <app-task-card [task]="task" /><a
            class="task-board-link"
            [routerLink]="['/quadros', task.boardId]"
            >{{ boardName(task.boardId) }} ↗</a
          >
        </div>
      } @empty {
        <div class="panel empty">
          <h2>Nenhuma pendência encontrada</h2>
          <p>Experimente limpar os filtros.</p>
          <button type="button" (click)="clear()">Limpar filtros</button>
        </div>
      }
    </div>
    <p class="note">
      Aceite, recusa, adiamento e conclusão não estão habilitados nesta etapa visual.
    </p>
  `,
})
export class Tasks {
  readonly query = signal('');
  readonly state = signal('');
  readonly states = Object.entries(STATE_LABELS).map(([key, label]) => ({ key, label }));
  readonly filtered = computed(() =>
    TASKS.filter(
      (t) =>
        t.assignee === DEMO_USER &&
        (!this.state() || t.state === this.state()) &&
        t.title.toLocaleLowerCase('pt-BR').includes(this.query().trim().toLocaleLowerCase('pt-BR')),
    ),
  );
  boardName(id: string) {
    return BOARDS.find((b) => b.id === id)?.title;
  }
  clear() {
    this.query.set('');
    this.state.set('');
  }
}
