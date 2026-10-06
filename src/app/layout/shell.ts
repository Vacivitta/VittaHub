import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { Icon, IconName } from '../shared/icon';
import { RequestsService } from '../features/requests/requests.service';
import { DecisionBadge } from '../features/requests/decision-badge';

@Component({
  host: { '[class.sidebar-collapsed]': 'sidebarCollapsed()' },
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon, DecisionBadge],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  readonly auth = inject(AuthService);
  readonly requests = inject(RequestsService);
  constructor() {
    inject(Router).events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => void this.requests.refresh());
  }
  readonly signingOut = signal(false);
  readonly logoutError = signal('');
  readonly menuOpen = signal(false);
  readonly sidebarCollapsed = signal(this.readSidebarPreference());

  toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
    try {
      localStorage.setItem('vittahub.sidebarCollapsed', String(this.sidebarCollapsed()));
    } catch {
      // The preference remains usable for this session when storage is unavailable.
    }
  }

  private readSidebarPreference(): boolean {
    try {
      return localStorage.getItem('vittahub.sidebarCollapsed') === 'true';
    } catch {
      return false;
    }
  }
  readonly links = [
    { path: '/inicio', label: 'Início', icon: 'home' },
    { path: '/quadros', label: 'Quadros', icon: 'boards' },
    { path: '/minhas-pendencias', label: 'Minhas Pendências', icon: 'tasks' },
    { path: '/chat', label: 'Chat', icon: 'chat' },
    { path: '/solicitacoes', label: 'Solicitações', icon: 'check' },
    { path: '/administracao', label: 'Administração', icon: 'settings' },
  ] satisfies { path: string; label: string; icon: IconName }[];
  readonly visibleLinks = computed(() =>
    this.links.filter(
      (link) => link.path !== '/administracao' || this.auth.canAccessAdministration(),
    ),
  );

  async logout(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.logoutError.set('');
    try {
      await this.auth.signOut();
      this.menuOpen.set(false);
    } catch {
      this.logoutError.set('Não foi possível sair. Tente novamente.');
    } finally {
      this.signingOut.set(false);
    }
  }
}
