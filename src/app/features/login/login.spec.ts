import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Login } from './login';

describe('Login', () => {
  const signIn = vi.fn();
  beforeEach(() => {
    signIn.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ imports: [Login], providers: [
      provideRouter([]), { provide: AuthService, useValue: { signIn } },
    ] });
  });

  it('renders editable inputs and rejects an invalid form', async () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input').readOnly).toBe(false);
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(signIn).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Informe um e-mail válido.');
    expect(fixture.nativeElement.textContent).toContain('Informe sua senha.');
  });

  it('submits entered values and navigates only after authentication succeeds', async () => {
    let complete!: () => void;
    signIn.mockImplementation(() => new Promise<void>((resolve) => { complete = resolve; }));
    const fixture = TestBed.createComponent(Login);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    for (const [id, value] of [['email', 'local@example.invalid'], ['password', 'test-password']]) {
      const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    const pending = fixture.componentInstance.submit();
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(signIn).toHaveBeenCalledExactlyOnceWith('local@example.invalid', 'test-password');
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    complete();
    await pending;
    expect(navigate).toHaveBeenCalledWith('/inicio');
    expect(fixture.componentInstance.form.controls.password.value).toBe('');
  });

  it('shows a safe error and stays on login after authentication failure', async () => {
    signIn.mockRejectedValue(new Error('sensitive server details'));
    const fixture = TestBed.createComponent(Login);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.componentInstance.form.setValue({ email: 'local@example.invalid', password: 'wrong' });
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Não foi possível entrar.');
    expect(fixture.nativeElement.textContent).not.toContain('sensitive server details');
    expect(fixture.componentInstance.busy()).toBe(false);
  });
});
