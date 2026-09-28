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
