import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { EmployeeSecurityService } from './employee-security.service';
describe('EmployeeSecurityService', () => {
  const rpc = vi.fn();
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'actor' } });
  beforeEach(() => {
    session.set({ user: { id: 'actor' } });
    rpc.mockReset().mockResolvedValue({ data: [], error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE_CLIENT, useValue: { rpc } },
        { provide: AuthService, useValue: { session } },
      ],
    });
  });
  it('sends only target and action, never actor or permissions', async () => {
    await TestBed.inject(EmployeeSecurityService).change('target', 'grant');
    expect(rpc).toHaveBeenCalledWith('change_employee_security', {
      p_target_id: 'target',
      p_action: 'grant',
    });
  });
  it('discards a response from the previous session', async () => {
    rpc.mockImplementation(async () => {
      session.set(null);
      return { data: [], error: null };
    });
    await expect(TestBed.inject(EmployeeSecurityService).list()).rejects.toThrow('Sessão alterada');
  });
  it('does not leak database errors', async () => {
    rpc.mockResolvedValue({ error: { code: '42501', message: 'secret' } });
    await expect(
      TestBed.inject(EmployeeSecurityService).change('target', 'deactivate'),
    ).rejects.toThrow('Operação não autorizada');
  });
});
