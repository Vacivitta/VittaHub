import { Component, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { TaskDetail } from './task-detail';
import { TasksService } from './tasks.service';

@Component({
  selector: 'app-task-reopening',
  styles: `
    :host { display: block; margin-top: 1rem; }
    dialog { width: min(32rem, calc(100vw - 2rem)); box-sizing: border-box; max-height: 85vh;
      overflow: auto; border: 1px solid #cbd5e1; border-radius: 1rem; padding: 1.5rem; }
    dialog::backdrop { background: #0f172a88; }
    form, label { display: grid; gap: .75rem; }
    textarea { width: 100%; box-sizing: border-box; }
  `,
  template: `
    @if (allowed()) {
      <button type="button" (click)="open()" [disabled]="busy()">Reabrir pendência</button>
    }
    <dialog #modal aria-labelledby="reopen-title" (cancel)="cancel($event)">
      <form (submit)="$event.preventDefault(); submit()">
        <h2 id="reopen-title">Reabrir pendência</h2>
        <label>Justificativa obrigatória
          <textarea required rows="4" [value]="reason()"
            (input)="reason.set($any($event.target).value)" [disabled]="busy()"></textarea>
        </label>
        @if (error()) { <p role="alert">{{ error() }}</p> }
        <div class="row">
          <button type="submit" [disabled]="busy() || !reason().trim()">
            {{ busy() ? 'Reabrindo…' : 'Confirmar reabertura' }}
          </button>
          <button type="button" (click)="close()" [disabled]="busy()">Cancelar</button>
        </div>
      </form>
    </dialog>
  `,
})
export class TaskReopening {
  readonly task = input.required<TaskDetail>();
  readonly changed = output<string>();
  readonly allowed = signal(false);
  readonly busy = signal(false);
  readonly reason = signal('');
  readonly error = signal('');
  private readonly modal = viewChild<ElementRef<HTMLDialogElement>>('modal');
  private readonly service = inject(TasksService);
  private readonly auth = inject(AuthService);

  constructor() {
    effect((cleanup) => {
      const task = this.task();
      const userId = this.auth.session()?.user.id;
      let active = true;
      cleanup(() => { active = false; });
      this.allowed.set(false);
      this.modal()?.nativeElement.close();
      if (userId && task.business_state === 'concluido') {
        void this.service.canReopen(task.id).then((allowed) => {
          if (active) this.allowed.set(allowed);
        }).catch(() => { /* Fail closed; retry by refreshing the detail. */ });
      }
    });
  }

  open(): void {
    if (!this.allowed() || this.busy()) return;
    this.reason.set('');
    this.error.set('');
    this.modal()?.nativeElement.showModal();
  }

  close(): void { if (!this.busy()) this.modal()?.nativeElement.close(); }
  cancel(event: Event): void { if (this.busy()) event.preventDefault(); }

  async submit(): Promise<void> {
    if (!this.allowed() || this.busy()) return;
    const reason = this.reason().trim();
    if (!reason) { this.error.set('Informe a justificativa da reabertura.'); return; }
    const taskId = this.task().id;
    const userId = this.auth.session()?.user.id;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.service.reopen(taskId, reason);
      if (this.task().id !== taskId || this.auth.session()?.user.id !== userId) return;
      this.allowed.set(false);
      this.modal()?.nativeElement.close();
      this.changed.emit('Pendência reaberta com sucesso.');
    } catch {
      if (this.task().id === taskId && this.auth.session()?.user.id === userId)
        this.error.set('Não foi possível reabrir. Atualize a pendência e confira sua permissão e se o responsável está ativo no quadro.');
    } finally { this.busy.set(false); }
  }
}
