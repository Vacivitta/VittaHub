import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar | Vacivitta',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Início | Vacivitta',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'quadros',
        title: 'Quadros | Vacivitta',
        loadComponent: () => import('./features/boards/boards').then((m) => m.Boards),
      },
      {
        path: 'quadros/:id',
        title: 'Quadro | Vacivitta',
        loadComponent: () => import('./features/boards/board').then((m) => m.BoardPage),
      },
      {
        path: 'minhas-pendencias',
        title: 'Minhas pendências | Vacivitta',
        loadComponent: () => import('./features/tasks/tasks').then((m) => m.Tasks),
      },
      {
        path: 'chat',
        title: 'Chat | Vacivitta',
        loadComponent: () => import('./features/chat/chat').then((m) => m.Chat),
      },
      {
        path: 'administracao',
        title: 'Administração | Vacivitta',
        loadComponent: () => import('./features/admin/admin').then((m) => m.Admin),
      },
      {
        path: '**',
        title: 'Página não encontrada | Vacivitta',
        loadComponent: () => import('./shared/not-found').then((m) => m.NotFound),
      },
    ],
  },
];
