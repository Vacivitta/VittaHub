import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { Icon, IconName } from '../shared/icon';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  readonly auth = inject(AuthService);
  readonly signingOut = signal(false);
  readonly logoutError = signal('');
  readonly menuOpen = signal(false);
  readonly links = [
    { path: '/inicio', label: 'Início', icon: 'home' },
    { path: '/quadros', label: 'Quadros', icon: 'boards' },
    { path: '/minhas-pendencias', label: 'Minhas Pendências', icon: 'tasks' },
    { path: '/chat', label: 'Chat', icon: 'chat' },
    { path: '/administracao', label: 'Administração', icon: 'settings' },
  ] satisfies { path: string; label: string; icon: IconName }[];

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
