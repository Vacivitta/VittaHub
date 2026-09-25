import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BOARDS, TASKS } from '../../core/demo-data';
import { PageHeading } from '../../shared/page-heading';
@Component({
  imports: [RouterLink, PageHeading],
  template: `
    <app-page-heading
      title="Quadros"
      description="Cada equipe, um espaço para organizar e acompanhar."
    />
    <div class="toolbar">
      <label class="search-field"
        >Buscar quadro<input
          type="search"
          placeholder="Digite o nome de um quadro"
          [value]="query()"
          (input)="query.set($any($event.target).value)" /></label
      ><span class="muted small" aria-live="polite"
        >{{ filtered().length }} quadros de demonstração</span
      >
    </div>
    <div class="boards-grid">
      @for (board of filtered(); track board.id) {
        <a class="board-tile panel" [routerLink]="['/quadros', board.id]"
          ><div class="board-cover" [class]="'board-cover ' + board.id">
            <span aria-hidden="true">▦</span><span class="small">{{ board.area }}</span>
          </div>
          <div class="board-body">
            <h2>{{ board.title }}</h2>
            <p class="muted">{{ board.description }}</p>
            <div class="row">
              <span class="small muted">{{ count(board.id) }} cards fictícios</span
              ><span class="text-link">Abrir quadro ↗</span>
            </div>
          </div></a
        >
      } @empty {
        <div class="panel empty">
          <h2>Nenhum quadro encontrado</h2>
          <p>Tente outro nome.</p>
          <button type="button" (click)="query.set('')">Limpar busca</button>
        </div>
      }
    </div>
    <p class="note">
      Visualização demonstrativa. Criação e edição de quadros estarão disponíveis em uma próxima
      etapa.
    </p>
  `,
})
export class Boards {
  readonly query = signal('');
  readonly filtered = computed(() =>
    BOARDS.filter((b) =>
      b.title.toLocaleLowerCase('pt-BR').includes(this.query().trim().toLocaleLowerCase('pt-BR')),
    ),
  );
  count(id: string) {
    return TASKS.filter((t) => t.boardId === id).length;
  }
}
