import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BoardSummary } from './board-summary';
import { Boards } from './boards';
import { BoardsService } from './boards.service';

describe('Boards', () => {
  const list = vi.fn();
  const getCreationContext = vi.fn();
  const listDepartments = vi.fn();
  const create = vi.fn();
  const canManageStructure = vi.fn();
  const boards: BoardSummary[] = [
    {
      id: 'board-1',
      title: 'Vacinação local',
      description: 'Organização da equipe',
      created_at: '2026-09-29T13:42:00Z',
      department: { name: 'Equipe local' },
    },
    {
      id: 'board-2',
      title: 'Planejamento local',
      description: null,
      created_at: '2026-09-28T13:42:00Z',
      department: null,
    },
  ];

  beforeEach(() => {
    list.mockReset().mockResolvedValue(boards);
    getCreationContext
      .mockReset()
      .mockResolvedValue({ role: 'membro', department_id: 'department-1', can_create: false });
    listDepartments.mockReset().mockResolvedValue([]);
    create.mockReset().mockResolvedValue('board-new');
    canManageStructure.mockReset().mockResolvedValue(false);
    TestBed.configureTestingModule({
      imports: [Boards],
      providers: [
        provideRouter([]),
        {
          provide: BoardsService,
          useValue: { list, getCreationContext, listDepartments, create, canManageStructure },
        },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(Boards);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows loading without prematurely displaying the empty state', async () => {
    let resolve!: (value: BoardSummary[]) => void;
    list.mockImplementation(
      () =>
        new Promise<BoardSummary[]>((done) => {
          resolve = done;
        }),
    );
    const fixture = TestBed.createComponent(Boards);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Carregando',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Nenhum quadro');
    expect(fixture.nativeElement.querySelector('input').disabled).toBe(true);
    resolve(boards);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.board-tile').length).toBe(2);
  });

  it('renders returned data and links using each board ID without demo counts', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    expect(list).toHaveBeenCalledOnce();
    expect(element.querySelectorAll('.board-tile').length).toBe(2);
    for (const text of [
      'Vacinação local',
      'Organização da equipe',
      'Equipe local',
      'Sem descrição.',
      'Departamento indisponível',
      '2 quadros disponíveis',
      'Criado em 29/09/2026',
    ]) {
      expect(element.textContent).toContain(text);
    }
    expect(element.textContent).not.toContain('cards fictícios');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/quadros/board-1');
  });

  it('shows no available boards without suggesting a search will grant access', async () => {
    list.mockResolvedValue([]);
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Nenhum quadro disponível');
    expect(fixture.nativeElement.querySelectorAll('.board-tile').length).toBe(0);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('filters loaded titles without new requests and allows clearing the search', async () => {
    const fixture = await render();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = ' VACINAÇÃO ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.board-tile').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.boards-count').textContent).toContain(
      '1 quadro disponível',
    );
    input.value = 'inexistente';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum quadro encontrado');
    expect(fixture.nativeElement.querySelector('.boards-count').textContent).toContain(
      '0 quadros disponíveis',
    );
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.board-tile').length).toBe(2);
    expect(list).toHaveBeenCalledOnce();
  });

  it('shows a safe error and retries successfully', async () => {
    list.mockRejectedValueOnce(new Error('sensitive server information'));
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Não foi possível carregar os quadros.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('sensitive server information');
    expect(fixture.nativeElement.textContent).not.toContain('Nenhum quadro');
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.board-tile').length).toBe(2);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('shows board creation only to an authorized manager and calls the service', async () => {
    getCreationContext.mockResolvedValue({
      role: 'gestor',
      department_id: 'department-1',
      can_create: true,
    });
    list
      .mockResolvedValueOnce(boards)
      .mockResolvedValueOnce([...boards, { ...boards[0], id: 'board-new', title: 'Novo quadro' }]);
    const fixture = await render();
    const page = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('Novo quadro');
    page.openCreateForm();
    page.form.setValue({
      title: ' Novo quadro ',
      description: ' Descrição ',
      departmentId: 'department-1',
    });
    await page.createBoard();
    fixture.detectChanges();
    expect(create).toHaveBeenCalledExactlyOnceWith({
      title: ' Novo quadro ',
      description: ' Descrição ',
      departmentId: 'department-1',
    });
    expect(list).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Quadro criado com sucesso.');
  });

  it('does not render board creation for a member', async () => {
    const fixture = await render();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      'button',
    );
    expect(Array.from(buttons).some((button) => button.textContent?.includes('Novo quadro'))).toBe(
      false,
    );
  });

  it('uses each board capability instead of inferring management from the global role', async () => {
    canManageStructure.mockImplementation(async (id: string) => id === 'board-1');
    const fixture = await render();
    await vi.waitFor(() => expect(fixture.componentInstance.management()['board-1']).toBe(true));
    fixture.detectChanges();
    const tiles = fixture.nativeElement.querySelectorAll('.board-tile');
    expect(tiles[0].textContent).toContain('Administra este quadro');
    expect(tiles[1].textContent).toContain('Acesso ao quadro');
    expect(fixture.nativeElement.textContent).not.toContain('Somente leitura');
    expect(canManageStructure.mock.calls).toEqual([['board-1'], ['board-2']]);
  });

  it('does not imply management for managers without the board capability', async () => {
    getCreationContext.mockResolvedValue({
      role: 'gestor',
      department_id: 'department-1',
      can_create: false,
    });
    const fixture = await render();
    expect(fixture.nativeElement.textContent).not.toContain('Administra este quadro');
    expect(fixture.nativeElement.textContent).not.toContain('Novo quadro');
  });

  it('keeps boards usable without claiming read-only access when the capability fails', async () => {
    canManageStructure.mockRejectedValue(new Error('unavailable'));
    const fixture = await render();
    expect(fixture.nativeElement.querySelectorAll('.board-tile').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Acesso ao quadro');
    expect(fixture.nativeElement.textContent).not.toContain('Somente leitura');
  });

  it('offers the first-board action only when creation is authorized', async () => {
    list.mockResolvedValue([]);
    getCreationContext.mockResolvedValue({
      role: 'gestor',
      department_id: 'department-1',
      can_create: true,
    });
    const fixture = await render();
    const cta = fixture.nativeElement.querySelector('.boards-state button') as HTMLButtonElement;
    expect(cta.textContent).toContain('Criar primeiro quadro');
    cta.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('keeps a single native link per card with an accessible title and real date', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const tiles = element.querySelectorAll<HTMLAnchorElement>('.board-tile');
    tiles.forEach((tile, index) => {
      expect(tile.tagName).toBe('A');
      expect(tile.getAttribute('href')).toBe('/quadros/' + boards[index].id);
      expect(tile.querySelector('a, button, input, [tabindex]')).toBeNull();
      expect(tile.getAttribute('aria-labelledby')).toBe(tile.querySelector('h2')?.id);
      expect(tile.querySelector('time')?.getAttribute('datetime')).toBe(boards[index].created_at);
    });
    expect(element.querySelector('label input[type="search"]')).not.toBeNull();
    expect(element.querySelector('.boards-toolbar [aria-live="polite"]')).not.toBeNull();
  });

  it('focuses the creation form and restores focus when closed with Escape', async () => {
    getCreationContext.mockResolvedValue({
      role: 'gestor',
      department_id: 'department-1',
      can_create: true,
    });
    const fixture = await render();
    const trigger = fixture.nativeElement.querySelector(
      '.boards-toolbar button',
    ) as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    // JSDOM has no layout; give the CDK visibility check a rendered field size.
    const rects = vi
      .spyOn(HTMLInputElement.prototype, 'getClientRects')
      .mockReturnValue({ length: 1 } as DOMRectList);
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector(
      '[formControlName="title"]',
    ) as HTMLInputElement;
    await fixture.whenStable();
    rects.mockRestore();
    expect(document.activeElement).toBe(title);
    title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('associates validation errors with fields and keeps the drawer open while saving', async () => {
    getCreationContext.mockResolvedValue({
      role: 'administrador',
      department_id: 'department-1',
      can_create: true,
    });
    const fixture = await render();
    const page = fixture.componentInstance;
    page.openCreateForm();
    await page.createBoard();
    fixture.detectChanges();
    for (const name of ['title', 'departmentId']) {
      const field = fixture.nativeElement.querySelector(
        `[formControlName="${name}"]`,
      ) as HTMLElement;
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(
        fixture.nativeElement.querySelector('#' + field.getAttribute('aria-describedby')),
      ).not.toBeNull();
    }
    expect(create).not.toHaveBeenCalled();
    page.creating.set(true);
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('[role="dialog"]')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(page.createFormOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('.drawer-backdrop').disabled).toBe(true);
  });
});
