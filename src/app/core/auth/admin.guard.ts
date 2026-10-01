import { computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  // Session restoration and profile loading complete independently.
  const resolved = computed(() => !auth.session() || !!auth.profile() || !!auth.profileError());
  const resolved$ = toObservable(resolved);
  await auth.ready;
  if (!resolved()) await firstValueFrom(resolved$.pipe(filter(() => resolved())));
  return auth.canAccessAdministration() || router.createUrlTree(['/inicio']);
};
