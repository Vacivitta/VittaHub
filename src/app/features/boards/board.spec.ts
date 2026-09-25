import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BoardPage } from './board';
import { BoardDetail, BoardResult } from './board-detail';
import { BoardsService } from './boards.service';

describe('BoardPage', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const secondId = '22222222-2222-4222-8222-222222222222';
  const getById = vi.fn();
  const board: BoardDetail = {
    id, title: 'Quadro de Testes', description: 'Descrição local', department: { name: 'Departamento de Testes' },
    columns: [
      { id: 'column-1', title: 'Entrada', position: 0, business_state: null },
      { id: 'column-2', title: 'Execução', position: 1, business_state: 'fazendo' },
    ],
  };

  beforeEach(() => {
    getById.mockReset().mockResolvedValue({ status: 'loaded', board });
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'quadros/:id', component: BoardPage }]),
      { provide: BoardsService, useValue: { getById } },
    ] });
  });

  async function render() {
    const harness = await RouterTestingHarness.create(`/quadros/${id}`);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  it('shows loading until the request finishes', async () => {
    let resolve!: (value: BoardResult) => void;
    getById.mockImplementation(() => new Promise<BoardResult>((done) => { resolve = done; }));
    const harness = await render();
    expect(harness.routeNativeElement?.querySelector('[role="status"]')?.textContent).toContain('Carregando quadro');
    expect(harness.routeNativeElement?.querySelector('.kanban')).toBeNull();
    resolve({ status: 'loaded', board });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Quadro de Testes');
  });

  it('renders real columns with optional state and no fictional cards or counts', async () => {
    const harness = await render();
    const element = harness.routeNativeElement!;
    expect(getById).toHaveBeenCalledExactlyOnceWith(id);
    expect(element.textContent).toContain('Departamento de Testes');
    expect(element.textContent).toContain('Descrição local');
    expect(Array.from(element.querySelectorAll('.kanban-column h2'), (heading) => heading.textContent)).toEqual(['Entrada', 'Execução']);
    expect(element.textContent).toContain('Coluna organizacional · sem estado vinculado');
    expect(element.textContent).toContain('Estado: Fazendo');
    expect(element.textContent).toContain('Os cartões ainda não estão disponíveis.');
    expect(element.querySelector('app-task-card')).toBeNull();
    expect(element.querySelector('.column-count')).toBeNull();
    expect(element.querySelector('button')).toBeNull();
  });

  it('shows the empty-column state and nullable metadata fallbacks', async () => {
    getById.mockResolvedValue({ status: 'loaded', board: { ...board, description: null, department: null, columns: [] } });
    const harness = await render();
    expect(harness.routeNativeElement?.textContent).toContain('Este quadro ainda não tem colunas');
    expect(harness.routeNativeElement?.textContent).toContain('Sem descrição.');
    expect(harness.routeNativeElement?.textContent).toContain('Departamento indisponível');
    expect(harness.routeNativeElement?.querySelector('.kanban')).toBeNull();
  });

  it.each([
    ['unavailable', 'Quadro não encontrado ou sem acesso'],
    ['forbidden', 'Acesso negado'],
    ['error', 'Não foi possível carregar o quadro'],
  ])('renders the %s state', async (status, heading) => {
    getById.mockResolvedValue({ status });
    const harness = await render();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(heading);
    expect(harness.routeNativeElement?.querySelector('.kanban')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('.back-link')?.getAttribute('href')).toBe('/quadros');
  });

  it('handles an unexpected error safely and allows retrying', async () => {
    getById.mockRejectedValueOnce(new Error('private details'));
    const harness = await render();
    expect(harness.routeNativeElement?.textContent).not.toContain('private details');
    harness.routeNativeElement?.querySelector('button')?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(getById).toHaveBeenCalledTimes(2);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Quadro de Testes');
  });

  it('ignores an old response when navigating to another board', async () => {
    let resolve!: (value: BoardResult) => void;
    getById.mockImplementationOnce(() => new Promise<BoardResult>((done) => { resolve = done; }));
    const harness = await render();
    getById.mockResolvedValue({ status: 'loaded', board: { ...board, id: secondId, title: 'Segundo quadro' } });
    await harness.navigateByUrl(`/quadros/${secondId}`);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Segundo quadro');
    resolve({ status: 'loaded', board });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Segundo quadro');
    expect(getById).toHaveBeenLastCalledWith(secondId);
  });
});
