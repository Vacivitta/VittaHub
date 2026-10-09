import { inject, Injectable } from '@angular/core';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { AuthService } from '../../core/auth/auth.service';

export interface EmployeeSecurity {
  id: string;
  display_name: string | null;
  role: 'membro' | 'gestor' | 'administrador';
  is_active: boolean;
  delegated: boolean;
  is_master: boolean;
  can_toggle: boolean;
}
export interface SecurityContext {
  is_master: boolean;
  can_manage: boolean;
}
export interface SecurityEvent {
  id: number;
  actor_id: string | null;
  target_id: string;
  action: string;
  occurred_at: string;
}
export type EmployeeAction = 'grant' | 'revoke' | 'activate' | 'deactivate';

@Injectable({ providedIn: 'root' })
export class EmployeeSecurityService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly auth = inject(AuthService);
  private async rpc<T>(name: string, args = {}): Promise<T> {
    const user = this.auth.session()?.user.id;
    if (!user) throw new Error('Sessão indisponível. Entre novamente.');
    const { data, error } = await this.client.rpc(name, args);
    if (user !== this.auth.session()?.user.id) throw new Error('Sessão alterada.');
    if (error)
      throw new Error(
        error.code === '42501'
          ? 'Operação não autorizada. Atualize a lista e confira suas permissões.'
          : 'Não foi possível concluir a operação. Tente novamente.',
      );
    return data as T;
  }
  context() {
    return this.rpc<SecurityContext>('employee_security_context');
  }
  list() {
    return this.rpc<EmployeeSecurity[]>('list_employee_security');
  }
  history() {
    return this.rpc<SecurityEvent[]>('list_employee_security_history');
  }
  change(id: string, action: EmployeeAction) {
    return this.rpc<void>('change_employee_security', { p_target_id: id, p_action: action });
  }
}
