import { Injectable, signal } from '@angular/core';

// Local invalidation only: no polling, subscriptions or notification transport.
@Injectable({ providedIn: 'root' })
export class TaskChanges {
  readonly revision = signal(0);
  notify(): void {
    this.revision.update((value) => value + 1);
  }
}
