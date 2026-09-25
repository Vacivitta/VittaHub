import { Component, computed, signal } from '@angular/core';
import { CONVERSATIONS } from '../../core/demo-data';
import { PageHeading } from '../../shared/page-heading';
@Component({ imports: [PageHeading], templateUrl: './chat.html', styleUrl: './chat.scss' })
export class Chat {
  readonly conversations = CONVERSATIONS;
  readonly selected = signal(CONVERSATIONS[0]);
  readonly query = signal('');
  readonly filtered = computed(() =>
    this.conversations.filter((c) =>
      c.name.toLocaleLowerCase('pt-BR').includes(this.query().trim().toLocaleLowerCase('pt-BR')),
    ),
  );
}
