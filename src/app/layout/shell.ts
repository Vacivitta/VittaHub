import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { Icon, IconName } from '../shared/icon';

@Component({
  host: { '[class.sidebar-collapsed]': 'sidebarCollapsed()' },
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  readonly auth = inject(AuthService);
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
