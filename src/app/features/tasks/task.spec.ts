import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../../core/auth/auth.service';
import { TaskDetailPage } from './task';
import { TaskResult, TaskWithContext } from './task-detail';
import { TasksService } from './tasks.service';

describe('TaskDetailPage', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const getById = vi.fn();
  const listAssignees = vi.fn();
  const listHistory = vi.fn();
  const listComments = vi.fn();
  const addComment = vi.fn();
  const accept = vi.fn();
  const start = vi.fn();
  const complete = vi.fn();
  const resume = vi.fn();
  const waitForThirdParty = vi.fn();
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'user-1' } });
  const profile = signal<{ id: string; display_name: string | null } | null>({ id: 'user-1', display_name: 'Pessoa Atual' });
  const auth = { session, profile, displayName: signal('Pessoa Atual') };
  const task: TaskWithContext = {
    id, board_id: 'board-1', column_id: 'column-1', title: 'Detalhe real',
    description: 'Descrição persistida', created_by: 'user-3', assignee_id: 'user-2',
    due_at: '2030-01-01T12:00:00Z', business_state: 'aguardando_aceite', is_private: true,
    created_at: '2026-09-28T12:00:00Z', board: { id: 'board-1', title: 'Quadro real' },
    column: { id: 'column-1', title: 'Entrada' },
  };

  beforeEach(() => {
    profile.set({ id: 'user-1', display_name: 'Pessoa Atual' });
    session.set({ user: { id: 'user-1' } });
    getById.mockReset().mockResolvedValue({ status: 'loaded', task });
    listAssignees.mockReset().mockResolvedValue([
      { id: 'user-2', display_name: 'Responsável visível' },
      { id: 'user-3', display_name: 'Criador visível' },
    ]);
    listHistory.mockReset().mockResolvedValue([]);
    listComments.mockReset().mockResolvedValue([]);
    addComment.mockReset().mockResolvedValue('comment-new');
    accept.mockReset().mockResolvedValue(undefined);
    start.mockReset().mockResolvedValue(undefined);
    complete.mockReset().mockResolvedValue(undefined);
    resume.mockReset().mockResolvedValue(undefined);
    waitForThirdParty.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'pendencias/:id', component: TaskDetailPage }]),
      { provide: TasksService, useValue: {
        getById, listAssignees, listHistory, listComments, addComment,
        accept, start, complete, resume, waitForThirdParty,
      } },
      { provide: AuthService, useValue: auth },
    ] });
  });

  async function render() {
    const harness = await RouterTestingHarness.create(`/pendencias/${id}`);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  it('shows loading while the RLS query is pending', async () => {
    let resolve!: (result: TaskResult) => void;
    getById.mockImplementation(() => new Promise<TaskResult>((done) => { resolve = done; }));
    const harness = await RouterTestingHarness.create(`/pendencias/${id}`);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Carregando pendência');
    resolve({ status: 'unavailable' });
    await harness.fixture.whenStable();
  });

  it('renders an accessible real task and only safely available related names', async () => {
    const harness = await render();
    const text = harness.routeNativeElement!.textContent!;
    expect(getById).toHaveBeenCalledExactlyOnceWith(id);
    expect(listAssignees).toHaveBeenCalledExactlyOnceWith('board-1');
    expect(listHistory).toHaveBeenCalledExactlyOnceWith(id);
    expect(listComments).toHaveBeenCalledExactlyOnceWith(id);
    expect(text).toContain('Detalhe real');
    expect(text).toContain('Descrição persistida');
    expect(text).toContain('Responsável visível');
    expect(text).toContain('Criador visível');
    expect(text).toContain('Quadro real');
    expect(text).toContain('Entrada');
    expect(text).toContain('Privada');
    expect(harness.routeNativeElement?.querySelector('a[href="/quadros/board-1"]')).not.toBeNull();
  });

  it('shows an action only to the assignee in the exact applicable state', async () => {
    session.set({ user: { id: 'user-2' } });
    const harness = await render();
    expect(harness.routeNativeElement?.querySelector('.task-action button')?.textContent).toContain('Aceitar pendência');

    session.set({ user: { id: 'user-1' } });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('.task-action')).toBeNull();
  });

  it.each([
    ['a_fazer', 'Iniciar pendência'], ['fazendo', 'Concluir pendência'],
    ['aguardando_terceiro', 'Retomar pendência'], ['concluido', null],
  ] as const)('shows the correct action for %s', async (state, label) => {
    session.set({ user: { id: 'user-2' } });
    getById.mockResolvedValue({ status: 'loaded', task: { ...task, business_state: state } });
    const harness = await render();
    const button = harness.routeNativeElement?.querySelector('.task-action button');
    if (label) expect(button?.textContent).toContain(label);
    else expect(button).toBeNull();
  });

  it('loads comments with safely available author names', async () => {
    listComments.mockResolvedValue([{ id: 'comment-1', task_id: id, author_id: 'user-2',
      content: 'Comentário carregado', created_at: '2026-09-28T15:00:00Z' }]);
    const harness = await render();
    const comments = harness.routeNativeElement!.querySelector('[aria-label="Comentários da pendência"]');
    expect(comments?.textContent).toContain('Comentário carregado');
    expect(comments?.textContent).toContain('Responsável visível');
  });

  it('sends a valid comment and shows it without reloading the page', async () => {
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as TaskDetailPage;
    page.commentText.set('  Novo comentário  ');
    listComments.mockResolvedValue([{ id: 'comment-new', task_id: id, author_id: 'user-1',
      content: 'Novo comentário', created_at: '2026-09-28T15:00:00Z' }]);
    await page.submitComment();
    harness.detectChanges();
    expect(addComment).toHaveBeenCalledExactlyOnceWith(id, 'Novo comentário');
    expect(harness.routeNativeElement?.textContent).toContain('Novo comentário');
    expect(page.commentText()).toBe('');
  });

  it('does not send an empty comment', async () => {
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as TaskDetailPage;
    page.commentText.set('   ');
    await page.submitComment();
    harness.detectChanges();
    expect(addComment).not.toHaveBeenCalled();
    expect(harness.routeNativeElement?.textContent).toContain('Escreva um comentário.');
  });

  it('prevents duplicate comment submission while loading', async () => {
    let resolve!: (id: string) => void;
    addComment.mockImplementation(() => new Promise<string>((done) => { resolve = done; }));
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as TaskDetailPage;
    page.commentText.set('Comentário lento');
    const pending = page.submitComment();
    await page.submitComment();
    expect(addComment).toHaveBeenCalledTimes(1);
    expect(page.commenting()).toBe(true);
    resolve('comment-new');
    await pending;
  });

  it('shows a friendly comment error', async () => {
    addComment.mockRejectedValue(new Error('private detail'));
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as TaskDetailPage;
    page.commentText.set('Comentário com falha');
    await page.submitComment();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Não foi possível adicionar o comentário.');
    expect(harness.routeNativeElement?.textContent).not.toContain('private detail');
  });

  it('offers awaiting third party only to the assignee while doing and requires an explanation', async () => {
    session.set({ user: { id: 'user-2' } });
    getById.mockResolvedValue({ status: 'loaded', task: { ...task, business_state: 'fazendo' } });
    const harness = await render();
    expect(harness.routeNativeElement?.textContent).toContain('Aguardar terceiro');
    const page = harness.routeDebugElement!.componentInstance as TaskDetailPage;
    page.thirdPartyFormOpen.set(true);
    await page.waitForThirdParty();
    harness.detectChanges();
    expect(waitForThirdParty).not.toHaveBeenCalled();
    expect(harness.routeNativeElement?.textContent).toContain('Descreva a dependência externa.');
  });

  it('moves doing to awaiting third party with a comment and preserves the column', async () => {
    session.set({ user: { id: 'user-2' } });
    const doing = { ...task, business_state: 'fazendo' as const };
    getById.mockResolvedValueOnce({ status: 'loaded', task: doing });
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as TaskDetailPage;
    page.thirdPartyFormOpen.set(true);
    page.thirdPartyExplanation.set('Fornecedor enviará confirmação');
    getById.mockResolvedValue({ status: 'loaded', task: {
      ...doing, business_state: 'aguardando_terceiro', column_id: 'column-1',
    } });
    await page.waitForThirdParty();
    harness.detectChanges();
    expect(waitForThirdParty).toHaveBeenCalledExactlyOnceWith(id, 'Fornecedor enviará confirmação');
    expect(harness.routeNativeElement?.textContent).toContain('Aguardando terceiro');
    expect(page.task()?.column_id).toBe('column-1');
  });

  it('resumes awaiting third party back to doing', async () => {
    session.set({ user: { id: 'user-2' } });
    const waiting = { ...task, business_state: 'aguardando_terceiro' as const };
    getById.mockResolvedValueOnce({ status: 'loaded', task: waiting });
    const harness = await render();
    getById.mockResolvedValue({ status: 'loaded', task: { ...waiting, business_state: 'fazendo' } });
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.task-action button')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(resume).toHaveBeenCalledExactlyOnceWith(id);
    expect(harness.routeNativeElement?.textContent).toContain('Fazendo');
  });

  it('accepts once and refreshes state and history without changing the column', async () => {
    session.set({ user: { id: 'user-2' } });
    const harness = await render();
    const refreshed = { ...task, business_state: 'a_fazer' as const, accepted_at: '2026-09-28T13:00:00Z' };
    getById.mockResolvedValue({ status: 'loaded', task: refreshed });
    listHistory.mockResolvedValue([{ id: 'event-1', task_id: id, event_type: 'accepted',
      content: 'Pendência aceita', actor_id: 'user-2', is_system: true, created_at: '2026-09-28T13:00:00Z' }]);
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.task-action button')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(accept).toHaveBeenCalledExactlyOnceWith(id);
    expect(harness.routeNativeElement?.textContent).toContain('A fazer');
    expect(harness.routeNativeElement?.textContent).toContain('Pendência aceita');
    expect((harness.routeDebugElement!.componentInstance as TaskDetailPage).task()?.column_id).toBe('column-1');
  });

  it('prevents duplicate action while loading', async () => {
    session.set({ user: { id: 'user-2' } });
    let resolve!: () => void;
    accept.mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as TaskDetailPage;
    const pending = page.runAction();
    await page.runAction();
    expect(accept).toHaveBeenCalledTimes(1);
    expect(page.transitioning()).toBe(true);
    resolve();
    await pending;
  });

  it('shows a friendly transition error and keeps the action available', async () => {
    session.set({ user: { id: 'user-2' } });
    accept.mockRejectedValue(new Error('private detail'));
    const harness = await render();
    (harness.routeDebugElement!.componentInstance as TaskDetailPage).runAction();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Não foi possível atualizar a pendência.');
    expect(harness.routeNativeElement?.textContent).not.toContain('private detail');
    expect(harness.routeNativeElement?.querySelector('.task-action button')).not.toBeNull();
  });

  it('completes an in-progress task and clearly updates the detail', async () => {
    session.set({ user: { id: 'user-2' } });
    const doing = { ...task, business_state: 'fazendo' as const };
    getById.mockResolvedValueOnce({ status: 'loaded', task: doing });
    const harness = await render();
    getById.mockResolvedValue({ status: 'loaded', task: {
      ...doing, business_state: 'concluido', completed_at: '2026-09-28T14:00:00Z',
    } });
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.task-action button')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(complete).toHaveBeenCalledExactlyOnceWith(id);
    expect(harness.routeNativeElement?.textContent).toContain('Concluído');
    expect(harness.routeNativeElement?.textContent).toContain('Pendência concluída com sucesso.');
    expect(harness.routeNativeElement?.querySelector('.task-action')).toBeNull();
  });

  it('omits an unavailable creator name instead of exposing an identifier', async () => {
    listAssignees.mockResolvedValue([{ id: 'user-2', display_name: 'Responsável visível' }]);
    const harness = await render();
    expect(harness.routeNativeElement?.textContent).not.toContain('Criador');
    expect(harness.routeNativeElement?.textContent).not.toContain('user-3');
  });

  it.each(['unavailable', 'error'])('handles the %s state without leaking task existence', async (status) => {
    getById.mockResolvedValue({ status });
    const harness = await render();
    if (status === 'unavailable') {
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Pendência não encontrada ou sem acesso');
    } else {
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Não foi possível carregar a pendência');
    }
    expect(listAssignees).not.toHaveBeenCalled();
    expect(listHistory).not.toHaveBeenCalled();
    expect(listComments).not.toHaveBeenCalled();
  });
  it('renders authorized actor names, timestamps and descriptions for all supported events', async () => {
    const events = [
      'accepted',
      'started',
      'column_moved',
      'waiting_third_party',
      'resumed',
      'completed',
    ].map((type, index) => ({
      id: 'event-' + index,
      task_id: id,
      event_type: type,
      content: 'Description ' + type,
      actor_id: 'former-participant',
      actor_display_name: 'Pessoa do histórico',
      created_at: '2026-09-28T13:00:00Z',
      is_system: true,
    }));
    listHistory.mockResolvedValue([
      ...events,
      { ...events[0], id: 'unnamed', actor_display_name: null },
    ]);
    const harness = await render();
    const entries = harness.routeNativeElement!.querySelectorAll('.history-entry');
    expect(entries).toHaveLength(7);
    events.forEach((event, index) => {
      expect(entries[index].textContent).toContain(event.content);
      expect(entries[index].textContent).toContain('Pessoa do histórico');
      expect(entries[index].textContent).toMatch(/28\/09\/2026 \d{2}:00/);
      expect(entries[index].textContent).not.toContain('former-participant');
    });
    expect(entries[6].textContent).toContain('Autor indisponível');
  });
  it('discards named history when the session changes while loading', async () => {
    let resolve!: (value: unknown[]) => void;
    listHistory.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const harness = await render();
    getById.mockResolvedValue({ status: 'unavailable' });
    session.set(null);
    harness.detectChanges();
    resolve([{ id: 'old', content: 'Old event', actor_display_name: 'Old person' }]);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).not.toContain('Old person');
    expect((harness.routeDebugElement!.componentInstance as TaskDetailPage).history()).toEqual([]);
  });
});
