import { Component, input } from '@angular/core';
@Component({
  selector: 'app-page-heading',
  template: `<header class="page-heading">
    <div>
      <p class="eyebrow">{{ eyebrow() }}</p>
      <h1>{{ title() }}</h1>
      <p class="muted">{{ description() }}</p>
    </div>
    <ng-content />
  </header>`,
})
export class PageHeading {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly eyebrow = input('ESPAÇO DE TRABALHO');
}
