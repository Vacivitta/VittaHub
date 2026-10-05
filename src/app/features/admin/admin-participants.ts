import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { BoardSummary } from '../boards/board-summary';
import { AdminService } from './admin.service';
import {
  AdminAccessError,
  AdminBoardMember,
  AdminTeamMember,
  BoardMemberAction,
} from './admin.models';

@Component({
  selector: 'app-admin-participants',
  templateUrl: './admin-participants.html',
  styleUrl: './admin-participants.scss',
})
export class AdminParticipants {
  readonly boards = input.required<BoardSummary[]>();
  readonly accessDenied = output<void>();
  readonly changed = output<void>();
  private readonly service = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly initialUser = this.auth.session()?.user.id;
  private revision = 0;
  readonly boardId = signal('');
  readonly boardSearch = signal('');
  readonly userSearch = signal('');
  readonly filteredBoards = computed(() =>
    this.boards().filter(
      (b) =>
        b.id === this.boardId() ||
        b.title
          .toLocaleLowerCase('pt-BR')
          .includes(this.boardSearch().trim().toLocaleLowerCase('pt-BR')),
    ),
  );
  readonly filteredCandidates = computed(() =>
    this.candidates().filter(
      (p) =>
        p.id === this.selectedUser() ||
        `${p.display_name ?? ''} ${p.department_name}`
          .toLocaleLowerCase('pt-BR')
          .includes(this.userSearch().trim().toLocaleLowerCase('pt-BR')),
    ),
  );
  readonly members = signal<AdminBoardMember[]>([]);
  readonly people = signal<AdminTeamMember[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly selectedUser = signal('');
  readonly pending = signal<{ id: string; name: string; action: BoardMemberAction } | null>(null);
  readonly candidates = computed(() =>
    this.people().filter((p) => p.is_active && !this.members().some((m) => m.id === p.id)),
  );
  readonly labels = { add: 'Adicionar', remove: 'Remover', promote: 'Promover a administrador' };

  constructor() {
    effect(() => {
      if (
        !this.auth.canAccessAdministration() ||
        this.auth.session()?.user.id !== this.initialUser ||
        (this.boardId() && !this.boards().some((b) => b.id === this.boardId()))
      ) {
        this.revision++;
        this.boardId.set('');
        this.clear();
      }
    });
  }

  private clear(): void {
    this.loading.set(false);
    this.members.set([]);
    this.people.set([]);
    this.pending.set(null);
    this.selectedUser.set('');
    this.success.set('');
    this.error.set('');
  }

  async selectBoard(id: string): Promise<void> {
    if (this.saving()) return;
    this.boardId.set(this.boards().some((b) => b.id === id) ? id : '');
    await this.load();
  }

  async load(): Promise<void> {
    const revision = ++this.revision;
    const board = this.boardId();
    this.clear();
    if (!board || !this.current(revision)) return;
    this.loading.set(true);
    try {
      const [members, people] = await Promise.all([
        this.service.listBoardMembers(board),
        this.service.listTeamMembers(),
      ]);
      if (this.current(revision)) {
        this.members.set(members);
        this.people.set(people);
      }
    } catch (error) {
      if (this.current(revision)) this.handleError(error);
    } finally {
      if (this.current(revision)) this.loading.set(false);
    }
  }

  request(action: BoardMemberAction, id: string): void {
    if (this.loading() || this.saving() || !this.boardId()) return;
    const person =
      action === 'add'
        ? this.candidates().find((p) => p.id === id)
        : this.members().find((p) => p.id === id);
    if (
      !person ||
      ('is_board_admin' in person && person.is_board_admin) ||
      (action === 'promote' && (!person.is_active || id === this.initialUser))
    )
      return;
    this.pending.set({ id, name: person.display_name || 'Nome não informado', action });
    this.error.set('');
    this.success.set('');
  }

  canPromote(member: AdminBoardMember): boolean {
    return !member.is_board_admin && member.is_active && member.id !== this.initialUser;
  }

  async confirm(): Promise<void> {
    const pending = this.pending();
    const revision = this.revision;
    const board = this.boardId();
    if (!pending || this.saving() || !this.current(revision)) return;
    this.saving.set(true);
    try {
      await this.service.changeBoardMember(this.boardId(), pending.id, pending.action);
      if (!this.current(revision)) return;
      this.pending.set(null);
      await this.load();
      if (this.current(revision + 1) && this.boardId() === board && !this.error()) {
        this.success.set('Participantes atualizados.');
        this.changed.emit();
      }
    } catch (error) {
      if (this.current(revision)) {
        this.pending.set(null);
        this.handleError(error);
      }
    } finally {
      if (!this.destroyRef.destroyed) this.saving.set(false);
    }
  }

  private current(revision: number): boolean {
    return (
      !this.destroyRef.destroyed &&
      revision === this.revision &&
      this.auth.canAccessAdministration() &&
      this.auth.session()?.user.id === this.initialUser
    );
  }

  private handleError(error: unknown): void {
    if (error instanceof AdminAccessError) {
      this.clear();
      this.boardId.set('');
      this.accessDenied.emit();
    } else
      this.error.set(
        'Não foi possível concluir a operação. Atualize os participantes e tente novamente.',
      );
  }
}
