import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
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
  imports: [DatePipe],
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
      article,
      .confirmation {
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
    `,
  ],
  template: `
    @if (loading()) {
      <p role="status">Verificando gestão de funcionários…</p>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button class="button secondary" (click)="load()" [disabled]="busy()">
        Atualizar permissões
      </button>
    }
    @if (context()?.can_manage) {
      <section aria-labelledby="employee-security-title" [attr.aria-busy]="busy()">
        <h2 id="employee-security-title">Gestão de funcionários</h2>
        <p>Desativar bloqueia o acesso e preserva os registros. Reativar exige novo login.</p>
        @if (feedback()) {
          <p role="status">{{ feedback() }}</p>
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
                      [disabled]="busy()"
                      (click)="choose(person, 'revoke')"
                    >
                      Revogar delegação
                    </button>
                  } @else if (person.is_active && person.role !== 'membro') {
                    <button
                      class="button secondary"
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
        @if (pending(); as change) {
          <div
            class="confirmation"
            role="alertdialog"
            aria-modal="false"
            aria-labelledby="employee-confirm-title"
          >
            <h3 id="employee-confirm-title">
              Confirmar {{ labels[change.action] }}:
              {{ change.person.display_name || 'funcionário' }}?
            </h3>
            <div class="actions">
              <button class="button primary" [disabled]="busy()" (click)="confirm()">
                {{ busy() ? 'Salvando…' : 'Confirmar' }}</button
              ><button class="button secondary" [disabled]="busy()" (click)="pending.set(null)">
                Cancelar
              </button>
            </div>
          </div>
        }
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
  `,
})
export class EmployeeSecurityPanel {
  private readonly service = inject(EmployeeSecurityService);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
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
    grant: 'delegação',
    revoke: 'revogação',
    activate: 'ativação',
    deactivate: 'desativação',
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
    }
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
      this.pending.set(null);
      this.feedback.set('Alteração registrada.');
      await this.load();
    } catch (error) {
      if (!this.destroy.destroyed && user === this.auth.session()?.user.id)
        this.error.set(error instanceof Error ? error.message : 'Operação recusada.');
    } finally {
      this.busy.set(false);
    }
  }
}
