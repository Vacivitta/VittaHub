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
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  const client = { from: vi.fn(), rpc: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() };

  beforeEach(() => {
    session.set({ user: { id: 'user-1' } });
    auth.ready = Promise.resolve();
    client.from.mockReset().mockReturnValue(query);
    client.rpc.mockReset();
    client.channel.mockReset().mockReturnValue(channel);
    client.removeChannel.mockReset().mockResolvedValue('ok');
    channel.on.mockReset().mockReturnValue(channel);
    channel.subscribe.mockReset().mockReturnValue(channel);
    query.select.mockReset().mockReturnValue(query);
    query.eq.mockReset().mockReturnValue(query);
    query.order.mockReset().mockReturnValue(query);
    returns.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: SUPABASE_CLIENT, useValue: client },
      ],
    });
  });

  it('lists only RLS-visible conversations by recent activity with stable order', async () => {
    const conversations = [
      {
        id: 'conversation-1',
        kind: 'individual',
        title: null,
        created_at: '2026-09-28T10:00:00Z',
        last_activity_at: '2026-09-28T11:00:00Z',
      },
    ];
    returns.mockResolvedValue({ data: conversations, error: null });

    expect(await TestBed.inject(ChatService).listMyConversations()).toEqual(conversations);
    expect(client.from).toHaveBeenCalledExactlyOnceWith('conversations');
    expect(query.select).toHaveBeenCalledExactlyOnceWith(
      'id, kind, title, created_at, last_activity_at',
    );
    expect(query.order.mock.calls).toEqual([
      ['last_activity_at', { ascending: false }],
      ['id', { ascending: true }],
    ]);
  });

  it('lists the minimal participant projection through the controlled RPC', async () => {
    const participants = [{ user_id: 'user-1', display_name: 'Pessoa Um' }];
    client.rpc.mockResolvedValue({ data: participants, error: null });

    expect(
      await TestBed.inject(ChatService).listConversationParticipants('conversation-1'),
    ).toEqual(participants);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('list_conversation_participants', {
      p_conversation_id: 'conversation-1',
    });
  });

  it('lists direct candidates and gets or creates a direct conversation through controlled RPCs', async () => {
    const candidates = [{ user_id: 'user-2', display_name: 'Pessoa Dois' }];
    client.rpc.mockResolvedValueOnce({ data: candidates, error: null });
    const service = TestBed.inject(ChatService);
    await expect(service.listDirectChatCandidates()).resolves.toEqual(candidates);
    expect(client.rpc).toHaveBeenLastCalledWith('list_direct_chat_candidates');

    client.rpc.mockResolvedValueOnce({ data: 'conversation-2', error: null });
    await expect(service.getOrCreateDirectConversation('user-2')).resolves.toBe('conversation-2');
    expect(client.rpc).toHaveBeenLastCalledWith('get_or_create_direct_conversation', {
      p_target_user_id: 'user-2',
    });
  });

  it('creates a group with a trimmed name and deduplicated participant ids', async () => {
    client.rpc.mockResolvedValue({ data: 'group-1', error: null });

    await expect(
      TestBed.inject(ChatService).createGroupConversation('  Operação da Unidade  ', [
        'user-2',
        'user-2',
        'user-3',
      ]),
    ).resolves.toBe('group-1');
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('create_group_conversation', {
      group_name: 'Operação da Unidade',
      participant_ids: ['user-2', 'user-3'],
    });
  });

  it('validates group name and participants before calling Supabase', async () => {
    const service = TestBed.inject(ChatService);
    await expect(service.createGroupConversation('   ', ['user-2'])).rejects.toThrow(
      'Informe o nome do grupo.',
    );
    await expect(service.createGroupConversation('Equipe', [])).rejects.toThrow(
      'Selecione pelo menos uma pessoa.',
    );
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('loads message history in stable chronological order', async () => {
    const messages = [
      {
        id: 'message-1',
        conversation_id: 'conversation-1',
        author_id: 'user-1',
        content: 'Olá',
        created_at: '2026-09-28T10:00:00Z',
      },
    ];
    returns.mockResolvedValue({ data: messages, error: null });

    expect(await TestBed.inject(ChatService).listMessages('conversation-1')).toEqual(messages);
    expect(client.from).toHaveBeenCalledExactlyOnceWith('messages');
    expect(query.eq).toHaveBeenCalledExactlyOnceWith('conversation_id', 'conversation-1');
    expect(query.order.mock.calls).toEqual([
      ['created_at', { ascending: true }],
      ['id', { ascending: true }],
    ]);
  });

  it('trims and sends a message without author or timestamp fields', async () => {
    client.rpc.mockResolvedValue({ data: 'message-new', error: null });

    expect(
      await TestBed.inject(ChatService).sendMessage('conversation-1', '  Mensagem segura  '),
    ).toBe('message-new');
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('send_message', {
      p_conversation_id: 'conversation-1',
      p_content: 'Mensagem segura',
    });
    expect(client.rpc.mock.calls[0][1]).not.toHaveProperty('author_id');
    expect(client.rpc.mock.calls[0][1]).not.toHaveProperty('created_at');
  });

  it('rejects an empty message without calling Supabase', async () => {
    await expect(TestBed.inject(ChatService).sendMessage('conversation-1', '   ')).rejects.toThrow(
      'Digite uma mensagem antes de enviar.',
    );
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('subscribes only to inserts from the selected conversation', () => {
    const onMessage = vi.fn();
    const onSubscribed = vi.fn();
    const service = TestBed.inject(ChatService);

    expect(service.subscribeToMessages('conversation-1', onMessage, onSubscribed)).toBe(channel);
    expect(client.channel).toHaveBeenCalledExactlyOnceWith('messages:conversation-1');
    expect(channel.on).toHaveBeenCalledExactlyOnceWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: 'conversation_id=eq.conversation-1',
      },
      expect.any(Function),
    );

    const message = {
      id: 'message-1',
      conversation_id: 'conversation-1',
      author_id: 'user-2',
      content: 'Nova',
      created_at: '2026-09-28T12:00:00Z',
    };
    channel.on.mock.calls[0][2]({ new: message });
    channel.subscribe.mock.calls[0][0]('SUBSCRIBED');
    expect(onMessage).toHaveBeenCalledExactlyOnceWith(message);
    expect(onSubscribed).toHaveBeenCalledOnce();
  });

  it('removes a Realtime channel through the shared client', async () => {
    await TestBed.inject(ChatService).removeMessageSubscription(channel as never);
    expect(client.removeChannel).toHaveBeenCalledExactlyOnceWith(channel);
  });

  it('returns empty lists when Supabase has no visible data', async () => {
    returns.mockResolvedValue({ data: null, error: null });
    expect(await TestBed.inject(ChatService).listMyConversations()).toEqual([]);

    client.rpc.mockResolvedValue({ data: null, error: null });
    expect(
      await TestBed.inject(ChatService).listConversationParticipants('conversation-1'),
    ).toEqual([]);
  });

  it.each([
    ['conversations', 'Não foi possível carregar suas conversas. Tente novamente.'],
    ['participants', 'Não foi possível carregar os participantes da conversa.'],
    ['messages', 'Não foi possível carregar as mensagens. Tente novamente.'],
    ['send', 'Não foi possível enviar a mensagem. Tente novamente.'],
    ['group', 'Não foi possível criar o grupo. Tente novamente.'],
  ] as const)('hides internal errors from %s', async (operation, expectedMessage) => {
    const service = TestBed.inject(ChatService);
    returns.mockResolvedValue({ data: null, error: { message: 'private database detail' } });
    client.rpc.mockResolvedValue({ data: null, error: { message: 'private database detail' } });

    const action =
      operation === 'conversations'
        ? service.listMyConversations()
        : operation === 'participants'
          ? service.listConversationParticipants('conversation-1')
          : operation === 'messages'
            ? service.listMessages('conversation-1')
            : operation === 'send'
              ? service.sendMessage('conversation-1', 'Mensagem')
              : service.createGroupConversation('Equipe', ['user-2']);
    await expect(action).rejects.toThrow(expectedMessage);
  });

  it('does not query without a current session', async () => {
    session.set(null);
    await expect(TestBed.inject(ChatService).listMyConversations()).rejects.toThrow(
      'Sessão inválida.',
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it('discards a response after the authenticated user changes', async () => {
    returns.mockImplementation(async () => {
      session.set({ user: { id: 'user-2' } });
      return { data: [], error: null };
    });
    await expect(TestBed.inject(ChatService).listMyConversations()).rejects.toThrow(
      'Não foi possível carregar suas conversas.',
    );
  });
});
