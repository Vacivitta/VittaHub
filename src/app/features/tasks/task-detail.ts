import { BusinessState } from '../boards/board-detail';

export interface TaskDetail {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  created_by: string;
  assignee_id: string;
  due_at: string;
  business_state: BusinessState;
  is_private: boolean;
  created_at: string;
  accepted_at?: string | null;
  completed_at?: string | null;
}

export interface BoardAssignee {
  id: string;
  display_name: string | null;
}

export interface CreateTaskInput {
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  assigneeId: string;
  dueAt: string;
  isPrivate: boolean;
}

export interface TaskWithContext extends TaskDetail {
  board: { id: string; title: string } | null;
  column: { id: string; title: string } | null;
}

export type TaskResult =
  | { status: 'loaded'; task: TaskWithContext }
  | { status: 'unavailable' | 'error' };

export interface TaskEvent {
  id: string;
  task_id: string;
  event_type: string;
  content: string;
  actor_id: string;
  is_system: boolean;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
}
