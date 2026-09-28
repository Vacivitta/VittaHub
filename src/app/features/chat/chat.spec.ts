import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { ChatConversation, ChatMessage, ConversationParticipant } from './chat.models';
import { ChatService } from './chat.service';
import { Chat } from './chat';

describe('Chat', () => {
  const first: ChatConversation = {
    id: 'conversation-1', kind: 'individual', title: null,
    created_at: '2026-09-28T10:00:00Z', last_activity_at: '2026-09-28T12:00:00Z',
  };
  const second: ChatConversation = {
    id: 'conversation-2', kind: 'individual', title: null,
    created_at: '2026-09-28T09:00:00Z', last_activity_at: '2026-09-28T11:00:00Z',
  };
  const participants: Record<string, ConversationParticipant[]> = {
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
    id: 'message-1', conversation_id: 'conversation-1', author_id: 'user-2',
    content: 'Mensagem recebida', created_at: '2026-09-28T10:00:00Z',
  };
  const newer: ChatMessage = {
    id: 'message-2', conversation_id: 'conversation-1', author_id: 'user-1',
    content: 'Mensagem própria', created_at: '2026-09-28T11:00:00Z',
  };

  const session = signal<{ user: { id: string } } | null>({ user: { id: 'user-1' } });
  const listMyConversations = vi.fn();
  const listConversationParticipants = vi.fn();
  const listMessages = vi.fn();
  const sendMessage = vi.fn();
  const subscribeToMessages = vi.fn();
  const removeMessageSubscription = vi.fn();
  const subscriptions: Array<{
    conversationId: string;
    onMessage: (message: ChatMessage) => void;
    onSubscribed: () => void;
    channel: { id: number };
  }> = [];

  beforeEach(() => {
    subscriptions.length = 0;
    session.set({ user: { id: 'user-1' } });
    listMyConversations.mockReset().mockResolvedValue([first, second]);
    listConversationParticipants.mockReset()
      .mockImplementation((id: string) => Promise.resolve(participants[id] ?? []));
    listMessages.mockReset().mockImplementation((id: string) =>
      Promise.resolve(id === first.id ? [newer, older] : []));
    sendMessage.mockReset().mockResolvedValue('message-new');
    subscribeToMessages.mockReset().mockImplementation((
      conversationId: string,
      onMessage: (message: ChatMessage) => void,
      onSubscribed: () => void,
    ) => {
      const channel = { id: subscriptions.length + 1 };
      subscriptions.push({ conversationId, onMessage, onSubscribed, channel });
      return channel;
    });
    removeMessageSubscription.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [Chat],
      providers: [
        { provide: AuthService, useValue: { session } },
        { provide: ChatService, useValue: {
          listMyConversations, listConversationParticipants, listMessages, sendMessage,
          subscribeToMessages, removeMessageSubscription,
        } },
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

  async function openFirst(fixture: ComponentFixture<Chat>): Promise<void> {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.conversation')!.click();
    await vi.waitFor(() => expect(fixture.componentInstance.conversationLoading()).toBe(false));
    fixture.detectChanges();
  }

  it('shows loading and then lists real individual conversations using the other participant name', async () => {
    let resolve!: (value: ChatConversation[]) => void;
    listMyConversations.mockImplementation(() => new Promise<ChatConversation[]>((done) => { resolve = done; }));
    const fixture = TestBed.createComponent(Chat);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carregando conversas');

    resolve([first]);
    await vi.waitFor(() => expect(fixture.componentInstance.listLoading()).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.conversation')?.textContent).toContain('Pessoa Teste 2');
    expect(fixture.nativeElement.querySelector('.conversation')?.textContent).not.toContain('Pessoa Atual');
  });

  it('shows the empty state when there are no existing individual conversations', async () => {
    listMyConversations.mockResolvedValue([]);
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma conversa individual disponível');
    expect(fixture.nativeElement.querySelector('.conversation')).toBeNull();
  });

  it('shows a friendly list error and retries safely', async () => {
    listMyConversations.mockRejectedValueOnce(new Error('private detail')).mockResolvedValueOnce([]);
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar suas conversas');
    expect(fixture.nativeElement.textContent).not.toContain('private detail');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.list-feedback button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(listMyConversations).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Nenhuma conversa individual disponível');
  });

  it('selects a conversation and loads its participants and persistent history in stable order', async () => {
    const fixture = await render();
    await openFirst(fixture);
    expect(listMessages).toHaveBeenCalledWith('conversation-1');
    const rendered = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.message');
    expect(rendered).toHaveLength(2);
    expect(rendered[0].textContent).toContain('Mensagem recebida');
    expect(rendered[1].textContent).toContain('Mensagem própria');
    expect(rendered[0].classList.contains('own')).toBe(false);
    expect(rendered[0].textContent).toContain('Pessoa Teste 2');
    expect(rendered[1].classList.contains('own')).toBe(true);
    expect(rendered[1].textContent).toContain('Você');
  });

  it('shows loading while opening and a generic message when history is inaccessible', async () => {
    let reject!: (error: Error) => void;
    listMessages.mockImplementation(() => new Promise<ChatMessage[]>((_resolve, fail) => { reject = fail; }));
    const fixture = await render();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.conversation')!.click();
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
    sendMessage.mockImplementation(() => new Promise<string>((done) => { resolve = done; }));
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
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.conversation');
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

  it('adds Realtime messages and deduplicates matching message IDs', async () => {
    const fixture = await render();
    await openFirst(fixture);
    const incoming: ChatMessage = {
      id: 'message-3', conversation_id: 'conversation-1', author_id: 'user-2',
      content: 'Chegou em tempo real', created_at: '2026-09-28T12:00:00Z',
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
    listMessages.mockResolvedValue([older, newer, {
      id: 'message-3', conversation_id: 'conversation-1', author_id: 'user-2',
      content: 'Recuperada após reconexão', created_at: '2026-09-28T12:00:00Z',
    }]);
    subscriptions[0].onSubscribed();
    await vi.waitFor(() => expect(fixture.componentInstance.messages()).toHaveLength(3));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.message')).toHaveLength(3);
    expect(fixture.nativeElement.textContent).toContain('Recuperada após reconexão');
  });
});
