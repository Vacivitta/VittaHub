import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { ChatConversation, ChatMessage, ConversationParticipant } from './chat.models';
import { ChatService } from './chat.service';
import { Chat } from './chat';

describe('Chat', () => {
  const first: ChatConversation = {
    id: 'conversation-1',
    kind: 'individual',
    title: null,
    created_at: '2026-09-28T10:00:00Z',
    last_activity_at: '2026-09-28T12:00:00Z',
  };
  const second: ChatConversation = {
    id: 'conversation-2',
    kind: 'individual',
    title: null,
    created_at: '2026-09-28T09:00:00Z',
    last_activity_at: '2026-09-28T11:00:00Z',
  };
  const group: ChatConversation = {
    id: 'group-1',
    kind: 'grupo',
    title: 'Operação da Unidade',
    created_at: '2026-09-28T12:00:00Z',
    last_activity_at: '2026-09-28T13:00:00Z',
  };
  const participants: Record<string, ConversationParticipant[]> = {
    'group-1': [
      { user_id: 'user-1', display_name: 'Pessoa Atual' },
      { user_id: 'user-2', display_name: 'Pessoa Teste 2' },
      { user_id: 'user-3', display_name: 'Pessoa Teste 3' },
    ],
    'conversation-1': [
      { user_id: 'user-1', display_name: 'Pessoa Atual' },
      { user_id: 'user-2', display_name: 'Pessoa Teste 2' },
    ],
    'conversation-2': [
      { user_id: 'user-1', display_name: 'Pessoa Atual' },
      { user_id: 'user-3', display_name: 'Pessoa Teste 3' },
    ],
  };
  const older: ChatMessage = {
    id: 'message-1',
    conversation_id: 'conversation-1',
    author_id: 'user-2',
    content: 'Mensagem recebida',
    created_at: '2026-09-28T10:00:00Z',
  };
  const newer: ChatMessage = {
    id: 'message-2',
    conversation_id: 'conversation-1',
    author_id: 'user-1',
    content: 'Mensagem própria',
    created_at: '2026-09-28T11:00:00Z',
  };

  const session = signal<{ user: { id: string } } | null>({ user: { id: 'user-1' } });
  const profile = signal<{
    id: string;
    display_name: string | null;
    role: 'membro' | 'gestor' | 'administrador';
  } | null>({ id: 'user-1', display_name: 'Pessoa Atual', role: 'membro' });
  const listMyConversations = vi.fn();
  const listConversationParticipants = vi.fn();
  const listMessages = vi.fn();
  const sendMessage = vi.fn();
  const subscribeToMessages = vi.fn();
  const removeMessageSubscription = vi.fn();
  const listDirectChatCandidates = vi.fn();
  const getOrCreateDirectConversation = vi.fn();
  const createGroupConversation = vi.fn();
  const subscriptions: Array<{
    conversationId: string;
    onMessage: (message: ChatMessage) => void;
    onSubscribed: () => void;
    channel: { id: number };
  }> = [];

  beforeEach(() => {
    subscriptions.length = 0;
    session.set({ user: { id: 'user-1' } });
    profile.set({ id: 'user-1', display_name: 'Pessoa Atual', role: 'membro' });
    listMyConversations.mockReset().mockResolvedValue([first, second]);
    listConversationParticipants
      .mockReset()
      .mockImplementation((id: string) => Promise.resolve(participants[id] ?? []));
    listMessages
      .mockReset()
      .mockImplementation((id: string) => Promise.resolve(id === first.id ? [newer, older] : []));
    sendMessage.mockReset().mockResolvedValue('message-new');
    subscribeToMessages
      .mockReset()
      .mockImplementation(
        (
          conversationId: string,
          onMessage: (message: ChatMessage) => void,
          onSubscribed: () => void,
        ) => {
          const channel = { id: subscriptions.length + 1 };
          subscriptions.push({ conversationId, onMessage, onSubscribed, channel });
          return channel;
        },
      );
    removeMessageSubscription.mockReset().mockResolvedValue(undefined);
    listDirectChatCandidates.mockReset().mockResolvedValue([
      { user_id: 'user-2', display_name: 'Ana Silva' },
      { user_id: 'user-3', display_name: 'Bruno Souza' },
    ]);
    getOrCreateDirectConversation.mockReset().mockResolvedValue('conversation-2');
    createGroupConversation.mockReset().mockResolvedValue('group-1');
    TestBed.configureTestingModule({
      imports: [Chat],
      providers: [
        { provide: AuthService, useValue: { session, profile } },
        {
          provide: ChatService,
          useValue: {
            listMyConversations,
            listConversationParticipants,
            listMessages,
            sendMessage,
            subscribeToMessages,
            removeMessageSubscription,
            listDirectChatCandidates,
            getOrCreateDirectConversation,
            createGroupConversation,
          },
        },
      ],
    });
  });

  async function render(): Promise<ComponentFixture<Chat>> {
    const fixture = TestBed.createComponent(Chat);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.listLoading()).toBe(false));
    fixture.detectChanges();
    return fixture;
  }

  it.each(['membro', 'gestor', 'administrador'] as const)('guides %s through available actions when conversations are empty', async (role) => {
    profile.set({ id: 'user-1', display_name: 'Pessoa Atual', role });
    listMyConversations.mockResolvedValue([]);
    const fixture = await render();
    const panel = fixture.nativeElement.querySelector('.message-panel') as HTMLElement;
    expect(panel.textContent).toContain('Nenhuma conversa disponível');
    expect(panel.textContent).toContain('Nova conversa');
    expect(panel.textContent).not.toContain('Selecione uma conversa');
    expect(panel.textContent?.includes('Novo grupo')).toBe(role !== 'membro');
  });

  async function openFirst(fixture: ComponentFixture<Chat>): Promise<void> {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.conversation')!
      .click();
    await vi.waitFor(() => expect(fixture.componentInstance.conversationLoading()).toBe(false));
    fixture.detectChanges();
  }

  it('groups dates without changing chronological order or message content', async () => {
    const nextDay = { ...newer, id: 'next-day', created_at: '2026-09-29T12:00:00Z', content: 'Outra data\nSegunda linha' };
    listMessages.mockResolvedValue([nextDay, newer, older]);
    const fixture = await render();
    await openFirst(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(Array.from(root.querySelectorAll('.date-divider time')).map(node => node.textContent))
      .toEqual(['28/09/2026', '29/09/2026']);
    expect(Array.from(root.querySelectorAll('.message p')).map(node => node.textContent))
      .toEqual([older.content, newer.content, nextDay.content]);
    expect(root.querySelectorAll('.message.own')).toHaveLength(2);
    expect(root.querySelector('[role="log"]')?.getAttribute('tabindex')).toBe('0');
    expect(root.querySelectorAll('[role="listitem"]')).toHaveLength(2);
  });

  it('keeps the conversation header and return action visible while loading and on error', async () => {
    let fail!: (error: Error) => void;
    listMessages.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.conversation')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.conversation-header')?.textContent).toContain('Pessoa Teste 2');
    expect(root.querySelector('.back-to-list')?.getAttribute('aria-label')).toBe('Voltar para conversas');
    await vi.waitFor(() => expect(listMessages).toHaveBeenCalledOnce());
    fail(new Error('unavailable'));
    await vi.waitFor(() => expect(fixture.componentInstance.conversationLoading()).toBe(false));
    fixture.detectChanges();
    expect(root.querySelector('.conversation-header')?.textContent).toContain('Pessoa Teste 2');
    expect(root.querySelector('.conversation-feedback button')?.textContent).toContain('Tentar novamente');
  });

  it('opens the mobile pane without focusing an input and returns to the selected row without losing draft', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query === '(max-width: 767px)' })));
    try {
      const fixture = await render();
      const root = fixture.nativeElement as HTMLElement;
      const row = root.querySelector<HTMLButtonElement>('.conversation')!;
      row.focus();
      row.click();
      fixture.detectChanges();
      expect(document.activeElement).toBe(root.querySelector('.conversation-header h2'));
      await vi.waitFor(() => expect(fixture.componentInstance.conversationLoading()).toBe(false));
      fixture.detectChanges();
      expect(root.querySelector('.chat-layout')?.classList.contains('mobile-conversation-open')).toBe(true);
      const field = root.querySelector<HTMLTextAreaElement>('#chat-message')!;
      field.value = 'Rascunho preservado';
      field.dispatchEvent(new Event('input'));
      const history = root.querySelector<HTMLElement>('.messages')!;
      history.scrollTop = 100;
      root.querySelector<HTMLButtonElement>('.back-to-list')!.click();
      fixture.detectChanges();
      expect(root.querySelector('.chat-layout')?.classList.contains('mobile-conversation-open')).toBe(false);
      expect(document.activeElement).toBe(row);
      expect(field.value).toBe('Rascunho preservado');
      expect(history.scrollTop).toBe(100);
      expect(removeMessageSubscription).not.toHaveBeenCalled();
      expect(listMessages).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps the history element and reading position when a new message arrives', async () => {
    const fixture = await render();
    await openFirst(fixture);
    const history = fixture.nativeElement.querySelector('.messages') as HTMLElement;
    history.scrollTop = 80;
    subscriptions[0].onMessage({ ...newer, id: 'another-message', content: 'Atualização' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.messages')).toBe(history);
    expect(history.scrollTop).toBe(80);
  });

  it('fits the mobile Chat in the visual viewport when the keyboard opens and cleans up listeners', async () => {
    const viewport = new EventTarget();
    let height = 800;
    Object.defineProperties(viewport, {
      height: { get: () => height },
      offsetTop: { value: 0 },
      scale: { value: 1 },
    });
    const remove = vi.spyOn(viewport, 'removeEventListener');
    vi.stubGlobal('visualViewport', viewport);
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query === '(max-width: 767px)' })));
    try {
      const fixture = await render();
      vi.spyOn(fixture.nativeElement, 'getBoundingClientRect').mockReturnValue({ top: 124 } as DOMRect);
      height = 450;
      viewport.dispatchEvent(new Event('resize'));
      fixture.detectChanges();
      expect(fixture.nativeElement.style.maxHeight).toBe('326px');
      height = 800;
      viewport.dispatchEvent(new Event('resize'));
      fixture.detectChanges();
      expect(fixture.nativeElement.style.maxHeight).toBe('676px');
      fixture.destroy();
      expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('preserves Enter to send and Shift+Enter for a new line', async () => {
    const fixture = await render();
    await openFirst(fixture);
    const field = fixture.nativeElement.querySelector('#chat-message') as HTMLTextAreaElement;
    field.value = 'Mensagem de teste';
    field.dispatchEvent(new Event('input'));
    const newline = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
    field.dispatchEvent(newline);
    expect(newline.defaultPrevented).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
    const submit = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    field.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledExactlyOnceWith(first.id, 'Mensagem de teste'));
  });

  describe('composer focus after mouse selection', () => {
    let desktop: boolean;

    beforeEach(() => {
      desktop = true;
      vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
        matches: desktop && query === '(min-width: 851px) and (hover: hover) and (pointer: fine)',
      })));
    });

    afterEach(() => vi.unstubAllGlobals());

    function selectWithMouse(fixture: ComponentFixture<Chat>, index = 0, detail = 1, pointerType = 'mouse'): HTMLButtonElement {
      const button = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.conversation')[index];
      button.focus();
      const event = new MouseEvent('click', { bubbles: true, detail, button: 0 });
      Object.defineProperty(event, 'pointerType', { value: pointerType });
      button.dispatchEvent(event);
      fixture.detectChanges();
      return button;
    }

    async function settle(fixture: ComponentFixture<Chat>): Promise<void> {
      await vi.waitFor(() => expect(fixture.componentInstance.conversationLoading()).toBe(false));
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('waits for history and rendering before focusing the ready composer', async () => {
      let finish!: (messages: ChatMessage[]) => void;
      listMessages.mockImplementation(() => new Promise<ChatMessage[]>((resolve) => { finish = resolve; }));
      const fixture = await render();
      const trigger = selectWithMouse(fixture);
      await vi.waitFor(() => expect(listMessages).toHaveBeenCalledOnce());
      expect(document.activeElement).toBe(trigger);
      expect(fixture.nativeElement.querySelector('#chat-message')).toBeNull();
      finish([older]);
      await settle(fixture);
      expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#chat-message'));
    });

    it.each([
      { name: 'keyboard activation', detail: 0, pointer: 'mouse', wide: true },
      { name: 'touch on a hybrid desktop', detail: 1, pointer: 'touch', wide: true },
      { name: 'pen input', detail: 1, pointer: 'pen', wide: true },
      { name: 'mobile layout or coarse pointer', detail: 1, pointer: 'mouse', wide: false },
    ])('preserves focus for $name', async ({ detail, pointer, wide }) => {
      desktop = wide;
      const fixture = await render();
      const trigger = selectWithMouse(fixture, 0, detail, pointer);
      await settle(fixture);
      expect(fixture.nativeElement.querySelector('#chat-message')).not.toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it('does not take focus when the user moves to another control while loading', async () => {
      let finish!: (messages: ChatMessage[]) => void;
      listMessages.mockImplementation(() => new Promise<ChatMessage[]>((resolve) => { finish = resolve; }));
      const fixture = await render();
      selectWithMouse(fixture);
      await vi.waitFor(() => expect(listMessages).toHaveBeenCalledOnce());
      const other = fixture.nativeElement.querySelector('#new-chat-trigger') as HTMLButtonElement;
      other.focus();
      finish([]);
      await settle(fixture);
      expect(document.activeElement).toBe(other);
    });

    it('does not focus the composer when loading fails', async () => {
      listMessages.mockRejectedValue(new Error('unavailable'));
      const fixture = await render();
      const trigger = selectWithMouse(fixture);
      await settle(fixture);
      expect(document.activeElement).toBe(trigger);
      expect(fixture.nativeElement.querySelector('#chat-message')).toBeNull();
    });

    it('preserves dialog focus if Nova conversa is opened while history loads', async () => {
      let finish!: (messages: ChatMessage[]) => void;
      listMessages.mockImplementation(() => new Promise<ChatMessage[]>((resolve) => { finish = resolve; }));
      const fixture = await render();
      selectWithMouse(fixture);
      await vi.waitFor(() => expect(listMessages).toHaveBeenCalledOnce());
      const trigger = fixture.nativeElement.querySelector('#new-chat-trigger') as HTMLButtonElement;
      trigger.focus();
      trigger.click();
      fixture.detectChanges();
      const title = fixture.nativeElement.querySelector('#new-chat-title');
      expect(document.activeElement).toBe(title);
      finish([]);
      await settle(fixture);
      expect(document.activeElement).toBe(title);
    });

    it('ignores an older mouse selection after a newer keyboard selection', async () => {
      let finish!: (messages: ChatMessage[]) => void;
      listMessages.mockImplementation((id: string) => id === first.id
        ? new Promise<ChatMessage[]>((resolve) => { finish = resolve; }) : Promise.resolve([]));
      const fixture = await render();
      selectWithMouse(fixture);
      await vi.waitFor(() => expect(listMessages).toHaveBeenCalledWith(first.id));
      const trigger = selectWithMouse(fixture, 1, 0);
      await vi.waitFor(() => expect(fixture.componentInstance.conversationLoading()).toBe(false));
      finish([older]);
      await settle(fixture);
      expect(fixture.componentInstance.selected()?.conversation.id).toBe(second.id);
      expect(document.activeElement).toBe(trigger);
    });

    it('preserves draft text and focus across messages, resynchronization and list reloads', async () => {
      const fixture = await render();
      selectWithMouse(fixture);
      await settle(fixture);
      const field = fixture.nativeElement.querySelector('#chat-message') as HTMLTextAreaElement;
      field.value = 'Texto ainda em edição';
      field.dispatchEvent(new Event('input'));
      const other = fixture.nativeElement.querySelector('#new-chat-trigger') as HTMLButtonElement;
      other.focus();
      subscriptions[0].onMessage({ ...older, id: 'new-message', content: 'Nova mensagem' });
      subscriptions[0].onSubscribed();
      await fixture.componentInstance.loadConversations();
      await settle(fixture);
      expect(fixture.nativeElement.querySelector('#chat-message')).toBe(field);
      expect(field.value).toBe('Texto ainda em edição');
      expect(fixture.componentInstance.draft()).toBe('Texto ainda em edição');
      expect(document.activeElement).toBe(other);

      await fixture.componentInstance.openConversation(fixture.componentInstance.conversations()[0]);
      await settle(fixture);
      expect(document.activeElement).toBe(other);
      expect(fixture.nativeElement.querySelector('#chat-message').value).toBe('Texto ainda em edição');
    });
  });

  it.each(['conversation', 'group'] as const)(
    'contains focus during loading and restores the %s opener on Escape',
    async (kind) => {
      profile.set({ id: 'user-1', display_name: 'Pessoa Atual', role: 'gestor' });
      let finish!: (value: []) => void;
      listDirectChatCandidates.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
      const fixture = await render();
      const root = fixture.nativeElement as HTMLElement;
      const trigger = root.querySelector<HTMLButtonElement>(
        kind === 'group' ? '#new-group-trigger' : '#new-chat-trigger',
      )!;
      trigger.focus();
      trigger.click();
      fixture.detectChanges();
      const dialog = root.querySelector<HTMLElement>('[role="dialog"]')!;
      const title = dialog.querySelector<HTMLElement>('h2')!;
      expect(document.activeElement).toBe(title);
      expect(root.querySelector('.chat-dialog-backdrop')?.getAttribute('tabindex')).toBe('-1');

      // jsdom has no layout or native Tab navigation. Exercise the CDK boundary
      // sentinels reached by Shift+Tab and Tab with visible control dimensions.
      for (const element of dialog.querySelectorAll<HTMLElement>('h2, button, input')) {
        Object.defineProperty(element, 'offsetWidth', { configurable: true, get: () => 100 });
        Object.defineProperty(element, 'offsetHeight', { configurable: true, get: () => 30 });
      }
      const anchors = root.querySelectorAll<HTMLElement>('.cdk-focus-trap-anchor');
      expect(anchors).toHaveLength(2);
      anchors[1].focus();
      expect(document.activeElement).toBe(title);
      anchors[0].focus();
      const enabled = dialog.querySelectorAll<HTMLElement>('h2, button:not(:disabled), input:not(:disabled)');
      expect(document.activeElement).toBe(enabled[enabled.length - 1]);

      title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      await Promise.resolve();
      expect(root.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      finish([]);
      await fixture.whenStable();
    },
  );

  it('opens the existing flow from the empty state and restores its action on close', async () => {
    listMyConversations.mockResolvedValue([]);
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector<HTMLButtonElement>('.conversation-feedback button')!;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(listDirectChatCandidates).toHaveBeenCalledOnce();
    root.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Fechar"]')!.click();
    fixture.detectChanges();
    await Promise.resolve();
    expect(document.activeElement).toBe(trigger);
  });

  it('uses natural selection labels for zero, one and multiple people', async () => {
    profile.set({ id: 'user-1', display_name: 'Pessoa Atual', role: 'gestor' });
    const fixture = await render();
    await fixture.componentInstance.openNewGroup();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.selected-count').textContent).toContain('Nenhuma pessoa selecionada');
    fixture.componentInstance.toggleGroupParticipant('user-2');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.selected-count').textContent).toContain('1 pessoa selecionada');
    fixture.componentInstance.toggleGroupParticipant('user-3');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.selected-count').textContent).toContain('2 pessoas selecionadas');
  });

  it.each(['conversation', 'group'] as const)(
    'keeps the %s dialog contained while saving and restores focus after success',
    async (kind) => {
      profile.set({ id: 'user-1', display_name: 'Pessoa Atual', role: 'gestor' });
      const fixture = await render();
      const root = fixture.nativeElement as HTMLElement;
      const page = fixture.componentInstance;
      const trigger = root.querySelector<HTMLButtonElement>(
        kind === 'group' ? '#new-group-trigger' : '#new-chat-trigger',
      )!;
      trigger.focus();
      trigger.click();
      await fixture.whenStable();
      fixture.detectChanges();
      let finish!: (id: string) => void;
      const operation = kind === 'group' ? createGroupConversation : getOrCreateDirectConversation;
      operation.mockImplementation(() => new Promise<string>((resolve) => { finish = resolve; }));
      listMyConversations.mockResolvedValue([first, second, group]);
      page.groupName.set('Equipe de teste');
      page.toggleGroupParticipant('user-2');
      const pending = kind === 'group' ? page.createGroup()
        : page.startConversation({ user_id: 'user-2', display_name: 'Ana Silva' });
      fixture.detectChanges();
      const title = root.querySelector<HTMLElement>('[role="dialog"] h2')!;
      title.focus();
      title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(root.querySelector('[role="dialog"]')).not.toBeNull();
      expect(root.querySelectorAll('[role="dialog"] button:not(:disabled), [role="dialog"] input:not(:disabled)')).toHaveLength(0);
      Object.defineProperty(title, 'offsetWidth', { configurable: true, get: () => 100 });
      Object.defineProperty(title, 'offsetHeight', { configurable: true, get: () => 30 });
      for (const anchor of root.querySelectorAll<HTMLElement>('.cdk-focus-trap-anchor')) {
        anchor.focus();
        expect(document.activeElement).toBe(title);
      }
      finish(kind === 'group' ? group.id : first.id);
      await pending;
      fixture.detectChanges();
      await Promise.resolve();
      expect(root.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    },
  );

  it('shows loading and then lists real individual conversations using the other participant name', async () => {
    let resolve!: (value: ChatConversation[]) => void;
    listMyConversations.mockImplementation(
      () =>
        new Promise<ChatConversation[]>((done) => {
          resolve = done;
        }),
    );
    const fixture = TestBed.createComponent(Chat);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carregando conversas');

    resolve([first]);
    await vi.waitFor(() => expect(fixture.componentInstance.listLoading()).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.conversation')?.textContent).toContain(
      'Pessoa Teste 2',
    );
    expect(fixture.nativeElement.querySelector('.conversation')?.textContent).not.toContain(
      'Pessoa Atual',
    );
  });

  it('shows the empty state when there are no existing individual conversations', async () => {
    listMyConversations.mockResolvedValue([]);
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma conversa disponível');
    expect(fixture.nativeElement.querySelector('.conversation')).toBeNull();
  });

  it('distinguishes groups with an icon, badge and count while retaining activity and individual initials', async () => {
    listMyConversations.mockResolvedValue([first, group]);
    const fixture = await render();
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.conversation');
    expect(rows[0].querySelector('.avatar')?.textContent?.trim()).toBe('PT');
    expect(rows[0].querySelector('.group-badge')).toBeNull();
    expect(rows[0].querySelector('.group-avatar')).toBeNull();
    expect(rows[1].querySelector('.group-avatar app-icon')).not.toBeNull();
    expect(rows[1].querySelector('.group-badge')?.textContent).toBe('Grupo');
    expect(rows[1].textContent).toContain('3 participantes');
    expect(rows[1].querySelector('.conversation-meta')?.textContent).toContain('28/09');
    await openFirst(fixture);
    expect(fixture.nativeElement.querySelector('.conversation-header').textContent)
      .toContain('Conversa individual');
    await fixture.componentInstance.openConversation(fixture.componentInstance.conversations()[1]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.conversation-header .group-avatar app-icon')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.conversation-header').textContent)
      .toContain('Grupo • 3 participantes');
  });

  it('opens Nova conversa, loads candidates and filters names locally', async () => {
    const fixture = await render();
    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((item) => item.textContent?.includes('Nova conversa'))!;
    button.click();
    await vi.waitFor(() => expect(listDirectChatCandidates).toHaveBeenCalledOnce());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ana Silva');
    expect(fixture.nativeElement.textContent).toContain('Bruno Souza');

    const input = fixture.nativeElement.querySelector(
      '.candidate-search input',
    ) as HTMLInputElement;
    input.value = 'bruno';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Ana Silva');
    expect(fixture.nativeElement.textContent).toContain('Bruno Souza');
  });

  it.each(['gestor', 'administrador'] as const)('%s sees the Novo grupo action', async (role) => {
    profile.set({ id: 'user-1', display_name: 'Pessoa Atual', role });
    const fixture = await render();
    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).map((button) => button.textContent?.trim());
    expect(labels).toContain('Novo grupo');
  });

  it('member does not see the Novo grupo action', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.textContent).not.toContain('Novo grupo');
    await fixture.componentInstance.openNewGroup();
    expect(fixture.componentInstance.newGroupOpen()).toBe(false);
    expect(listDirectChatCandidates).not.toHaveBeenCalled();
  });

  it('opens the group dialog, loads candidates, filters locally and supports multiple selection', async () => {
    profile.set({ id: 'user-1', display_name: 'Pessoa Atual', role: 'gestor' });
    const fixture = await render();
    const page = fixture.componentInstance;
    await page.openNewGroup();
    fixture.detectChanges();
    expect(listDirectChatCandidates).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Ana Silva');
    expect(fixture.nativeElement.textContent).toContain('Bruno Souza');
    expect(page.canSubmitGroup()).toBe(false);

    page.groupCandidateQuery.set('bruno');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Ana Silva');
    expect(fixture.nativeElement.textContent).toContain('Bruno Souza');
    page.toggleGroupParticipant('user-2');
    page.toggleGroupParticipant('user-3');
    expect(page.selectedGroupParticipantIds().size).toBe(2);
    expect(page.canSubmitGroup()).toBe(false);
    page.groupName.set('Equipe Administrativa');
    expect(page.canSubmitGroup()).toBe(true);
  });

  it('creates, refreshes and selects a named group, then uses the existing send flow', async () => {
    profile.set({ id: 'user-1', display_name: 'Pessoa Atual', role: 'administrador' });
    listMyConversations
      .mockReset()
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([group, first, second]);
    const fixture = await render();
    const page = fixture.componentInstance;
    await page.openNewGroup();
    page.groupName.set('  Operação da Unidade  ');
    page.toggleGroupParticipant('user-2');
    page.toggleGroupParticipant('user-3');
    await page.createGroup();
    fixture.detectChanges();

    expect(createGroupConversation).toHaveBeenCalledExactlyOnceWith('  Operação da Unidade  ', [
      'user-2',
      'user-3',
    ]);
    expect(listMyConversations).toHaveBeenCalledTimes(2);
    expect(page.newGroupOpen()).toBe(false);
    expect(page.selected()?.conversation.id).toBe('group-1');
    expect(page.selected()?.name).toBe('Operação da Unidade');
    expect(fixture.nativeElement.textContent).toContain('Grupo • 3 participantes');
    expect(fixture.nativeElement.textContent).toContain('A conversa começa por aqui');
    expect(subscriptions.at(-1)?.conversationId).toBe('group-1');

    page.draft.set('Mensagem para o grupo');
    await page.send();
    expect(sendMessage).toHaveBeenLastCalledWith('group-1', 'Mensagem para o grupo');
  });

  it('keeps the group dialog usable when creation fails', async () => {
    profile.set({ id: 'user-1', display_name: 'Pessoa Atual', role: 'gestor' });
    createGroupConversation.mockRejectedValue(new Error('private detail'));
    const fixture = await render();
    const page = fixture.componentInstance;
    await page.openNewGroup();
    page.groupName.set('Projetos e Melhorias');
    page.toggleGroupParticipant('user-2');
    await page.createGroup();
    fixture.detectChanges();
    expect(page.newGroupOpen()).toBe(true);
    expect(page.creatingGroup()).toBe(false);
    expect(page.groupName()).toBe('Projetos e Melhorias');
    expect(page.selectedGroupParticipantIds().has('user-2')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Não foi possível criar o grupo');
    expect(fixture.nativeElement.textContent).not.toContain('private detail');
  });

  it('opens the returned conversation after refreshing the conversation list', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;
    await page.openNewConversation();
    await page.startConversation({ user_id: 'user-3', display_name: 'Bruno Souza' });
    fixture.detectChanges();
    expect(getOrCreateDirectConversation).toHaveBeenCalledExactlyOnceWith('user-3');
    expect(listMyConversations).toHaveBeenCalledTimes(2);
    expect(page.selected()?.conversation.id).toBe('conversation-2');
    expect(listMessages).toHaveBeenCalledWith('conversation-2');
    expect(page.newConversationOpen()).toBe(false);
  });

  it('keeps the candidate dialog usable when conversation creation fails', async () => {
    getOrCreateDirectConversation.mockRejectedValue(new Error('private detail'));
    const fixture = await render();
    const page = fixture.componentInstance;
    await page.openNewConversation();
    await page.startConversation({ user_id: 'user-2', display_name: 'Ana Silva' });
    fixture.detectChanges();
    expect(page.newConversationOpen()).toBe(true);
    expect(page.startingConversation()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Não foi possível abrir a conversa.');
    expect(fixture.nativeElement.textContent).not.toContain('private detail');
  });

  it('shows a friendly list error and retries safely', async () => {
    listMyConversations
      .mockRejectedValueOnce(new Error('private detail'))
      .mockResolvedValueOnce([]);
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar suas conversas');
    expect(fixture.nativeElement.textContent).not.toContain('private detail');
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.list-feedback button')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(listMyConversations).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Nenhuma conversa disponível');
  });

  it('selects a conversation and loads its participants and persistent history in stable order', async () => {
    const fixture = await render();
    await openFirst(fixture);
    expect(listMessages).toHaveBeenCalledWith('conversation-1');
    const rendered = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      '.message',
    );
    expect(rendered).toHaveLength(2);
    expect(rendered[0].textContent).toContain('Mensagem recebida');
    expect(rendered[1].textContent).toContain('Mensagem própria');
    expect(rendered[0].classList.contains('own')).toBe(false);
    expect(rendered[0].textContent).toContain('Pessoa Teste 2');
    expect(rendered[0].querySelector('.avatar')?.textContent?.trim()).toBe('PT');
    expect(rendered[0].querySelector('.message-meta time')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.chat-layout')?.classList.contains('panel')).toBe(false);
    expect(fixture.nativeElement.querySelector('.conversation-list .chat-actions')).not.toBeNull();
    expect(rendered[1].classList.contains('own')).toBe(true);
    expect(rendered[1].textContent).toContain('Você');
  });

  it('shows loading while opening and a generic message when history is inaccessible', async () => {
    let reject!: (error: Error) => void;
    listMessages.mockImplementation(
      () =>
        new Promise<ChatMessage[]>((_resolve, fail) => {
          reject = fail;
        }),
    );
    const fixture = await render();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.conversation')!
      .click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carregando histórico');
    await vi.waitFor(() => expect(listMessages).toHaveBeenCalledWith('conversation-1'));
    reject(new Error('conversation exists but RLS denied'));
    await vi.waitFor(() => expect(fixture.componentInstance.conversationLoading()).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Conversa não encontrada ou sem acesso');
    expect(fixture.nativeElement.textContent).not.toContain('RLS denied');
  });

  it('does not send blank content', async () => {
    const fixture = await render();
    await openFirst(fixture);
    const page = fixture.componentInstance;
    page.draft.set('   ');
    await page.send();
    fixture.detectChanges();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Digite uma mensagem antes de enviar');
  });

  it('sends once, clears the field and immediately adds the persisted message acknowledgement', async () => {
    let resolve!: (id: string) => void;
    sendMessage.mockImplementation(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const fixture = await render();
    await openFirst(fixture);
    const page = fixture.componentInstance;
    page.draft.set('  Nova mensagem  ');
    const pending = page.send();
    await page.send();
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith('conversation-1', 'Nova mensagem');
    expect(page.sending()).toBe(true);
    resolve('message-new');
    await pending;
    fixture.detectChanges();
    expect(page.draft()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Nova mensagem');
  });

  it('keeps message content available for retry after a send error', async () => {
    sendMessage.mockRejectedValue(new Error('private detail'));
    const fixture = await render();
    await openFirst(fixture);
    fixture.componentInstance.draft.set('Mensagem para tentar novamente');
    await fixture.componentInstance.send();
    fixture.detectChanges();
    expect(fixture.componentInstance.draft()).toBe('Mensagem para tentar novamente');
    expect(fixture.nativeElement.textContent).toContain('Não foi possível enviar a mensagem');
    expect(fixture.nativeElement.textContent).not.toContain('private detail');
  });

  it('keeps one subscription, removes it on conversation change and removes the last on destroy', async () => {
    const fixture = await render();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.conversation',
    );
    buttons[0].click();
    await vi.waitFor(() => expect(subscribeToMessages).toHaveBeenCalledTimes(1));
    fixture.detectChanges();
    expect(subscribeToMessages).toHaveBeenCalledTimes(1);
    expect(subscriptions[0].conversationId).toBe('conversation-1');

    buttons[1].click();
    await vi.waitFor(() => expect(subscribeToMessages).toHaveBeenCalledTimes(2));
    fixture.detectChanges();
    expect(removeMessageSubscription).toHaveBeenCalledExactlyOnceWith(subscriptions[0].channel);
    expect(subscribeToMessages).toHaveBeenCalledTimes(2);
    expect(subscriptions[1].conversationId).toBe('conversation-2');

    fixture.destroy();
    expect(removeMessageSubscription).toHaveBeenCalledWith(subscriptions[1].channel);
  });

  it('clears messages and rejects queued Realtime callbacks after access is blocked', async () => {
    const fixture = await render();
    await openFirst(fixture);
    const subscription = subscriptions[0];
    session.set(null);
    fixture.detectChanges();
    subscription.onMessage({ ...older, id: 'late-message' });
    subscription.onSubscribed();
    await Promise.resolve();
    expect(fixture.componentInstance.messages()).toEqual([]);
    expect(fixture.componentInstance.conversations()).toEqual([]);
    expect(removeMessageSubscription).toHaveBeenCalledWith(subscription.channel);
  });

  it('adds Realtime messages and deduplicates matching message IDs', async () => {
    const fixture = await render();
    await openFirst(fixture);
    const incoming: ChatMessage = {
      id: 'message-3',
      conversation_id: 'conversation-1',
      author_id: 'user-2',
      content: 'Chegou em tempo real',
      created_at: '2026-09-28T12:00:00Z',
    };
    subscriptions[0].onMessage(incoming);
    subscriptions[0].onMessage({ ...incoming, content: 'Versão deduplicada' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.message')).toHaveLength(3);
    expect(fixture.nativeElement.textContent).toContain('Versão deduplicada');
    expect(fixture.nativeElement.textContent).not.toContain('Chegou em tempo real');
  });

  it('resynchronizes persisted history when Realtime subscribes again without duplicating messages', async () => {
    const fixture = await render();
    await openFirst(fixture);
    listMessages.mockResolvedValue([
      older,
      newer,
      {
        id: 'message-3',
        conversation_id: 'conversation-1',
        author_id: 'user-2',
        content: 'Recuperada após reconexão',
        created_at: '2026-09-28T12:00:00Z',
      },
    ]);
    subscriptions[0].onSubscribed();
    await vi.waitFor(() => expect(fixture.componentInstance.messages()).toHaveLength(3));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.message')).toHaveLength(3);
    expect(fixture.nativeElement.textContent).toContain('Recuperada após reconexão');
  });
});
