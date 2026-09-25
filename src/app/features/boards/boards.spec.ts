import { TestBed } from '@angular/core/testing';
import { BoardSummary } from './board-summary';
import { Boards } from './boards';
import { BoardsService } from './boards.service';

describe('Boards', () => {
  const list = vi.fn();
  const boards: BoardSummary[] = [
    { id: 'board-1', title: 'Vacinação local', description: 'Organização da equipe', department: { name: 'Equipe local' } },
    { id: 'board-2', title: 'Planejamento local', description: null, department: null },
  ];

  beforeEach(() => {
    list.mockReset().mockResolvedValue(boards);
    TestBed.configureTestingModule({ imports: [Boards], providers: [
      { provide: BoardsService, useValue: { list } },
    ] });
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
    list.mockImplementation(() => new Promise<BoardSummary[]>((done) => { resolve = done; }));
    const fixture = TestBed.createComponent(Boards);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Carregando');
    expect(fixture.nativeElement.textContent).not.toContain('Nenhum quadro');
    expect(fixture.nativeElement.querySelector('input').disabled).toBe(true);
    resolve(boards);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.board-tile').length).toBe(2);
  });

  it('renders returned data and fallbacks without demo counts or links', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    expect(list).toHaveBeenCalledOnce();
    expect(element.querySelectorAll('.board-tile').length).toBe(2);
    for (const text of ['Vacinação local', 'Organização da equipe', 'Equipe local', 'Sem descrição.', 'Departamento indisponível', '2 quadros disponíveis']) {
      expect(element.textContent).toContain(text);
    }
    expect(element.textContent).not.toContain('cards fictícios');
    expect(element.querySelector('a')).toBeNull();
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
    input.value = 'inexistente';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum quadro encontrado');
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.board-tile').length).toBe(2);
    expect(list).toHaveBeenCalledOnce();
  });

  it('shows a safe error and retries successfully', async () => {
    list.mockRejectedValueOnce(new Error('sensitive server information'));
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Não foi possível carregar os quadros.');
    expect(fixture.nativeElement.textContent).not.toContain('sensitive server information');
    expect(fixture.nativeElement.textContent).not.toContain('Nenhum quadro');
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.board-tile').length).toBe(2);
    expect(list).toHaveBeenCalledTimes(2);
  });
});
