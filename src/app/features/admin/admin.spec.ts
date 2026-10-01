import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { BoardsService } from '../boards/boards.service';
import { BoardSummary } from '../boards/board-summary';
import { Admin } from './admin';

describe('Admin', () => {
  const access = signal(true);
  const session = signal({ user: { id: 'test-user' } });
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
    canManageStructure: vi.fn(),
    getCreationContext: vi.fn(),
    listDepartments: vi.fn(),
  };
  beforeEach(() => {
    access.set(true);
    session.set({ user: { id: 'test-user' } });
    service.list.mockReset().mockResolvedValue(boards);
    service.canManageStructure
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
        provideRouter([]),
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
    expect(service.canManageStructure.mock.calls).toEqual([['managed'], ['view-only']]);
  });

  it('does not display zero or the empty state before capabilities finish loading', async () => {
    let resolve!: (value: boolean) => void;
    service.canManageStructure.mockReturnValue(
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
    service.canManageStructure.mockResolvedValue(false);
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
});
