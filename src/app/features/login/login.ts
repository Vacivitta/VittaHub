import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
@Component({
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <main class="login-page">
      <section class="login-story">
        <a class="brand" routerLink="/login"
          ><span class="brand-mark" aria-hidden="true">v</span>vacivitta.</a
        >
        <div>
          <p class="eyebrow">PESSOAS CONECTADAS. ROTINA ORGANIZADA.</p>
          <h1>Mais perto da equipe.<br />Mais leve no dia a dia.</h1>
          <p>Um espaço para acompanhar pendências, organizar ideias e conversar.</p>
        </div>
        <span class="small">Cuidar começa com organizar.</span>
      </section>
      <section class="login-form panel" aria-labelledby="login-title">
        <span class="demo-pill">Acesso local</span>
        <h2 id="login-title">Boas-vindas ao VittaHub</h2>
        <p class="muted">Entre com sua conta de teste autorizada.</p>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate [attr.aria-busy]="busy()">
          <label for="email">E-mail</label>
          <input id="email" type="email" formControlName="email" autocomplete="username"
            [attr.aria-invalid]="form.controls.email.touched && form.controls.email.invalid"
            aria-describedby="email-error" />
          <span id="email-error" class="small">
            @if (form.controls.email.touched && form.controls.email.invalid) { Informe um e-mail válido. }
          </span>
          <label for="password">Senha</label>
          <input id="password" type="password" formControlName="password" autocomplete="current-password"
            [attr.aria-invalid]="form.controls.password.touched && form.controls.password.invalid"
            aria-describedby="password-error" />
          <span id="password-error" class="small">
            @if (form.controls.password.touched && form.controls.password.invalid) { Informe sua senha. }
          </span>
          @if (error()) { <p role="alert">{{ error() }}</p> }
          <button class="button primary" type="submit" [disabled]="busy()">
            {{ busy() ? 'Entrando…' : 'Entrar →' }}
          </button>
        </form>
        <p class="small muted">Ambiente local de testes. Sem cadastro público.</p>
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
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
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
