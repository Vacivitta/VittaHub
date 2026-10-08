import { DatePipe } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeading } from '../../shared/page-heading';
import { BoardDetail, BUSINESS_STATE_LABELS } from '../boards/board-detail';
import { BoardsService } from '../boards/boards.service';
import { BoardAssignee, TaskComment, TaskEvent, TaskResult } from './task-detail';
import { TasksService } from './tasks.service';
import { Icon } from '../../shared/icon';
import { TaskAssignmentActions } from './task-assignment-actions';
import { TaskReopening } from './task-reopening';
import { TaskEditing } from './task-editing';

@Component({
  styles: `
    .detail-tools { display: flex; align-items: center; flex-wrap: wrap; gap: .75rem; margin-top: 1rem; }
    .detail-tools app-task-editing { margin-top: 0; }
    .task-detail-layout { align-items: start; grid-template-areas: 'detail history' 'comments .'; }
    .task-detail-main { display: contents; }
    .task-detail-panel { grid-area: detail; min-width: 0; }
    .task-comments-panel { grid-area: comments; margin-top: 0; }
    .task-history-slot { grid-area: history; position: relative; align-self: stretch; min-width: 0; }
    .task-history-panel { position: absolute; top: auto; bottom: 0; width: 100%; max-height: 100%;
      box-sizing: border-box; overflow: auto; min-width: 0; }
    @media (max-width: 900px) {
      .task-detail-layout { grid-template-areas: 'detail' 'comments' 'history'; }
      .task-history-panel { position: static; max-height: none; overflow: visible; }
    }
    .history-toggle { margin-top: .25rem; }
    .move-dialog { margin: auto; width: min(32rem, calc(100vw - 2rem)); box-sizing: border-box;
      max-height: 85dvh; overflow: auto; border: 1px solid var(--border); border-radius: 1rem;
      padding: 1.5rem; background: var(--surface); color: var(--text-primary); }
    .move-dialog::backdrop { background: #0f172a88; }
    .move-dialog header, .move-dialog footer { display: flex; align-items: center; gap: .75rem; }
    .move-dialog header { justify-content: space-between; }
    .move-dialog h2 { margin: 0; }
    .move-dialog .icon-button { display: inline-flex; align-items: center; justify-content: center;
      flex: 0 0 42px; width: 42px; height: 42px; padding: 0; border-radius: 50%;
      background: var(--brand-primary-soft); color: var(--brand-primary); }
    .move-dialog fieldset { display: grid; gap: .75rem; border: 0; padding: 0; margin: 1rem 0; min-width: 0; }
    .move-dialog legend { margin-bottom: .75rem; }
    .move-option { display: flex; align-items: center; gap: .75rem; padding: .75rem;
      border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; overflow-wrap: anywhere; }
    .move-option.selected { border-color: var(--brand-primary); background: var(--brand-primary-soft); }
    .move-option:focus-within { outline: 2px solid var(--brand-primary); outline-offset: 2px; }
    .move-option input { appearance: none; width: 1.1rem; height: 1.1rem; min-height: 0; min-width: 0;
      box-sizing: border-box; aspect-ratio: 1; align-self: center; flex: 0 0 1.1rem;
      padding: 0; margin: 0; border: 2px solid var(--brand-primary); border-radius: 50%;
      background: var(--surface); box-shadow: none; cursor: pointer; }
    .move-option input:checked { background: var(--brand-primary);
      box-shadow: inset 0 0 0 3px var(--surface); }
    .move-option input:focus-visible { outline: none; }
    .move-dialog footer { flex-wrap: wrap; justify-content: flex-end; }
    .move-dialog footer button { white-space: normal; overflow-wrap: anywhere; }
    @media (max-width: 480px) { .move-dialog { padding: 1rem; } .move-dialog footer button { width: 100%; } }
  `,
  imports: [RouterLink, PageHeading, DatePipe, Icon, TaskAssignmentActions, TaskReopening, TaskEditing],
  template: `
    <a class="back-link" [routerLink]="backTarget().commands"
      ><app-icon name="arrow-left" /> {{ backTarget().label }}</a
    >
    @if (assignmentFeedback()) { <p role="status">{{ assignmentFeedback() }}</p> }
    @if (moveFeedback()) { <p role="status">{{ moveFeedback() }}</p> }
    @if (moveError() && !moveModalOpen()) { <p class="form-error" role="alert">{{ moveError() }}</p> }
    @if (result().status === 'loading') {
      <div class="panel empty" role="status">Carregando pendência…</div>
    } @else if (task(); as current) {
      <app-page-heading
        [title]="current.title"
        [description]="current.description || 'Sem descrição.'"
        eyebrow="Detalhe da pendência"
      />
      <div class="task-detail-layout">
        <div class="task-detail-main">
          <section class="panel task-detail-panel">
            <div class="task-detail-state">
              <span class="badge" [attr.data-state]="current.business_state">{{
                current.awaiting_reassignment ? 'Aguardando reatribuição' : labels[current.business_state]
              }}</span>
              <span
                class="badge"
                [class.private]="current.is_private"
                [class.shared]="!current.is_private"
              >
                <app-icon [name]="current.is_private ? 'lock' : 'users'" />{{
                  current.is_private ? 'Privada' : 'Compartilhada'
                }}
              </span>
            </div>
            <dl class="task-detail-grid">
              <div>
                <dt>Responsável</dt>
                <dd>{{ current.awaiting_reassignment ? 'Sem responsável ativo' : assigneeName() || 'Nome indisponível' }}</dd>
              </div>
              <div>
                <dt>Prazo</dt>
                <dd>{{ current.due_at | date: 'dd/MM/yyyy HH:mm' }}</dd>
              </div>
              <div>
                <dt>Quadro</dt>
                <dd>{{ current.board?.title || 'Indisponível' }}</dd>
              </div>
              <div>
                <dt>Coluna</dt>
                <dd>{{ current.column?.title || 'Indisponível' }}</dd>
              </div>
              <div>
                <dt>Criada em</dt>
                <dd>{{ current.created_at | date: 'dd/MM/yyyy HH:mm' }}</dd>
              </div>
              @if (current.accepted_at) {
                <div>
                  <dt>Aceita em</dt>
                  <dd>{{ current.accepted_at | date: 'dd/MM/yyyy HH:mm' }}</dd>
                </div>
              }
              @if (current.completed_at) {
                <div>
                  <dt>Concluída em</dt>
                  <dd>{{ current.completed_at | date: 'dd/MM/yyyy HH:mm' }}</dd>
                </div>
              }
              @if (creatorName()) {
                <div>
                  <dt>Criador</dt>
                  <dd>{{ creatorName() }}</dd>
                </div>
              }
            </dl>
            <div class="task-actions">
              @if (action(); as currentAction) {
                <div class="task-action">
                  <button
                    class="button primary"
                    type="button"
                    (click)="runAction()"
                    [disabled]="transitioning()"
                  >
                    {{ transitioning() ? 'Atualizando…' : actionLabel(currentAction) }}
                  </button>
                </div>
              }
              @if (canWaitForThirdParty()) {
                <div class="task-action">
                  <button
                    class="button secondary"
                    type="button"
                    (click)="thirdPartyFormOpen.set(true)"
                    [disabled]="transitioning()"
                  >
                    Aguardar terceiro
                  </button>
                </div>
              }
              @if (thirdPartyFormOpen()) {
                <div class="third-party-form">
                  <h2>Quem ou o que estamos aguardando?</h2>
                  <label
                    >Descreva a dependência externa
                    <textarea
                      rows="3"
                      [value]="thirdPartyExplanation()"
                      (input)="thirdPartyExplanation.set($any($event.target).value)"
                    ></textarea>
                  </label>
                  <div class="row">
                    <button
                      class="button primary"
                      type="button"
                      (click)="waitForThirdParty()"
                      [disabled]="transitioning()"
                    >
                      {{ transitioning() ? 'Atualizando…' : 'Confirmar espera' }}
                    </button>
                    <button
                      type="button"
                      (click)="closeThirdPartyForm()"
                      [disabled]="transitioning()"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              }
              @if (feedback()) {
                <p class="action-feedback" role="status">{{ feedback() }}</p>
              }
              @if (actionError()) {
                <p class="form-error" role="alert">{{ actionError() }}</p>
              }
            </div>
            <app-task-assignment-actions [task]="current" (changed)="assignmentChanged($event)" />
            <app-task-reopening [task]="current" (changed)="assignmentChanged($event)" />
            <div class="detail-tools">
              @if (canMove() && moveDestinations().length) {
                <button #moveTrigger class="button primary" type="button" (click)="openMoveModal()">Mover pendência</button>
              }
              <app-task-editing [task]="current" (changed)="assignmentChanged($event)" />
              @if (current.board) {
                <a class="button tertiary" [routerLink]="['/quadros', current.board.id]">Abrir quadro</a>
              }
            </div>
            <dialog #moveModal class="move-dialog" aria-labelledby="move-title" aria-describedby="move-current"
              [attr.aria-busy]="moving()" (cancel)="cancelMoveModal($event)" (close)="moveModalClosed()">
              <form (submit)="$event.preventDefault(); moveTask()">
                <header>
                  <h2 id="move-title" #moveTitle tabindex="-1">Mover pendência</h2>
                  <button class="icon-button" type="button" aria-label="Fechar movimentação" (click)="closeMoveModal()" [disabled]="moving()"><app-icon name="close" /></button>
                </header>
                <p id="move-current">Coluna atual: <strong>{{ current.column?.title || 'Indisponível' }}</strong></p>
                <fieldset [disabled]="moving() || !canMove()">
                  <legend>Selecione a coluna de destino</legend>
                  @for (column of moveDestinations(); track column.id) {
                    <label class="move-option" [class.selected]="moveColumnId() === column.id">
                      <input type="radio" name="move-destination" [value]="column.id" [checked]="moveColumnId() === column.id"
                        (change)="moveColumnId.set(column.id)" />
                      <span>{{ column.title }}</span>
                    </label>
                  }
                </fieldset>
                @if (moveError()) { <p class="form-error" role="alert">{{ moveError() }}</p> }
                @if (moving()) { <p role="status">Movendo pendência…</p> }
                <footer>
                  <button class="button tertiary" type="button" (click)="closeMoveModal()" [disabled]="moving()">Cancelar</button>
                  <button class="button primary" type="submit" [disabled]="moving() || !canMove() || !moveDestination()">
                    @if (moving()) { Movendo… }
                    @else if (moveDestination(); as destination) { Mover pendência para “{{ destination.title }}” }
                    @else { Mover pendência }
                  </button>
                </footer>
              </form>
            </dialog>
          </section>
        <section class="panel task-comments-panel" aria-label="Comentários da pendência">
          <h2>Comentários</h2>
          @for (comment of comments(); track comment.id) {
            <article class="comment-entry">
              <div class="row">
                <strong>{{ commentAuthorName(comment.author_id) || 'Autor indisponível' }}</strong>
                <span class="small muted">{{ comment.created_at | date: 'dd/MM/yyyy HH:mm' }}</span>
              </div>
              <p>{{ comment.content }}</p>
            </article>
          } @empty {
            <p class="small muted">{{ commentsError() || 'Nenhum comentário registrado.' }}</p>
          }
          <div class="comment-form">
            <label
              >Adicionar comentário
              <textarea
                rows="3"
                [value]="commentText()"
                (input)="commentText.set($any($event.target).value)"
              ></textarea>
            </label>
            @if (commentError()) {
              <p class="form-error" role="alert">{{ commentError() }}</p>
            }
            <button
              class="button primary"
              type="button"
              (click)="submitComment()"
              [disabled]="commenting()"
            >
              {{ commenting() ? 'Enviando…' : 'Comentar' }}
            </button>
          </div>
        </section>
        </div>
        <div class="task-history-slot">
        <aside class="panel task-history-panel" aria-label="Histórico da pendência">
          <h2>Histórico</h2>
          @for (event of visibleHistory(); track event.id) {
            <div class="history-entry">
              <strong>{{ historyContent(event) }}</strong>
              <span class="small">{{ event.actor_display_name?.trim() || 'Autor indisponível' }}</span>
              <span class="small muted">{{ event.created_at | date: 'dd/MM/yyyy HH:mm' }}</span>
            </div>
          } @empty {
            <p class="small muted">{{ historyError() || 'Nenhum evento registrado.' }}</p>
          }
          @if (sortedHistory().length > 4) {
            <button #historyTrigger class="button tertiary history-toggle" type="button"
              aria-haspopup="dialog" (click)="openHistoryModal()">
              Ver histórico completo
            </button>
          }
        </aside>
        </div>
      </div>
      <dialog #historyModal class="move-dialog history-dialog" aria-labelledby="history-title"
        (cancel)="cancelHistoryModal($event)" (close)="restoreHistoryFocus()">
        <header>
          <h2 #historyTitle id="history-title" tabindex="-1">Histórico completo</h2>
          <button class="icon-button" type="button" aria-label="Fechar histórico" (click)="closeHistoryModal()"><app-icon name="close" /></button>
        </header>
        @for (event of sortedHistory(); track event.id) {
          <div class="history-entry">
            <strong>{{ historyContent(event) }}</strong>
            <span class="small">{{ event.actor_display_name?.trim() || 'Autor indisponível' }}</span>
            <span class="small muted">{{ event.created_at | date: 'dd/MM/yyyy HH:mm' }}</span>
          </div>
        }
        <footer><button class="button secondary" type="button" (click)="closeHistoryModal()">Fechar</button></footer>
      </dialog>
    } @else if (result().status === 'unavailable') {
      <section class="panel empty">
        <h1>Pendência não encontrada ou sem acesso</h1>
        <p>Confira o endereço ou volte para suas pendências.</p>
      </section>
    } @else {
      <section class="panel empty">
        <h1>Não foi possível carregar a pendência</h1>
        <p role="alert">Tente novamente em instantes.</p>
        <button type="button" (click)="retry()">Tentar novamente</button>
      </section>
    }
  `,
})
export class TaskDetailPage {
  private readonly service = inject(TasksService);
  private readonly boards = inject(BoardsService);
  private readonly moveBoard = signal<BoardDetail | null>(null);
  private readonly moveAdmin = signal(false);
  readonly moveColumnId = signal('');
  readonly moving = signal(false);
  readonly moveFeedback = signal('');
  readonly moveError = signal('');
  readonly moveModalOpen = signal(false);
  private readonly moveModal = viewChild<ElementRef<HTMLDialogElement>>('moveModal');
  private readonly moveTrigger = viewChild<ElementRef<HTMLButtonElement>>('moveTrigger');
  private readonly moveTitle = viewChild<ElementRef<HTMLElement>>('moveTitle');

  openMoveModal(): void {
    if (!this.canMove() || !this.moveDestinations().length || this.moving()) return;
    this.moveColumnId.set('');
    this.moveError.set('');
    this.moveFeedback.set('');
    this.moveModal()?.nativeElement.showModal();
    this.moveModalOpen.set(true);
    this.moveTitle()?.nativeElement.focus();
  }

  closeMoveModal(): void {
    if (this.moving()) return;
    this.moveModal()?.nativeElement.close();
    this.moveModalClosed();
  }

  cancelMoveModal(event: Event): void {
    event.preventDefault();
    this.closeMoveModal();
  }

  moveModalClosed(): void {
    this.moveModalOpen.set(false);
    this.moveTrigger()?.nativeElement.focus();
  }
  readonly canMove = computed(() => {
    const task = this.task();
    const userId = this.auth.session()?.user.id;
    // Same visibility and movement conditions used by the Kanban; RPC remains authoritative.
    return !!task && !!userId && this.auth.profile()?.id === userId
      && this.auth.profile()?.is_active === true && this.moveBoard()?.id === task.board_id
      && (!task.is_private || this.moveAdmin() || task.assignee_id === userId || task.created_by === userId);
  });
  readonly moveDestinations = computed(() =>
    (this.moveBoard()?.columns ?? []).filter(column => column.id !== this.task()?.column_id));
  readonly moveDestination = computed(() =>
    this.moveDestinations().find(column => column.id === this.moveColumnId()));
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly backTarget = computed(() => {
    // Only accept known Angular navigation origins, never a supplied URL.
    const navigation = this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation();
    const origin: unknown = navigation?.extras.state?.['taskOrigin'];
    if (origin === 'tasks') return { commands: ['/minhas-pendencias'], label: 'Minhas pendências' };
    if (origin === 'home') return { commands: ['/inicio'], label: 'Início' };
    if (origin === 'requests') return { commands: ['/solicitacoes'], label: 'Solicitações' };
    const board = this.task()?.board;
    return board
      ? { commands: ['/quadros', board.id], label: 'Voltar ao quadro' }
      : { commands: ['/minhas-pendencias'], label: 'Minhas pendências' };
  });
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly attempt = signal(0);
  private readonly assignees = signal<BoardAssignee[]>([]);
  readonly history = signal<TaskEvent[]>([]);
  readonly sortedHistory = computed(() => [...this.history()].sort((a, b) =>
    Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id)));
  readonly visibleHistory = computed(() => this.sortedHistory().slice(0, 4));
  private readonly historyModal = viewChild<ElementRef<HTMLDialogElement>>('historyModal');
  private readonly historyTrigger = viewChild<ElementRef<HTMLButtonElement>>('historyTrigger');
  private readonly historyTitle = viewChild<ElementRef<HTMLElement>>('historyTitle');

  openHistoryModal(): void {
    this.historyModal()?.nativeElement.showModal();
    this.historyTitle()?.nativeElement.focus();
  }

  closeHistoryModal(): void {
    this.historyModal()?.nativeElement.close();
    this.restoreHistoryFocus();
  }

  cancelHistoryModal(event: Event): void {
    event.preventDefault();
    this.closeHistoryModal();
  }

  restoreHistoryFocus(): void { this.historyTrigger()?.nativeElement.focus(); }
  readonly comments = signal<TaskComment[]>([]);
  readonly historyError = signal('');
  readonly commentsError = signal('');
  readonly commentText = signal('');
  readonly commentError = signal('');
  readonly commenting = signal(false);
  readonly thirdPartyFormOpen = signal(false);
  readonly thirdPartyExplanation = signal('');
  readonly transitioning = signal(false);
  readonly feedback = signal('');
  readonly assignmentFeedback = signal('');
  readonly actionError = signal('');
  readonly result = signal<TaskResult | { status: 'loading' }>({ status: 'loading' });
  readonly task = computed(() => {
    const result = this.result();
    return result.status === 'loaded' ? result.task : null;
  });
  readonly assigneeName = computed(() => this.nameFor(this.task()?.assignee_id));
  readonly creatorName = computed(() => this.nameFor(this.task()?.created_by));
  readonly action = computed<'accept' | 'start' | 'complete' | 'resume' | null>(() => {
    const task = this.task();
    if (!task || this.auth.session()?.user.id !== task.assignee_id) return null;
    if (task.business_state === 'aguardando_aceite') return 'accept';
    if (task.business_state === 'a_fazer') return 'start';
    if (task.business_state === 'fazendo') return 'complete';
    if (task.business_state === 'aguardando_terceiro') return 'resume';
    return null;
  });
  readonly canWaitForThirdParty = computed(() => {
    const task = this.task();
    return (
      !!task &&
      task.business_state === 'fazendo' &&
      this.auth.session()?.user.id === task.assignee_id
    );
  });
  readonly labels = BUSINESS_STATE_LABELS;

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
      this.moveBoard.set(null);
      this.moveModalOpen.set(false);
      this.moveAdmin.set(false);
      this.moveColumnId.set('');
      this.moveFeedback.set('');
      this.moveError.set('');
      this.assignees.set([]);
      this.history.set([]);
      this.comments.set([]);
      this.historyError.set('');
      this.commentsError.set('');
      this.commentText.set('');
      this.commentError.set('');
      this.thirdPartyFormOpen.set(false);
      this.thirdPartyExplanation.set('');
      this.feedback.set('');
      this.assignmentFeedback.set('');
      this.actionError.set('');
      void this.load(id, () => active && this.auth.session()?.user.id === userId);
    });
  }

  private async load(id: string, isActive: () => boolean): Promise<void> {
    const result = await this.service.getById(id);
    if (!isActive()) return;
    this.result.set(result);
    if (result.status !== 'loaded') return;
    await Promise.all([
      this.loadMoveBoard(result.task.board_id, isActive),
      this.loadAssignees(result.task.board_id, isActive),
      this.loadHistory(result.task.id, isActive),
      this.loadComments(result.task.id, isActive),
    ]);
  }

  private async loadMoveBoard(boardId: string, isActive: () => boolean): Promise<void> {
    try {
      const [result, admin] = await Promise.all([
        this.boards.getById(boardId), this.boards.canManageStructure(boardId),
      ]);
      if (!isActive()) return;
      this.moveBoard.set(result.status === 'loaded' && result.board.id === boardId ? result.board : null);
      this.moveAdmin.set(admin);
      if (result.status === 'error') this.moveError.set('Não foi possível carregar as colunas para movimentação.');
    } catch {
      if (isActive()) this.moveError.set('Não foi possível carregar as colunas para movimentação.');
    }
  }

  async moveTask(): Promise<void> {
    const task = this.task();
    const destination = this.moveDestination();
    if (!task || !destination || !this.canMove() || this.moving()) return;
    const userId = this.auth.session()?.user.id;
    const current = () => this.task()?.id === task.id && this.auth.session()?.user.id === userId;
    this.moving.set(true);
    this.moveError.set('');
    this.moveFeedback.set('');
    let moved = false;
    try {
      await this.service.moveToColumn(task.id, destination.id);
      moved = true;
      if (!current()) return;
      this.moveFeedback.set(`Pendência movida para "${destination.title}".`);
      this.moveColumnId.set('');
      const refreshed = await this.service.getById(task.id);
      if (!current()) return;
      this.result.set(refreshed);
      if (refreshed.status === 'loaded') await this.loadHistory(task.id, current);
      else if (refreshed.status === 'error') this.moveError.set('Movimentação salva, mas não foi possível recarregar o detalhe. Tente novamente.');
    } catch {
      if (current()) {
        this.moveError.set(moved
          ? 'Movimentação salva, mas não foi possível recarregar o detalhe. Tente novamente.'
          : 'Não foi possível mover a pendência. Atualize os dados e tente novamente.');
        if (moved) this.result.set({ status: 'error' });
      }
    } finally {
      this.moving.set(false);
      if (moved) this.closeMoveModal();
    }
  }

  private async loadAssignees(boardId: string, isActive: () => boolean): Promise<void> {
    try {
      const assignees = await this.service.listAssignees(boardId);
      if (isActive()) this.assignees.set(assignees);
    } catch {
      // Related names are cosmetic and must not broaden access or hide the task.
    }
  }

  private async loadHistory(taskId: string, isActive: () => boolean = () => true): Promise<void> {
    const userId = this.auth.session()?.user.id;
    const current = () =>
      isActive() && this.task()?.id === taskId && this.auth.session()?.user.id === userId;
    try {
      const history = await this.service.listHistory(taskId);
      if (current()) {
        this.history.set(history);
        this.historyError.set('');
      }
    } catch {
      if (current()) {
        this.history.set([]);
        this.historyError.set('Histórico indisponível.');
      }
    }
  }

  private async loadComments(taskId: string, isActive: () => boolean = () => true): Promise<void> {
    try {
      const comments = await this.service.listComments(taskId);
      if (isActive()) {
        this.comments.set(comments);
        this.commentsError.set('');
      }
    } catch {
      if (isActive()) this.commentsError.set('Comentários indisponíveis.');
    }
  }

  private nameFor(id: string | null | undefined): string {
    if (!id) return '';
    if (this.auth.profile()?.id === id) return this.auth.displayName();
    return (
      this.assignees()
        .find((person) => person.id === id)
        ?.display_name?.trim() || ''
    );
  }

  commentAuthorName(id: string): string {
    return this.nameFor(id);
  }

  historyContent(event: TaskEvent): string {
    const details = event.details;
    const previous = this.localDateTime(details?.['previous_due_at']);
    const requested = this.localDateTime(details?.['requested_due_at']);
    const next = this.localDateTime(details?.['new_due_at']);
    const reason = typeof details?.['justification'] === 'string'
      ? details['justification'].trim()
      : '';

    if (event.event_type === 'postponement_requested' && previous && requested && reason) {
      return `Adiamento solicitado de ${previous} para ${requested}. Motivo: ${reason}.`;
    }
    if (event.event_type === 'postponement_approved' && previous && next) {
      const requester = event.content.match(/^Adiamento solicitado por (.*?) aprovado:/)?.[1];
      return `${requester ? `Adiamento solicitado por ${requester} aprovado` : 'Adiamento aprovado'}: prazo de ${previous} para ${next}.`;
    }
    if (event.event_type === 'postponement_rejected' && previous && reason) {
      const requester = event.content.match(/^Adiamento solicitado por (.*?) recusado\./)?.[1];
      return `${requester ? `Adiamento solicitado por ${requester} recusado` : 'Adiamento recusado'} (prazo mantido em ${previous}). Motivo: ${reason}.`;
    }
    if (event.event_type === 'due_at_changed' && previous && next && reason) {
      return `Prazo alterado diretamente de ${previous} para ${next}. Motivo: ${reason}.`;
    }
    return event.content;
  }

  private localDateTime(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const local = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(date);
    return local.replace(', ', ' às ');
  }

  actionLabel(action: 'accept' | 'start' | 'complete' | 'resume'): string {
    return {
      accept: 'Aceitar pendência',
      start: 'Iniciar pendência',
      complete: 'Concluir pendência',
      resume: 'Retomar pendência',
    }[action];
  }

  async submitComment(): Promise<void> {
    const task = this.task();
    const content = this.commentText().trim();
    if (!task || this.commenting()) return;
    if (!content) {
      this.commentError.set('Escreva um comentário.');
      return;
    }
    this.commenting.set(true);
    this.commentError.set('');
    try {
      await this.service.addComment(task.id, content);
      await this.loadComments(task.id);
      this.commentText.set('');
    } catch {
      this.commentError.set('Não foi possível adicionar o comentário. Tente novamente.');
    } finally {
      this.commenting.set(false);
    }
  }

  async runAction(): Promise<void> {
    const task = this.task();
    const action = this.action();
    if (!task || !action || this.transitioning()) return;
    this.transitioning.set(true);
    this.feedback.set('');
    this.actionError.set('');
    try {
      if (action === 'accept') await this.service.accept(task.id);
      else if (action === 'start') await this.service.start(task.id);
      else if (action === 'complete') await this.service.complete(task.id);
      else await this.service.resume(task.id);

      await this.refreshTaskContent(task.id);
      this.feedback.set(
        action === 'complete'
          ? 'Pendência concluída com sucesso.'
          : 'Pendência atualizada com sucesso.',
      );
    } catch {
      this.actionError.set('Não foi possível atualizar a pendência. Tente novamente.');
    } finally {
      this.transitioning.set(false);
    }
  }

  async waitForThirdParty(): Promise<void> {
    const task = this.task();
    const content = this.thirdPartyExplanation().trim();
    if (!task || !this.canWaitForThirdParty() || this.transitioning()) return;
    if (!content) {
      this.actionError.set('Descreva a dependência externa.');
      return;
    }
    this.transitioning.set(true);
    this.feedback.set('');
    this.actionError.set('');
    try {
      await this.service.waitForThirdParty(task.id, content);
      await this.refreshTaskContent(task.id);
      this.thirdPartyExplanation.set('');
      this.thirdPartyFormOpen.set(false);
      this.feedback.set('Pendência marcada como aguardando terceiro.');
    } catch {
      this.actionError.set('Não foi possível colocar a pendência em espera. Tente novamente.');
    } finally {
      this.transitioning.set(false);
    }
  }

  closeThirdPartyForm(): void {
    if (!this.transitioning()) {
      this.thirdPartyFormOpen.set(false);
      this.thirdPartyExplanation.set('');
      this.actionError.set('');
    }
  }

  private async refreshTaskContent(taskId: string): Promise<void> {
    const refreshed = await this.service.getById(taskId);
    if (refreshed.status !== 'loaded') throw new Error();
    this.result.set(refreshed);
    await Promise.all([this.loadHistory(taskId), this.loadComments(taskId)]);
  }

  retry(): void {
    this.attempt.update((attempt) => attempt + 1);
  }

  async assignmentChanged(message: string): Promise<void> {
    const id = this.task()?.id;
    const userId = this.auth.session()?.user.id;
    if (!id) return;
    this.assignmentFeedback.set(message);
    const refreshed = await this.service.getById(id);
    if (this.task()?.id !== id || this.auth.session()?.user.id !== userId) return;
    this.result.set(refreshed);
    if (refreshed.status === 'loaded') await this.loadHistory(id);
  }
}
