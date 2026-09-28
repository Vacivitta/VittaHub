import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeading } from '../../shared/page-heading';
import { BUSINESS_STATE_LABELS } from '../boards/board-detail';
import { BoardAssignee, TaskEvent, TaskResult } from './task-detail';
import { TasksService } from './tasks.service';

@Component({
  imports: [RouterLink, PageHeading, DatePipe],
  template: `
    <a class="back-link" routerLink="/minhas-pendencias">← Minhas pendências</a>
    @if (result().status === 'loading') {
      <div class="panel empty" role="status">Carregando pendência…</div>
    } @else if (task(); as current) {
      <app-page-heading
        [title]="current.title"
        [description]="current.description || 'Sem descrição.'"
        eyebrow="Detalhe da pendência"
      />
      <section class="panel task-detail-panel">
        <dl class="task-detail-grid">
          <div><dt>Estado</dt><dd><span class="badge">{{ labels[current.business_state] }}</span></dd></div>
          <div><dt>Privacidade</dt><dd>{{ current.is_private ? 'Privada' : 'Compartilhada' }}</dd></div>
          <div><dt>Responsável</dt><dd>{{ assigneeName() || 'Nome indisponível' }}</dd></div>
          <div><dt>Prazo</dt><dd>{{ current.due_at | date:'dd/MM/yyyy HH:mm' }}</dd></div>
          <div><dt>Quadro</dt><dd>{{ current.board?.title || 'Indisponível' }}</dd></div>
          <div><dt>Coluna</dt><dd>{{ current.column?.title || 'Indisponível' }}</dd></div>
          <div><dt>Criada em</dt><dd>{{ current.created_at | date:'dd/MM/yyyy HH:mm' }}</dd></div>
          @if (current.accepted_at) { <div><dt>Aceita em</dt><dd>{{ current.accepted_at | date:'dd/MM/yyyy HH:mm' }}</dd></div> }
          @if (current.completed_at) { <div><dt>Concluída em</dt><dd>{{ current.completed_at | date:'dd/MM/yyyy HH:mm' }}</dd></div> }
          @if (creatorName()) { <div><dt>Criador</dt><dd>{{ creatorName() }}</dd></div> }
        </dl>
        @if (action(); as currentAction) {
          <div class="task-action">
            <button class="button primary" type="button" (click)="runAction()" [disabled]="transitioning()">
              {{ transitioning() ? 'Atualizando…' : actionLabel(currentAction) }}
            </button>
          </div>
        }
        @if (feedback()) { <p class="action-feedback" role="status">{{ feedback() }}</p> }
        @if (actionError()) { <p class="form-error" role="alert">{{ actionError() }}</p> }
        @if (current.board) {
          <a class="button" [routerLink]="['/quadros', current.board.id]">Abrir quadro</a>
        }
      </section>
      <section class="panel task-history-panel" aria-label="Histórico da pendência">
        <h2>Histórico</h2>
        @for (event of history(); track event.id) {
          <div class="history-entry">
            <strong>{{ event.content }}</strong>
            <span class="small muted">{{ event.created_at | date:'dd/MM/yyyy HH:mm' }}</span>
          </div>
        } @empty {
          <p class="small muted">{{ historyError() || 'Nenhum evento registrado.' }}</p>
        }
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
  readonly historyError = signal('');
  readonly transitioning = signal(false);
  readonly feedback = signal('');
  readonly actionError = signal('');
  readonly result = signal<TaskResult | { status: 'loading' }>({ status: 'loading' });
  readonly task = computed(() => {
    const result = this.result();
    return result.status === 'loaded' ? result.task : null;
  });
  readonly assigneeName = computed(() => this.nameFor(this.task()?.assignee_id));
  readonly creatorName = computed(() => this.nameFor(this.task()?.created_by));
  readonly action = computed<'accept' | 'start' | 'complete' | null>(() => {
    const task = this.task();
    if (!task || this.auth.session()?.user.id !== task.assignee_id) return null;
    if (task.business_state === 'aguardando_aceite') return 'accept';
    if (task.business_state === 'a_fazer') return 'start';
    if (task.business_state === 'fazendo') return 'complete';
    return null;
  });
  readonly labels = BUSINESS_STATE_LABELS;

  constructor() {
    effect((onCleanup) => {
      const id = this.params()?.get('id') ?? '';
      this.attempt();
      let active = true;
      onCleanup(() => { active = false; });
      this.result.set({ status: 'loading' });
      this.assignees.set([]);
      this.history.set([]);
      this.historyError.set('');
      this.feedback.set('');
      this.actionError.set('');
      void this.load(id, () => active);
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
    try {
      const history = await this.service.listHistory(taskId);
      if (isActive()) {
        this.history.set(history);
        this.historyError.set('');
      }
    } catch {
      if (isActive()) this.historyError.set('Histórico indisponível.');
    }
  }

  private nameFor(id: string | undefined): string {
    if (!id) return '';
    if (this.auth.profile()?.id === id) return this.auth.displayName();
    return this.assignees().find((person) => person.id === id)?.display_name?.trim() || '';
  }

  actionLabel(action: 'accept' | 'start' | 'complete'): string {
    return { accept: 'Aceitar pendência', start: 'Iniciar pendência', complete: 'Concluir pendência' }[action];
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
      else await this.service.complete(task.id);

      const refreshed = await this.service.getById(task.id);
      if (refreshed.status !== 'loaded') throw new Error();
      this.result.set(refreshed);
      await this.loadHistory(task.id);
      this.feedback.set(action === 'complete'
        ? 'Pendência concluída com sucesso.'
        : 'Pendência atualizada com sucesso.');
    } catch {
      this.actionError.set('Não foi possível atualizar a pendência. Tente novamente.');
    } finally {
      this.transitioning.set(false);
    }
  }

  retry(): void {
    this.attempt.update((attempt) => attempt + 1);
  }
}
