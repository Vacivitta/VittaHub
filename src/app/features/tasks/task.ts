import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeading } from '../../shared/page-heading';
import { BUSINESS_STATE_LABELS } from '../boards/board-detail';
import { BoardAssignee, TaskComment, TaskEvent, TaskResult } from './task-detail';
import { TasksService } from './tasks.service';
import { Icon } from '../../shared/icon';
import { TaskAssignmentActions } from './task-assignment-actions';

@Component({
  imports: [RouterLink, PageHeading, DatePipe, Icon, TaskAssignmentActions],
  template: `
    <a class="back-link" routerLink="/minhas-pendencias"
      ><app-icon name="arrow-left" /> Minhas pendências</a
    >
    @if (assignmentFeedback()) { <p role="status">{{ assignmentFeedback() }}</p> }
    @if (result().status === 'loading') {
      <div class="panel empty" role="status">Carregando pendência…</div>
    } @else if (task(); as current) {
      <app-page-heading
        [title]="current.title"
        [description]="current.description || 'Sem descrição.'"
        eyebrow="Detalhe da pendência"
      />
      <div class="task-detail-layout">
        <div>
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
              @if (current.board) {
                <a class="button tertiary" [routerLink]="['/quadros', current.board.id]"
                  >Abrir quadro</a
                >
              }
            </div>
            <app-task-assignment-actions [task]="current" (changed)="assignmentChanged($event)" />
          </section>
        </div>
        <aside class="panel task-history-panel" aria-label="Histórico da pendência">
          <h2>Histórico</h2>
          @for (event of history(); track event.id) {
            <div class="history-entry">
              <strong>{{ historyContent(event) }}</strong>
              <span class="small">{{
                event.actor_display_name?.trim() || 'Autor indisponível'
              }}</span>
              <span class="small muted">{{ event.created_at | date: 'dd/MM/yyyy HH:mm' }}</span>
            </div>
          } @empty {
            <p class="small muted">{{ historyError() || 'Nenhum evento registrado.' }}</p>
          }
        </aside>
      </div>
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
  private readonly auth = inject(AuthService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly attempt = signal(0);
  private readonly assignees = signal<BoardAssignee[]>([]);
  readonly history = signal<TaskEvent[]>([]);
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
      this.loadAssignees(result.task.board_id, isActive),
      this.loadHistory(result.task.id, isActive),
      this.loadComments(result.task.id, isActive),
    ]);
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
