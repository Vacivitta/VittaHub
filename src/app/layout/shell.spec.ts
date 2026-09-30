import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { Shell } from './shell';

describe('Shell sidebar', () => {
  const key = 'vittahub.sidebarCollapsed';
  beforeEach(() => {
    localStorage.removeItem(key);
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([]), { provide: AuthService, useValue: {
        displayName: signal('Pessoa Teste'), profileError: signal(''), signOut: vi.fn(),
      } }],
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(key);
  });

  it('toggles the desktop sidebar, exposes accessible labels and persists the preference', () => {
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.sidebar-toggle') as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.sidebar-brand').textContent.trim()).toBe('');
    expect(fixture.nativeElement.querySelector('.sidebar-brand img')).not.toBeNull();
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('sidebar-collapsed')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Expandir barra lateral');
    expect(localStorage.getItem(key)).toBe('true');
    const links = fixture.nativeElement.querySelectorAll('nav a') as NodeListOf<HTMLElement>;
    expect(links).toHaveLength(5);
    for (const link of links) {
      expect(link.querySelector('.nav-tooltip')?.textContent?.trim()).toBe(link.getAttribute('aria-label'));
    }
    expect(fixture.nativeElement.querySelector('.exit-link').getAttribute('aria-label')).toBe('Sair');
    button.click();
    expect(localStorage.getItem(key)).toBe('false');
  });

  it('restores a collapsed preference without opening the mobile menu', () => {
    localStorage.setItem(key, 'true');
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(true);
    expect(fixture.componentInstance.menuOpen()).toBe(false);
    (fixture.nativeElement.querySelector('.menu-toggle') as HTMLButtonElement).click();
    expect(fixture.componentInstance.menuOpen()).toBe(true);
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(true);
  });

  it('defaults to expanded and remains usable when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
    const fixture = TestBed.createComponent(Shell);
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(false);
    expect(() => fixture.componentInstance.toggleSidebar()).not.toThrow();
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(true);
  });
});
