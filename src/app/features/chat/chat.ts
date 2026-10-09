import { DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../../core/auth/auth.service';
import {
  ChatConversation,
  ChatMessage,
  ConversationParticipant,
  DirectChatCandidate,
} from './chat.models';
import { ChatService } from './chat.service';
import { Icon } from '../../shared/icon';

interface ConversationListItem {
  conversation: ChatConversation;
  name: string;
  initials: string;
  participantCount: number;
}

@Component({
  imports: [DatePipe, Icon],
  host: { class: 'chat-page' },
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
  readonly newConversationOpen = signal(false);
  readonly candidates = signal<DirectChatCandidate[]>([]);
  readonly candidateQuery = signal('');
  readonly candidatesLoading = signal(false);
  readonly candidateError = signal('');
  readonly startingConversation = signal(false);
  readonly canCreateGroup = computed(() => {
    const role = this.auth.profile()?.role;
    return role === 'gestor' || role === 'administrador';
  });
  readonly newGroupOpen = signal(false);
  readonly groupName = signal('');
  readonly groupCandidateQuery = signal('');
  readonly groupCandidates = signal<DirectChatCandidate[]>([]);
  readonly selectedGroupParticipantIds = signal<ReadonlySet<string>>(new Set());
  readonly groupCandidatesLoading = signal(false);
  readonly groupError = signal('');
  readonly creatingGroup = signal(false);
  readonly canSubmitGroup = computed(
    () =>
      !!this.groupName().trim() &&
      this.selectedGroupParticipantIds().size > 0 &&
      !this.creatingGroup(),
  );
  readonly filteredCandidates = computed(() => {
    const query = this.candidateQuery().trim().toLocaleLowerCase('pt-BR');
    return this.candidates().filter((candidate) =>
      (candidate.display_name ?? '').toLocaleLowerCase('pt-BR').includes(query),
    );
  });
  readonly filteredGroupCandidates = computed(() => {
    const query = this.groupCandidateQuery().trim().toLocaleLowerCase('pt-BR');
    return this.groupCandidates().filter((candidate) =>
      (candidate.display_name ?? '').toLocaleLowerCase('pt-BR').includes(query),
    );
  });

  constructor() {
    const initialUser = this.auth.session()?.user.id;
    effect(() => {
      if (this.auth.session()?.user.id !== initialUser || !this.auth.session()) {
        this.conversationRevision++;
        this.conversations.set([]);
        this.messages.set([]);
        this.participants.set([]);
        this.candidates.set([]);
        this.groupCandidates.set([]);
        this.selected.set(null);
        this.draft.set('');
        void this.removeActiveSubscription();
      }
    });
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
      const conversations = await this.service.listMyConversations();
      const items = await Promise.all(
        conversations.map(async (conversation) => {
          const participants = await this.service.listConversationParticipants(conversation.id);
          if (conversation.kind === 'grupo') {
            const name = conversation.title?.trim() || 'Grupo';
            return {
              conversation,
              name,
              initials: this.initials(name),
              participantCount: participants.length,
            };
          }
          const other = participants.find(
            (participant) => participant.user_id !== this.currentUserId(),
          );
          const name = other?.display_name?.trim() || 'Conversa individual';
          return {
            conversation,
            name,
            initials: this.initials(name),
            participantCount: participants.length,
          };
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

  async openNewGroup(): Promise<void> {
    if (!this.canCreateGroup() || this.creatingGroup()) return;
    this.newGroupOpen.set(true);
    this.groupName.set('');
    this.groupCandidateQuery.set('');
    this.groupCandidates.set([]);
    this.selectedGroupParticipantIds.set(new Set());
    this.groupError.set('');
    await this.loadGroupCandidates();
  }

  async loadGroupCandidates(): Promise<void> {
    this.groupCandidatesLoading.set(true);
    this.groupError.set('');
    try {
      this.groupCandidates.set(await this.service.listDirectChatCandidates());
    } catch {
      this.groupError.set('Não foi possível carregar as pessoas disponíveis. Tente novamente.');
    } finally {
      this.groupCandidatesLoading.set(false);
    }
  }

  closeNewGroup(): void {
    if (!this.creatingGroup()) this.newGroupOpen.set(false);
  }

  toggleGroupParticipant(userId: string): void {
    if (this.creatingGroup()) return;
    const selected = new Set(this.selectedGroupParticipantIds());
    if (selected.has(userId)) selected.delete(userId);
    else selected.add(userId);
    this.selectedGroupParticipantIds.set(selected);
    this.groupError.set('');
  }

  async createGroup(): Promise<void> {
    if (!this.canCreateGroup() || !this.canSubmitGroup()) return;
    this.creatingGroup.set(true);
    this.groupError.set('');
    try {
      const conversationId = await this.service.createGroupConversation(this.groupName(), [
        ...this.selectedGroupParticipantIds(),
      ]);
      await this.loadConversations();
      const item = this.conversations().find((entry) => entry.conversation.id === conversationId);
      if (!item) throw new Error();
      this.newGroupOpen.set(false);
      await this.openConversation(item);
    } catch {
      this.groupError.set('Não foi possível criar o grupo. Tente novamente.');
    } finally {
      this.creatingGroup.set(false);
    }
  }

  async openNewConversation(): Promise<void> {
    if (this.startingConversation()) return;
    this.newConversationOpen.set(true);
    this.candidateQuery.set('');
    this.candidateError.set('');
    this.candidatesLoading.set(true);
    try {
      this.candidates.set(await this.service.listDirectChatCandidates());
    } catch {
      this.candidateError.set('Não foi possível carregar as pessoas disponíveis. Tente novamente.');
    } finally {
      this.candidatesLoading.set(false);
    }
  }

  closeNewConversation(): void {
    if (!this.startingConversation()) this.newConversationOpen.set(false);
  }

  async startConversation(candidate: DirectChatCandidate): Promise<void> {
    if (this.startingConversation()) return;
    this.startingConversation.set(true);
    this.candidateError.set('');
    try {
      const conversationId = await this.service.getOrCreateDirectConversation(candidate.user_id);
      await this.loadConversations();
      const item = this.conversations().find((entry) => entry.conversation.id === conversationId);
      if (!item) throw new Error();
      this.newConversationOpen.set(false);
      await this.openConversation(item);
    } catch {
      this.candidateError.set('Não foi possível abrir a conversa. Tente novamente.');
    } finally {
      this.startingConversation.set(false);
    }
  }

  candidateName(candidate: DirectChatCandidate): string {
    return candidate.display_name?.trim() || 'Pessoa sem nome';
  }

  candidateInitials(candidate: DirectChatCandidate): string {
    return this.initials(this.candidateName(candidate));
  }

  conversationKindLabel(item: ConversationListItem): string {
    return item.conversation.kind === 'grupo'
      ? `Grupo • ${this.participants().length} participantes`
      : 'Conversa individual';
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

  authorInitials(message: ChatMessage): string {
    const name = this.participants().find(
      (person) => person.user_id === message.author_id,
    )?.display_name;
    return this.initials(name?.trim() || this.authorName(message));
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
