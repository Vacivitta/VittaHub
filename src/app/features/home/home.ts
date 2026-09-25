import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BOARDS, DEMO_DATE, DEMO_USER, TASKS } from '../../core/demo-data';
import { PageHeading } from '../../shared/page-heading';
import { TaskCard } from '../../shared/task-card';
@Component({
  imports: [RouterLink, PageHeading, TaskCard],
  templateUrl: './home.html',
})
export class Home {
  readonly date = DEMO_DATE;
  readonly boards = BOARDS;
  readonly mine = TASKS.filter((task) => task.assignee === DEMO_USER);
  readonly upcoming = this.mine.filter((task) => task.state !== 'concluido').slice(0, 3);
  readonly stats = [
    {
      label: 'Pendências em aberto',
      value: this.mine.filter((t) => t.state !== 'concluido').length,
      detail: 'Para acompanhar',
      tone: 'green',
    },
    {
      label: 'Aguardando aceite',
      value: this.mine.filter((t) => t.state === 'aguardando_aceite').length,
      detail: 'Atribuídas a você',
      tone: 'amber',
    },
    {
      label: 'Prazos vencidos',
      value: this.mine.filter((t) => t.overdue).length,
      detail: 'Precisam de atenção',
      tone: 'rose',
    },
    {
      label: 'Concluídas',
      value: this.mine.filter((t) => t.state === 'concluido').length,
      detail: 'No cenário demonstrativo',
      tone: 'blue',
    },
  ];
}
