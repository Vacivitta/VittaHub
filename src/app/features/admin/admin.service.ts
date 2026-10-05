import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  ActivityFilters,
  AdminAccessError,
  AdminActivityDashboard,
  AdminTeamMember,
  AdminBoardMember,
  BoardMemberAction,
} from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly auth = inject(AuthService);

  async listBoardMembers(boardId: string): Promise<AdminBoardMember[]> {
    return ((await this.membershipRpc('list_admin_board_members', { p_board_id: boardId })) ??
      []) as AdminBoardMember[];
  }

  async changeBoardMember(
    boardId: string,
    userId: string,
    action: BoardMemberAction,
  ): Promise<void> {
    await this.membershipRpc('manage_admin_board_member', {
      p_board_id: boardId,
      p_user_id: userId,
      p_action: action,
    });
  }

  private async membershipRpc(name: string, parameters: Record<string, string>): Promise<unknown> {
    await this.auth.ready;
    const userId = this.auth.session()?.user.id;
    if (!userId || !this.auth.canAccessAdministration()) throw new AdminAccessError();
    const { data, error, status } = await this.client.rpc(name, parameters);
    if (
      this.auth.session()?.user.id !== userId ||
      !this.auth.canAccessAdministration() ||
      status === 401 ||
      status === 403 ||
      error?.code === '42501' ||
      error?.code === 'PGRST301'
    ) {
      throw new AdminAccessError();
    }
    if (error)
      throw new Error(
        'Não foi possível concluir a operação. Atualize os participantes e tente novamente.',
      );
    return data;
  }

  async getActivity(filters: ActivityFilters): Promise<AdminActivityDashboard> {
    await this.auth.ready;
    const userId = this.auth.session()?.user.id;
    if (!userId || !this.auth.canAccessAdministration()) throw new AdminAccessError();
    const { data, error, status } = await this.client.rpc('get_admin_activity', {
      p_from: filters.from,
      p_to: filters.to,
      p_actor_id: filters.actorId,
      p_board_id: filters.boardId,
    });
    if (
      this.auth.session()?.user.id !== userId ||
      !this.auth.canAccessAdministration() ||
      status === 401 ||
      status === 403 ||
      error?.code === '42501' ||
      error?.code === 'PGRST301'
    ) {
      throw new AdminAccessError();
    }
    if (error || !data) throw new Error('Não foi possível carregar as atividades.');
    return data as AdminActivityDashboard;
  }

  async listTeamMembers(): Promise<AdminTeamMember[]> {
    await this.auth.ready;
    const userId = this.auth.session()?.user.id;
    if (!userId || !this.auth.canAccessAdministration()) throw new AdminAccessError();
    const { data, error, status } = await this.client.rpc('list_admin_team_members');
    if (
      this.auth.session()?.user.id !== userId ||
      !this.auth.canAccessAdministration() ||
      status === 401 ||
      status === 403 ||
      error?.code === '42501' ||
      error?.code === 'PGRST301'
    ) {
      throw new AdminAccessError();
    }
    if (error) throw new Error('Não foi possível carregar a equipe. Tente novamente.');
    return (data ?? []) as AdminTeamMember[];
  }
}
