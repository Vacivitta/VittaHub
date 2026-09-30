import { DestroyRef, inject, signal } from '@angular/core';

/** Browser-local presentation clock; does not fetch or mutate application data. */
export function minuteClock() {
  const now = signal(Date.now());
  const timer = setInterval(() => now.set(Date.now()), 60_000);
  inject(DestroyRef).onDestroy(() => clearInterval(timer));
  return now.asReadonly();
}
