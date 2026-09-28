import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PageHeading } from '../../shared/page-heading';
import { BoardAssignee, TaskDetail } from '../tasks/task-detail';
import { TasksService } from '../tasks/tasks.service';
import { BoardResult, BUSINESS_STATE_LABELS } from './board-detail';
import { BoardsService } from './boards.service';

@Component({
  imports: [RouterLink, PageHeading, ReactiveFormsModule, DatePipe],
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
        <span class="badge">Visualização Kanban</span>
        <button class="button primary" type="button" (click)="openForm()" [disabled]="!current.columns.length || !assignees().length">
          Nova pendência
        </button>
      </div>

      @if (formOpen()) {
        <section class="panel task-form-panel" aria-label="Nova pendência">
          <div class="section-heading">
            <h2>Nova pendência</h2>
            <button type="button" (click)="closeForm()" [disabled]="creating()">Fechar</button>
          </div>
          <form class="task-form" [formGroup]="form" (ngSubmit)="createTask()">
            <label>Título
              <input formControlName="title" maxlength="200" />
              @if (form.controls.title.touched && form.controls.title.invalid) {
                <span class="field-error">Informe um título.</span>
              }
            </label>
            <label>Descrição opcional
              <textarea formControlName="description" rows="3"></textarea>
            </label>
            <label>Responsável
              <select formControlName="assigneeId">
                <option value="">Selecione</option>
                @for (person of assignees(); track person.id) {
                  <option [value]="person.id">{{ person.display_name || 'Participante sem nome' }}</option>
                }
              </select>
              @if (form.controls.assigneeId.touched && form.controls.assigneeId.invalid) {
                <span class="field-error">Selecione um responsável.</span>
              }
            </label>
            <label>Prazo
              <input type="datetime-local" formControlName="dueAt" />
              @if (form.controls.dueAt.touched && form.controls.dueAt.invalid) {
                <span class="field-error">Informe um prazo.</span>
              }
            </label>
            <label>Coluna
              <select formControlName="columnId">
                <option value="">Selecione</option>
                @for (column of current.columns; track column.id) {
                  <option [value]="column.id">{{ column.title }}</option>
                }
              </select>
              @if (form.controls.columnId.touched && form.controls.columnId.invalid) {
                <span class="field-error">Selecione uma coluna.</span>
              }
            </label>
            <label class="checkbox-field">
              <input type="checkbox" formControlName="isPrivate" /> Pendência privada
            </label>
            @if (creationError()) {
              <p class="form-error" role="alert">{{ creationError() }}</p>
            }
            <button class="button primary" type="submit" [disabled]="creating()">
              {{ creating() ? 'Salvando…' : 'Criar pendência' }}
            </button>
          </form>
        </section>
      }

      @if (contentLoading()) {
        <div class="panel empty" role="status">Carregando pendências…</div>
      } @else if (contentError()) {
        <section class="panel empty">
          <h2>Não foi possível carregar as pendências</h2>
          <p role="alert">{{ contentError() }}</p>
          <button type="button" (click)="retry()">Tentar novamente</button>
        </section>
      } @else if (current.columns.length) {
        <p class="note">No celular, deslize o quadro para ver as colunas.</p>
        <section class="kanban" tabindex="0" aria-label="Quadro Kanban com rolagem horizontal">
          @for (column of current.columns; track column.id) {
            <section class="kanban-column" [attr.aria-label]="column.title">
              <div class="section-heading">
                <h2>{{ column.title }}</h2>
                <span class="column-count">{{ tasksForColumn(column.id).length }}</span>
              </div>
              <p class="column-description">
                {{ column.business_state ? 'Estado: ' + labels[column.business_state] : 'Coluna organizacional · sem estado vinculado' }}
              </p>
              <div class="task-list">
                @for (task of tasksForColumn(column.id); track task.id) {
                  <article class="task-card">
                    <div class="row">
                      <span class="task-id">{{ task.is_private ? 'Privada' : 'Compartilhada' }}</span>
                      <span class="badge" [class.success]="task.business_state === 'concluido'">{{ labels[task.business_state] }}</span>
                    </div>
                    <h3>{{ task.title }}</h3>
                    <div class="task-footer">
                      <span>{{ assigneeName(task.assignee_id) }}</span>
                      <span>Prazo · {{ task.due_at | date:'dd/MM/yyyy HH:mm' }}</span>
                    </div>
                  </article>
                } @empty {
                  <p class="empty-column">Nenhuma pendência nesta coluna.</p>
                }
              </div>
            </section>
          }
        </section>
      } @else {
        <section class="panel empty" role="status"><h2>Este quadro ainda não tem colunas</h2></section>
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
  private readonly boardsService = inject(BoardsService);
  private readonly tasksService = inject(TasksService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly attempt = signal(0);
  readonly result = signal<BoardResult | { status: 'loading' }>({ status: 'loading' });
  readonly board = computed(() => {
    const result = this.result();
    return result.status === 'loaded' ? result.board : null;
  });
  readonly tasks = signal<TaskDetail[]>([]);
  readonly assignees = signal<BoardAssignee[]>([]);
  readonly contentLoading = signal(false);
  readonly contentError = signal('');
  readonly formOpen = signal(false);
  readonly creating = signal(false);
  readonly creationError = signal('');
  readonly labels = BUSINESS_STATE_LABELS;
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    assigneeId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    dueAt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    columnId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    isPrivate: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    effect((onCleanup) => {
      const id = this.params()?.get('id') ?? '';
      this.attempt();
      let active = true;
      onCleanup(() => { active = false; });
      this.result.set({ status: 'loading' });
      this.tasks.set([]);
      this.assignees.set([]);
      this.contentError.set('');
      this.formOpen.set(false);
      void this.load(id, () => active);
    });
  }

  private async load(id: string, isActive: () => boolean): Promise<void> {
    try {
      const result = await this.boardsService.getById(id);
      if (!isActive()) return;
      this.result.set(result);
      if (result.status !== 'loaded') return;
      this.contentLoading.set(true);
      try {
        const [tasks, assignees] = await Promise.all([
          this.tasksService.list(id), this.tasksService.listAssignees(id),
        ]);
        if (!isActive()) return;
        this.tasks.set(tasks);
        this.assignees.set(assignees);
      } catch {
        if (isActive()) this.contentError.set('Tente novamente em instantes.');
      } finally {
        if (isActive()) this.contentLoading.set(false);
      }
    } catch {
      if (isActive()) this.result.set({ status: 'error' });
    }
  }

  tasksForColumn(columnId: string): TaskDetail[] {
    return this.tasks().filter((task) => task.column_id === columnId);
  }

  assigneeName(id: string): string {
    return this.assignees().find((person) => person.id === id)?.display_name?.trim() || 'Responsável indisponível';
  }

  openForm(): void {
    const board = this.board();
    if (!board?.columns.length || !this.assignees().length) return;
    this.creationError.set('');
    this.form.reset({ title: '', description: '', assigneeId: '', dueAt: '', columnId: board.columns[0].id, isPrivate: false });
    this.formOpen.set(true);
  }

  closeForm(): void {
    if (!this.creating()) this.formOpen.set(false);
  }

  async createTask(): Promise<void> {
    const board = this.board();
    if (!board || this.creating()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const dueAt = new Date(value.dueAt);
    if (Number.isNaN(dueAt.getTime())) {
      this.form.controls.dueAt.setErrors({ invalid: true });
      this.form.controls.dueAt.markAsTouched();
      return;
    }
    this.creating.set(true);
    this.creationError.set('');
    try {
      await this.tasksService.create({
        boardId: board.id, columnId: value.columnId, title: value.title,
        description: value.description || null, assigneeId: value.assigneeId,
        dueAt: dueAt.toISOString(), isPrivate: value.isPrivate,
      });
      this.tasks.set(await this.tasksService.list(board.id));
      this.formOpen.set(false);
      this.form.reset();
    } catch {
      this.creationError.set('Não foi possível criar a pendência. Revise os dados e tente novamente.');
    } finally {
      this.creating.set(false);
    }
  }

  retry(): void {
    this.attempt.update((attempt) => attempt + 1);
  }
}
