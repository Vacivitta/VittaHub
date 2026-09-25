import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { BoardSummary } from './board-summary';
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

      const { data, error, status } = await this.client.from('boards')
        .select('id, title, description, department:departments(name), columns:board_columns(id, title, position, business_state)')
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
      const { data, error } = await this.client.from('boards')
        .select('id, title, description, department:departments(name)')
        .order('title', { ascending: true })
        .returns<BoardSummary[]>();

      if (error || this.auth.session()?.user.id !== userId) throw new Error();
      return data ?? [];
    } catch {
      throw new Error('Não foi possível carregar os quadros. Tente novamente.');
    }
  }
}
