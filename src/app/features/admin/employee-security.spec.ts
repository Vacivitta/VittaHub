import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { EmployeeSecurityPanel } from './employee-security';
import { EmployeeSecurityService } from './employee-security.service';

describe('Employee security panel', () => {
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'master' } });
  const person = {
    id: 'employee',
    display_name: 'Pessoa fictícia',
    role: 'gestor',
    is_active: true,
    delegated: false,
    is_master: false,
    can_toggle: true,
  } as const;
  const service = { context: vi.fn(), list: vi.fn(), history: vi.fn(), change: vi.fn() };
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) { this.open = true; },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) { this.open = false; },
    });
    session.set({ user: { id: 'master' } });
    service.context.mockReset().mockResolvedValue({ is_master: true, can_manage: true });
    service.list.mockReset().mockResolvedValue([person]);
    service.history.mockReset().mockResolvedValue([]);
    service.change.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [EmployeeSecurityPanel],
      providers: [
        { provide: AuthService, useValue: { session } },
        { provide: EmployeeSecurityService, useValue: service },
      ],
    });
  });
  async function render() {
    const f = TestBed.createComponent(EmployeeSecurityPanel);
    f.detectChanges();
    await vi.waitFor(() => expect(f.componentInstance.loading()).toBe(false));
    f.detectChanges();
    return f;
  }
  it('offers delegation only with master capability', async () => {
    const f = await render();
    expect(f.nativeElement.textContent).toContain('Delegar gestão');
    service.context.mockResolvedValue({ is_master: false, can_manage: true });
    await f.componentInstance.load();
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Delegar gestão');
  });
  it('requires confirmation and blocks duplicate requests', async () => {
    const f = await render();
    const c = f.componentInstance;
    c.choose(person, 'deactivate');
    expect(service.change).not.toHaveBeenCalled();
    let finish!: () => void;
    service.change.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const pending = c.confirm();
    await c.confirm();
    expect(service.change).toHaveBeenCalledTimes(1);
    expect(c.busy()).toBe(true);
    finish();
    await pending;
    expect(c.feedback()).toContain('registrada');
    expect(service.list).toHaveBeenCalledTimes(2);
  });
  it('shows refusal without claiming success', async () => {
    const f = await render();
    service.change.mockRejectedValue(new Error('Operação não autorizada.'));
    f.componentInstance.choose(person, 'deactivate');
    await f.componentInstance.confirm();
    expect(f.componentInstance.error()).toContain('não autorizada');
    expect(f.componentInstance.feedback()).toBe('');
    f.detectChanges();
    expect(f.nativeElement.querySelector('dialog').open).toBe(true);
    expect(f.nativeElement.querySelector('dialog [role="alert"]').textContent).toContain('não autorizada');
    service.change.mockResolvedValue(undefined);
    await f.componentInstance.confirm();
    f.detectChanges();
    expect(service.change).toHaveBeenCalledTimes(2);
    expect(f.nativeElement.querySelector('dialog').open).toBe(false);
    expect(f.nativeElement.querySelector('.feedback.success').textContent).toContain('Pessoa fictícia');
  });

  it.each(['activate', 'deactivate', 'grant', 'revoke'] as const)('confirms %s in a named modal with an effect warning', async (action) => {
    const f = await render();
    f.componentInstance.choose(person, action);
    const modal = f.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(modal.open).toBe(true);
    expect(modal.querySelector('#employee-confirm-title')?.textContent).toContain(f.componentInstance.labels[action]);
    expect(modal.querySelector('#employee-confirm-description')?.textContent).toContain(person.display_name);
    expect(modal.textContent).toContain(f.componentInstance.warnings[action]);
    expect(modal.querySelector('[autofocus]')?.textContent).toBe('Cancelar');
    await f.componentInstance.confirm();
    expect(service.change).toHaveBeenCalledExactlyOnceWith(person.id, action);
    expect(modal.open).toBe(false);
  });

  it('supports Escape and close, but blocks dismissal and double confirmation while saving', async () => {
    const f = await render();
    const c = f.componentInstance;
    c.choose(person, 'deactivate');
    const modal = f.nativeElement.querySelector('dialog') as HTMLDialogElement;
    modal.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(c.pending()).toBeNull();
    expect(modal.open).toBe(false);
    c.choose(person, 'deactivate');
    (modal.querySelector('[aria-label="Fechar confirmação"]') as HTMLButtonElement).click();
    expect(c.pending()).toBeNull();
    c.choose(person, 'deactivate');
    let finish!: () => void;
    service.change.mockReturnValue(new Promise<void>(resolve => finish = resolve));
    const request = c.confirm();
    f.detectChanges();
    const escape = new Event('cancel', { cancelable: true });
    modal.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    c.cancel();
    await c.confirm();
    expect(modal.open).toBe(true);
    expect(c.pending()).not.toBeNull();
    expect(Array.from(modal.querySelectorAll('button')).every(button => button.disabled)).toBe(true);
    expect(service.change).toHaveBeenCalledTimes(1);
    finish();
    await request;
    f.detectChanges();
    await f.whenStable();
    expect(document.activeElement).toBe(f.nativeElement.querySelector('[data-action="activation"]'));
  });

  it('keeps backend toggle restrictions and master protection in the rendered controls', async () => {
    service.list.mockResolvedValue([{ ...person, is_master: true, can_toggle: false }]);
    const f = await render();
    expect(f.nativeElement.querySelectorAll('.people button')).toHaveLength(0);
  });
  it('does not load employees for ordinary admin without capability', async () => {
    service.context.mockResolvedValue({ is_master: false, can_manage: false });
    const f = await render();
    expect(service.list).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).not.toContain('Desativar');
  });
  it('clears protected state and discards pending responses after logout', async () => {
    const f = await render();
    let finish!: (v: unknown) => void;
    service.list.mockReturnValue(new Promise((r) => (finish = r)));
    const pending = f.componentInstance.load();
    await vi.waitFor(() => expect(finish).toBeDefined());
    session.set(null);
    f.detectChanges();
    finish([person]);
    await pending;
    expect(f.componentInstance.people()).toEqual([]);
    expect(f.componentInstance.context()).toBeNull();
  });
});
