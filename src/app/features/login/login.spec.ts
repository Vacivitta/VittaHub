import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { AuthService, LOGIN_MESSAGES } from '../../core/auth/auth.service';
import { Login } from './login';

describe('Login', () => {
  const signIn = vi.fn();
  const accessMessage = signal('');
  beforeEach(() => {
    signIn.mockReset().mockResolvedValue(undefined);
    accessMessage.set('');
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { signIn, accessMessage } },
      ],
    });
  });

  it('renders editable inputs and rejects an invalid form', async () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input').readOnly).toBe(false);
    expect(fixture.nativeElement.querySelector('.login-brand').textContent.trim()).toBe('');
    expect(fixture.nativeElement.querySelector('.login-brand img')).not.toBeNull();
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(signIn).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Informe seu e-mail.');
    expect(fixture.nativeElement.textContent).toContain('Informe sua senha.');
  });

  it.each([
    ['', '', 'email', 'Informe seu e-mail.'],
    ['invalido', 'senha fictícia', 'email', 'Informe um e-mail válido.'],
    ['local@example.invalid', '', 'password', 'Informe sua senha.'],
  ])('focuses the first invalid field and preserves values (%s)', async (email, password, id, message) => {
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance.form.setValue({ email, password });
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('false');
    input.focus();
    const focus = vi.spyOn(input, 'focus');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.activeElement).toBe(input);
    expect(focus).toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const description = fixture.nativeElement.querySelector(`#${input.getAttribute('aria-describedby')}`);
    expect(description.textContent.trim()).toBe(message);
    expect(description.hasAttribute('role')).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent.trim()).toBe('');
    expect(fixture.componentInstance.form.getRawValue()).toEqual({ email, password });
    expect(signIn).not.toHaveBeenCalled();
    if (id === 'email') {
      input.value = 'correct@example.invalid';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(input.getAttribute('aria-invalid')).toBe('false');
      expect(description.textContent.trim()).toBe('');
    }
  });

  it.each(Object.values(LOGIN_MESSAGES))('renders one coherent authentication alert: %s', async message => {
    accessMessage.set('Orientação da sessão anterior.');
    signIn.mockImplementation(async () => {
      accessMessage.set(message);
      throw new Error('private detail');
    });
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance.form.setValue({ email: 'local@example.invalid', password: 'wrong' });
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBe(alert);
    expect(alert.textContent.trim()).toBe(message);
    expect(fixture.nativeElement.textContent).not.toContain('private detail');
    expect(fixture.nativeElement.textContent).not.toContain('Orientação da sessão anterior.');
  });

  it('clears outdated authentication guidance when a new attempt has invalid fields', async () => {
    const fixture = TestBed.createComponent(Login);
    accessMessage.set(LOGIN_MESSAGES.inactive);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('inativa');
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent.trim()).toBe('');
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#email'));
    expect(signIn).not.toHaveBeenCalled();
  });

  it('submits entered values and navigates only after authentication succeeds', async () => {
    let complete!: () => void;
    signIn.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const fixture = TestBed.createComponent(Login);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    for (const [id, value] of [
      ['email', 'local@example.invalid'],
      ['password', 'test-password'],
    ]) {
      const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    const pending = fixture.componentInstance.submit();
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(signIn).toHaveBeenCalledExactlyOnceWith('local@example.invalid', 'test-password');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
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
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Não foi possível entrar.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('sensitive server details');
    expect(fixture.componentInstance.busy()).toBe(false);
  });

  it('toggles password visibility without changing values or submitting and starts hidden on a new visit', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance.form.setValue({ email: 'local@example.invalid', password: 'fictitious-password' });
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    const button = fixture.nativeElement.querySelector('.password-toggle') as HTMLButtonElement;
    expect(input.type).toBe('password');
    expect(button.getAttribute('aria-label')).toBe('Mostrar senha');
    expect(button.type).toBe('button');
    button.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(button.getAttribute('aria-label')).toBe('Ocultar senha');
    expect(input.value).toBe('fictitious-password');
    expect(fixture.componentInstance.form.controls.password.value).toBe('fictitious-password');
    expect(signIn).not.toHaveBeenCalled();
    button.click();
    fixture.detectChanges();
    expect(input.type).toBe('password');
    expect(input.value).toBe('fictitious-password');
    button.click();
    fixture.destroy();
    const next = TestBed.createComponent(Login);
    next.detectChanges();
    expect(next.nativeElement.querySelector('#password').type).toBe('password');
  });

  it('preserves input focus, selection and horizontal scroll when toggled by pointer', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance.form.controls.password.setValue('fictitious-password');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    const button = fixture.nativeElement.querySelector('.password-toggle') as HTMLButtonElement;
    input.focus();
    input.setSelectionRange(2, 8, 'backward');
    input.scrollLeft = 12;
    for (const type of ['text', 'password']) {
      const pointer = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
      button.dispatchEvent(pointer);
      expect(pointer.defaultPrevented).toBe(true);
      button.click();
      fixture.detectChanges();
      expect(document.activeElement).toBe(input);
      expect(input.type).toBe(type);
      expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([2, 8, 'backward']);
      expect(input.scrollLeft).toBe(12);
      expect(input.value).toBe('fictitious-password');
    }
    expect(signIn).not.toHaveBeenCalled();
  });

  it('keeps the toggle focused for keyboard activation without changing the saved caret', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance.form.controls.password.setValue('fictitious-password');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    const button = fixture.nativeElement.querySelector('.password-toggle') as HTMLButtonElement;
    input.setSelectionRange(4, 4);
    button.focus();
    button.click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(button);
    expect(input.selectionStart).toBe(4);
    expect(input.selectionEnd).toBe(4);
    expect(button.getAttribute('aria-label')).toBe('Ocultar senha');
    const pointer = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
    button.dispatchEvent(pointer);
    expect(pointer.defaultPrevented).toBe(false);
  });
});
