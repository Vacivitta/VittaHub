import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  imports: [RouterLink],
  template: `<section class="empty panel">
    <p class="eyebrow">404</p>
    <h1>Página não encontrada</h1>
    <p>Este endereço não faz parte da demonstração.</p>
    <a class="button primary" routerLink="/inicio">Voltar ao início</a>
  </section>`,
})
export class NotFound {}
