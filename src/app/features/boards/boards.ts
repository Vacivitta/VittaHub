import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
import { PageHeading } from '../../shared/page-heading';
import { BoardCreationContext, BoardSummary, DepartmentOption } from './board-summary';
import { BoardsService } from './boards.service';

@Component({
  imports: [PageHeading, RouterLink, Icon, ReactiveFormsModule, DatePipe],
  template: `
    <app-page-heading
      title="Quadros"
      description="Encontre os espaços de trabalho dos quais você participa."
    >
      @if (canCreate()) {
        <button class="button primary" type="button" (click)="openCreateForm()">
          <app-icon name="plus" /> Novo quadro
        </button>
      }
    </app-page-heading>
    @if (success()) {
      <p class="feedback success" role="status">{{ success() }}</p>
    }
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
              <app-icon name="boards" /><span class="badge">{{
                board.department?.name || 'Departamento indisponível'
              }}</span>
            </div>
            <div class="board-body">
              <h2>{{ board.title }}</h2>
              <p class="muted">{{ board.description || 'Sem descrição.' }}</p>
              <p class="board-created-date">Criado em {{ board.created_at | date: 'dd/MM/yyyy' }}</p>
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
              @if (canCreate()) {
                <button class="button primary" type="button" (click)="openCreateForm()">
                  <app-icon name="plus" /> Criar primeiro quadro
                </button>
              }
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
    @if (createFormOpen()) {
      <button
        class="drawer-backdrop"
        type="button"
        aria-label="Fechar novo quadro"
        (click)="closeCreateForm()"
      ></button>
      <section
        class="task-drawer board-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-board-title"
      >
        <header class="drawer-header">
          <div>
            <h2 id="new-board-title">Novo quadro</h2>
            <p class="muted">Crie um espaço para organizar o trabalho da equipe.</p>
          </div>
          <button
            class="icon-button"
            type="button"
            aria-label="Fechar"
            (click)="closeCreateForm()"
            [disabled]="creating()"
          >
            <app-icon name="close" />
          </button>
        </header>
        <form class="task-form" [formGroup]="form" (ngSubmit)="createBoard()">
          <label
            >Nome do quadro<input
              formControlName="title"
              maxlength="200"
              placeholder="Ex.: Rotina da equipe"
            />
            @if (form.controls.title.touched && form.controls.title.invalid) {
              <span class="field-error">Informe o nome do quadro.</span>
            }
          </label>
          <label
            >Descrição <span class="muted">(opcional)</span
            ><textarea
              formControlName="description"
              rows="4"
              placeholder="Descreva o objetivo deste quadro"
            ></textarea>
          </label>
          @if (context()?.role === 'administrador') {
            <label
              >Departamento<select formControlName="departmentId">
                <option value="">Selecione</option>
                @for (department of departments(); track department.id) {
                  <option [value]="department.id">{{ department.name }}</option>
                }
              </select>
              @if (form.controls.departmentId.touched && form.controls.departmentId.invalid) {
                <span class="field-error">Selecione um departamento.</span>
              }
            </label>
          }
          @if (creationError()) {
            <p class="form-error" role="alert">{{ creationError() }}</p>
          }
          <div class="drawer-actions">
            <button
              class="button tertiary"
              type="button"
              (click)="closeCreateForm()"
              [disabled]="creating()"
            >
              Cancelar</button
            ><button class="button primary" type="submit" [disabled]="creating()">
              <app-icon name="plus" />{{ creating() ? 'Criando…' : 'Criar quadro' }}
            </button>
          </div>
        </form>
      </section>
    }
  `,
})
export class Boards implements OnInit {
  private readonly service = inject(BoardsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly boards = signal<BoardSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly context = signal<BoardCreationContext | null>(null);
  readonly departments = signal<DepartmentOption[]>([]);
  readonly createFormOpen = signal(false);
  readonly creating = signal(false);
  readonly creationError = signal('');
  readonly success = signal('');
  readonly canCreate = computed(() => this.context()?.can_create === true);
  readonly filtered = computed(() =>
    this.boards().filter((board) =>
      board.title
        .toLocaleLowerCase('pt-BR')
        .includes(this.query().trim().toLocaleLowerCase('pt-BR')),
    ),
  );
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    departmentId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    void this.load();
    void this.loadAccess();
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

  private async loadAccess(): Promise<void> {
    const context = await this.service.getCreationContext();
    if (this.destroyRef.destroyed || !context) return;
    this.context.set(context);
    if (context.role === 'administrador' && context.can_create) {
      try {
        this.departments.set(await this.service.listDepartments());
      } catch {
        this.context.set({ ...context, can_create: false });
      }
    }
  }

  openCreateForm(): void {
    const context = this.context();
    if (!context?.can_create) return;
    this.creationError.set('');
    this.success.set('');
    this.form.reset({
      title: '',
      description: '',
      departmentId: context.role === 'gestor' ? context.department_id : '',
    });
    this.createFormOpen.set(true);
  }
  closeCreateForm(): void {
    if (!this.creating()) this.createFormOpen.set(false);
  }
  async createBoard(): Promise<void> {
    if (!this.canCreate() || this.creating()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.creating.set(true);
    this.creationError.set('');
    try {
      const value = this.form.getRawValue();
      await this.service.create({
        title: value.title,
        description: value.description || null,
        departmentId: value.departmentId,
      });
      await this.load();
      this.createFormOpen.set(false);
      this.success.set('Quadro criado com sucesso.');
    } catch {
      this.creationError.set('Não foi possível criar o quadro. Revise os dados e tente novamente.');
    } finally {
      this.creating.set(false);
    }
  }
}
