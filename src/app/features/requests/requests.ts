import { DatePipe } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PageHeading } from '../../shared/page-heading';
import { TaskAssignmentActions } from '../tasks/task-assignment-actions';
import { REQUEST_LABELS, RequestItem } from './request-item';
import { RequestsService } from './requests.service';

@Component({
  imports: [DatePipe, RouterLink, PageHeading, TaskAssignmentActions],
  templateUrl: './requests.html',
  styleUrl: './requests.scss',
})
export class Requests {
  readonly service = inject(RequestsService);
  readonly labels = REQUEST_LABELS;
  readonly feedback = signal<{ message: string; taskId: string } | null>(null);
  readonly fragment = toSignal(inject(ActivatedRoute).fragment);
  private readonly cards = viewChildren<ElementRef<HTMLElement>>('requestCard');
  private focusedKey: string | null = null;

  constructor() {
    afterRenderEffect(() => {
      const key = this.fragment();
      const cards = this.cards();
      if (!key) {
        this.focusedKey = null;
        return;
      }
      if (key === this.focusedKey) return;
      const card = cards.find((card) => card.nativeElement.id === key)?.nativeElement;
      if (!card) return;
      this.focusedKey = key;
      card.focus({ preventScroll: true });
      card.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }

  resolved(item: RequestItem, message: string): void {
    this.feedback.set({ message, taskId: item.task.id });
    this.service.resolved(item.item_key);
  }
}
