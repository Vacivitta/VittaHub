import { Component, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { TaskDetail } from './task-detail';
import { TasksService } from './tasks.service';

@Component({
  selector: 'app-task-editing',
  styles: `
    :host { display: block; margin-top: 1rem; }
    dialog { width: min(32rem, calc(100vw - 2rem)); box-sizing: border-box; max-height: 85vh;
      overflow: auto; border: 1px solid #cbd5e1; border-radius: 1rem; padding: 1.5rem; }
    dialog::backdrop { background: #0f172a88; }
    form, label { display: grid; gap: .75rem; }
    input, textarea, select { width: 100%; box-sizing: border-box; }
  `,
  template: `
    @if (permissionLoading()) {
      <p role="status">Verificando permissão de edição…</p>
    }
    @if (permissionError()) {
      <p role="alert">{{ permissionError() }}</p>
      <button type="button" (click)="retryPermission()">Tentar verificar edição novamente</button>
    }
    @if (allowed()) {
      <button type="button" (click)="open()" [disabled]="busy()">Editar pendência</button>
    }
    <dialog #modal aria-labelledby="edit-task-title" (cancel)="cancel($event)">
      <form (submit)="$event.preventDefault(); submit()">
        <h2 id="edit-task-title">Editar pendência</h2>
        <label>Título
          <input required [value]="title()" (input)="title.set($any($event.target).value)" [disabled]="busy()" />
        </label>
        <label>Descrição
          <textarea rows="4" [value]="description()" (input)="description.set($any($event.target).value)" [disabled]="busy()"></textarea>
        </label>
        <label>Privacidade
          <select [value]="isPrivate() ? 'private' : 'shared'"
            (change)="isPrivate.set($any($event.target).value === 'private')" [disabled]="busy()">
            <option value="shared">Compartilhada</option>
            <option value="private">Privada</option>
          </select>
        </label>
        @if (error()) { <p role="alert">{{ error() }}</p> }
        <div class="row">
          <button type="submit" [disabled]="busy() || !title().trim()">{{ busy() ? 'Salvando…' : 'Salvar alterações' }}</button>
          <button type="button" (click)="close()" [disabled]="busy()">Cancelar</button>
        </div>
      </form>
    </dialog>
  `,
})
export class TaskEditing {
  readonly task = input.required<TaskDetail>();
  readonly changed = output<string>();
  readonly allowed = signal(false);
  readonly permissionLoading = signal(false);
  readonly permissionError = signal('');
  private readonly permissionAttempt = signal(0);
  readonly busy = signal(false);
  readonly title = signal('');
  readonly description = signal('');
  readonly isPrivate = signal(false);
  readonly error = signal('');
  private readonly modal = viewChild<ElementRef<HTMLDialogElement>>('modal');
  private readonly service = inject(TasksService);
  private readonly auth = inject(AuthService);

  constructor() {
    effect((cleanup) => {
      const task = this.task();
      const userId = this.auth.session()?.user.id;
      this.permissionAttempt();
      let active = true;
      cleanup(() => { active = false; });
      this.allowed.set(false);
      this.permissionLoading.set(false);
      this.permissionError.set('');
      this.modal()?.nativeElement.close();
      if (userId && task.business_state !== 'concluido') {
        this.permissionLoading.set(true);
        void this.service.canEdit(task.id).then((allowed) => {
          if (active) this.allowed.set(allowed);
        }).catch(() => {
          if (active) this.permissionError.set('Não foi possível verificar a permissão de edição. Tente novamente.');
        }).finally(() => {
          if (active) this.permissionLoading.set(false);
        });
      }
    });
  }

  retryPermission(): void { this.permissionAttempt.update((attempt) => attempt + 1); }

  open(): void {
    if (!this.allowed() || this.busy()) return;
    const task = this.task();
    this.title.set(task.title);
    this.description.set(task.description ?? '');
    this.isPrivate.set(task.is_private);
    this.error.set('');
    this.modal()?.nativeElement.showModal();
  }

  close(): void { if (!this.busy()) this.modal()?.nativeElement.close(); }
  cancel(event: Event): void { if (this.busy()) event.preventDefault(); }

  async submit(): Promise<void> {
    if (!this.allowed() || this.busy()) return;
    if (!this.title().trim()) { this.error.set('Informe o título da pendência.'); return; }
    const taskId = this.task().id;
    const userId = this.auth.session()?.user.id;
    this.busy.set(true);
    this.error.set('');
    try {
      const edited = await this.service.edit(taskId, this.title(), this.description(), this.isPrivate());
      if (this.task().id !== taskId || this.auth.session()?.user.id !== userId) return;
      this.modal()?.nativeElement.close();
      this.changed.emit(edited ? 'Pendência editada com sucesso.' : 'Nenhuma alteração para salvar.');
    } catch {
      if (this.task().id === taskId && this.auth.session()?.user.id === userId)
        this.error.set('Não foi possível editar. Atualize a pendência e confira sua permissão e os dados.');
    } finally { this.busy.set(false); }
  }
}
