import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  imports: [RouterLink],
  template: `
    <main class="login-page">
      <section class="login-story">
        <a class="brand" routerLink="/inicio"
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
        <span class="demo-pill">Acesso demonstrativo</span>
        <h2 id="login-title">Boas-vindas ao VittaHub</h2>
        <p class="muted">Conheça seu novo espaço de trabalho.</p>
        <label
          >E-mail de exemplo<input
            type="email"
            value="pessoa.demo@example.invalid"
            readonly /></label
        ><label>Senha de exemplo<input type="password" value="demonstracao" readonly /></label>
        <p class="note">Os campos são ilustrativos. Nenhuma credencial é solicitada ou validada.</p>
        <a class="button primary" routerLink="/inicio">Entrar na demonstração →</a>
        <p class="small muted">
          Apenas dados fictícios. Sem autenticação e sem cadastro nesta etapa.
        </p>
      </section>
    </main>
  `,
  styleUrl: './login.scss',
})
export class Login {}
