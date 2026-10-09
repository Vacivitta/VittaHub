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
