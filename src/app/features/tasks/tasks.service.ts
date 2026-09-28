import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { BoardAssignee, CreateTaskInput, TaskDetail, TaskResult, TaskWithContext } from './task-detail';

const TASK_WITH_CONTEXT_SELECT = 'id, board_id, column_id, title, description, created_by, assignee_id, due_at, business_state, is_private, created_at, board:boards!tasks_board_id_fkey(id, title), column:board_columns!tasks_board_column_fkey(id, title)';

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly auth = inject(AuthService);

  async list(boardId: string): Promise<TaskDetail[]> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.from('tasks')
        .select('id, board_id, column_id, title, description, created_by, assignee_id, due_at, business_state, is_private, created_at')
        .eq('board_id', boardId)
        .order('created_at', { ascending: true })
        .returns<TaskDetail[]>();
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return data ?? [];
    } catch {
      throw new Error('Não foi possível carregar as pendências. Tente novamente.');
    }
  }

  async listAssignees(boardId: string): Promise<BoardAssignee[]> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.rpc('list_board_assignees', { p_board_id: boardId });
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return (data ?? []) as BoardAssignee[];
    } catch {
      throw new Error('Não foi possível carregar os responsáveis disponíveis.');
    }
  }

  async listMine(): Promise<TaskWithContext[]> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.from('tasks')
        .select(TASK_WITH_CONTEXT_SELECT)
        .eq('assignee_id', userId)
        .neq('business_state', 'concluido')
        .order('due_at', { ascending: true })
        .order('id', { ascending: true })
        .returns<TaskWithContext[]>();
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return data ?? [];
    } catch {
      throw new Error('Não foi possível carregar suas pendências. Tente novamente.');
    }
  }

  async getById(id: string): Promise<TaskResult> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return { status: 'unavailable' };
    }
    let userId: string;
    try {
      userId = await this.authenticatedUser();
    } catch {
      return { status: 'unavailable' };
    }
    try {
      const { data, error, status } = await this.client.from('tasks')
        .select(TASK_WITH_CONTEXT_SELECT)
        .eq('id', id)
        .maybeSingle<TaskWithContext>();
      if (this.auth.session()?.user.id !== userId) return { status: 'unavailable' };
      if (error) return { status: status === 403 || error.code === '42501' ? 'unavailable' : 'error' };
      return data ? { status: 'loaded', task: data } : { status: 'unavailable' };
    } catch {
      return { status: 'error' };
    }
  }

  async create(input: CreateTaskInput): Promise<string> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.rpc('create_task', {
        p_board_id: input.boardId,
        p_column_id: input.columnId,
        p_title: input.title.trim(),
        p_assignee_id: input.assigneeId,
        p_due_at: input.dueAt,
        p_is_private: input.isPrivate,
        p_description: input.description?.trim() || null,
      });
      if (error || typeof data !== 'string' || this.auth.session()?.user.id !== userId) throw new Error();
      return data;
    } catch {
      throw new Error('Não foi possível criar a pendência. Revise os dados e tente novamente.');
    }
  }

  private async authenticatedUser(): Promise<string> {
    await this.auth.ready;
    const userId = this.auth.session()?.user.id;
    if (!userId) throw new Error('Sessão inválida.');
    return userId;
  }
}
