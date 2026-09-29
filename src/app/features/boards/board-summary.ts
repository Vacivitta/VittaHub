export interface BoardSummary {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  department: { name: string } | null;
}

export interface BoardCreationContext {
  role: 'membro' | 'gestor' | 'administrador';
  department_id: string;
  can_create: boolean;
}

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface CreateBoardInput {
  title: string;
  description: string | null;
  departmentId: string;
}

export interface UpdateBoardInput {
  title: string;
  description: string | null;
}
