import { Component, effect, input, signal } from '@angular/core';

@Component({
  selector: 'app-decision-badge',
  host: { 'aria-hidden': 'true' },
  template: `@for (value of count() > 0 ? [count()] : []; track value) {
    <span class="decision-badge" [class.pulse]="pulse()">{{ value }}</span>
  }`,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
    .decision-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.4rem;
      padding: 0.1rem 0.35rem;
      border-radius: 1rem;
      background: #187144;
      color: #fff;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .pulse {
      animation: decision-pulse 550ms ease-out 1;
    }
    @keyframes decision-pulse {
      50% {
        transform: scale(1.13);
        box-shadow: 0 0 0 4px #18714422;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .pulse {
        animation: none;
      }
    }
  `,
})
export class DecisionBadge {
  readonly count = input(0);
  readonly pulse = signal(false);
  private previous = 0;
  constructor() {
    effect(() => {
      const count = this.count();
      this.pulse.set(count > this.previous);
      this.previous = count;
    });
  }
}
