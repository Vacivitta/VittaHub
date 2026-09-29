export type ConversationKind = 'individual' | 'grupo';

export interface ChatConversation {
  id: string;
  kind: ConversationKind;
  title: string | null;
  created_at: string;
  last_activity_at: string;
}

export interface ConversationParticipant {
  user_id: string;
  display_name: string | null;
}

export interface DirectChatCandidate {
  user_id: string;
  display_name: string | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  author_id: string;
  content: string;
  created_at: string;
}
