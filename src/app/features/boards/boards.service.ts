import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  BoardCreationContext,
  BoardSummary,
  CreateBoardInput,
  DepartmentOption,
  UpdateBoardInput,
} from './board-summary';
import { BoardDetail, BoardResult } from './board-detail';

@Injectable({ providedIn: 'root' })
export class BoardsService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly auth = inject(AuthService);

  async getById(id: string): Promise<BoardResult> {
    // Do not send malformed route values to the UUID column.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return { status: 'unavailable' };
    }
    try {
      await this.auth.ready;
      const userId = this.auth.session()?.user.id;
      if (!userId) return { status: 'forbidden' };

      const { data, error, status } = await this.client
        .from('boards')
        .select(
          'id, title, description, created_at, department:departments(name), columns:board_columns(id, title, position, business_state)',
        )
        .eq('id', id)
        .order('position', { referencedTable: 'columns', ascending: true })
        .maybeSingle<BoardDetail>();

      if (this.auth.session()?.user.id !== userId) return { status: 'forbidden' };
      if (error) {
        return { status: status === 403 || error.code === '42501' ? 'forbidden' : 'error' };
      }
      // RLS hides rows; an absent board and a hidden board are indistinguishable.
      return data ? { status: 'loaded', board: data } : { status: 'unavailable' };
    } catch {
      return { status: 'error' };
    }
  }

  async list(): Promise<BoardSummary[]> {
    try {
      await this.auth.ready;
      const userId = this.auth.session()?.user.id;
      if (!userId) throw new Error();

      // RLS decides visibility, including cross-department members and system admins.
      // A left relationship keeps a visible board even if its department is unavailable.
      const { data, error } = await this.client
        .from('boards')
        .select('id, title, description, created_at, department:departments(name)')
        .order('title', { ascending: true })
        .returns<BoardSummary[]>();

      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return data ?? [];
    } catch {
      throw new Error('Não foi possível carregar os quadros. Tente novamente.');
    }
  }

  async getCreationContext(): Promise<BoardCreationContext | null> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.rpc('get_board_creation_context');
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return ((data ?? [])[0] as BoardCreationContext | undefined) ?? null;
    } catch {
      return null;
    }
  }

  async listDepartments(): Promise<DepartmentOption[]> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client
        .from('departments')
        .select('id, name')
        .order('name', { ascending: true })
        .returns<DepartmentOption[]>();
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return data ?? [];
    } catch {
      throw new Error('Não foi possível carregar os departamentos disponíveis.');
    }
  }

  async create(input: CreateBoardInput): Promise<string> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.rpc('create_board', {
        p_title: input.title.trim(),
        p_department_id: input.departmentId,
        p_description: input.description?.trim() || null,
      });
      if (error || typeof data !== 'string' || this.auth.session()?.user.id !== userId)
        throw new Error();
      return data;
    } catch {
      throw new Error('Não foi possível criar o quadro. Revise os dados e tente novamente.');
    }
  }

  async canManageStructure(boardId: string): Promise<boolean> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.rpc('can_manage_board_structure', {
        p_board_id: boardId,
      });
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return data === true;
    } catch {
      return false;
    }
  }

  async canManageColumns(boardId: string): Promise<boolean> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.rpc('can_manage_board_columns', { p_board_id: boardId });
      return !error && this.auth.session()?.user.id === userId && data === true;
    } catch {
      return false;
    }
  }

  async createColumn(boardId: string, name: string): Promise<string> {
    const userId = await this.authenticatedUser();
    try {
      const { data, error } = await this.client.rpc('create_board_column', {
        p_board_id: boardId,
        p_name: name.trim(),
      });
      if (error || typeof data !== 'string' || this.auth.session()?.user.id !== userId)
        throw new Error();
      return data;
    } catch {
      throw new Error('Não foi possível criar a coluna. Tente novamente.');
    }
  }

  async canManageStructureStrict(boardId: string): Promise<boolean> {
    const userId = await this.authenticatedUser();
    const { data, error } = await this.client.rpc('can_manage_board_structure', {
      p_board_id: boardId,
    });
    if (error || typeof data !== 'boolean' || this.auth.session()?.user.id !== userId) {
      throw new Error('Não foi possível consultar a permissão do quadro.');
    }
    return data;
  }

  async renameColumn(columnId: string, name: string): Promise<void> {
    const userId = await this.authenticatedUser();
    try {
      const { error } = await this.client.rpc('rename_board_column', {
        p_column_id: columnId,
        p_name: name.trim(),
      });
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
    } catch {
      throw new Error('Não foi possível renomear a coluna. Tente novamente.');
    }
  }

  async updateBoard(boardId: string, input: UpdateBoardInput): Promise<void> {
    const userId = await this.authenticatedUser();
    try {
      const { error } = await this.client.rpc('update_board', {
        p_board_id: boardId,
        p_title: input.title.trim(),
        p_description: input.description?.trim() || null,
      });
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
    } catch {
      throw new Error('Não foi possível salvar as alterações do quadro. Tente novamente.');
    }
  }

  async deleteColumn(columnId: string): Promise<void> {
    const userId = await this.authenticatedUser();
    try {
      const { error } = await this.client.rpc('delete_board_column', {
        p_column_id: columnId,
      });
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
    } catch {
      throw new Error('Esta coluna possui pendências. Mova as pendências antes de excluí-la.');
    }
  }

  async deleteBoard(boardId: string): Promise<void> {
    const userId = await this.authenticatedUser();
    try {
      const { error } = await this.client.rpc('delete_board', { p_board_id: boardId });
      if (error || this.auth.session()?.user.id !== userId) throw new Error();
    } catch {
      throw new Error('Não é possível excluir este quadro enquanto houver pendências vinculadas.');
    }
  }

  private async authenticatedUser(): Promise<string> {
    await this.auth.ready;
    const userId = this.auth.session()?.user.id;
    if (!userId) throw new Error('Sessão inválida.');
    return userId;
  }
}
