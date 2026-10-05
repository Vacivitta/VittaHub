import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { AdminParticipants } from './admin-participants';
import { AdminService } from './admin.service';
import { AdminAccessError } from './admin.models';

describe('AdminParticipants', () => {
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'manager' } });
  const access = signal(true);
  const service = {
    listBoardMembers: vi.fn(),
    listTeamMembers: vi.fn(),
    changeBoardMember: vi.fn(),
  };
  const members = [
    { id: 'manager', display_name: 'Gestora', is_active: true, is_board_admin: true },
    { id: 'member', display_name: 'Participante', is_active: true, is_board_admin: false },
    { id: 'inactive', display_name: 'Inativa', is_active: false, is_board_admin: false },
  ];
  beforeEach(() => {
    session.set({ user: { id: 'manager' } });
    access.set(true);
    service.listBoardMembers.mockReset().mockResolvedValue(members);
    service.listTeamMembers
      .mockReset()
      .mockResolvedValue([
        ...members,
        { id: 'new', display_name: 'Nova', is_active: true, department_name: 'Equipe' },
        { id: 'ineligible', display_name: 'Inativo externo', is_active: false },
      ]);
    service.changeBoardMember.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminService, useValue: service },
        { provide: AuthService, useValue: { session, canAccessAdministration: access } },
      ],
    });
  });
  async function render() {
    const fixture = TestBed.createComponent(AdminParticipants);
    fixture.componentRef.setInput('boards', [
      { id: 'board', title: 'Administrado' },
      { id: 'second', title: 'Segundo' },
    ]);
    fixture.detectChanges();
    await fixture.componentInstance.selectBoard('board');
    fixture.detectChanges();
    return fixture;
  }

  it('starts expanded and preserves state when collapsed; searches do not change selection', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;
    const details = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    page.selectedUser.set('new');
    page.request('add', 'new');
    const search = fixture.nativeElement.querySelector(
      '#participants-board-search',
    ) as HTMLInputElement;
    search.value = 'absent';
    search.dispatchEvent(new Event('input'));
    const userSearch = fixture.nativeElement.querySelector(
      '#participant-user-search',
    ) as HTMLInputElement;
    userSearch.value = 'absent';
    userSearch.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(page.filteredBoards().map((b) => b.id)).toEqual(['board']);
    expect(page.filteredCandidates().map((p) => p.id)).toEqual(['new']);
    expect(page.boardId()).toBe('board');
    expect(page.selectedUser()).toBe('new');
    const calls = service.listBoardMembers.mock.calls.length;
    details.querySelector('summary')!.click();
    fixture.detectChanges();
    expect(details.open).toBe(false);
    details.querySelector('summary')!.click();
    fixture.detectChanges();
    expect(details.open).toBe(true);
    expect(page.pending()?.id).toBe('new');
    expect(page.boardSearch()).toBe('absent');
    expect(service.listBoardMembers).toHaveBeenCalledTimes(calls);
    page.selectedUser.set('');
    expect(page.filteredCandidates()).toEqual([]);
    page.userSearch.set('nova');
    expect(page.filteredCandidates().map((p) => p.id)).toEqual(['new']);
  });
  it('lists members and only active eligible candidates; administrators have no removal or demotion', async () => {
    const fixture = await render();
    expect(fixture.componentInstance.candidates().map((p) => p.id)).toEqual(['new']);
    const rows = fixture.nativeElement.querySelectorAll('li');
    expect(rows[0].querySelector('button')).toBeNull();
    expect(rows[1].querySelectorAll('button')).toHaveLength(2);
    expect(rows[2].querySelectorAll('button')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toContain('Rebaixar');
    await fixture.componentInstance.selectBoard('forged');
    expect(fixture.componentInstance.boardId()).toBe('');
    expect(service.listBoardMembers).toHaveBeenCalledTimes(1);
  });
  it.each(['add', 'remove', 'promote'] as const)(
    'confirms %s and refreshes after success',
    async (action) => {
      const fixture = await render();
      const component = fixture.componentInstance;
      const id = action === 'add' ? 'new' : 'member';
      component.request(action, id);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.confirmation').textContent).toContain(
        component.labels[action],
      );
      expect(service.changeBoardMember).not.toHaveBeenCalled();
      fixture.nativeElement.querySelector('.confirmation .secondary').click();
      expect(component.pending()).toBeNull();
      component.request(action, id);
      const changed = vi.fn();
      component.changed.subscribe(changed);
      await component.confirm();
      fixture.detectChanges();
      expect(service.changeBoardMember).toHaveBeenCalledExactlyOnceWith('board', id, action);
      expect(service.listBoardMembers).toHaveBeenCalledTimes(2);
      expect(changed).toHaveBeenCalledOnce();
      expect(fixture.nativeElement.textContent).toContain('Participantes atualizados');
    },
  );
  it('disables concurrent writes and board changes while saving', async () => {
    const fixture = await render();
    let finish!: () => void;
    service.changeBoardMember.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const c = fixture.componentInstance;
    c.request('remove', 'member');
    const saving = c.confirm();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#participants-board').disabled).toBe(true);
    await c.confirm();
    await c.selectBoard('second');
    expect(c.boardId()).toBe('board');
    expect(service.changeBoardMember).toHaveBeenCalledTimes(1);
    finish();
    await saving;
  });
  it('shows safe errors and allows refreshing after failure', async () => {
    const fixture = await render();
    service.changeBoardMember.mockRejectedValue(new Error('secret'));
    fixture.componentInstance.request('add', 'new');
    await fixture.componentInstance.confirm();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível');
    expect(fixture.nativeElement.textContent).not.toContain('secret');
    expect(fixture.componentInstance.success()).toBe('');
    await fixture.componentInstance.load();
    expect(fixture.componentInstance.error()).toBe('');
  });
  it('clears data and emits access denial after revoked database permission', async () => {
    const fixture = await render();
    const denied = vi.fn();
    fixture.componentInstance.accessDenied.subscribe(denied);
    service.changeBoardMember.mockRejectedValue(new AdminAccessError());
    fixture.componentInstance.request('remove', 'member');
    await fixture.componentInstance.confirm();
    expect(denied).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.members()).toEqual([]);
    expect(fixture.componentInstance.pending()).toBeNull();
  });
  it('does not report success if access is revoked during refresh', async () => {
    const fixture = await render();
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    service.listBoardMembers.mockRejectedValueOnce(new AdminAccessError());
    fixture.componentInstance.request('remove', 'member');
    await fixture.componentInstance.confirm();
    expect(fixture.componentInstance.success()).toBe('');
    expect(changed).not.toHaveBeenCalled();
    expect(fixture.componentInstance.boardId()).toBe('');
  });

  it('does not offer self promotion even to a global admin with common membership', async () => {
    service.listBoardMembers.mockResolvedValue([{ ...members[0], is_board_admin: false }]);
    const fixture = await render();
    expect(fixture.nativeElement.querySelectorAll('li button')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('li button').textContent).toContain('Remover');
    fixture.componentInstance.request('promote', 'manager');
    expect(fixture.componentInstance.pending()).toBeNull();
  });

  it('shows loading and safe read errors with retry', async () => {
    const fixture = await render();
    let reject!: (reason: Error) => void;
    service.listBoardMembers.mockReturnValueOnce(new Promise((_, fail) => (reject = fail)));
    const loading = fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carregando participantes');
    expect(fixture.componentInstance.members()).toEqual([]);
    reject(new Error('private details'));
    await loading;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('private details');
    await fixture.componentInstance.load();
    expect(fixture.componentInstance.members()).toEqual(members);
  });

  it('ignores old board responses and clears confirmation on switching', async () => {
    const fixture = await render();
    let finish!: (value: typeof members) => void;
    service.listBoardMembers.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const old = fixture.componentInstance.load();
    await fixture.componentInstance.selectBoard('second');
    finish([]);
    await old;
    expect(fixture.componentInstance.members()).toEqual(members);
    fixture.componentInstance.request('remove', 'member');
    await fixture.componentInstance.selectBoard('board');
    expect(fixture.componentInstance.pending()).toBeNull();
  });
  it.each(['session', 'access', 'logout'])(
    'discards loaded data and late requests on %s change',
    async (change) => {
      const fixture = await render();
      let finish!: (value: typeof members) => void;
      service.listBoardMembers.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
      const pending = fixture.componentInstance.load();
      if (change === 'session') session.set({ user: { id: 'other' } });
      else if (change === 'logout') session.set(null);
      else access.set(false);
      fixture.detectChanges();
      finish(members);
      await pending;
      expect(fixture.componentInstance.members()).toEqual([]);
      expect(fixture.componentInstance.boardId()).toBe('');
    },
  );
});
