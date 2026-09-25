import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { BoardSummary } from './board-summary';

@Injectable({ providedIn: 'root' })
export class BoardsService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly auth = inject(AuthService);

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
