export type TaskState =
  'aguardando_aceite' | 'a_fazer' | 'fazendo' | 'aguardando_terceiro' | 'concluido';
export interface Task {
  id: string;
  title: string;
  boardId: string;
  columnId: string;
  creator: string;
  assignee: string;
  deadline: string;
  state: TaskState;
  overdue?: boolean;
}
export interface BoardColumn {
  id: string;
  title: string;
  state?: TaskState;
}
export interface Board {
  id: string;
  title: string;
  description: string;
  area: string;
  columns: readonly BoardColumn[];
}
export interface Message {
  author: string;
  text: string;
  time: string;
  own?: boolean;
}
export interface Conversation {
  id: string;
  name: string;
  initials: string;
  description: string;
  messages: readonly Message[];
}
