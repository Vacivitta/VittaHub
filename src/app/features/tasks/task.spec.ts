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
  const canReopen = vi.fn();
  const reopen = vi.fn();
  const canEdit = vi.fn();
  const edit = vi.fn();
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
    canEdit.mockReset().mockResolvedValue(false);
    edit.mockReset().mockResolvedValue(true);
    canReopen.mockReset().mockResolvedValue(false);
    reopen.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true, value: function (this: HTMLDialogElement) { this.open = true; },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true, value: function (this: HTMLDialogElement) { this.open = false; },
    });
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
        assignmentCapabilities: vi.fn().mockResolvedValue({ can_manage: false, can_change_due_at: false }),
        listPostponements: vi.fn().mockResolvedValue([]),
        accept, start, complete, resume, waitForThirdParty, canReopen, reopen, canEdit, edit,
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

  it('edits only title description and privacy and refreshes detail and history', async () => {
    session.set({ user: { id: task.created_by } });
    canEdit.mockResolvedValue(true);
    const harness = await render();
    const root = harness.routeNativeElement!;
    const editor = root.querySelector('app-task-editing')!;
    (editor.querySelector('button') as HTMLButtonElement).click();
    harness.detectChanges();
    const modal = editor.querySelector('dialog')!;
    expect(modal.open).toBe(true);
    expect(modal.querySelectorAll('input')).toHaveLength(1);
    const input = modal.querySelector('input')!;
    expect(input.value).toBe(task.title);
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    modal.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(edit).not.toHaveBeenCalled();
    input.value = 'Título atualizado';
    input.dispatchEvent(new Event('input'));
    const description = modal.querySelector('textarea')!;
    description.value = 'Descrição atualizada';
    description.dispatchEvent(new Event('input'));
    const privacy = modal.querySelector('select')!;
    privacy.value = 'shared';
    privacy.dispatchEvent(new Event('change'));
    getById.mockResolvedValue({ status: 'loaded', task: { ...task, title: input.value, description: description.value, is_private: false } });
    listHistory.mockResolvedValue([{ id: 'edited', content: 'Campos alterados: título, descrição, privacidade.', actor_display_name: 'Pessoa Atual', created_at: '2026-10-07T12:00:00Z' }]);
    modal.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(edit).toHaveBeenCalledExactlyOnceWith(id, 'Título atualizado', 'Descrição atualizada', false);
    expect(modal.open).toBe(false);
    expect(root.textContent).toContain('Título atualizado');
    expect(root.textContent).toContain('Descrição atualizada');
    expect(root.textContent).toContain('Compartilhada');
    expect(root.textContent).toContain('Campos alterados: título, descrição, privacidade.');
    expect(root.textContent).toContain('Pendência editada com sucesso.');
  });

  it('recovers a failed capability lookup and displays editing for the creator after the async response', async () => {
    session.set({ user: { id: task.created_by } });
    canEdit.mockRejectedValueOnce(new Error('network failure'));
    const harness = await render();
    const editor = harness.routeNativeElement!.querySelector('app-task-editing')!;
    expect(editor.querySelector('[role=alert]')?.textContent).toContain('Não foi possível verificar');
    let resolve!: (allowed: boolean) => void;
    canEdit.mockImplementation(() => new Promise<boolean>((done) => { resolve = done; }));
    (editor.querySelector('button') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(editor.querySelector('[role=status]')?.textContent).toContain('Verificando permissão');
    expect([...editor.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Editar pendência')).toBe(false);
    resolve(true);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(editor.querySelector('[role=alert]')).toBeNull();
    const button = editor.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('Editar pendência');
    button.click();
    harness.detectChanges();
    expect(editor.querySelector('dialog')!.open).toBe(true);
    expect(editor.querySelector('input')!.value).toBe(task.title);
  });

  it('hides editing when permission is denied or the task is completed', async () => {
    const harness = await render();
    expect(harness.routeNativeElement!.querySelector('app-task-editing > button')).toBeNull();
    canEdit.mockClear().mockResolvedValue(true);
    const page = harness.routeDebugElement!.componentInstance as TaskDetailPage;
    page.result.set({ status: 'loaded', task: { ...task, business_state: 'concluido' } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('app-task-editing > button')).toBeNull();
    expect(canEdit).not.toHaveBeenCalled();
  });

  it('keeps the editing form on failure and reports a no-op without claiming an edit', async () => {
    canEdit.mockResolvedValue(true);
    edit.mockRejectedValueOnce(new Error('denied')).mockResolvedValue(false);
    const harness = await render();
    const editor = harness.routeNativeElement!.querySelector('app-task-editing')!;
    (editor.querySelector('button') as HTMLButtonElement).click();
    const form = editor.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(editor.querySelector('dialog')!.open).toBe(true);
    expect(editor.querySelector('[role=alert]')!.textContent).toContain('Não foi possível editar');
    expect(getById).toHaveBeenCalledTimes(1);
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Nenhuma alteração para salvar.');
  });

  it('reopens through a required-reason modal and refreshes state and history', async () => {
    canReopen.mockResolvedValue(true);
    getById.mockResolvedValue({ status: 'loaded', task: { ...task, business_state: 'concluido', completed_at: '2026-10-01T12:00:00Z' } });
    const harness = await render();
    const root = harness.routeNativeElement!;
    const component = root.querySelector('app-task-reopening')!;
    (component.querySelector('button') as HTMLButtonElement).click();
    harness.detectChanges();
    const modal = component.querySelector('dialog')!;
    expect(modal.open).toBe(true);
    expect((modal.querySelector('[type=submit]') as HTMLButtonElement).disabled).toBe(true);
    const input = modal.querySelector('textarea')!;
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    modal.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(reopen).not.toHaveBeenCalled();
    input.value = '  Revisar entrega  ';
    input.dispatchEvent(new Event('input'));
    getById.mockResolvedValue({ status: 'loaded', task: { ...task, business_state: 'a_fazer', completed_at: null } });
    listHistory.mockResolvedValue([{ id: 'reopened', event_type: 'reopened', content: 'Pendência reaberta. Justificativa: Revisar entrega', actor_display_name: 'Pessoa Atual', created_at: '2026-10-07T12:00:00Z' }]);
    modal.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(reopen).toHaveBeenCalledExactlyOnceWith(id, 'Revisar entrega');
    expect(modal.open).toBe(false);
    expect(root.textContent).toContain('Pendência reaberta com sucesso.');
    expect(root.textContent).toContain('Revisar entrega');
    expect(root.textContent).not.toContain('Concluída em');
  });

  it('hides reopening when the database denies permission', async () => {
    getById.mockResolvedValue({ status: 'loaded', task: { ...task, business_state: 'concluido' } });
    const harness = await render();
    expect(harness.routeNativeElement!.querySelector('app-task-reopening > button')).toBeNull();
    expect(canReopen).toHaveBeenCalledWith(id);
  });

  it('keeps the justification and shows an error when reopening fails', async () => {
    canReopen.mockResolvedValue(true);
    reopen.mockRejectedValue(new Error('denied'));
    getById.mockResolvedValue({ status: 'loaded', task: { ...task, business_state: 'concluido' } });
    const harness = await render();
    const root = harness.routeNativeElement!.querySelector('app-task-reopening')!;
    (root.querySelector('button') as HTMLButtonElement).click();
    const input = root.querySelector('textarea')!;
    input.value = 'Revisar';
    input.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(root.querySelector('[role=alert]')!.textContent).toContain('Não foi possível reabrir');
    expect(root.querySelector('dialog')!.open).toBe(true);
    expect(input.value).toBe('Revisar');
    expect(getById).toHaveBeenCalledTimes(1);
  });

  it('shows loading while the RLS query is pending', async () => {
    let resolve!: (result: TaskResult) => void;
    getById.mockImplementation(() => new Promise<TaskResult>((done) => { resolve = done; }));
    const harness = await RouterTestingHarness.create(`/pendencias/${id}`);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Carregando pendência');
    resolve({ status: 'unavailable' });
    await harness.fixture.whenStable();
  });

  it('refreshes a refused assignment as unassigned without keeping the acceptance action', async () => {
    session.set({ user: { id: 'user-2' } });
    const harness = await render();
    getById.mockResolvedValue({ status: 'loaded', task: { ...task, assignee_id: null, awaiting_reassignment: true } });
    const page = harness.routeDebugElement!.componentInstance as TaskDetailPage;
    await page.assignmentChanged('Atribuição recusada com sucesso.');
    harness.detectChanges();
    expect(page.action()).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Sem responsável ativo');
    expect(harness.routeNativeElement?.textContent).toContain('Aguardando reatribuição');
  });

  it('preserves refusal success feedback when the former assignee loses private visibility', async () => {
    const harness = await render();
    getById.mockResolvedValue({ status: 'unavailable' });
    await (harness.routeDebugElement!.componentInstance as TaskDetailPage).assignmentChanged('Atribuição recusada com sucesso.');
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Atribuição recusada com sucesso.');
    expect(harness.routeNativeElement?.textContent).toContain('Pendência não encontrada ou sem acesso');
    expect(harness.routeNativeElement?.textContent).not.toContain('Detalhe real');
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

  it('formats structured postponement and deadline events in local Brazilian date/time', async () => {
    const harness = await render();
    const page = harness.routeDebugElement!.componentInstance as TaskDetailPage;
    const previous = '2026-09-30 09:00:00+00';
    const requested = '2026-10-14 14:44:00+00';
    const local = (value: string) => new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(value)).replace(', ', ' às ');
    const format = (event_type: string, details: Record<string, unknown>, content = 'raw') =>
      page.historyContent({
        id: event_type, task_id: id, event_type, details, content, actor_id: 'user-1',
        actor_display_name: 'Pessoa atual', is_system: true, created_at: '2026-10-14T15:00:00Z',
      });

    expect(format('postponement_requested', {
      previous_due_at: previous, requested_due_at: requested, justification: 'aguardando resposta do fornecedor',
    })).toBe(`Adiamento solicitado de ${local(previous)} para ${local(requested)}. Motivo: aguardando resposta do fornecedor.`);
    expect(format('postponement_approved', {
      previous_due_at: previous, new_due_at: requested,
    }, 'Adiamento solicitado por Pessoa solicitante aprovado: prazo de raw para raw.'))
      .toBe(`Adiamento solicitado por Pessoa solicitante aprovado: prazo de ${local(previous)} para ${local(requested)}.`);
    expect(format('postponement_rejected', {
      previous_due_at: previous, justification: 'Prazo inviável',
    }, 'Adiamento solicitado por Pessoa solicitante recusado. Justificativa: raw'))
      .toBe(`Adiamento solicitado por Pessoa solicitante recusado (prazo mantido em ${local(previous)}). Motivo: Prazo inviável.`);
    expect(format('due_at_changed', {
      previous_due_at: previous, new_due_at: requested, justification: 'Correção administrativa',
    })).toBe(`Prazo alterado diretamente de ${local(previous)} para ${local(requested)}. Motivo: Correção administrativa.`);
    expect(format('completed', { previous_due_at: previous }, 'Conclusão original')).toBe('Conclusão original');
    expect(format('postponement_requested', {}, 'Conteúdo original')).toBe('Conteúdo original');
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
