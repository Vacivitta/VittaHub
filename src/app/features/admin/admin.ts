import { Component, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeading } from '../../shared/page-heading';
import { Icon } from '../../shared/icon';
import { BoardsService } from '../boards/boards.service';
import { BoardSummary } from '../boards/board-summary';

@Component({
  imports: [PageHeading, Icon, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  readonly auth = inject(AuthService);
  private readonly service = inject(BoardsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly boards = signal<BoardSummary[]>([]);
  readonly department = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  private revision = 0;

  constructor() {
    effect(() => {
      if (!this.auth.canAccessAdministration()) {
        this.revision++;
        this.boards.set([]);
        this.department.set('');
        void this.router.navigateByUrl('/inicio');
      }
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    if (!this.auth.canAccessAdministration()) return;
    const revision = ++this.revision;
    const userId = this.auth.session()?.user.id;
    const current = () =>
      !this.destroyRef.destroyed &&
      revision === this.revision &&
      this.auth.session()?.user.id === userId &&
      this.auth.canAccessAdministration();
    this.loading.set(true);
    this.error.set('');
    this.boards.set([]);
    this.department.set('');
    const department = this.loadDepartment().then((name) => {
      if (current()) this.department.set(name);
    });
    try {
      const visible = await this.service.list();
      const allowed = await Promise.all(
        visible.map((board) => this.service.canManageStructure(board.id)),
      );
      if (current()) this.boards.set(visible.filter((_, index) => allowed[index] === true));
    } catch {
      if (current())
        this.error.set('Não foi possível carregar os quadros administrados. Tente novamente.');
    } finally {
      await department;
      if (current()) this.loading.set(false);
    }
  }

  private async loadDepartment(): Promise<string> {
    try {
      const context = await this.service.getCreationContext();
      if (!context?.department_id) return '';
      const departments = await this.service.listDepartments();
      return departments.find((department) => department.id === context.department_id)?.name ?? '';
    } catch {
      return '';
    }
  }
}
