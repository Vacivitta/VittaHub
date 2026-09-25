import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  readonly menuOpen = signal(false);
  readonly links = [
    { path: '/inicio', label: 'Início', icon: '⌂' },
    { path: '/quadros', label: 'Quadros', icon: '▦' },
    { path: '/minhas-pendencias', label: 'Minhas Pendências', icon: '✓' },
    { path: '/chat', label: 'Chat', icon: '☏' },
    { path: '/administracao', label: 'Administração', icon: '⚙' },
  ];
}
