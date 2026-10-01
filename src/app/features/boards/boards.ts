import { DatePipe } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
import { PageHeading } from '../../shared/page-heading';
import { BoardCreationContext, BoardSummary, DepartmentOption } from './board-summary';
import { BoardsService } from './boards.service';

@Component({
  imports: [PageHeading, RouterLink, Icon, ReactiveFormsModule, DatePipe, CdkTrapFocus],
  templateUrl: './boards.html',
  styleUrl: './boards.scss',
})
export class Boards implements OnInit {
  private readonly service = inject(BoardsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly boards = signal<BoardSummary[]>([]);
  readonly management = signal<Record<string, boolean>>({});
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly context = signal<BoardCreationContext | null>(null);
  readonly departments = signal<DepartmentOption[]>([]);
  readonly createFormOpen = signal(false);
  readonly creating = signal(false);
  readonly creationError = signal('');
  readonly success = signal('');
  readonly canCreate = computed(() => this.context()?.can_create === true);
  readonly filtered = computed(() =>
    this.boards().filter((board) =>
      board.title
        .toLocaleLowerCase('pt-BR')
        .includes(this.query().trim().toLocaleLowerCase('pt-BR')),
    ),
  );
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    departmentId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    void this.load();
    void this.loadAccess();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.boards.set([]);
    this.management.set({});
    try {
      const boards = await this.service.list();
      if (!this.destroyRef.destroyed) {
        this.boards.set(boards);
        void this.loadManagement(boards);
      }
    } catch {
      if (!this.destroyRef.destroyed)
        this.error.set('Não foi possível carregar os quadros. Tente novamente.');
    } finally {
      if (!this.destroyRef.destroyed) this.loading.set(false);
    }
  }

  private async loadManagement(boards: BoardSummary[]): Promise<void> {
    const entries = await Promise.all(
      boards.map(async (board) => {
        // Reuse the detail capability: global role alone does not define board access.
        const allowed = await this.service.canManageStructure(board.id).catch(() => false);
        return [board.id, allowed] as const;
      }),
    );
    if (!this.destroyRef.destroyed && this.boards() === boards) {
      this.management.set(Object.fromEntries(entries));
    }
  }

  private async loadAccess(): Promise<void> {
    const context = await this.service.getCreationContext();
    if (this.destroyRef.destroyed || !context) return;
    this.context.set(context);
    if (context.role === 'administrador' && context.can_create) {
      try {
        this.departments.set(await this.service.listDepartments());
      } catch {
        this.context.set({ ...context, can_create: false });
      }
    }
  }

  openCreateForm(): void {
    const context = this.context();
    if (!context?.can_create) return;
    this.creationError.set('');
    this.success.set('');
    this.form.reset({
      title: '',
      description: '',
      departmentId: context.role === 'gestor' ? context.department_id : '',
    });
    this.createFormOpen.set(true);
  }
  closeCreateForm(): void {
    if (!this.creating()) this.createFormOpen.set(false);
  }
  async createBoard(): Promise<void> {
    if (!this.canCreate() || this.creating()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.creating.set(true);
    this.creationError.set('');
    try {
      const value = this.form.getRawValue();
      await this.service.create({
        title: value.title,
        description: value.description || null,
        departmentId: value.departmentId,
      });
      await this.load();
      this.createFormOpen.set(false);
      this.success.set('Quadro criado com sucesso.');
    } catch {
      this.creationError.set('Não foi possível criar o quadro. Revise os dados e tente novamente.');
    } finally {
      this.creating.set(false);
    }
  }
}
