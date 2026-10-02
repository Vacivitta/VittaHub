import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { BoardsService } from '../boards/boards.service';
import { BoardSummary } from '../boards/board-summary';
import { Admin } from './admin';
import { AdminService } from './admin.service';
import { AdminAccessError } from './admin.models';

@Component({ template: '' })
class SafePage {}

describe('Admin', () => {
  const access = signal(true);
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'test-user' } });
  const boards: BoardSummary[] = [
    {
      id: 'managed',
      title: 'Rotina local',
      description: 'Organização',
      created_at: '',
      department: { name: 'Equipe' },
    },
    { id: 'view-only', title: 'Outro quadro', description: null, created_at: '', department: null },
  ];
  const service = {
    list: vi.fn(),
    canManageStructureStrict: vi.fn(),
    getCreationContext: vi.fn(),
    listDepartments: vi.fn(),
  };
  const teamService = { listTeamMembers: vi.fn(), getActivity: vi.fn() };
  beforeEach(() => {
    teamService.getActivity
      .mockReset()
      .mockResolvedValue({
        completed: 0,
        in_progress: 0,
        average_seconds: null,
        duration_samples: 0,
        total_events: 0,
        events: [],
        boards: [],
        people: [],
      });
    teamService.listTeamMembers.mockReset().mockResolvedValue([]);
    access.set(true);
    session.set({ user: { id: 'test-user' } });
    service.list.mockReset().mockResolvedValue(boards);
    service.canManageStructureStrict
      .mockReset()
      .mockImplementation(async (id: string) => id === 'managed');
    service.getCreationContext
      .mockReset()
      .mockResolvedValue({ department_id: 'own-department', can_create: false });
    service.listDepartments
      .mockReset()
      .mockResolvedValue([{ id: 'own-department', name: 'Departamento local' }]);
    TestBed.configureTestingModule({
      imports: [Admin],
      providers: [
        provideRouter([{ path: 'inicio', component: SafePage }]),
        { provide: AdminService, useValue: teamService },
        { provide: BoardsService, useValue: service },
        {
          provide: AuthService,
          useValue: {
            session,
            canAccessAdministration: access,
            displayName: signal('Conta Local'),
            profile: signal({ id: 'test-user', role: 'gestor', is_active: true }),
          },
        },
      ],
    });
  });
  async function render() {
    const fixture = TestBed.createComponent(Admin);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    fixture.detectChanges();
    return fixture;
  }

  it('shows real profile data, a confirmed count and links only for managed boards', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    for (const text of [
      'Conta Local',
      'Gestor',
      'Ativo',
      'Departamento local',
      '1 quadro',
      'Rotina local',
    ]) {
      expect(element.textContent).toContain(text);
    }
    expect(element.textContent).not.toContain('Outro quadro');
    expect(element.textContent).not.toMatch(/fictíc|Configuração futura|Prévia/);
    expect(element.querySelectorAll('.managed-board')).toHaveLength(1);
    const link = element.querySelector('.managed-board')!;
    expect(link.getAttribute('href')).toBe('/quadros/managed');
    expect(link.getAttribute('aria-labelledby')).toBe(link.querySelector('h3')?.id);
    expect(service.canManageStructureStrict.mock.calls).toEqual([['managed'], ['view-only']]);
  });

  it('does not display zero or the empty state before capabilities finish loading', async () => {
    let resolve!: (value: boolean) => void;
    service.canManageStructureStrict.mockReturnValue(
      new Promise<boolean>((done) => {
        resolve = done;
      }),
    );
    const fixture = TestBed.createComponent(Admin);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carregando seus quadros');
    expect(fixture.nativeElement.textContent).not.toContain('Nenhum quadro');
    expect(fixture.nativeElement.querySelector('.badge')).toBeNull();
    resolve(true);
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.managed-board')).toHaveLength(2);
  });

  it('shows a safe error and retries without retaining stale counts', async () => {
    service.list.mockRejectedValueOnce(new Error('private server details'));
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('private server details');
    expect(fixture.nativeElement.querySelector('.badge')).toBeNull();
    fixture.nativeElement.querySelector('button').click();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.managed-board')).toHaveLength(1);
  });

  it('shows an empty state when no management capability is confirmed', async () => {
    service.canManageStructureStrict.mockResolvedValue(false);
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('0 quadros');
    expect(fixture.nativeElement.textContent).toContain(
      'Nenhum quadro com administração confirmada',
    );
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/quadros');
  });

  it('keeps boards available when the department cannot be read', async () => {
    service.listDepartments.mockRejectedValue(new Error('denied'));
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Departamento indisponível');
    expect(fixture.nativeElement.querySelectorAll('.managed-board')).toHaveLength(1);
  });

  it('discards results received after the session changes', async () => {
    let resolve!: (value: BoardSummary[]) => void;
    service.list.mockReturnValue(
      new Promise<BoardSummary[]>((done) => {
        resolve = done;
      }),
    );
    const fixture = TestBed.createComponent(Admin);
    fixture.detectChanges();
    session.set({ user: { id: 'another-user' } });
    resolve(boards);
    await fixture.whenStable();
    expect(fixture.componentInstance.boards()).toEqual([]);
    expect(fixture.componentInstance.department()).toBe('');
  });

  const people = [
    {
      id: 'p1',
      display_name: 'Ana Teste',
      role: 'membro',
      is_active: true,
      department_id: 'd1',
      department_name: 'Operações',
    },
    {
      id: 'p2',
      display_name: 'Bia Teste',
      role: 'gestor',
      is_active: false,
      department_id: 'd2',
      department_name: 'Financeiro',
    },
  ];
  it('renders authorized people, scoped count, status and local search', async () => {
    teamService.listTeamMembers.mockResolvedValue(people);
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('2 pessoas no seu escopo');
    expect(fixture.nativeElement.textContent).toContain('Inativo');
    expect(fixture.nativeElement.querySelectorAll('.team-person')).toHaveLength(2);
    const input = fixture.nativeElement.querySelector('#team-search');
    input.value = 'financeiro';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.team-person')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toContain('Ana Teste');
    fixture.componentInstance.search.set('ausente');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma pessoa encontrada');
  });
  it('distinguishes empty results and query errors with retry', async () => {
    teamService.listTeamMembers.mockRejectedValueOnce(new Error('secret'));
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar a equipe');
    expect(fixture.nativeElement.textContent).not.toContain('secret');
    fixture.nativeElement.querySelector('.team-panel button').click();
    await vi.waitFor(() => expect(fixture.componentInstance.teamLoading()).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma pessoa disponível');
  });
  it('does not interpret permission RPC failure as zero boards', async () => {
    service.canManageStructureStrict.mockRejectedValue(new Error('failed'));
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar os quadros');
    expect(fixture.nativeElement.textContent).not.toContain('Nenhum quadro');
  });
  it.each(['session', 'access', 'logout'])('clears loaded people on %s change', async (change) => {
    teamService.listTeamMembers.mockResolvedValue(people);
    const fixture = await render();
    if (change === 'session') session.set({ user: { id: 'other' } });
    else if (change === 'logout') session.set(null);
    else access.set(false);
    fixture.detectChanges();
    expect(fixture.componentInstance.team()).toEqual([]);
    expect(fixture.componentInstance.boards()).toEqual([]);
  });
  it('ignores late directory results after session change', async () => {
    let resolve!: (value: typeof people) => void;
    teamService.listTeamMembers.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Carregando a equipe');
    session.set({ user: { id: 'other' } });
    fixture.detectChanges();
    resolve(people);
    await fixture.whenStable();
    expect(fixture.componentInstance.team()).toEqual([]);
  });
  it('clears data when the database denies administrative access', async () => {
    teamService.listTeamMembers.mockRejectedValue(new AdminAccessError());
    const fixture = TestBed.createComponent(Admin);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.invalidSession()).toBe(true);
    expect(fixture.componentInstance.team()).toEqual([]);
    expect(fixture.componentInstance.boards()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Sua sessão não tem acesso');
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/inicio'));
  });
});
