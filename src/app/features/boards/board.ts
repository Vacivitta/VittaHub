import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PageHeading } from '../../shared/page-heading';
import { BoardResult, BUSINESS_STATE_LABELS } from './board-detail';
import { BoardsService } from './boards.service';
@Component({
  imports: [RouterLink, PageHeading],
  template: `
    <a class="back-link" routerLink="/quadros">← Todos os quadros</a>
    @if (result().status === 'loading') {
      <div class="panel empty" role="status">Carregando quadro…</div>
    } @else if (board(); as current) {
      <app-page-heading
        [title]="current.title"
        [description]="current.description || 'Sem descrição.'"
        [eyebrow]="current.department?.name || 'Departamento indisponível'"
      />
      <div class="board-info">
        <span class="badge">Visualização Kanban</span
        ><span class="small muted">Somente leitura</span>
      </div>
      <p class="note">Os cartões ainda não estão disponíveis.</p>
      @if (current.columns.length) {
      <p class="note">No celular, deslize o quadro para ver as colunas.</p>
      <section class="kanban" tabindex="0" aria-label="Quadro Kanban com rolagem horizontal">
        @for (column of current.columns; track column.id) {
          <section class="kanban-column" [attr.aria-label]="column.title">
            <div class="section-heading">
              <h2>{{ column.title }}</h2>
            </div>
            <p class="column-description">
              {{
                column.business_state
                  ? 'Estado: ' + labels[column.business_state]
                  : 'Coluna organizacional · sem estado vinculado'
              }}
            </p>
            <div class="task-list">
              <p class="empty-column">Cartões indisponíveis nesta etapa.</p>
            </div>
          </section>
        }
      </section>
      } @else {
        <section class="panel empty" role="status">
          <h2>Este quadro ainda não tem colunas</h2>
        </section>
      }
    } @else {
      <section class="panel empty">
        @switch (result().status) {
          @case ('unavailable') {
            <h1>Quadro não encontrado ou sem acesso</h1>
            <p>Confira o endereço ou escolha um quadro disponível na listagem.</p>
          }
          @case ('forbidden') {
            <h1>Acesso negado</h1>
            <p role="alert">Não foi possível acessar este quadro com sua sessão atual.</p>
          }
          @default {
            <h1>Não foi possível carregar o quadro</h1>
            <p role="alert">Tente novamente em instantes.</p>
            <button type="button" (click)="retry()">Tentar novamente</button>
          }
        }
      </section>
    }
  `,
})
export class BoardPage {
  private readonly service = inject(BoardsService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly attempt = signal(0);
  readonly result = signal<BoardResult | { status: 'loading' }>({ status: 'loading' });
  readonly board = computed(() => {
    const result = this.result();
    return result.status === 'loaded' ? result.board : null;
  });
  readonly labels = BUSINESS_STATE_LABELS;

  constructor() {
    effect((onCleanup) => {
      const id = this.params()?.get('id') ?? '';
      this.attempt();
      let active = true;
      onCleanup(() => { active = false; });
      this.result.set({ status: 'loading' });
      void this.service.getById(id).then(
        (result) => { if (active) this.result.set(result); },
        () => { if (active) this.result.set({ status: 'error' }); },
      );
    });
  }

  retry(): void {
    this.attempt.update((attempt) => attempt + 1);
  }
}
