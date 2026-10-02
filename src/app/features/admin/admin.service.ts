import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { AdminAccessError, AdminTeamMember } from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly auth = inject(AuthService);

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
