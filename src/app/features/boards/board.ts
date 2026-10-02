import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { AuthService } from '../../core/auth/auth.service';
import { Icon } from '../../shared/icon';
import { PageHeading } from '../../shared/page-heading';
import { BoardAssignee, TaskDetail } from '../tasks/task-detail';
import { TasksService } from '../tasks/tasks.service';
import { BoardColumn, BoardResult, BUSINESS_STATE_LABELS } from './board-detail';
import { BoardsService } from './boards.service';

@Component({
  imports: [
    RouterLink,
    PageHeading,
    ReactiveFormsModule,
    DatePipe,
    Icon,
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
  ],
  template: `
    <a class="back-link" routerLink="/quadros"><app-icon name="arrow-left" /> Todos os quadros</a>
    @if (result().status === 'loading') {
      <div class="panel empty" role="status">Carregando quadro…</div>
    } @else if (board(); as current) {
      <app-page-heading
        [title]="current.title"
        [description]="current.description || 'Sem descrição.'"
        [eyebrow]="current.department?.name || 'Departamento indisponível'"
      />
      <div class="board-info">
        <div class="board-context-actions">
          <span class="board-created-at"
            >Criado em {{ current.created_at | date: 'dd/MM/yyyy' }} às
            {{ current.created_at | date: 'HH:mm' }}</span
          >
          <div class="board-primary-actions">
            <button
              class="button primary"
              type="button"
              (click)="openForm()"
              [disabled]="!current.columns.length || !assignees().length"
            >
              <app-icon name="plus" /> Nova pendência
            </button>
            @if (canManage() && current.columns.length) {
              <button class="button secondary" type="button" (click)="openNewColumn()">
                <app-icon name="plus" /> Nova coluna
              </button>
            }
            @if (canManage()) {
              <div class="menu-shell">
                <button
                  class="button secondary manage-board-button"
                  type="button"
                  aria-label="Ações administrativas do quadro"
                  [attr.aria-expanded]="boardMenuOpen()"
                  (click)="boardMenuOpen.update((open) => !open)"
                >
                  <app-icon name="settings" /> Gerenciar quadro
                </button>
                @if (boardMenuOpen()) {
                  <div class="action-menu" role="menu">
                    <button type="button" role="menuitem" (click)="openEditBoard()">
                      Editar quadro
                    </button>
                    <button class="danger-item" type="button" role="menuitem" (click)="requestDeleteBoard()">
                      Excluir quadro
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        </div>
        <div class="board-actions">
          <span class="badge"><app-icon name="boards" /> Visualização Kanban</span>
          <div class="filter-tabs" aria-label="Filtrar pendências">
            <button
              type="button"
              [class.active]="filter() === 'active'"
              [attr.aria-pressed]="filter() === 'active'"
              (click)="filter.set('active')"
            >
              Ativas
            </button>
            <button
              type="button"
              [class.active]="filter() === 'completed'"
              [attr.aria-pressed]="filter() === 'completed'"
              (click)="filter.set('completed')"
            >
              Concluídas
            </button>
          </div>
        </div>
      </div>
      @if (newColumnOpen() && current.columns.length) {
        <div class="header-column-form panel">
          <label for="new-column-name">Nome da nova coluna</label>
          <input
            id="new-column-name"
            [value]="newColumnName()"
            (input)="newColumnName.set($any($event.target).value)"
            (keydown.enter)="createColumn()"
            (keydown.escape)="closeNewColumn()"
            maxlength="120"
            placeholder="Ex.: Em revisão"
          />
          <button class="button primary" type="button" (click)="createColumn()" [disabled]="columnBusy()">
            Adicionar
          </button>
          <button class="button tertiary" type="button" (click)="closeNewColumn()" [disabled]="columnBusy()">
            Cancelar
          </button>
        </div>
      }
      @if (managementFeedback()) {
        <p class="feedback success" role="status">{{ managementFeedback() }}</p>
      }
      @if (managementError()) {
        <p class="feedback error" role="alert">{{ managementError() }}</p>
      }

      @if (editBoardOpen()) {
        <button class="dialog-backdrop" type="button" aria-label="Fechar edição do quadro" (click)="closeEditBoard()"></button>
        <section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="edit-board-title">
          <header class="dialog-header">
            <div>
              <h2 id="edit-board-title">Editar quadro</h2>
              <p class="muted">Atualize o nome e a descrição deste quadro.</p>
            </div>
            <button class="icon-button" type="button" aria-label="Fechar" (click)="closeEditBoard()" [disabled]="boardBusy()">
              <app-icon name="close" />
            </button>
          </header>
          <form class="task-form" [formGroup]="editBoardForm" (ngSubmit)="saveBoard()">
            <label
              >Nome do quadro<input formControlName="title" maxlength="200" />
              @if (editBoardForm.controls.title.touched && editBoardForm.controls.title.invalid) {
                <span class="field-error">Informe o nome do quadro.</span>
              }
            </label>
            <label
              >Descrição <span class="muted">(opcional)</span
              ><textarea formControlName="description" rows="4"></textarea>
            </label>
            <div class="dialog-actions">
              <button class="button tertiary" type="button" (click)="closeEditBoard()" [disabled]="boardBusy()">Cancelar</button>
              <button class="button primary" type="submit" [disabled]="boardBusy()">
                {{ boardBusy() ? 'Salvando…' : 'Salvar alterações' }}
              </button>
            </div>
          </form>
        </section>
      }

      @if (confirmation(); as pendingConfirmation) {
        <button class="dialog-backdrop" type="button" aria-label="Cancelar exclusão" (click)="cancelConfirmation()"></button>
        <section class="dialog-card confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
          <h2 id="delete-title">
            {{ pendingConfirmation.kind === 'board' ? 'Excluir quadro?' : 'Excluir coluna?' }}
          </h2>
          <p id="delete-description" class="muted">
            {{ pendingConfirmation.kind === 'board'
              ? 'Esta ação removerá permanentemente este quadro e suas colunas vazias. Ela não poderá ser desfeita.'
              : 'Esta ação removerá a coluna do quadro e não poderá ser desfeita.' }}
          </p>
          <div class="dialog-actions">
            <button class="button tertiary" type="button" (click)="cancelConfirmation()" [disabled]="deleting()">Cancelar</button>
            <button class="button danger" type="button" (click)="confirmDeletion()" [disabled]="deleting()">
              {{ deleting() ? 'Excluindo…' : (pendingConfirmation.kind === 'board' ? 'Excluir quadro' : 'Excluir coluna') }}
            </button>
          </div>
        </section>
      }

      @if (formOpen()) {
        <button
          class="drawer-backdrop"
          type="button"
          aria-label="Fechar nova pendência"
          (click)="closeForm()"
        ></button>
        <section
          class="task-drawer"
          aria-label="Nova pendência"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-task-title"
        >
          <header class="drawer-header">
            <div>
              <h2 id="new-task-title">Nova pendência</h2>
              <p class="muted">Preencha os dados para criar uma nova pendência.</p>
            </div>
            <button
              class="icon-button"
              type="button"
              (click)="closeForm()"
              [disabled]="creating()"
              aria-label="Fechar"
            >
              <app-icon name="close" />
            </button>
          </header>
          <form class="task-form" [formGroup]="form" (ngSubmit)="createTask()">
            <fieldset class="form-section">
              <legend>INFORMAÇÕES</legend>
              <label
                >Título
                <input
                  formControlName="title"
                  maxlength="200"
                  placeholder="Digite o título da pendência"
                />
                @if (form.controls.title.touched && form.controls.title.invalid) {
                  <span class="field-error">Informe um título.</span>
                }
              </label>
              <label
                >Descrição <span class="muted">(opcional)</span>
                <textarea
                  formControlName="description"
                  rows="4"
                  placeholder="Descreva os detalhes da pendência"
                ></textarea>
              </label>
            </fieldset>
            <fieldset class="form-section">
              <legend>ATRIBUIÇÃO</legend>
              <label
                >Responsável
                <select formControlName="assigneeId" (change)="assigneeChanged()">
                  <option value="">Selecione um responsável</option>
                  @for (person of assignees(); track person.id) {
                    <option [value]="person.id">
                      {{ person.display_name || 'Participante sem nome' }}
                    </option>
                  }
                </select>
                @if (form.controls.assigneeId.touched && form.controls.assigneeId.invalid) {
                  <span class="field-error">Selecione um responsável.</span>
                }
              </label>
              <div class="field-row">
                <label
                  >Prazo
                  <input type="datetime-local" formControlName="dueAt" />
                  @if (form.controls.dueAt.touched && form.controls.dueAt.invalid) {
                    <span class="field-error">Informe um prazo.</span>
                  }
                </label>
                <label
                  >Coluna
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
              </div>
            </fieldset>
            <fieldset class="form-section">
              <legend>PRIVACIDADE DA PENDÊNCIA</legend>
              <div class="privacy-options">
                <label class="privacy-option">
                  <input type="radio" formControlName="isPrivate" [value]="false" />
                  <span
                    ><strong>Compartilhada</strong
                    ><small>Visível para usuários autorizados do quadro.</small></span
                  >
                </label>
                <label class="privacy-option">
                  <input type="radio" formControlName="isPrivate" [value]="true" />
                  <span><strong>Privada</strong><small>Visível somente para você.</small></span>
                </label>
              </div>
              @if (assignedToAnother()) {
                <p class="small privacy-note">
                  Pendências atribuídas a outra pessoa são compartilhadas. Elas precisam ser
                  compartilhadas.
                </p>
              }
            </fieldset>
            @if (creationError()) {
              <p class="form-error" role="alert">{{ creationError() }}</p>
            }
            <div class="drawer-actions">
              <button
                class="button tertiary"
                type="button"
                (click)="closeForm()"
                [disabled]="creating()"
              >
                Cancelar
              </button>
              <button class="button primary" type="submit" [disabled]="creating()">
                <app-icon name="plus" />{{ creating() ? 'Salvando…' : 'Criar pendência' }}
              </button>
            </div>
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
        <p class="note">
          No celular, deslize o quadro para ver as colunas. Arraste os cards permitidos para
          movê-los.
        </p>
        <section
          class="kanban"
          cdkDropListGroup
          tabindex="0"
          aria-label="Quadro Kanban com rolagem horizontal"
        >
          @for (column of current.columns; track column.id) {
            <section
              class="kanban-column"
              cdkDropList
              [cdkDropListData]="tasksForColumn(column.id)"
              (cdkDropListDropped)="dropTask($event, column.id)"
              [attr.aria-label]="column.title"
            >
              <div class="section-heading column-heading">
                @if (renamingColumnId() === column.id) {
                  <label class="sr-only" [for]="'rename-' + column.id">Novo nome da coluna</label>
                  <input
                    class="column-name-input"
                    [id]="'rename-' + column.id"
                    [value]="renameColumnName()"
                    (input)="renameColumnName.set($any($event.target).value)"
                    (keydown.enter)="renameColumn(column)"
                    (keydown.escape)="cancelRename()"
                    maxlength="120"
                  />
                  <button
                    class="column-action"
                    type="button"
                    (click)="renameColumn(column)"
                    [disabled]="columnBusy()"
                  >
                    Salvar
                  </button>
                  <button
                    class="column-action"
                    type="button"
                    (click)="cancelRename()"
                    [disabled]="columnBusy()"
                  >
                    Cancelar
                  </button>
                } @else {
                  <h2>{{ column.title }}</h2>
                  <span class="column-count">{{ tasksForColumn(column.id).length }}</span>
                  @if (canManage()) {
                    <button
                      class="column-menu"
                      type="button"
                      (click)="toggleColumnMenu(column.id)"
                      aria-label="Ações da coluna"
                      [attr.aria-expanded]="columnMenuId() === column.id"
                    >
                      <app-icon name="more" />
                    </button>
                    @if (columnMenuId() === column.id) {
                      <div class="action-menu column-action-menu" role="menu">
                        <button type="button" role="menuitem" (click)="startRename(column)">
                          Renomear coluna
                        </button>
                        <button class="danger-item" type="button" role="menuitem" (click)="requestDeleteColumn(column)">
                          Excluir coluna
                        </button>
                      </div>
                    }
                  }
                }
              </div>
              <p class="column-description">
                {{
                  column.business_state
                    ? 'Estado: ' + labels[column.business_state]
                    : 'Coluna organizacional · sem estado vinculado'
                }}
              </p>
              <div class="task-list">
                @for (task of tasksForColumn(column.id); track task.id) {
                  <a
                    class="task-card-link"
                    cdkDrag
                    [cdkDragData]="task"
                    [cdkDragDisabled]="!canMove(task)"
                    [class.draggable]="canMove(task)"
                    [routerLink]="['/pendencias', task.id]"
                    [attr.aria-label]="'Abrir pendência ' + task.title"
                  >
                    <article class="task-card">
                      <div class="row">
                        <span
                          class="badge"
                          [class.private]="task.is_private"
                          [class.shared]="!task.is_private"
                          ><app-icon [name]="task.is_private ? 'lock' : 'users'" />{{
                            task.is_private ? 'Privada' : 'Compartilhada'
                          }}</span
                        >
                        <span class="badge" [attr.data-state]="task.business_state">{{
                          labels[task.business_state]
                        }}</span>
                      </div>
                      <h3>{{ task.title }}</h3>
                      @if (task.description) {
                        <p class="muted">{{ task.description }}</p>
                      }
                      <div class="task-footer">
                        <span>{{ assigneeName(task.assignee_id) }}</span
                        ><span
                          ><app-icon name="calendar" />
                          {{ task.due_at | date: 'dd/MM/yyyy HH:mm' }}</span
                        >
                      </div>
                    </article>
                  </a>
                } @empty {
                  <p class="empty-column">Nenhuma pendência nesta coluna.</p>
                }
              </div>
            </section>
          }
        </section>
      } @else {
        <section class="panel empty empty-board" role="status">
          <h2>Este quadro ainda não possui colunas.</h2>
          <p>Crie a primeira coluna para começar a organizar as pendências.</p>
          @if (canManage()) {
            @if (newColumnOpen()) {
              <div class="first-column-form">
                <label for="first-column-name">Nome da primeira coluna</label
                ><input
                  id="first-column-name"
                  [value]="newColumnName()"
                  (input)="newColumnName.set($any($event.target).value)"
                  (keydown.enter)="createColumn()"
                  maxlength="120"
                /><button
                  class="button primary"
                  type="button"
                  (click)="createColumn()"
                  [disabled]="columnBusy()"
                >
                  Criar coluna
                </button>
              </div>
            } @else {
              <button class="button primary" type="button" (click)="openNewColumn()">
                <app-icon name="plus" /> Criar primeira coluna
              </button>
            }
          }
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
  private readonly boardsService = inject(BoardsService);
  private readonly tasksService = inject(TasksService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
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
  readonly canManage = signal(false);
  readonly boardMenuOpen = signal(false);
  readonly columnMenuId = signal<string | null>(null);
  readonly editBoardOpen = signal(false);
  readonly boardBusy = signal(false);
  readonly deleting = signal(false);
  readonly confirmation = signal<{ kind: 'board' | 'column'; column?: BoardColumn } | null>(null);
  readonly managementError = signal('');
  readonly managementFeedback = signal('');
  readonly newColumnOpen = signal(false);
  readonly newColumnName = signal('');
  readonly renamingColumnId = signal<string | null>(null);
  readonly renameColumnName = signal('');
  readonly columnBusy = signal(false);
  readonly movingTaskId = signal<string | null>(null);
  readonly filter = signal<'active' | 'completed'>('active');
  readonly labels = BUSINESS_STATE_LABELS;
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    assigneeId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    dueAt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    columnId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    isPrivate: new FormControl(false, { nonNullable: true }),
  });
  readonly editBoardForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect((onCleanup) => {
      const id = this.params()?.get('id') ?? '';
      const userId = this.auth.session()?.user.id;
      this.attempt();
      let active = true;
      onCleanup(() => {
        active = false;
      });
      this.result.set({ status: 'loading' });
      this.tasks.set([]);
      this.assignees.set([]);
      this.contentError.set('');
      this.managementError.set('');
      this.managementFeedback.set('');
      this.canManage.set(false);
      this.boardMenuOpen.set(false);
      this.columnMenuId.set(null);
      this.editBoardOpen.set(false);
      this.confirmation.set(null);
      this.closeNewColumn();
      this.cancelRename();
      this.formOpen.set(false);
      void this.load(id, () => active && this.auth.session()?.user.id === userId);
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
        const [tasks, assignees, canManage] = await Promise.all([
          this.tasksService.list(id),
          this.tasksService.listAssignees(id),
          this.boardsService.canManageStructure(id),
        ]);
        if (!isActive()) return;
        this.tasks.set(tasks);
        this.assignees.set(assignees);
        this.canManage.set(canManage);
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
    return this.tasks().filter(
      (task) =>
        task.column_id === columnId &&
        (this.filter() === 'completed'
          ? task.business_state === 'concluido'
          : task.business_state !== 'concluido'),
    );
  }
  assigneeName(id: string): string {
    return (
      this.assignees()
        .find((person) => person.id === id)
        ?.display_name?.trim() || 'Responsável indisponível'
    );
  }
  openForm(): void {
    const board = this.board();
    if (!board?.columns.length || !this.assignees().length) return;
    this.creationError.set('');
    this.form.controls.isPrivate.enable();
    this.form.reset({
      title: '',
      description: '',
      assigneeId: '',
      dueAt: '',
      columnId: board.columns[0].id,
      isPrivate: false,
    });
    this.formOpen.set(true);
  }
  closeForm(): void {
    if (!this.creating()) this.formOpen.set(false);
  }
  assignedToAnother(): boolean {
    const assigneeId = this.form.controls.assigneeId.value;
    return !!assigneeId && assigneeId !== this.auth.session()?.user.id;
  }
  assigneeChanged(): void {
    if (this.assignedToAnother()) {
      this.form.controls.isPrivate.setValue(false);
      this.form.controls.isPrivate.disable();
    } else this.form.controls.isPrivate.enable();
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
        boardId: board.id,
        columnId: value.columnId,
        title: value.title,
        description: value.description || null,
        assigneeId: value.assigneeId,
        dueAt: dueAt.toISOString(),
        isPrivate: value.isPrivate,
      });
      this.tasks.set(await this.tasksService.list(board.id));
      this.formOpen.set(false);
      this.form.reset();
    } catch {
      this.creationError.set(
        'Não foi possível criar a pendência. Revise os dados e tente novamente.',
      );
    } finally {
      this.creating.set(false);
    }
  }
  canMove(task: TaskDetail): boolean {
    const userId = this.auth.session()?.user.id;
    return (
      this.movingTaskId() !== task.id &&
      !!userId &&
      this.auth.profile()?.id === userId &&
      this.auth.profile()?.is_active === true &&
      this.board()?.id === task.board_id &&
      this.tasks().some((visible) => visible.id === task.id) &&
      (!task.is_private ||
        this.canManage() ||
        task.assignee_id === userId ||
        task.created_by === userId)
    );
  }

  async dropTask(event: CdkDragDrop<TaskDetail[]>, targetColumnId: string): Promise<void> {
    const task = event.item.data as TaskDetail;
    if (!task || task.column_id === targetColumnId || !this.canMove(task)) return;
    const previousTasks = this.tasks();
    this.managementError.set('');
    this.managementFeedback.set('');
    this.movingTaskId.set(task.id);
    this.tasks.update((tasks) =>
      tasks.map((item) => (item.id === task.id ? { ...item, column_id: targetColumnId } : item)),
    );
    try {
      await this.tasksService.moveToColumn(task.id, targetColumnId);
      this.managementFeedback.set('Pendência movida com sucesso.');
    } catch {
      this.tasks.set(previousTasks);
      this.managementError.set(
        'Não foi possível mover a pendência. Ela voltou para a coluna anterior.',
      );
    } finally {
      this.movingTaskId.set(null);
    }
  }

  openEditBoard(): void {
    const board = this.board();
    if (!board || !this.canManage()) return;
    this.boardMenuOpen.set(false);
    this.managementError.set('');
    this.managementFeedback.set('');
    this.editBoardForm.reset({ title: board.title, description: board.description ?? '' });
    this.editBoardOpen.set(true);
  }
  closeEditBoard(): void {
    if (!this.boardBusy()) this.editBoardOpen.set(false);
  }
  async saveBoard(): Promise<void> {
    const board = this.board();
    if (!board || !this.canManage() || this.boardBusy()) return;
    this.editBoardForm.markAllAsTouched();
    if (this.editBoardForm.invalid) return;
    const value = this.editBoardForm.getRawValue();
    this.boardBusy.set(true);
    this.managementError.set('');
    try {
      await this.boardsService.updateBoard(board.id, {
        title: value.title,
        description: value.description || null,
      });
      const current = this.result();
      if (current.status === 'loaded') {
        this.result.set({
          status: 'loaded',
          board: {
            ...current.board,
            title: value.title.trim(),
            description: value.description.trim() || null,
          },
        });
      }
      this.editBoardOpen.set(false);
      this.managementFeedback.set('Quadro atualizado com sucesso.');
    } catch {
      this.managementError.set('Não foi possível salvar as alterações do quadro. Tente novamente.');
    } finally {
      this.boardBusy.set(false);
    }
  }

  requestDeleteBoard(): void {
    if (!this.canManage()) return;
    this.boardMenuOpen.set(false);
    this.confirmation.set({ kind: 'board' });
  }
  requestDeleteColumn(column: BoardColumn): void {
    if (!this.canManage()) return;
    this.columnMenuId.set(null);
    this.confirmation.set({ kind: 'column', column });
  }
  cancelConfirmation(): void {
    if (!this.deleting()) this.confirmation.set(null);
  }
  async confirmDeletion(): Promise<void> {
    const board = this.board();
    const confirmation = this.confirmation();
    if (!board || !confirmation || !this.canManage() || this.deleting()) return;
    this.deleting.set(true);
    this.managementError.set('');
    this.managementFeedback.set('');
    try {
      if (confirmation.kind === 'column' && confirmation.column) {
        await this.boardsService.deleteColumn(confirmation.column.id);
        this.updateColumns(board.columns.filter((column) => column.id !== confirmation.column!.id));
        this.confirmation.set(null);
        this.managementFeedback.set('Coluna excluída com sucesso.');
      } else {
        await this.boardsService.deleteBoard(board.id);
        this.confirmation.set(null);
        await this.router.navigateByUrl('/quadros');
      }
    } catch (error) {
      this.confirmation.set(null);
      this.managementError.set(
        error instanceof Error
          ? error.message
          : confirmation.kind === 'column'
            ? 'Esta coluna possui pendências. Mova as pendências antes de excluí-la.'
            : 'Não é possível excluir este quadro enquanto houver pendências vinculadas.',
      );
    } finally {
      this.deleting.set(false);
    }
  }

  toggleColumnMenu(columnId: string): void {
    this.columnMenuId.update((current) => (current === columnId ? null : columnId));
  }

  openNewColumn(): void {
    if (!this.canManage()) return;
    this.managementError.set('');
    this.managementFeedback.set('');
    this.newColumnName.set('');
    this.newColumnOpen.set(true);
  }
  closeNewColumn(): void {
    if (this.columnBusy()) return;
    this.newColumnOpen.set(false);
    this.newColumnName.set('');
  }
  async createColumn(): Promise<void> {
    const board = this.board();
    const name = this.newColumnName().trim();
    if (!board || !this.canManage() || this.columnBusy()) return;
    if (!name) {
      this.managementError.set('Informe o nome da coluna.');
      return;
    }
    this.columnBusy.set(true);
    this.managementError.set('');
    try {
      const id = await this.boardsService.createColumn(board.id, name);
      const columns = board.columns;
      this.updateColumns([
        ...columns,
        {
          id,
          title: name,
          position: columns.length ? Math.max(...columns.map((column) => column.position)) + 1 : 0,
          business_state: null,
        },
      ]);
      this.newColumnOpen.set(false);
      this.newColumnName.set('');
      this.managementFeedback.set('Coluna criada com sucesso.');
    } catch {
      this.managementError.set('Não foi possível criar a coluna. Tente novamente.');
    } finally {
      this.columnBusy.set(false);
    }
  }

  startRename(column: BoardColumn): void {
    if (!this.canManage()) return;
    this.managementError.set('');
    this.managementFeedback.set('');
    this.columnMenuId.set(null);
    this.renamingColumnId.set(column.id);
    this.renameColumnName.set(column.title);
  }
  cancelRename(): void {
    if (this.columnBusy()) return;
    this.renamingColumnId.set(null);
    this.renameColumnName.set('');
  }
  async renameColumn(column: BoardColumn): Promise<void> {
    const name = this.renameColumnName().trim();
    if (!this.canManage() || this.columnBusy()) return;
    if (!name) {
      this.managementError.set('Informe o novo nome da coluna.');
      return;
    }
    this.columnBusy.set(true);
    this.managementError.set('');
    try {
      await this.boardsService.renameColumn(column.id, name);
      this.updateColumns(
        (this.board()?.columns ?? []).map((item) =>
          item.id === column.id ? { ...item, title: name } : item,
        ),
      );
      this.renamingColumnId.set(null);
      this.renameColumnName.set('');
      this.managementFeedback.set('Coluna renomeada com sucesso.');
    } catch {
      this.managementError.set('Não foi possível renomear a coluna. Tente novamente.');
    } finally {
      this.columnBusy.set(false);
    }
  }

  private updateColumns(columns: BoardColumn[]): void {
    const current = this.result();
    if (current.status === 'loaded')
      this.result.set({ status: 'loaded', board: { ...current.board, columns } });
  }
  retry(): void {
    this.attempt.update((attempt) => attempt + 1);
  }
}
