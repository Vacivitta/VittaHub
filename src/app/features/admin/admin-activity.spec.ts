import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminActivity } from './admin-activity';
import { AdminService } from './admin.service';
import { AdminAccessError, AdminActivityDashboard } from './admin.models';
import { AuthService } from '../../core/auth/auth.service';

describe('AdminActivity', () => {
  const access = signal(true);
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'manager' } });
  const getActivity = vi.fn();
  const dashboard: AdminActivityDashboard = {
    completed: 2,
    in_progress: 3,
    average_seconds: 90000,
    duration_samples: 1,
    total_events: 1,
    boards: [{ id: 'board', name: 'Quadro autorizado' }],
    people: [{ id: 'person', name: 'Pessoa Teste' }],
    events: [
      {
        id: 'event',
        task_id: 'task',
        task_title: 'Pendência autorizada',
        board_id: 'board',
        board_title: 'Quadro autorizado',
        actor_id: 'person',
        actor_name: 'Pessoa Teste',
        event_type: 'completed',
        content: 'Pendência concluída',
        created_at: '2026-10-02T12:00:00Z',
        elapsed_seconds: null,
      },
    ],
  };
  beforeEach(() => {
    access.set(true);
    session.set({ user: { id: 'manager' } });
    getActivity.mockReset().mockResolvedValue(dashboard);
    TestBed.configureTestingModule({
      imports: [AdminActivity],
      providers: [
        provideRouter([]),
        { provide: AdminService, useValue: { getActivity } },
        { provide: AuthService, useValue: { session, canAccessAdministration: access } },
      ],
    });
  });
  async function render() {
    const fixture = TestBed.createComponent(AdminActivity);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  afterEach(() => vi.useRealTimers());

  it('starts collapsed and preserves data and filters when toggled; searches only filter options', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;
    const details = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    const data = page.data();
    const search = fixture.nativeElement.querySelector(
      '[aria-label="Pesquisar colaborador"]',
    ) as HTMLInputElement;
    search.value = 'missing';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(page.filteredPeople()).toEqual([]);
    page.boardSearch = 'missing';
    expect(page.filteredBoards()).toEqual([]);
    page.actorId = 'person';
    page.boardId = 'board';
    fixture.detectChanges();
    expect(page.filteredPeople()).toEqual(dashboard.people);
    expect(page.filteredBoards()).toEqual(dashboard.boards);
    details.querySelector('summary')!.click();
    fixture.detectChanges();
    expect(details.open).toBe(true);
    details.querySelector('summary')!.click();
    fixture.detectChanges();
    expect(details.open).toBe(false);
    expect(page.data()).toBe(data);
    expect(page.actorId).toBe('person');
    expect(page.actorSearch).toBe('missing');
    expect(getActivity).toHaveBeenCalledTimes(1);
    page.clearFilters();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(page.actorId).toBe('');
    expect(page.boardId).toBe('');
    expect(page.actorSearch).toBe('');
    expect(page.boardSearch).toBe('');
    expect(getActivity).toHaveBeenCalledTimes(2);
  });

  it('clears every filter to its default with one query, cancelling pending debounce', async () => {
    const fixture = await render();
    vi.useFakeTimers();
    const page = fixture.componentInstance;
    const defaults = { from: page.from, to: page.to };
    page.actorId = 'person';
    page.boardId = 'board';
    page.from = '2020-01-01';
    page.to = '2020-01-02';
    page.filtersChanged();
    fixture.nativeElement.querySelector('.clear-filters').click();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(500);
    fixture.detectChanges();
    expect(getActivity).toHaveBeenCalledTimes(2);
    expect(page.actorId).toBe('');
    expect(page.boardId).toBe('');
    expect(page.from).toBe(defaults.from);
    expect(page.to).toBe(defaults.to);
    const end = new Date(`${defaults.to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    expect(getActivity).toHaveBeenLastCalledWith({
      actorId: null,
      boardId: null,
      from: new Date(`${defaults.from}T00:00:00`).toISOString(),
      to: end.toISOString(),
    });
    expect(page.data()).toEqual(dashboard);
    expect(fixture.nativeElement.querySelector('[name="actor"]').value).toBe('');
    expect(fixture.nativeElement.querySelector('[name="board"]').value).toBe('');
    expect(fixture.nativeElement.querySelector('.timeline-title button').textContent.trim()).toBe(
      'Atualizar',
    );
  });

  it('ignores an older response after clearing filters', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;
    let resolve!: (value: AdminActivityDashboard) => void;
    getActivity.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    page.actorId = 'person';
    const pending = page.load();
    fixture.nativeElement.querySelector('.clear-filters').click();
    await fixture.whenStable();
    resolve({ ...dashboard, completed: 99 });
    await pending;
    expect(getActivity).toHaveBeenCalledTimes(3);
    expect(page.data()?.completed).toBe(2);
    expect(page.actorId).toBe('');
  });

  it('debounces changes to all four controls and validates dates without querying', async () => {
    const fixture = await render();
    vi.useFakeTimers();
    expect(fixture.nativeElement.querySelector('.activity-filters button').textContent.trim()).toBe(
      'Limpar filtros',
    );
    for (const [name, value, event] of [
      ['actor', 'person', 'change'],
      ['board', 'board', 'change'],
      ['from', '2026-10-01', 'input'],
      ['to', '2026-10-02', 'input'],
    ]) {
      const control = fixture.nativeElement.querySelector(`[name="${name}"]`);
      control.value = value;
      control.dispatchEvent(new Event(event));
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(getActivity).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(getActivity).toHaveBeenCalledTimes(2);
    expect(getActivity).toHaveBeenLastCalledWith({
      actorId: 'person',
      boardId: 'board',
      from: new Date('2026-10-01T00:00:00').toISOString(),
      to: new Date('2026-10-03T00:00:00').toISOString(),
    });
    const from = fixture.nativeElement.querySelector('[name="from"]');
    from.value = '2026-11-01';
    from.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(250);
    expect(getActivity).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.error()).toContain('período válido');
  });

  it('ignores old responses both during debounce and after the newest request finishes', async () => {
    const fixture = await render();
    vi.useFakeTimers();
    const page = fixture.componentInstance;
    let resolveOld!: (value: AdminActivityDashboard) => void;
    getActivity.mockReturnValueOnce(
      new Promise((done) => {
        resolveOld = done;
      }),
    );
    const pending = page.load();
    page.actorId = 'person';
    page.filtersChanged();
    resolveOld({ ...dashboard, completed: 99 });
    await pending;
    expect(page.data()).toBeNull();
    expect(page.loading()).toBe(true);
    await vi.advanceTimersByTimeAsync(250);
    expect(page.data()?.completed).toBe(2);
    getActivity.mockReturnValueOnce(
      new Promise((done) => {
        resolveOld = done;
      }),
    );
    const second = page.load();
    page.boardId = 'board';
    page.filtersChanged();
    await vi.advanceTimersByTimeAsync(250);
    resolveOld({ ...dashboard, completed: 99 });
    await second;
    expect(page.data()?.completed).toBe(2);
  });

  it('refreshes metrics and timeline together from their button and retains the update time', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;
    const previousTime = page.updatedAt();
    page.actorId = 'person';
    let resolve!: (value: AdminActivityDashboard) => void;
    getActivity.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    fixture.nativeElement.querySelector('.timeline-title button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.updated')).not.toBeNull();
    expect(page.updatedAt()).toBe(previousTime);
    expect(getActivity).toHaveBeenLastCalledWith(expect.objectContaining({ actorId: 'person' }));
    resolve({ ...dashboard, completed: 7, events: [], total_events: 0 });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(page.data()?.completed).toBe(7);
    expect(fixture.nativeElement.textContent).toContain('Nenhuma atividade encontrada');
    expect(page.updatedAt()).not.toBe(previousTime);
  });

  it('cancels scheduled automatic refresh on destruction', async () => {
    const fixture = await render();
    vi.useFakeTimers();
    fixture.componentInstance.filtersChanged();
    fixture.destroy();
    await vi.advanceTimersByTimeAsync(250);
    expect(getActivity).toHaveBeenCalledTimes(1);
  });
  it('renders metrics, named timeline, real links and missing durations', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;
    for (const value of [
      'Acompanhamento de atividades',
      '2',
      '3',
      '1 d 1 h 0 min',
      'Pessoa Teste',
      'Pendência concluída',
      'Quadro autorizado',
      'Não disponível',
      'Não representa horas trabalhadas',
    ]) {
      expect(text).toContain(value);
    }
    expect(fixture.nativeElement.querySelector('.timeline time').textContent).toMatch(
      /02\/10\/2026 \d{2}:00/,
    );
    expect(fixture.nativeElement.querySelector('a[href="/pendencias/task"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.metric')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });
  it('sends all filters to the server using inclusive local calendar dates', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;
    page.actorId = 'person';
    page.boardId = 'board';
    page.from = '2026-10-01';
    page.to = '2026-10-02';
    await page.load();
    expect(getActivity).toHaveBeenLastCalledWith({
      actorId: 'person',
      boardId: 'board',
      from: new Date('2026-10-01T00:00:00').toISOString(),
      to: new Date('2026-10-03T00:00:00').toISOString(),
    });
    expect(fixture.nativeElement.querySelector('label select')).not.toBeNull();
    page.from = '2026-11-01';
    await page.load();
    expect(getActivity).toHaveBeenCalledTimes(2);
    expect(page.error()).toContain('período válido');
  });
  it('shows loading without stale metrics, then an empty result and unavailable average', async () => {
    let resolve!: (value: AdminActivityDashboard) => void;
    getActivity.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Carregando indicadores');
    expect(fixture.nativeElement.querySelector('.metrics')).toBeNull();
    resolve({
      ...dashboard,
      events: [],
      total_events: 0,
      completed: 0,
      average_seconds: null,
      duration_samples: 0,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma atividade encontrada');
    expect(fixture.nativeElement.querySelector('.duration strong').textContent).toContain(
      'Não disponível',
    );
  });
  it('clears stale results on failure and retries with human errors', async () => {
    const fixture = await render();
    getActivity.mockRejectedValueOnce(new Error('secret database details'));
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar as atividades');
    expect(fixture.nativeElement.textContent).not.toContain('secret database');
    expect(fixture.componentInstance.data()).toBeNull();
    fixture.nativeElement.querySelector('.activity-state button').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.data()).toEqual(dashboard);
  });
  it.each(['logout', 'user', 'access'])('discards a late response after %s', async (change) => {
    let resolve!: (value: AdminActivityDashboard) => void;
    getActivity.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const fixture = await render();
    if (change === 'logout') session.set(null);
    else if (change === 'user') session.set({ user: { id: 'other' } });
    else access.set(false);
    fixture.detectChanges();
    resolve(dashboard);
    await fixture.whenStable();
    expect(fixture.componentInstance.data()).toBeNull();
    expect(fixture.componentInstance.people()).toEqual([]);
  });
  it('reports database authorization loss and clears options', async () => {
    const fixture = await render();
    const denied = vi.fn();
    fixture.componentInstance.accessDenied.subscribe(denied);
    getActivity.mockRejectedValue(new AdminAccessError());
    await fixture.componentInstance.load();
    expect(denied).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.data()).toBeNull();
    expect(fixture.componentInstance.boards()).toEqual([]);
  });
  it('explains timeline truncation without reducing metric totals', async () => {
    getActivity.mockResolvedValue({ ...dashboard, total_events: 250 });
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('250 atividades');
    expect(fixture.nativeElement.textContent).toContain('os indicadores consideram todo o filtro');
  });
});
