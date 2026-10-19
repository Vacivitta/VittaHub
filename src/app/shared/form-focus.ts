import { DOCUMENT } from '@angular/common';
import { afterNextRender, Directive, ElementRef, HostListener, inject, input, OnDestroy } from '@angular/core';

/** Focus lifecycle for conditionally rendered forms; modal containment stays with CDK. */
@Directive({ selector: '[appFocusRegion]' })
export class FocusRegion implements OnDestroy {
  readonly appFocusRegion = input('');
  private readonly document = inject(DOCUMENT);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly origin = this.document.activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => {
      const root = this.element.nativeElement;
      (root.querySelector<HTMLElement>('[data-focus-initial], [cdkFocusInitial]')
        ?? root.querySelector<HTMLElement>('input, select, textarea')
        ?? root.querySelector<HTMLElement>('button'))?.focus();
    });
  }

  ngOnDestroy(): void {
    const fallback = this.appFocusRegion();
    // Wait for removed controls and newly rendered fallback controls to settle.
    queueMicrotask(() => {
      const target = this.origin?.isConnected && this.origin !== this.document.body && !this.origin.matches(':disabled')
        ? this.origin : fallback.split(',').filter(Boolean)
          .map(selector => this.document.querySelector<HTMLElement>(selector.trim()))
          .find(element => !!element && !element.matches(':disabled'));
      target?.focus();
    });
  }
}

@Directive({ selector: 'form[appFocusInvalid]' })
export class FocusInvalid {
  private readonly element = inject<ElementRef<HTMLFormElement>>(ElementRef);

  @HostListener('submit')
  focusInvalid(): void {
    queueMicrotask(() => this.element.nativeElement.querySelector<HTMLElement>(
      'input.ng-invalid, select.ng-invalid, textarea.ng-invalid, [aria-invalid="true"]',
    )?.focus());
  }
}
