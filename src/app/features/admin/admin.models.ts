export interface AdminTeamMember {
  id: string;
  display_name: string | null;
  role: 'membro' | 'gestor' | 'administrador';
  is_active: boolean;
  department_id: string;
  department_name: string;
}

export class AdminAccessError extends Error {}

export interface ActivityFilters {
  from: string;
  to: string;
  actorId: string | null;
  boardId: string | null;
}

export interface AdminActivityEvent {
  id: string;
  task_id: string;
  task_title: string;
  board_id: string;
  board_title: string;
  actor_id: string;
  actor_name: string | null;
  event_type: string;
  content: string;
  created_at: string;
  elapsed_seconds: number | null;
}

export interface AdminActivityDashboard {
  completed: number;
  in_progress: number;
  average_seconds: number | null;
  duration_samples: number;
  total_events: number;
  events: AdminActivityEvent[];
  boards: { id: string; name: string }[];
  people: { id: string; name: string | null }[];
}
