import { DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeading } from '../../shared/page-heading';
import { ChatConversation, ChatMessage, ConversationParticipant } from './chat.models';
import { ChatService } from './chat.service';
import { Icon } from '../../shared/icon';

interface ConversationListItem {
  conversation: ChatConversation;
  name: string;
  initials: string;
}

@Component({
  imports: [PageHeading, DatePipe, Icon],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements OnDestroy {
  private readonly service = inject(ChatService);
  private readonly auth = inject(AuthService);
  private activeChannel: RealtimeChannel | null = null;
  private conversationRevision = 0;
  private destroyed = false;

  readonly conversations = signal<ConversationListItem[]>([]);
  readonly listLoading = signal(true);
  readonly listError = signal('');
  readonly selected = signal<ConversationListItem | null>(null);
  readonly participants = signal<ConversationParticipant[]>([]);
  readonly messages = signal<ChatMessage[]>([]);
  readonly conversationLoading = signal(false);
  readonly conversationError = signal('');
  readonly draft = signal('');
  readonly sending = signal(false);
  readonly sendError = signal('');

  constructor() {
    void this.loadConversations();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.conversationRevision++;
    const channel = this.activeChannel;
    this.activeChannel = null;
    if (channel) void this.service.removeMessageSubscription(channel).catch(() => undefined);
  }

  async loadConversations(): Promise<void> {
    this.listLoading.set(true);
    this.listError.set('');
    try {
      const conversations = (await this.service.listMyConversations()).filter(
        (conversation) => conversation.kind === 'individual',
      );
      const items = await Promise.all(
        conversations.map(async (conversation) => {
          const participants = await this.service.listConversationParticipants(conversation.id);
          const other = participants.find(
            (participant) => participant.user_id !== this.currentUserId(),
          );
          const name = other?.display_name?.trim() || 'Conversa individual';
          return { conversation, name, initials: this.initials(name) };
        }),
      );
      if (!this.destroyed) this.conversations.set(items);
    } catch {
      if (!this.destroyed)
        this.listError.set('Não foi possível carregar suas conversas. Tente novamente.');
    } finally {
      if (!this.destroyed) this.listLoading.set(false);
    }
  }

  async openConversation(item: ConversationListItem): Promise<void> {
    const revision = ++this.conversationRevision;
    this.selected.set(item);
    this.participants.set([]);
    this.messages.set([]);
    this.conversationLoading.set(true);
    this.conversationError.set('');
    this.sendError.set('');

    await this.removeActiveSubscription();
    if (this.destroyed || revision !== this.conversationRevision) return;

    try {
      const [participants, messages] = await Promise.all([
        this.service.listConversationParticipants(item.conversation.id),
        this.service.listMessages(item.conversation.id),
      ]);
      if (this.destroyed || revision !== this.conversationRevision) return;
      this.participants.set(participants);
      this.replaceMessages(messages);
      this.activeChannel = this.service.subscribeToMessages(
        item.conversation.id,
        (message) => this.receiveRealtimeMessage(item.conversation.id, revision, message),
        () => void this.synchronizeHistory(item.conversation.id, revision),
      );
    } catch {
      if (!this.destroyed && revision === this.conversationRevision) {
        this.conversationError.set('Conversa não encontrada ou sem acesso.');
      }
    } finally {
      if (!this.destroyed && revision === this.conversationRevision) {
        this.conversationLoading.set(false);
      }
    }
  }

  async send(): Promise<void> {
    const item = this.selected();
    const content = this.draft().trim();
    if (!item || this.sending()) return;
    if (!content) {
      this.sendError.set('Digite uma mensagem antes de enviar.');
      return;
    }

    this.sending.set(true);
    this.sendError.set('');
    try {
      const id = await this.service.sendMessage(item.conversation.id, content);
      this.draft.set('');
      if (this.selected()?.conversation.id === item.conversation.id) {
        this.mergeMessages([
          {
            id,
            conversation_id: item.conversation.id,
            author_id: this.currentUserId(),
            content,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      this.sendError.set('Não foi possível enviar a mensagem. Tente novamente.');
    } finally {
      this.sending.set(false);
    }
  }

  handleComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    void this.send();
  }

  authorName(message: ChatMessage): string {
    if (message.author_id === this.currentUserId()) return 'Você';
    return (
      this.participants()
        .find((participant) => participant.user_id === message.author_id)
        ?.display_name?.trim() || 'Participante'
    );
  }

  isOwn(message: ChatMessage): boolean {
    return message.author_id === this.currentUserId();
  }

  private currentUserId(): string {
    return this.auth.session()?.user.id ?? '';
  }

  private initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  private async removeActiveSubscription(): Promise<void> {
    const channel = this.activeChannel;
    this.activeChannel = null;
    if (channel) {
      try {
        await this.service.removeMessageSubscription(channel);
      } catch {
        // The old channel is no longer referenced locally; continue opening the selected conversation.
      }
    }
  }

  private receiveRealtimeMessage(
    conversationId: string,
    revision: number,
    message: ChatMessage,
  ): void {
    if (
      this.destroyed ||
      revision !== this.conversationRevision ||
      this.selected()?.conversation.id !== conversationId ||
      message.conversation_id !== conversationId
    )
      return;
    this.mergeMessages([message]);
  }

  private async synchronizeHistory(conversationId: string, revision: number): Promise<void> {
    try {
      const messages = await this.service.listMessages(conversationId);
      if (
        !this.destroyed &&
        revision === this.conversationRevision &&
        this.selected()?.conversation.id === conversationId
      ) {
        this.mergeMessages(messages);
      }
    } catch {
      // Keep the persisted history already loaded; a later subscription or reopen resynchronizes it.
    }
  }

  private replaceMessages(messages: ChatMessage[]): void {
    this.messages.set(this.sorted(messages));
  }

  private mergeMessages(messages: ChatMessage[]): void {
    const byId = new Map(this.messages().map((message) => [message.id, message]));
    for (const message of messages) byId.set(message.id, message);
    this.messages.set(this.sorted([...byId.values()]));
  }

  private sorted(messages: ChatMessage[]): ChatMessage[] {
    return [...messages].sort(
      (left, right) =>
        left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id),
    );
  }
}
