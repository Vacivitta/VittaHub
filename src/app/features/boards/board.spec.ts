import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TasksService } from '../tasks/tasks.service';
import { AuthService } from '../../core/auth/auth.service';
import { BoardPage } from './board';
import { BoardDetail, BoardResult } from './board-detail';
import { BoardsService } from './boards.service';

describe('BoardPage', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const getById = vi.fn();
  const list = vi.fn();
  const listAssignees = vi.fn();
  const create = vi.fn();
  const canManageStructure = vi.fn();
  const createColumn = vi.fn();
  const renameColumn = vi.fn();
  const updateBoard = vi.fn();
  const deleteColumn = vi.fn();
  const deleteBoard = vi.fn();
  const moveToColumn = vi.fn();
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'user-1' } });
  const profile = signal<{ id: string; is_active: boolean } | null>({
    id: 'user-1',
    is_active: true,
  });
  const board: BoardDetail = {
    id,
    title: 'Quadro de Testes',
    description: 'Descrição local',
    created_at: '2026-09-29T13:42:00Z',
    department: { name: 'Departamento de Testes' },
    columns: [
      { id: 'column-1', title: 'Entrada', position: 0, business_state: null },
      { id: 'column-2', title: 'Execução', position: 1, business_state: 'fazendo' },
    ],
  };
  const tasks = [
    {
      id: 'task-1',
      board_id: id,
      column_id: 'column-1',
      title: 'Primeira pendência',
      description: null,
      created_by: 'user-1',
      assignee_id: 'user-2',
      due_at: '2030-01-10T12:00:00Z',
      business_state: 'aguardando_aceite' as const,
      is_private: false,
      created_at: '2026-09-28T12:00:00Z',
    },
    {
      id: 'task-2',
      board_id: id,
      column_id: 'column-2',
      title: 'Segunda pendência',
      description: null,
      created_by: 'user-1',
      assignee_id: 'user-1',
      due_at: '2030-01-11T12:00:00Z',
      business_state: 'a_fazer' as const,
      is_private: true,
      created_at: '2026-09-28T12:01:00Z',
    },
  ];

  beforeEach(() => {
    profile.set({ id: 'user-1', is_active: true });
    session.set({ user: { id: 'user-1' } });
    getById.mockReset().mockResolvedValue({ status: 'loaded', board });
    list.mockReset().mockResolvedValue(tasks);
    listAssignees.mockReset().mockResolvedValue([
      { id: 'user-1', display_name: 'Pessoa Um' },
      { id: 'user-2', display_name: 'Pessoa Dois' },
    ]);
    create.mockReset().mockResolvedValue('task-new');
    canManageStructure.mockReset().mockResolvedValue(false);
    createColumn.mockReset().mockResolvedValue('column-new');
    renameColumn.mockReset().mockResolvedValue(undefined);
    updateBoard.mockReset().mockResolvedValue(undefined);
    deleteColumn.mockReset().mockResolvedValue(undefined);
    deleteBoard.mockReset().mockResolvedValue(undefined);
    moveToColumn.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'quadros/:id', component: BoardPage }]),
        {
          provide: BoardsService,
          useValue: {
            getById,
            canManageStructure,
            createColumn,
            renameColumn,
            updateBoard,
            deleteColumn,
            deleteBoard,
          },
        },
        { provide: TasksService, useValue: { list, listAssignees, create, moveToColumn } },
        { provide: AuthService, useValue: { session, profile } },
      ],
    });
  });

  async function render() {
    const harness = await RouterTestingHarness.create(`/quadros/${id}`);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  it('shows loading until the board request finishes', async () => {
    let resolve!: (value: BoardResult) => void;
    getById.mockImplementation(
      () =>
        new Promise<BoardResult>((done) => {
          resolve = done;
        }),
    );
    const harness = await RouterTestingHarness.create(`/quadros/${id}`);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Carregando quadro');
    resolve({ status: 'loaded', board });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Quadro de Testes');
  });

  it('loads real tasks and distributes them by column', async () => {
    const harness = await render();
    const columns = harness.routeNativeElement!.querySelectorAll('.kanban-column');
    expect(list).toHaveBeenCalledExactlyOnceWith(id);
    expect(listAssignees).toHaveBeenCalledExactlyOnceWith(id);
    expect(columns[0].textContent).toContain('Primeira pendência');
    expect(columns[0].textContent).not.toContain('Segunda pendência');
    expect(columns[1].textContent).toContain('Segunda pendência');
    expect(columns[1].textContent).toContain('Pessoa Um');
    expect(harness.routeNativeElement?.textContent).toContain('Aguardando aceite');
    expect(columns[0].querySelector('.task-card-link')?.getAttribute('href')).toBe(
      '/pendencias/task-1',
    );
  });

  it('renders an empty state in every column when there are no tasks', async () => {
    list.mockResolvedValue([]);
    const harness = await render();
    expect(harness.routeNativeElement!.querySelectorAll('.empty-column')).toHaveLength(2);
    expect(harness.routeNativeElement?.textContent).toContain('Nenhuma pendência nesta coluna.');
  });

  it('reflects a refreshed business state without moving the card column', async () => {
    list.mockResolvedValue([{ ...tasks[0], business_state: 'fazendo', column_id: 'column-1' }]);
    const harness = await render();
    const columns = harness.routeNativeElement!.querySelectorAll('.kanban-column');
    expect(columns[0].textContent).toContain('Fazendo');
    expect(columns[0].textContent).toContain('Primeira pendência');
    expect(columns[1].textContent).not.toContain('Primeira pendência');
  });

  it('opens the creation form and defaults the first column', async () => {
    const harness = await render();
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.board-info button')!.click();
    harness.detectChanges();
    expect(
      harness.routeNativeElement?.querySelector('[aria-label="Nova pendência"]'),
    ).not.toBeNull();
    expect(
      harness.routeNativeElement?.querySelector<HTMLSelectElement>(
        'select[formControlName="columnId"]',
      )?.value,
    ).toBe('column-1');
  });

  it('keeps privacy available for self-assignment', async () => {
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    page.openForm();
    page.form.controls.assigneeId.setValue('user-1');
    page.assigneeChanged();
    page.form.controls.isPrivate.setValue(true);
    harness.detectChanges();
    expect(page.form.controls.isPrivate.enabled).toBe(true);
    expect(page.form.controls.isPrivate.value).toBe(true);
    expect(harness.routeNativeElement?.textContent).not.toContain('são compartilhadas');
  });

  it('clears and disables privacy when assigned to another user', async () => {
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    page.openForm();
    page.form.controls.isPrivate.setValue(true);
    page.form.controls.assigneeId.setValue('user-2');
    page.assigneeChanged();
    harness.detectChanges();
    expect(page.form.controls.isPrivate.disabled).toBe(true);
    expect(page.form.controls.isPrivate.value).toBe(false);
    expect(harness.routeNativeElement?.textContent).toContain(
      'Pendências atribuídas a outra pessoa são compartilhadas.',
    );
  });

  it('validates required fields before creating', async () => {
    const harness = await render();
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.board-info button')!.click();
    harness.detectChanges();
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    harness.detectChanges();
    expect(create).not.toHaveBeenCalled();
    expect(harness.routeNativeElement?.textContent).toContain('Informe um título.');
    expect(harness.routeNativeElement?.textContent).toContain('Selecione um responsável.');
    expect(harness.routeNativeElement?.textContent).toContain('Informe um prazo.');
  });

  it('creates once, closes the form and refreshes the Kanban', async () => {
    const newTask = {
      ...tasks[0],
      id: 'task-new',
      title: 'Pendência recém-criada',
      column_id: 'column-2',
    };
    list.mockResolvedValueOnce(tasks).mockResolvedValueOnce([...tasks, newTask]);
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    page.openForm();
    page.form.setValue({
      title: 'Pendência recém-criada',
      description: '',
      assigneeId: 'user-2',
      dueAt: '2030-01-12T10:30',
      columnId: 'column-2',
      isPrivate: false,
    });
    const pending = page.createTask();
    await page.createTask();
    await pending;
    harness.detectChanges();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      boardId: id,
      columnId: 'column-2',
      assigneeId: 'user-2',
    });
    expect(list).toHaveBeenCalledTimes(2);
    expect(harness.routeNativeElement?.textContent).toContain('Pendência recém-criada');
    const createdCard = Array.from(harness.routeNativeElement!.querySelectorAll('.task-card')).find(
      (card) => card.textContent?.includes('Pendência recém-criada'),
    );
    expect(createdCard?.textContent).toContain('Compartilhada');
    expect(harness.routeNativeElement?.querySelector('[aria-label="Nova pendência"]')).toBeNull();
  });

  it('shows a friendly creation error and permits another attempt', async () => {
    create.mockRejectedValueOnce(new Error('internal detail')).mockResolvedValueOnce('task-new');
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    page.openForm();
    page.form.setValue({
      title: 'Falha temporária',
      description: '',
      assigneeId: 'user-1',
      dueAt: '2030-01-12T10:30',
      columnId: 'column-1',
      isPrivate: false,
    });
    await page.createTask();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain(
      'Não foi possível criar a pendência.',
    );
    expect(harness.routeNativeElement?.textContent).not.toContain('internal detail');
    await page.createTask();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('shows task loading errors without exposing internals', async () => {
    list.mockRejectedValue(new Error('private detail'));
    const harness = await render();
    expect(harness.routeNativeElement?.textContent).toContain(
      'Não foi possível carregar as pendências',
    );
    expect(harness.routeNativeElement?.textContent).not.toContain('private detail');
  });

  it.each([
    ['unavailable', 'Quadro não encontrado ou sem acesso'],
    ['forbidden', 'Acesso negado'],
    ['error', 'Não foi possível carregar o quadro'],
  ])('renders the %s board state without requesting tasks', async (status, heading) => {
    getById.mockResolvedValue({ status });
    const harness = await render();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(heading);
    expect(list).not.toHaveBeenCalled();
  });

  it('creates and renames columns only when board management is allowed', async () => {
    canManageStructure.mockResolvedValue(true);
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    page.openNewColumn();
    page.newColumnName.set(' Revisão ');
    await page.createColumn();
    expect(createColumn).toHaveBeenCalledExactlyOnceWith(id, 'Revisão');
    expect(page.board()?.columns.at(-1)?.title).toBe('Revisão');
    page.startRename(page.board()!.columns[0]);
    page.renameColumnName.set(' Entrada nova ');
    await page.renameColumn(page.board()!.columns[0]);
    expect(renameColumn).toHaveBeenCalledExactlyOnceWith('column-1', 'Entrada nova');
    expect(page.board()?.columns[0].title).toBe('Entrada nova');
  });

  it('shows creation metadata and management actions only when authorized', async () => {
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    expect(harness.routeNativeElement?.textContent).toContain('Criado em 29/09/2026 às 10:42');
    expect(
      harness.routeNativeElement?.querySelector('[aria-label="Ações administrativas do quadro"]'),
    ).toBeNull();

    page.canManage.set(true);
    harness.detectChanges();
    expect(
      harness.routeNativeElement?.querySelector('[aria-label="Ações administrativas do quadro"]'),
    ).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Nova coluna');
    expect(harness.routeNativeElement?.querySelector('.new-column-card')).toBeNull();
  });

  it('edits the board through the service and updates the heading immediately', async () => {
    canManageStructure.mockResolvedValue(true);
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    page.openEditBoard();
    page.editBoardForm.setValue({ title: ' Quadro atualizado ', description: ' Nova descrição ' });
    await page.saveBoard();
    harness.detectChanges();
    expect(updateBoard).toHaveBeenCalledExactlyOnceWith(id, {
      title: ' Quadro atualizado ',
      description: ' Nova descrição ',
    });
    expect(page.board()?.title).toBe('Quadro atualizado');
    expect(harness.routeNativeElement?.textContent).toContain('Quadro atualizado');
  });

  it('shows the first-column empty state without the former trailing card', async () => {
    canManageStructure.mockResolvedValue(true);
    getById.mockResolvedValue({ status: 'loaded', board: { ...board, columns: [] } });
    const harness = await render();
    expect(harness.routeNativeElement?.textContent).toContain(
      'Este quadro ainda não possui colunas.',
    );
    expect(harness.routeNativeElement?.textContent).toContain('Criar primeira coluna');
    expect(harness.routeNativeElement?.querySelector('.new-column-card')).toBeNull();
  });

  it('requires confirmation to delete a column and reports an occupied column', async () => {
    canManageStructure.mockResolvedValue(true);
    deleteColumn.mockRejectedValue(
      new Error('Esta coluna possui pendências. Mova as pendências antes de excluí-la.'),
    );
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    page.requestDeleteColumn(page.board()!.columns[0]);
    harness.detectChanges();
    expect(deleteColumn).not.toHaveBeenCalled();
    expect(harness.routeNativeElement?.textContent).toContain('Excluir coluna?');
    await page.confirmDeletion();
    harness.detectChanges();
    expect(deleteColumn).toHaveBeenCalledExactlyOnceWith('column-1');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Mova as pendências antes de excluí-la.',
    );
    expect(page.board()?.columns).toHaveLength(2);
  });

  it('requires confirmation to delete a board and navigates after success', async () => {
    canManageStructure.mockResolvedValue(true);
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    const router = TestBed.inject(Router);
    const navigation = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    page.requestDeleteBoard();
    harness.detectChanges();
    expect(deleteBoard).not.toHaveBeenCalled();
    expect(harness.routeNativeElement?.textContent).toContain('Excluir quadro?');
    await page.confirmDeletion();
    expect(deleteBoard).toHaveBeenCalledExactlyOnceWith(id);
    expect(navigation).toHaveBeenCalledWith('/quadros');
  });

  it('shows a friendly error when a board still has tasks', async () => {
    canManageStructure.mockResolvedValue(true);
    deleteBoard.mockRejectedValue(
      new Error('Não é possível excluir este quadro enquanto houver pendências vinculadas.'),
    );
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    page.requestDeleteBoard();
    await page.confirmDeletion();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain(
      'Não é possível excluir este quadro enquanto houver pendências vinculadas.',
    );
  });

  it('moves a card without changing its business state', async () => {
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    const originalState = page.tasks()[0].business_state;
    await page.dropTask({ item: { data: page.tasks()[0] } } as never, 'column-2');
    expect(moveToColumn).toHaveBeenCalledExactlyOnceWith('task-1', 'column-2');
    expect(page.tasks()[0].column_id).toBe('column-2');
    expect(page.tasks()[0].business_state).toBe(originalState);
  });

  it('restores the original column when movement fails', async () => {
    moveToColumn.mockRejectedValue(new Error('private detail'));
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    await page.dropTask({ item: { data: page.tasks()[0] } } as never, 'column-2');
    expect(page.tasks()[0].column_id).toBe('column-1');
    expect(page.managementError()).toContain('voltou para a coluna anterior');
  });

  it('keeps the active/completed filter local to visibility', async () => {
    list.mockResolvedValue([
      ...tasks,
      { ...tasks[0], id: 'task-3', title: 'Concluída', business_state: 'concluido' },
    ]);
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    expect(page.tasksForColumn('column-1').map((task) => task.id)).toEqual(['task-1']);
    page.filter.set('completed');
    expect(page.tasksForColumn('column-1').map((task) => task.id)).toEqual(['task-3']);
  });

  it('allows an unrelated active participant to move shared tasks but not private tasks', async () => {
    const unrelated = tasks.map((task) => ({ ...task, created_by: 'other', assignee_id: 'other' }));
    list.mockResolvedValue(unrelated);
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    expect(page.canMove(page.tasks()[0])).toBe(true);
    expect(page.canMove(page.tasks()[1])).toBe(false);
    await page.dropTask({ item: { data: page.tasks()[0] } } as never, 'column-2');
    expect(moveToColumn).toHaveBeenCalledExactlyOnceWith('task-1', 'column-2');
    expect(page.tasks()[0].business_state).toBe('aguardando_aceite');
    await page.dropTask({ item: { data: page.tasks()[0] } } as never, 'column-2');
    expect(moveToColumn).toHaveBeenCalledTimes(1);
    page.canManage.set(true);
    expect(page.canMove(page.tasks()[1])).toBe(true);
  });
  it('rejects inactive, missing or mismatched profiles and tasks outside the loaded board', async () => {
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as BoardPage;
    expect(page.canMove({ ...page.tasks()[0], board_id: 'other' })).toBe(false);
    expect(page.canMove({ ...page.tasks()[0], id: 'hidden' })).toBe(false);
    for (const value of [
      null,
      { id: 'user-1', is_active: false },
      { id: 'other', is_active: true },
    ]) {
      profile.set(value);
      expect(page.canMove(page.tasks()[0])).toBe(false);
      await page.dropTask({ item: { data: page.tasks()[0] } } as never, 'column-2');
    }
    expect(moveToColumn).not.toHaveBeenCalled();
  });
});
