import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { PageHeading } from '../../shared/page-heading';
import { BoardSummary } from './board-summary';
import { BoardsService } from './boards.service';
@Component({
  imports: [PageHeading],
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
          [disabled]="loading() || !!error()"
          [value]="query()"
          (input)="query.set($any($event.target).value)" /></label
      >
      @if (!loading() && !error()) {
        <span class="muted small" aria-live="polite">{{ filtered().length }} quadros disponíveis</span>
      }
    </div>
    @if (loading()) {
      <div class="panel empty" role="status">Carregando quadros…</div>
    } @else if (error()) {
      <div class="panel empty">
        <p role="alert">{{ error() }}</p>
        <button type="button" (click)="load()">Tentar novamente</button>
      </div>
    } @else {
      <div class="boards-grid">
      @for (board of filtered(); track board.id) {
        <article class="board-tile panel">
          <div class="board-cover">
            <span aria-hidden="true">▦</span><span class="small">{{ board.department?.name || 'Departamento indisponível' }}</span>
          </div>
          <div class="board-body">
            <h2>{{ board.title }}</h2>
            <p class="muted">{{ board.description || 'Sem descrição.' }}</p>
            <div class="row">
              <span class="small muted">Somente leitura</span>
            </div>
          </div>
        </article>
      } @empty {
        <div class="panel empty">
          @if (boards().length === 0) {
            <h2>Nenhum quadro disponível</h2>
            <p>Não há quadros disponíveis para sua conta.</p>
          } @else {
            <h2>Nenhum quadro encontrado</h2>
            <p>Tente outro nome.</p>
            <button type="button" (click)="query.set('')">Limpar busca</button>
          }
        </div>
      }
      </div>
    }
    <p class="note">
      Abertura de detalhes, criação e edição de quadros estarão disponíveis em uma próxima etapa.
    </p>
  `,
})
export class Boards implements OnInit {
  private readonly service = inject(BoardsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly boards = signal<BoardSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly filtered = computed(() =>
    this.boards().filter((b) =>
      b.title.toLocaleLowerCase('pt-BR').includes(this.query().trim().toLocaleLowerCase('pt-BR')),
    ),
  );
  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.boards.set([]);
    try {
      const boards = await this.service.list();
      if (!this.destroyRef.destroyed) this.boards.set(boards);
    } catch {
      if (!this.destroyRef.destroyed) {
        this.error.set('Não foi possível carregar os quadros. Tente novamente.');
      }
    } finally {
      if (!this.destroyRef.destroyed) this.loading.set(false);
    }
  }
}
