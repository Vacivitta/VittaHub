import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { ChatConversation, ChatMessage, ConversationParticipant } from './chat.models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly auth = inject(AuthService);

  async listMyConversations(): Promise<ChatConversation[]> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.from('conversations')
        .select('id, kind, title, created_at, last_activity_at')
        .order('last_activity_at', { ascending: false })
        .order('id', { ascending: true })
        .returns<ChatConversation[]>();
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return data ?? [];
    } catch {
      throw new Error('NÃ£o foi possÃ­vel carregar suas conversas. Tente novamente.');
    }
  }

  async listConversationParticipants(conversationId: string): Promise<ConversationParticipant[]> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.rpc('list_conversation_participants', {
        p_conversation_id: conversationId,
      });
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return (data ?? []) as ConversationParticipant[];
    } catch {
      throw new Error('NÃ£o foi possÃ­vel carregar os participantes da conversa.');
    }
  }

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.from('messages')
        .select('id, conversation_id, author_id, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .returns<ChatMessage[]>();
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return data ?? [];
    } catch {
      throw new Error('NÃ£o foi possÃ­vel carregar as mensagens. Tente novamente.');
    }
  }

  async sendMessage(conversationId: string, content: string): Promise<string> {
    const normalizedContent = content.trim();
    if (!normalizedContent) throw new Error('Digite uma mensagem antes de enviar.');

    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.rpc('send_message', {
        p_conversation_id: conversationId,
        p_content: normalizedContent,
      });
      if (error || typeof data !== 'string' || this.auth.session()?.user.id !== userId) throw new Error();
      return data;
    } catch {
      throw new Error('NÃ£o foi possÃ­vel enviar a mensagem. Tente novamente.');
    }
  }

  private async authenticatedUser(): Promise<string> {
    await this.auth.ready;
    const userId = this.auth.session()?.user.id;
    if (!userId) throw new Error('SessÃ£o invÃ¡lida.');
    return userId;
  }
}
