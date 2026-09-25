import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { createSupabaseClient, SUPABASE_CLIENT } from './core/supabase/supabase-client';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: SUPABASE_CLIENT, useFactory: createSupabaseClient },
  ],
};
