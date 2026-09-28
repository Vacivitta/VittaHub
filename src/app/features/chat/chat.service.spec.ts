import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'user-1' } });
  const auth = { session, ready: Promise.resolve() };
  const returns = vi.fn();
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), returns };
  const client = { from: vi.fn(), rpc: vi.fn() };

  beforeEach(() => {
    session.set({ user: { id: 'user-1' } });
    auth.ready = Promise.resolve();
    client.from.mockReset().mockReturnValue(query);
    client.rpc.mockReset();
    query.select.mockReset().mockReturnValue(query);
    query.eq.mockReset().mockReturnValue(query);
    query.order.mockReset().mockReturnValue(query);
    returns.mockReset();
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: auth },
      { provide: SUPABASE_CLIENT, useValue: client },
    ] });
  });

  it('lists only RLS-visible conversations by recent activity with stable order', async () => {
    const conversations = [{
      id: 'conversation-1', kind: 'individual', title: null,
      created_at: '2026-09-28T10:00:00Z', last_activity_at: '2026-09-28T11:00:00Z',
    }];
    returns.mockResolvedValue({ data: conversations, error: null });

    expect(await TestBed.inject(ChatService).listMyConversations()).toEqual(conversations);
    expect(client.from).toHaveBeenCalledExactlyOnceWith('conversations');
    expect(query.select).toHaveBeenCalledExactlyOnceWith('id, kind, title, created_at, last_activity_at');
    expect(query.order.mock.calls).toEqual([
      ['last_activity_at', { ascending: false }], ['id', { ascending: true }],
    ]);
  });

  it('lists the minimal participant projection through the controlled RPC', async () => {
    const participants = [{ user_id: 'user-1', display_name: 'Pessoa Um' }];
    client.rpc.mockResolvedValue({ data: participants, error: null });

    expect(await TestBed.inject(ChatService).listConversationParticipants('conversation-1'))
      .toEqual(participants);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('list_conversation_participants', {
      p_conversation_id: 'conversation-1',
    });
  });

  it('loads message history in stable chronological order', async () => {
    const messages = [{
      id: 'message-1', conversation_id: 'conversation-1', author_id: 'user-1',
      content: 'OlÃ¡', created_at: '2026-09-28T10:00:00Z',
    }];
    returns.mockResolvedValue({ data: messages, error: null });

    expect(await TestBed.inject(ChatService).listMessages('conversation-1')).toEqual(messages);
    expect(client.from).toHaveBeenCalledExactlyOnceWith('messages');
    expect(query.eq).toHaveBeenCalledExactlyOnceWith('conversation_id', 'conversation-1');
    expect(query.order.mock.calls).toEqual([
      ['created_at', { ascending: true }], ['id', { ascending: true }],
    ]);
  });

  it('trims and sends a message without author or timestamp fields', async () => {
    client.rpc.mockResolvedValue({ data: 'message-new', error: null });

    expect(await TestBed.inject(ChatService).sendMessage('conversation-1', '  Mensagem segura  '))
      .toBe('message-new');
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('send_message', {
      p_conversation_id: 'conversation-1', p_content: 'Mensagem segura',
    });
    expect(client.rpc.mock.calls[0][1]).not.toHaveProperty('author_id');
    expect(client.rpc.mock.calls[0][1]).not.toHaveProperty('created_at');
  });

  it('rejects an empty message without calling Supabase', async () => {
    await expect(TestBed.inject(ChatService).sendMessage('conversation-1', '   '))
      .rejects.toThrow('Digite uma mensagem antes de enviar.');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('returns empty lists when Supabase has no visible data', async () => {
    returns.mockResolvedValue({ data: null, error: null });
    expect(await TestBed.inject(ChatService).listMyConversations()).toEqual([]);

    client.rpc.mockResolvedValue({ data: null, error: null });
    expect(await TestBed.inject(ChatService).listConversationParticipants('conversation-1')).toEqual([]);
  });

  it.each([
    ['conversations', 'NÃ£o foi possÃ­vel carregar suas conversas. Tente novamente.'],
    ['participants', 'NÃ£o foi possÃ­vel carregar os participantes da conversa.'],
    ['messages', 'NÃ£o foi possÃ­vel carregar as mensagens. Tente novamente.'],
    ['send', 'NÃ£o foi possÃ­vel enviar a mensagem. Tente novamente.'],
  ] as const)('hides internal errors from %s', async (operation, expectedMessage) => {
    const service = TestBed.inject(ChatService);
    returns.mockResolvedValue({ data: null, error: { message: 'private database detail' } });
    client.rpc.mockResolvedValue({ data: null, error: { message: 'private database detail' } });

    const action = operation === 'conversations' ? service.listMyConversations()
      : operation === 'participants' ? service.listConversationParticipants('conversation-1')
        : operation === 'messages' ? service.listMessages('conversation-1')
          : service.sendMessage('conversation-1', 'Mensagem');
    await expect(action).rejects.toThrow(expectedMessage);
  });

  it('does not query without a current session', async () => {
    session.set(null);
    await expect(TestBed.inject(ChatService).listMyConversations()).rejects.toThrow('SessÃ£o invÃ¡lida.');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('discards a response after the authenticated user changes', async () => {
    returns.mockImplementation(async () => {
      session.set({ user: { id: 'user-2' } });
      return { data: [], error: null };
    });
    await expect(TestBed.inject(ChatService).listMyConversations())
      .rejects.toThrow('NÃ£o foi possÃ­vel carregar suas conversas.');
  });
});
