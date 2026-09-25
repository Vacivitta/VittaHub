import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BOARDS, STATE_LABELS, TASKS } from '../../core/demo-data';
import { PageHeading } from '../../shared/page-heading';
import { TaskCard } from '../../shared/task-card';
@Component({
  imports: [RouterLink, PageHeading, TaskCard],
  template: `
    <a class="back-link" routerLink="/quadros">← Todos os quadros</a>
    @if (board(); as current) {
      <app-page-heading
        [title]="current.title"
        [description]="current.description"
        [eyebrow]="current.area"
      />
      <div class="board-info">
        <span class="badge">Visualização Kanban</span
        ><span class="small muted">Cards fictícios · Somente leitura</span>
      </div>
      <p class="note">
        No celular, deslize o quadro para ver as colunas. Movimentações não estão disponíveis nesta
        demonstração.
      </p>
      <section class="kanban" tabindex="0" aria-label="Quadro Kanban com rolagem horizontal">
        @for (column of current.columns; track column.id) {
          <section class="kanban-column" [attr.aria-label]="column.title">
            <div class="section-heading">
              <h2>{{ column.title }}</h2>
              <span class="column-count">{{ cards(current.id, column.id).length }}</span>
            </div>
            <p class="column-description">
              {{
                column.state
                  ? 'Estado: ' + labels[column.state]
                  : 'Coluna organizacional · sem estado vinculado'
              }}
            </p>
            <div class="task-list">
              @for (task of cards(current.id, column.id); track task.id) {
                <app-task-card [task]="task" />
              } @empty {
                <p class="empty-column">Nenhum card por aqui.</p>
              }
            </div>
          </section>
        }
      </section>
    } @else {
      <section class="panel empty">
        <h1>Quadro não encontrado</h1>
        <p>Escolha um dos quadros fictícios disponíveis.</p>
        <a class="button primary" routerLink="/quadros">Ver quadros</a>
      </section>
    }
  `,
})
export class BoardPage {
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  readonly board = computed(() => BOARDS.find((b) => b.id === this.params()?.get('id')));
  readonly labels = STATE_LABELS;
  cards(boardId: string, columnId: string) {
    return TASKS.filter((t) => t.boardId === boardId && t.columnId === columnId);
  }
}
