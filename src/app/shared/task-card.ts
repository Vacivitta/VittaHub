import { Component, input } from '@angular/core';
import { Task } from '../core/models';
import { STATE_LABELS } from '../core/demo-data';
@Component({
  selector: 'app-task-card',
  template: `<article class="task-card">
    <div class="row">
      <span class="task-id">{{ task().id }}</span
      ><span class="badge" [class.success]="task().state === 'concluido'">{{
        labels[task().state]
      }}</span>
    </div>
    <h3>{{ task().title }}</h3>
    <p class="small muted">Criado por {{ task().creator }}</p>
    <div class="task-footer">
      <span>{{ task().assignee }}</span
      ><span [class.overdue]="task().overdue"
        >{{ task().overdue ? 'Vencido · ' : 'Prazo · ' }}{{ task().deadline }}</span
      >
    </div>
  </article>`,
})
export class TaskCard {
  readonly task = input.required<Task>();
  readonly labels = STATE_LABELS;
}
