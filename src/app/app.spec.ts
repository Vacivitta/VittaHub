import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { signal } from '@angular/core';
import { AuthService } from './core/auth/auth.service';
import { BoardsService } from './features/boards/boards.service';
import { ChatService } from './features/chat/chat.service';
import { TasksService } from './features/tasks/tasks.service';

describe('Vacivitta interface', () => {
  const session = signal<object | null>({ user: { id: 'test-user' } });
  const auth = {
    session,
    ready: Promise.resolve(),
    displayName: signal('Conta Local'),
    profile: signal({ id: 'test-user', display_name: 'Conta Local' }),
    profileError: signal(''),
    signOut: vi.fn(),
  };
  beforeEach(() => {
    session.set({ user: { id: 'test-user' } });
    auth.ready = Promise.resolve();
    auth.signOut.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ imports: [App], providers: [
      provideRouter(routes), { provide: AuthService, useValue: auth },
      { provide: BoardsService, useValue: {
        list: vi.fn().mockResolvedValue([
          { id: '11111111-1111-4111-8111-111111111111', title: 'Quadro local', description: null, department: { name: 'Equipe local' } },
        ]),
        getById: vi.fn().mockImplementation(async (id: string) => id === '11111111-1111-4111-8111-111111111111'
          ? { status: 'loaded', board: { id, title: 'Quadro local', description: null, department: null, columns: [] } }
          : { status: 'unavailable' }),
      } },
      { provide: TasksService, useValue: {
        list: vi.fn().mockResolvedValue([]),
        listMine: vi.fn().mockResolvedValue([]),
        listAssignees: vi.fn().mockResolvedValue([]),
        listHistory: vi.fn().mockResolvedValue([]),
        listComments: vi.fn().mockResolvedValue([]),
        getById: vi.fn().mockResolvedValue({ status: 'unavailable' }),
        create: vi.fn(),
      } },
      { provide: ChatService, useValue: {
        listMyConversations: vi.fn().mockResolvedValue([
          { id: 'conversation-1', kind: 'individual', title: null, created_at: '2026-09-28T10:00:00Z', last_activity_at: '2026-09-28T12:00:00Z' },
          { id: 'conversation-2', kind: 'individual', title: null, created_at: '2026-09-28T09:00:00Z', last_activity_at: '2026-09-28T11:00:00Z' },
        ]),
        listConversationParticipants: vi.fn().mockImplementation(async (id: string) => [
          { user_id: 'test-user', display_name: 'Conta Local' },
          { user_id: id === 'conversation-2' ? 'colleague-a' : 'colleague-b', display_name: id === 'conversation-2' ? 'Colega Alfa' : 'Colega Beta' },
        ]),
        listMessages: vi.fn().mockImplementation(async (id: string) => id === 'conversation-2' ? [{
          id: 'message-1', conversation_id: id, author_id: 'colleague-a', content: 'Mensagem persistida', created_at: '2026-09-28T11:00:00Z',
        }] : []),
        sendMessage: vi.fn(),
        subscribeToMessages: vi.fn().mockReturnValue({ id: 'channel' }),
        removeMessageSubscription: vi.fn().mockResolvedValue(undefined),
      } },
    ] });
  });

  it('creates the application', () => {
    expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
  });

  it.each([
    ['/inicio', 'Olá, Pessoa Teste'],
    ['/quadros', 'Quadros'],
    ['/quadros/11111111-1111-4111-8111-111111111111', 'Quadro local'],
    ['/minhas-pendencias', 'Minhas Pendências'],
    ['/pendencias/11111111-1111-4111-8111-111111111111', 'Pendência não encontrada ou sem acesso'],
    ['/chat', 'Chat'],
    ['/administracao', 'Administração'],
    ['/endereco-inexistente', 'Página não encontrada'],
    ['/quadros/inexistente', 'Quadro não encontrado'],
  ])('renders %s', async (url, heading) => {
    const harness = await RouterTestingHarness.create(url);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(heading);
    expect(harness.routeNativeElement?.querySelectorAll('nav a').length).toBe(5);
  });

  it('redirects the root to the home page', async () => {
    await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/inicio');
  });

  it('does not offer a demonstration bypass on login', async () => {
    session.set(null);
    const harness = await RouterTestingHarness.create('/login');
    expect(harness.routeNativeElement?.querySelector('input')?.readOnly).toBe(false);
    (harness.routeNativeElement?.querySelector('.button') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('a[href="/inicio"]')).toBeNull();
  });

  it.each(['/', '/inicio', '/quadros', '/quadros/rotina', '/minhas-pendencias', '/pendencias/11111111-1111-4111-8111-111111111111', '/chat', '/administracao', '/endereco-inexistente'])
  ('protects %s without a session', async (url) => {
    session.set(null);
    const harness = await RouterTestingHarness.create(url);
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('.workspace')).toBeNull();
  });

  it('waits for session restoration before admitting the user', async () => {
    session.set(null);
    let restore!: () => void;
    auth.ready = new Promise<void>((resolve) => { restore = resolve; });
    const pending = RouterTestingHarness.create('/inicio');
    expect(TestBed.inject(Router).url).not.toBe('/inicio');
    session.set({ user: { id: 'test-user' } });
    restore();
    await pending;
    expect(TestBed.inject(Router).url).toBe('/inicio');
  });

  it('protects child navigation when the shell is already active', async () => {
    const harness = await RouterTestingHarness.create('/inicio');
    session.set(null);
    await harness.navigateByUrl('/quadros');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('shows the real profile name and invokes logout from the layout', async () => {
    const harness = await RouterTestingHarness.create('/inicio');
    expect(harness.routeNativeElement?.querySelector('.topbar')?.textContent).toContain('Conta Local');
    (harness.routeNativeElement?.querySelector('.exit-link') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it('filters boards and shows an empty result', async () => {
    const harness = await RouterTestingHarness.create('/quadros');
    const input = harness.routeNativeElement!.querySelector('input')!;
    input.value = 'inexistente';
    input.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Nenhum quadro encontrado');
    expect(harness.routeNativeElement?.querySelectorAll('.board-tile').length).toBe(0);
  });

  it('opens a real board ID from the listing', async () => {
    const harness = await RouterTestingHarness.create('/quadros');
    await harness.fixture.whenStable();
    harness.detectChanges();
    (harness.routeNativeElement?.querySelector('.board-tile') as HTMLAnchorElement).click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/quadros/11111111-1111-4111-8111-111111111111');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Quadro local');
  });

  it('shows the real empty state for my tasks without demo cards', async () => {
    const harness = await RouterTestingHarness.create('/minhas-pendencias');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelectorAll('.task-card').length).toBe(0);
    expect(harness.routeNativeElement?.textContent).toContain('Nenhuma pendência aberta');
  });

  it('selects a conversation and keeps sending disabled', async () => {
    const harness = await RouterTestingHarness.create('/chat');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.querySelectorAll('.conversation').length).toBe(2);
    });
    (harness.routeNativeElement?.querySelectorAll('.conversation')[1] as HTMLButtonElement).click();
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.querySelector('.conversation-header')).not.toBeNull();
    });
    expect(
      harness.routeNativeElement?.querySelector('.conversation-header')?.textContent,
    ).toContain('Colega Alfa');
    expect(harness.routeNativeElement?.querySelectorAll('.message').length).toBe(1);
    expect(
      harness.routeNativeElement?.querySelector<HTMLButtonElement>('.composer button')?.disabled,
    ).toBe(true);
  });
});
