import { computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export const activeUserGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const resolved = computed(() => !auth.session() || !!auth.profile() || !!auth.profileError());
  const resolved$ = toObservable(resolved);
  await auth.ready;
  if (!resolved()) await firstValueFrom(resolved$.pipe(filter(() => resolved())));
  return (
    (!!auth.session() &&
      auth.profile()?.id === auth.session()?.user.id &&
      auth.profile()?.is_active === true) ||
    router.createUrlTree(['/inicio'])
  );
};
