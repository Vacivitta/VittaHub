export interface AdminTeamMember {
  id: string;
  display_name: string | null;
  role: 'membro' | 'gestor' | 'administrador';
  is_active: boolean;
  department_id: string;
  department_name: string;
}

export class AdminAccessError extends Error {}
