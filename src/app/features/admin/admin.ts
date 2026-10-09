import { Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminService } from './admin.service';
import { AdminAccessError, AdminTeamMember } from './admin.models';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeading } from '../../shared/page-heading';
import { Icon } from '../../shared/icon';
import { BoardsService } from '../boards/boards.service';
import { BoardSummary } from '../boards/board-summary';
import { AdminActivity } from './admin-activity';
import { AdminParticipants } from './admin-participants';
import { EmployeeSecurityPanel } from './employee-security';

@Component({
  imports: [PageHeading, Icon, RouterLink, AdminActivity, AdminParticipants, EmployeeSecurityPanel],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  readonly auth = inject(AuthService);
  private readonly service = inject(BoardsService);
  private readonly adminService = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly boards = signal<BoardSummary[]>([]);
  readonly department = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  private revision = 0;
  readonly team = signal<AdminTeamMember[]>([]);
  readonly teamLoading = signal(true);
  readonly teamError = signal('');
  readonly invalidSession = signal(false);
  readonly search = signal('');
  readonly filteredTeam = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('pt-BR');
    return this.team().filter((person) =>
      `${person.display_name ?? ''} ${person.department_name}`
        .toLocaleLowerCase('pt-BR')
        .includes(query),
    );
  });
  readonly roleLabels = { membro: 'Membro', gestor: 'Gestor', administrador: 'Administrador' };
  private readonly initialUserId = this.auth.session()?.user.id;
  private teamRevision = 0;

  constructor() {
    effect(() => {
      if (
        !this.auth.canAccessAdministration() ||
        this.auth.session()?.user.id !== this.initialUserId
      ) {
        this.invalidateAccess();
      }
    });
  }

  ngOnInit(): void {
    void this.load();
    void this.loadTeam();
  }

  protected invalidateAccess(): void {
    this.revision++;
    this.teamRevision++;
    this.boards.set([]);
    this.department.set('');
    this.team.set([]);
    this.search.set('');
    this.invalidSession.set(true);
    void this.router.navigateByUrl('/inicio');
  }

  async loadTeam(): Promise<void> {
    if (!this.auth.canAccessAdministration() || this.invalidSession()) return;
    const revision = ++this.teamRevision;
    const userId = this.auth.session()?.user.id;
    const current = () =>
      !this.destroyRef.destroyed &&
      revision === this.teamRevision &&
      userId === this.auth.session()?.user.id &&
      this.auth.canAccessAdministration();
    this.team.set([]);
    this.teamLoading.set(true);
    this.teamError.set('');
    try {
      const people = await this.adminService.listTeamMembers();
      if (current()) this.team.set(people);
    } catch (error) {
      if (current()) {
        if (error instanceof AdminAccessError) this.invalidateAccess();
        else this.teamError.set('Não foi possível carregar a equipe. Tente novamente.');
      }
    } finally {
      if (current()) this.teamLoading.set(false);
    }
  }

  async load(): Promise<void> {
    if (!this.auth.canAccessAdministration() || this.invalidSession()) return;
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
        visible.map((board) => this.service.canManageStructureStrict(board.id)),
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
