import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  BoardAssignee,
  CreateTaskInput,
  TaskComment,
  TaskDetail,
  TaskEvent,
  TaskResult,
  TaskWithContext,
} from './task-detail';

const TASK_FIELDS =
  'id, board_id, column_id, title, description, created_by, assignee_id, due_at, business_state, is_private, created_at, accepted_at, completed_at';
const TASK_WITH_CONTEXT_SELECT = `${TASK_FIELDS}, board:boards!tasks_board_id_fkey(id, title), column:board_columns!tasks_board_column_fkey(id, title)`;

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly auth = inject(AuthService);

  async list(boardId: string): Promise<TaskDetail[]> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client
        .from('tasks')
        .select(TASK_FIELDS)
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
      const { data, error } = await this.client.rpc('list_board_assignees', {
        p_board_id: boardId,
      });
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return (data ?? []) as BoardAssignee[];
    } catch {
      throw new Error('Não foi possível carregar os responsáveis disponíveis.');
    }
  }

  async listMine(): Promise<TaskWithContext[]> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client
        .from('tasks')
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
      const { data, error, status } = await this.client
        .from('tasks')
        .select(TASK_WITH_CONTEXT_SELECT)
        .eq('id', id)
        .maybeSingle<TaskWithContext>();
      if (this.auth.session()?.user.id !== userId) return { status: 'unavailable' };
      if (error)
        return { status: status === 403 || error.code === '42501' ? 'unavailable' : 'error' };
      return data ? { status: 'loaded', task: data } : { status: 'unavailable' };
    } catch {
      return { status: 'error' };
    }
  }

  async listHistory(taskId: string): Promise<TaskEvent[]> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client
        .from('task_events')
        .select('id, task_id, event_type, content, actor_id, is_system, created_at')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .returns<TaskEvent[]>();
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return data ?? [];
    } catch {
      throw new Error('Não foi possível carregar o histórico da pendência.');
    }
  }

  async listComments(taskId: string): Promise<TaskComment[]> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client
        .from('task_comments')
        .select('id, task_id, author_id, content, created_at')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .returns<TaskComment[]>();
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return data ?? [];
    } catch {
      throw new Error('Não foi possível carregar os comentários.');
    }
  }

  async addComment(taskId: string, content: string): Promise<string> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.rpc('add_task_comment', {
        p_task_id: taskId,
        p_content: content.trim(),
      });
      if (error || typeof data !== 'string' || this.auth.session()?.user.id !== userId)
        throw new Error();
      return data;
    } catch {
      throw new Error('Não foi possível adicionar o comentário. Tente novamente.');
    }
  }

  accept(taskId: string): Promise<void> {
    return this.transition('accept_task', taskId);
  }

  start(taskId: string): Promise<void> {
    return this.transition('start_task', taskId);
  }

  complete(taskId: string): Promise<void> {
    return this.transition('complete_task', taskId);
  }

  resume(taskId: string): Promise<void> {
    return this.transition('resume_task', taskId);
  }

  async waitForThirdParty(taskId: string, content: string): Promise<void> {
    const userId = await this.authenticatedUser();
    try {
      const { error } = await this.client.rpc('wait_task_for_third_party', {
        p_task_id: taskId,
        p_content: content.trim(),
      });
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
    } catch {
      throw new Error('Não foi possível colocar a pendência em espera. Tente novamente.');
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
      if (error || typeof data !== 'string' || this.auth.session()?.user.id !== userId)
        throw new Error();
      return data;
    } catch {
      throw new Error('Não foi possível criar a pendência. Revise os dados e tente novamente.');
    }
  }

  async moveToColumn(taskId: string, targetColumnId: string): Promise<void> {
    const userId = await this.authenticatedUser();
    try {
      const { error } = await this.client.rpc('move_task_to_column', {
        p_task_id: taskId,
        p_target_column_id: targetColumnId,
      });
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
    } catch {
      throw new Error('Não foi possível mover a pendência. Ela voltou para a coluna anterior.');
    }
  }

  private async authenticatedUser(): Promise<string> {
    await this.auth.ready;
    const userId = this.auth.session()?.user.id;
    if (!userId) throw new Error('Sessão inválida.');
    return userId;
  }

  private async transition(
    rpc: 'accept_task' | 'start_task' | 'complete_task' | 'resume_task',
    taskId: string,
  ): Promise<void> {
    const userId = await this.authenticatedUser();
    try {
      const { error } = await this.client.rpc(rpc, { p_task_id: taskId });
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
    } catch {
      throw new Error('Não foi possível atualizar a pendência. Tente novamente.');
    }
  }
}
