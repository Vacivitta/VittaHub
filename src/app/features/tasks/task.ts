import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeading } from '../../shared/page-heading';
import { BUSINESS_STATE_LABELS } from '../boards/board-detail';
import { BoardAssignee, TaskResult } from './task-detail';
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
          @if (creatorName()) { <div><dt>Criador</dt><dd>{{ creatorName() }}</dd></div> }
        </dl>
        @if (current.board) {
          <a class="button" [routerLink]="['/quadros', current.board.id]">Abrir quadro</a>
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
  readonly result = signal<TaskResult | { status: 'loading' }>({ status: 'loading' });
  readonly task = computed(() => {
    const result = this.result();
    return result.status === 'loaded' ? result.task : null;
  });
  readonly assigneeName = computed(() => this.nameFor(this.task()?.assignee_id));
  readonly creatorName = computed(() => this.nameFor(this.task()?.created_by));
  readonly labels = BUSINESS_STATE_LABELS;

  constructor() {
    effect((onCleanup) => {
      const id = this.params()?.get('id') ?? '';
      this.attempt();
      let active = true;
      onCleanup(() => { active = false; });
      this.result.set({ status: 'loading' });
      this.assignees.set([]);
      void this.load(id, () => active);
    });
  }

  private async load(id: string, isActive: () => boolean): Promise<void> {
    const result = await this.service.getById(id);
    if (!isActive()) return;
    this.result.set(result);
    if (result.status !== 'loaded') return;
    try {
      const assignees = await this.service.listAssignees(result.task.board_id);
      if (isActive()) this.assignees.set(assignees);
    } catch {
      // Related names are cosmetic and must not broaden access or hide the task.
    }
  }

  private nameFor(id: string | undefined): string {
    if (!id) return '';
    if (this.auth.profile()?.id === id) return this.auth.displayName();
    return this.assignees().find((person) => person.id === id)?.display_name?.trim() || '';
  }

  retry(): void {
    this.attempt.update((attempt) => attempt + 1);
  }
}
