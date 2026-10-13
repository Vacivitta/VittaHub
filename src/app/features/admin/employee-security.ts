import { afterNextRender, ChangeDetectorRef, Component, DestroyRef, effect, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Icon } from '../../shared/icon';
import { AuthService } from '../../core/auth/auth.service';
import {
  EmployeeAction,
  EmployeeSecurity,
  EmployeeSecurityService,
  SecurityContext,
  SecurityEvent,
} from './employee-security.service';

@Component({
  selector: 'app-employee-security',
  imports: [DatePipe, Icon],
  styles: [
    `
      :host {
        display: block;
        margin-block: 24px;
      }
      .people {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
        gap: 16px;
      }
      article {
        padding: 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .dialog-card { margin: 0; color: var(--text-primary); overflow-wrap: anywhere; }
      .dialog-card::backdrop {
        background: rgba(12, 36, 28, 0.3);
        backdrop-filter: blur(2px);
      }
    `,
  ],
  template: `
    @if (loading()) {
      <p role="status">Verificando gestão de funcionários…</p>
    }
    @if (error() && !pending()) {
      <p role="alert">{{ error() }}</p>
      <button class="button secondary" (click)="load()" [disabled]="busy()">
        Atualizar permissões
      </button>
    }
    @if (context()?.can_manage) {
      <section aria-labelledby="employee-security-title" [attr.aria-busy]="busy()">
        <h2 id="employee-security-title" tabindex="-1">Gestão de funcionários</h2>
        <p>Desativar bloqueia o acesso e preserva os registros. Reativar exige novo login.</p>
        @if (feedback()) {
          <p class="feedback success" role="status">{{ feedback() }}</p>
        }
        <div class="people">
          @for (person of people(); track person.id) {
            <article>
              <h3>{{ person.display_name || 'Funcionário' }}</h3>
              <p>{{ person.role }} · {{ person.is_active ? 'Ativo' : 'Inativo' }}</p>
              @if (person.is_master) {
                <p>Administrador master</p>
              }
              @if (person.delegated) {
                <p>Permissão de gerir ativação</p>
              }
              <div class="actions">
                @if (person.can_toggle) {
                  <button
                    class="button secondary"
                    [attr.data-person]="person.id" data-action="activation"
                    [disabled]="busy()"
                    (click)="choose(person, person.is_active ? 'deactivate' : 'activate')"
                  >
                    {{ person.is_active ? 'Desativar' : 'Ativar' }}
                  </button>
                }
                @if (context()?.is_master && !person.is_master) {
                  @if (person.delegated) {
                    <button
                      class="button secondary"
                      [attr.data-person]="person.id" data-action="delegation"
                      [disabled]="busy()"
                      (click)="choose(person, 'revoke')"
                    >
                      Revogar delegação
                    </button>
                  } @else if (person.is_active && person.role !== 'membro') {
                    <button
                      class="button secondary"
                      [attr.data-person]="person.id" data-action="delegation"
                      [disabled]="busy()"
                      (click)="choose(person, 'grant')"
                    >
                      Delegar gestão de ativação
                    </button>
                  }
                }
              </div>
            </article>
          }
        </div>
        <details>
          <summary>Histórico de gestão (últimos 100 registros autorizados)</summary>
          @for (event of events(); track event.id) {
            <p>
              {{ event.occurred_at | date: 'dd/MM/yyyy HH:mm' }} ·
              {{ eventLabels[event.action] || event.action }} · {{ name(event.target_id) }} · por
              {{ name(event.actor_id) }}
            </p>
          }
        </details>
      </section>
    }
    <dialog #confirmation class="dialog-card confirm-dialog" aria-labelledby="employee-confirm-title"
      aria-describedby="employee-confirm-description" [attr.aria-busy]="busy()" tabindex="-1"
      (cancel)="$event.preventDefault(); cancel()">
      @if (pending(); as change) {
        <header class="dialog-header">
          <h2 id="employee-confirm-title">Confirmar {{ labels[change.action] }}</h2>
          <button class="icon-button" type="button" aria-label="Fechar confirmação"
            [disabled]="busy()" (click)="cancel()"><app-icon name="close" /></button>
        </header>
        <p id="employee-confirm-description">
          <strong>{{ change.person.display_name || 'Funcionário' }}</strong>.
          {{ warnings[change.action] }}
        </p>
        @if (error()) { <p class="feedback error" role="alert">{{ error() }}</p> }
        <div class="dialog-actions">
          <button class="button secondary" type="button" autofocus [disabled]="busy()" (click)="cancel()">Cancelar</button>
          <button class="button" type="button" [class.danger]="change.action === 'deactivate' || change.action === 'revoke'"
            [class.primary]="change.action === 'activate' || change.action === 'grant'"
            [disabled]="busy()" (click)="confirm()">{{ busy() ? 'Salvando…' : 'Confirmar' }}</button>
        </div>
      }
    </dialog>
  `,
})
export class EmployeeSecurityPanel {
  private readonly service = inject(EmployeeSecurityService);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('confirmation');
  private revision = 0;
  readonly context = signal<SecurityContext | null>(null);
  readonly people = signal<EmployeeSecurity[]>([]);
  readonly events = signal<SecurityEvent[]>([]);
  readonly pending = signal<{ person: EmployeeSecurity; action: EmployeeAction } | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly labels = {
    grant: 'delegação de gestão de ativação',
    revoke: 'revogação da delegação',
    activate: 'ativação',
    deactivate: 'desativação',
  };
  readonly warnings = {
    grant: 'Poderá gerir a ativação de funcionários dentro das permissões autorizadas.',
    revoke: 'Perderá a delegação para gerir a ativação de funcionários.',
    activate: 'O acesso será reativado. Será necessário um novo login.',
    deactivate: 'O acesso será bloqueado. Os registros serão preservados.',
  };
  readonly eventLabels: Record<string, string> = {
    delegation_granted: 'Delegação concedida',
    delegation_revoked: 'Delegação revogada',
    activated: 'Funcionário ativado',
    deactivated: 'Funcionário desativado',
  };
  constructor() {
    effect(() => {
      if (!this.auth.session()) {
        this.revision++;
        this.clear();
      }
    });
    void this.load();
  }
  private clear() {
    const dialog = this.dialog()?.nativeElement;
    if (dialog?.open) dialog.close();
    this.context.set(null);
    this.people.set([]);
    this.events.set([]);
    this.pending.set(null);
  }
  name(id: string | null) {
    return (
      this.people().find((p) => p.id === id)?.display_name ||
      (id === this.auth.session()?.user.id ? 'Minha conta' : 'Operador autorizado')
    );
  }
  choose(person: EmployeeSecurity, action: EmployeeAction) {
    if (!this.busy()) {
      this.pending.set({ person, action });
      this.feedback.set('');
      this.error.set('');
      this.cdr.detectChanges();
      this.dialog()?.nativeElement.showModal();
    }
  }
  cancel() {
    if (this.busy()) return;
    this.dialog()?.nativeElement.close();
    this.pending.set(null);
    this.error.set('');
  }
  async load() {
    const revision = ++this.revision;
    const user = this.auth.session()?.user.id;
    const current = () =>
      !this.destroy.destroyed &&
      revision === this.revision &&
      user === this.auth.session()?.user.id;
    this.loading.set(true);
    this.error.set('');
    this.clear();
    try {
      const context = await this.service.context();
      if (!current()) return;
      if (context.can_manage) {
        const [people, events] = await Promise.all([this.service.list(), this.service.history()]);
        if (!current()) return;
        this.people.set(people);
        this.events.set(events);
      }
      this.context.set(context);
    } catch (error) {
      if (current()) {
        this.clear();
        this.error.set(error instanceof Error ? error.message : 'Falha ao carregar funcionários.');
      }
    } finally {
      if (current()) this.loading.set(false);
    }
  }
  async confirm() {
    const change = this.pending();
    if (!change || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const user = this.auth.session()?.user.id;
    try {
      await this.service.change(change.person.id, change.action);
      if (this.destroy.destroyed || user !== this.auth.session()?.user.id) return;
      this.dialog()?.nativeElement.close();
      this.pending.set(null);
      this.feedback.set(`Alteração registrada: ${this.labels[change.action]} de ${change.person.display_name || 'funcionário'}.`);
      await this.load();
      if (!this.destroy.destroyed && user === this.auth.session()?.user.id) {
        // Refresh replaces the employee cards; restore focus to the corresponding new control.
        afterNextRender(() => {
          const action = change.action === 'activate' || change.action === 'deactivate' ? 'activation' : 'delegation';
          const buttons = this.element.nativeElement.querySelectorAll<HTMLButtonElement>('[data-person]');
          const origin = Array.from(buttons).find(button => button.dataset['person'] === change.person.id && button.dataset['action'] === action);
          (origin ?? this.element.nativeElement.querySelector<HTMLElement>('#employee-security-title, [role="alert"] + button'))?.focus();
        }, { injector: this.injector });
      }
    } catch (error) {
      if (!this.destroy.destroyed && user === this.auth.session()?.user.id)
        this.error.set(error instanceof Error ? error.message : 'Operação recusada.');
    } finally {
      this.busy.set(false);
    }
  }
}
