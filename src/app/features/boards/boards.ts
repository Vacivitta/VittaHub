import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
import { PageHeading } from '../../shared/page-heading';
import { BoardSummary } from './board-summary';
import { BoardsService } from './boards.service';

@Component({
  imports: [PageHeading, RouterLink, Icon],
  template: `
    <app-page-heading
      title="Quadros"
      description="Encontre os espaços de trabalho dos quais você participa."
    />
    <div class="toolbar">
      <label class="search-field"
        >Buscar quadro
        <app-icon name="search" />
        <input
          type="search"
          placeholder="Digite o nome de um quadro"
          [disabled]="loading() || !!error()"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
      </label>
      @if (!loading() && !error()) {
        <span class="muted small" aria-live="polite"
          >{{ filtered().length }} quadros disponíveis</span
        >
      }
    </div>
    @if (loading()) {
      <div class="panel empty" role="status">Carregando quadros…</div>
    } @else if (error()) {
      <div class="panel empty">
        <h2>Não foi possível carregar os quadros</h2>
        <p role="alert">{{ error() }}</p>
        <button class="button secondary" type="button" (click)="load()">Tentar novamente</button>
      </div>
    } @else {
      <div class="boards-grid">
        @for (board of filtered(); track board.id) {
          <a class="board-tile panel" [routerLink]="['/quadros', board.id]">
            <div class="board-cover">
              <app-icon name="boards" />
              <span class="badge">{{ board.department?.name || 'Departamento indisponível' }}</span>
            </div>
            <div class="board-body">
              <h2>{{ board.title }}</h2>
              <p class="muted">{{ board.description || 'Sem descrição.' }}</p>
              <div class="row">
                <span class="small muted">Somente leitura</span
                ><span class="text-link">Abrir quadro <app-icon name="arrow-right" /></span>
              </div>
            </div>
          </a>
        } @empty {
          <div class="panel empty">
            @if (boards().length === 0) {
              <h2>Nenhum quadro disponível</h2>
              <p>Você ainda não participa de nenhum quadro.</p>
            } @else {
              <h2>Nenhum quadro encontrado</h2>
              <p>Tente outro nome ou limpe a busca.</p>
              <button class="button secondary" type="button" (click)="query.set('')">
                Limpar busca
              </button>
            }
          </div>
        }
      </div>
    }
    <p class="note">Criação e edição de quadros estarão disponíveis em uma próxima etapa.</p>
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
    this.boards().filter((board) =>
      board.title
        .toLocaleLowerCase('pt-BR')
        .includes(this.query().trim().toLocaleLowerCase('pt-BR')),
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
      if (!this.destroyRef.destroyed)
        this.error.set('Não foi possível carregar os quadros. Tente novamente.');
    } finally {
      if (!this.destroyRef.destroyed) this.loading.set(false);
    }
  }
}
