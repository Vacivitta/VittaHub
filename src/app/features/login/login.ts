import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Icon } from '../../shared/icon';

@Component({
  imports: [RouterLink, ReactiveFormsModule, Icon],
  template: `
    <main class="login-page">
      <section class="login-story" aria-labelledby="brand-headline">
        <a class="login-brand" routerLink="/login" aria-label="VittaHub, página de acesso">
          <img src="/brand/vacivitta-logo-horizontal.png" alt="Vacivitta Saúde Integrada" />
        </a>
        <div class="story-copy">
          <h1 id="brand-headline">Organize sua equipe<br />com mais clareza.</h1>
          <p>Acompanhe quadros, pendências e conversas em um espaço simples e intuitivo.</p>
          <div class="login-motto">
            <app-icon name="sparkle" />
            <strong>Juntos, no mesmo ritmo.</strong>
            <span>Mais clareza para organizar.<br />Mais tempo para cuidar.</span>
          </div>
        </div>
        <img class="story-symbol" src="/brand/vacivitta-symbol.png" alt="" aria-hidden="true" />
      </section>
      <section class="login-area">
        <div class="login-form panel" aria-labelledby="login-title">
          <h2 id="login-title">Entrar no VittaHub</h2>
          <p class="muted">Use sua conta autorizada para acessar o espaço da Vacivitta.</p>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate [attr.aria-busy]="busy()">
            <label for="email">E-mail</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              autocomplete="username"
              placeholder="voce@exemplo.com"
              [attr.aria-invalid]="form.controls.email.touched && form.controls.email.invalid"
              aria-describedby="email-error"
            />
            <span id="email-error" class="field-message">
              @if (form.controls.email.touched && form.controls.email.invalid) {
                Informe um e-mail válido.
              }
            </span>
            <label for="password">Senha</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              placeholder="Digite sua senha"
              [attr.aria-invalid]="form.controls.password.touched && form.controls.password.invalid"
              aria-describedby="password-error"
            />
            <span id="password-error" class="field-message">
              @if (form.controls.password.touched && form.controls.password.invalid) {
                Informe sua senha.
              }
            </span>
            @if (error()) {
              <p class="feedback error" role="alert">{{ error() }}</p>
            }
            <button class="button primary login-submit" type="submit" [disabled]="busy()">
              {{ busy() ? 'Entrando…' : 'Entrar' }}<app-icon name="arrow-right" />
            </button>
          </form>
          <div class="secure-note">
            <app-icon name="lock" /><span>Ambiente seguro · Acesso autenticado</span>
          </div>
          <p class="small muted access-note">
            Sem cadastro público. O acesso é disponibilizado pela administração.
          </p>
        </div>
      </section>
    </main>
  `,
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signIn(email, password);
      this.form.controls.password.reset();
      await this.router.navigateByUrl('/inicio');
    } catch {
      this.error.set('Não foi possível entrar. Confira e-mail e senha e tente novamente.');
      this.form.controls.password.reset();
    } finally {
      this.busy.set(false);
    }
  }
}
