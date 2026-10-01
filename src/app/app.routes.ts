import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar | VittaHub',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Início | VittaHub',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'quadros',
        title: 'Quadros | VittaHub',
        loadComponent: () => import('./features/boards/boards').then((m) => m.Boards),
      },
      {
        path: 'quadros/:id',
        title: 'Quadro | VittaHub',
        loadComponent: () => import('./features/boards/board').then((m) => m.BoardPage),
      },
      {
        path: 'minhas-pendencias',
        title: 'Minhas Pendências | VittaHub',
        loadComponent: () => import('./features/tasks/tasks').then((m) => m.Tasks),
      },
      {
        path: 'pendencias/:id',
        title: 'Pendência | VittaHub',
        loadComponent: () => import('./features/tasks/task').then((m) => m.TaskDetailPage),
      },
      {
        path: 'chat',
        title: 'Chat | VittaHub',
        loadComponent: () => import('./features/chat/chat').then((m) => m.Chat),
      },
      {
        path: 'administracao',
        canActivate: [adminGuard],
        title: 'Administração | VittaHub',
        loadComponent: () => import('./features/admin/admin').then((m) => m.Admin),
      },
      {
        path: '**',
        title: 'Página não encontrada | VittaHub',
        loadComponent: () => import('./shared/not-found').then((m) => m.NotFound),
      },
    ],
  },
];
