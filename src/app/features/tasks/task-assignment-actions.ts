import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import {
  BoardAssignee,
  TaskAssignmentCapabilities,
  TaskDetail,
  TaskPostponementRequest,
} from './task-detail';
import { TasksService } from './tasks.service';

type AssignmentAction = 'accept' | 'refuse' | 'reassign' | 'request' | 'approve' | 'reject' | 'deadline';

@Component({
  selector: 'app-task-assignment-actions',
  imports: [DatePipe],
  styles: `
    :host {
      display: block;
      margin-top: 1rem;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    dialog {
      width: min(32rem, calc(100vw - 2rem));
      max-height: 85vh;
      overflow: auto;
      border: 1px solid #cbd5e1;
      border-radius: 1rem;
      padding: 1.5rem;
    }
    dialog::backdrop {
      background: #0f172a88;
    }
    form,
    label {
      display: grid;
      gap: 0.75rem;
    }
    input,
    textarea,
    select {
      width: 100%;
      box-sizing: border-box;
    }
    .request {
      margin: 1rem 0;
      overflow-wrap: anywhere;
    }
  `,
  template: `
    @if (context() === 'detail' && task().awaiting_reassignment) {
      <p role="status"><strong>Aguardando reatribuição</strong> — sem responsável ativo.</p>
    }
    @if (context() === 'detail' && pending(); as request) {
      <div class="request">
        <strong>Adiamento aguardando decisão</strong>
        <p>Prazo solicitado: {{ request.requested_due_at | date: 'dd/MM/yyyy HH:mm' }}</p>
        <p>{{ request.justification }}</p>
        <p>O prazo atual permanece válido até a aprovação.</p>
      </div>
    }
    <div class="actions">
      @if (context() === 'acceptance' && canRefuse()) {
        <button type="button" (click)="accept()" [disabled]="busy()">Aceitar pendência</button>
      }
      @if (canRefuse() && (context() === 'detail' || context() === 'acceptance')) {
        <button type="button" (click)="open('refuse')" [disabled]="busy()">
          Recusar atribuição
        </button>
      }
      @if (canReassign() && (context() === 'detail' || context() === 'reassignment')) {
        <button type="button" (click)="open('reassign')" [disabled]="busy()">
          Reatribuir pendência
        </button>
      }
      @if (canRequest() && context() === 'detail') {
        <button type="button" (click)="open('request')" [disabled]="busy()">
          Solicitar adiamento
        </button>
      }
      @if (canDecide() && (context() === 'detail' || context() === 'postponement')) {
        <button type="button" (click)="open('approve')" [disabled]="busy()">
          Aprovar adiamento
        </button>
        <button type="button" (click)="open('reject')" [disabled]="busy()">
          Recusar adiamento
        </button>
      }
      @if (context() === 'detail' && active() && capabilities()?.can_change_due_at) {
        <button type="button" (click)="open('deadline')" [disabled]="busy()">
          Alterar prazo diretamente
        </button>
      }
    </div>
    @if (loadError()) {
      <p role="alert">
        {{ loadError() }} <button type="button" (click)="reload()">Tentar novamente</button>
      </p>
    }
    @if (context() === 'detail' && feedback()) {
      <p role="status">{{ feedback() }}</p>
    }
    @if (mode() === 'accept' && error()) { <p role="alert">{{ error() }}</p> }
    <dialog #dialog [attr.aria-labelledby]="'assignment-action-title-' + task().id" (cancel)="cancel($event)">
      <h2 [id]="'assignment-action-title-' + task().id">{{ actionTitle() }}</h2>
      <form (submit)="$event.preventDefault(); submit()">
        @if (mode() === 'reassign') {
          <label
            >Novo responsável
            <select
              required
              [value]="assigneeId()"
              (change)="assigneeId.set($any($event.target).value)"
            >
              <option value="">Selecione um participante ativo</option>
              @for (person of assignees(); track person.id) {
                <option [value]="person.id">
                  {{ person.display_name || 'Participante sem nome' }}
                </option>
              }
            </select>
          </label>
        }
        @if (mode() === 'request' || mode() === 'deadline') {
          <label
            >Novo prazo
            <input
              type="datetime-local"
              required
              [value]="dueAt()"
              (input)="dueAt.set($any($event.target).value)"
          /></label>
        }
        @if (mode() !== 'reassign' && mode() !== 'approve') {
          <label
            >Justificativa
            <textarea
              rows="3"
              required
              [value]="justification()"
              (input)="justification.set($any($event.target).value)"
            ></textarea>
          </label>
        }
        @if (mode() === 'approve') {
          <p>
            Confirmar o prazo solicitado:
            {{ pending()?.requested_due_at | date: 'dd/MM/yyyy HH:mm' }}?
          </p>
        }
        @if (error()) {
          <p role="alert">{{ error() }}</p>
        }
        <div class="actions">
          <button type="submit" class="button primary" [disabled]="busy()">
            {{ busy() ? 'Salvando…' : 'Confirmar' }}
          </button>
          <button type="button" (click)="close()" [disabled]="busy()">Cancelar</button>
        </div>
      </form>
    </dialog>
  `,
})
export class TaskAssignmentActions {
  readonly task = input.required<TaskDetail>();
  readonly context = input<'detail' | 'acceptance' | 'postponement' | 'reassignment'>('detail');
  readonly changed = output<string>();
  private readonly service = inject(TasksService);
  private readonly auth = inject(AuthService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly attempt = signal(0);
  readonly capabilities = signal<TaskAssignmentCapabilities | null>(null);
  readonly requests = signal<TaskPostponementRequest[]>([]);
  readonly assignees = signal<BoardAssignee[]>([]);
  readonly mode = signal<AssignmentAction | null>(null);
  readonly justification = signal('');
  readonly dueAt = signal('');
  readonly assigneeId = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly loadError = signal('');
  readonly feedback = signal('');
  readonly active = computed(
    () =>
      this.auth.profile()?.is_active === true &&
      this.auth.profile()?.id === this.auth.session()?.user.id,
  );
  readonly pending = computed(() => this.requests().find((r) => r.status === 'pending'));
  readonly isAssignee = computed(
    () =>
      this.active() &&
      this.task().assignee_id === this.auth.session()?.user.id &&
      !this.task().awaiting_reassignment,
  );
  readonly canRefuse = computed(
    () => this.isAssignee() && this.task().business_state === 'aguardando_aceite',
  );
  readonly canReassign = computed(
    () =>
      this.active() &&
      this.task().awaiting_reassignment &&
      this.capabilities()?.can_manage === true,
  );
  readonly canRequest = computed(
    () =>
      this.isAssignee() &&
      !this.loadError() &&
      this.capabilities() !== null &&
      !this.pending() &&
      ['a_fazer', 'fazendo', 'aguardando_terceiro'].includes(this.task().business_state),
  );
  readonly canDecide = computed(
    () =>
      this.active() &&
      this.capabilities()?.can_manage === true &&
      !!this.pending() &&
      this.pending()?.requested_by !== this.auth.session()?.user.id,
  );
  readonly actionTitle = computed(
    () =>
      ({
        accept: 'Aceitar pendência',
        refuse: 'Recusar atribuição',
        reassign: 'Reatribuir pendência',
        request: 'Solicitar adiamento',
        approve: 'Aprovar adiamento',
        reject: 'Recusar adiamento',
        deadline: 'Alterar prazo diretamente',
      })[this.mode() ?? 'refuse'],
  );

  constructor() {
    effect((onCleanup) => {
      const task = this.task();
      const userId = this.auth.session()?.user.id;
      this.attempt();
      let current = true;
      onCleanup(() => {
        current = false;
      });
      this.capabilities.set(null);
      this.requests.set([]);
      this.assignees.set([]);
      this.loadError.set('');
      const dialog = untracked(() => this.dialog()?.nativeElement);
      if (dialog?.open) dialog.close();
      this.mode.set(null);
      void this.load(task, () => current && this.auth.session()?.user.id === userId);
    });
  }

  private async load(task: TaskDetail, current: () => boolean): Promise<void> {
    try {
      const [capabilities, requests] = await Promise.all([
        this.service.assignmentCapabilities(task.id),
        this.service.listPostponements(task.id),
      ]);
      if (!current()) return;
      this.capabilities.set(capabilities);
      this.requests.set(requests);
      if (task.awaiting_reassignment && capabilities?.can_manage) {
        const people = await this.service.listAssignees(task.board_id);
        if (current()) this.assignees.set(people);
      }
    } catch {
      if (current())
        this.loadError.set('Não foi possível carregar as ações de atribuição e adiamento.');
    }
  }

  reload(): void {
    this.attempt.update((n) => n + 1);
  }

  open(mode: AssignmentAction): void {
    if (this.busy()) return;
    this.mode.set(mode);
    this.justification.set('');
    this.dueAt.set('');
    this.assigneeId.set('');
    this.error.set('');
    this.feedback.set('');
    this.dialog()?.nativeElement.showModal();
  }

  async accept(): Promise<void> {
    if (this.busy()) return;
    this.mode.set('accept');
    await this.submit();
  }

  cancel(event: Event): void {
    if (this.busy()) event.preventDefault();
    else this.mode.set(null);
  }
  close(): void {
    if (!this.busy()) {
      this.dialog()?.nativeElement.close();
      this.mode.set(null);
    }
  }

  async submit(): Promise<void> {
    const mode = this.mode();
    const task = this.task();
    const userId = this.auth.session()?.user.id;
    if (!mode || this.busy()) return;
    const allowed =
      mode === 'refuse' || mode === 'accept'
        ? this.canRefuse()
        : mode === 'reassign'
          ? this.canReassign()
          : mode === 'request'
            ? this.canRequest()
            : mode === 'deadline'
              ? this.active() && this.capabilities()?.can_change_due_at
              : this.canDecide();
    if (!allowed) {
      this.error.set('Ação indisponível. Atualize a pendência.');
      return;
    }
    const reason = this.justification().trim();
    if (!['reassign', 'approve', 'accept'].includes(mode) && !reason) {
      this.error.set('Informe uma justificativa.');
      return;
    }
    if (mode === 'reassign' && !this.assigneeId()) {
      this.error.set('Selecione um responsável.');
      return;
    }
    const date = new Date(this.dueAt());
    if (
      ['request', 'deadline'].includes(mode) &&
      (!this.dueAt() ||
        !Number.isFinite(date.getTime()) ||
        (mode === 'request' && date.getTime() <= new Date(task.due_at).getTime()))
    ) {
      this.error.set(
        mode === 'request' ? 'Informe um prazo posterior ao atual.' : 'Informe um prazo válido.',
      );
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      if (mode === 'accept') await this.service.accept(task.id);
      else if (mode === 'refuse') await this.service.refuseAssignment(task.id, reason);
      else if (mode === 'reassign') await this.service.reassign(task.id, this.assigneeId());
      else if (mode === 'request')
        await this.service.requestPostponement(task.id, date.toISOString(), reason);
      else if (mode === 'deadline')
        await this.service.changeDueAt(task.id, date.toISOString(), reason);
      else
        await this.service.decidePostponement(
          task.id,
          this.pending()!.id,
          mode === 'approve',
          reason,
        );
      if (this.task().id !== task.id || this.auth.session()?.user.id !== userId) return;
      this.dialog()?.nativeElement.close();
      this.mode.set(null);
      this.feedback.set('Ação registrada com sucesso.');
      this.changed.emit(
        mode === 'refuse'
          ? 'Atribuição recusada com sucesso. A pendência aguarda reatribuição.'
          : 'Ação registrada com sucesso.',
      );
      this.reload();
    } catch {
      if (this.task().id === task.id && this.auth.session()?.user.id === userId)
        this.error.set(
          'Não foi possível executar a ação. Confira os dados e atualize a pendência.',
        );
    } finally {
      this.busy.set(false);
    }
  }
}
