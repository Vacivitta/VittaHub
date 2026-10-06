import { BusinessState } from '../boards/board-detail';

export interface TaskDetail {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  created_by: string;
  assignee_id: string | null;
  awaiting_reassignment?: boolean;
  refused_assignee_id?: string | null;
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
  { status: 'loaded'; task: TaskWithContext } | { status: 'unavailable' | 'error' };

export interface TaskEvent {
  actor_display_name: string | null;
  id: string;
  task_id: string;
  event_type: string;
  content: string;
  actor_id: string;
  is_system: boolean;
  created_at: string;
  details?: Record<string, unknown> | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface TaskAssignmentCapabilities {
  can_manage: boolean;
  can_change_due_at: boolean;
}

export interface TaskPostponementRequest {
  id: string;
  task_id: string;
  requested_by: string;
  previous_due_at: string;
  requested_due_at: string;
  justification: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  decided_by: string | null;
  decided_at: string | null;
  decision_justification: string | null;
}
