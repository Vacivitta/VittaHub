import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { Shell } from './shell';
import { RequestsService } from '../features/requests/requests.service';

@Component({
  template: `<button type="button" (click)="filter.set('atrasadas')">Filtrar</button>
    <output>{{ filter() }}</output>`,
})
class SkipTargetPage {
  readonly filter = signal('todas');
}

describe('Shell sidebar', () => {
  const key = 'vittahub.sidebarCollapsed';
  const canAccessAdministration = signal(true);
  const count = signal(0);
  beforeEach(() => {
    canAccessAdministration.set(true);
    count.set(0);
    localStorage.removeItem(key);
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([
          'inicio', 'quadros', 'quadros/:id', 'minhas-pendencias',
          'pendencias/:id', 'chat', 'solicitacoes', 'administracao',
        ].map(path => ({ path, component: SkipTargetPage }))),
        { provide: RequestsService, useValue: { count, refresh: vi.fn() } },
        {
          provide: AuthService,
          useValue: {
            displayName: signal('Pessoa Teste'),
            profileError: signal(''),
            signOut: vi.fn(),
            canAccessAdministration,
          },
        },
      ],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.removeItem(key);
  });

  it.each([
    '/minhas-pendencias?estado=fazendo&prazo=atrasadas#filtros',
    '/inicio', '/quadros', '/quadros/quadro-teste', '/pendencias/pendencia-teste',
    '/chat?conversa=teste', '/solicitacoes', '/administracao',
  ])('skips to main without navigation or loss of page state on %s', async (url) => {
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    await fixture.whenStable();
    fixture.detectChanges();
    const main = fixture.nativeElement.querySelector('main') as HTMLElement;
    const control = main.querySelector('button')!;
    control.click();
    fixture.detectChanges();
    expect(main.querySelector('output')?.textContent).toBe('atrasadas');
    const navigations = vi.fn();
    const subscription = router.events.subscribe(navigations);
    try {
      const skipLink = fixture.nativeElement.querySelector('.skip-link') as HTMLAnchorElement;
      skipLink.focus();
      expect(document.activeElement).toBe(skipLink);
      // Enter on a native link produces a click with detail 0.
      const activation = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 });
      skipLink.dispatchEvent(activation);
      await fixture.whenStable();
      expect(activation.defaultPrevented).toBe(true);
      expect(router.url).toBe(url);
      expect(navigations).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(main);
      expect(main.tabIndex).toBe(-1);
      expect(main.querySelector('button')).toBe(control);
      expect(control.tabIndex).toBe(0);
      expect(main.querySelector('output')?.textContent).toBe('atrasadas');
    } finally {
      subscription.unsubscribe();
    }
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
    expect(button.getAttribute('aria-label')).toBe('Fixar barra lateral');
    expect(localStorage.getItem(key)).toBe('true');
    const links = fixture.nativeElement.querySelectorAll('nav a') as NodeListOf<HTMLElement>;
    expect(links).toHaveLength(6);
    for (const link of links) {
      expect(link.querySelector('.nav-tooltip')?.textContent?.trim()).toBe(
        link.getAttribute('aria-label'),
      );
    }
    expect(fixture.nativeElement.querySelector('.exit-link').getAttribute('aria-label')).toBe(
      'Sair',
    );
    button.click();
    expect(localStorage.getItem(key)).toBe('false');
  });

  it('restores a collapsed preference without opening the mobile menu', async () => {
    localStorage.setItem(key, 'true');
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(true);
    expect(fixture.componentInstance.menuOpen()).toBe(false);
    (fixture.nativeElement.querySelector('.menu-toggle') as HTMLButtonElement).click();
    expect(fixture.componentInstance.menuOpen()).toBe(true);
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(true);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('nav a') as HTMLAnchorElement).click();
    expect(fixture.componentInstance.menuOpen()).toBe(false);
    expect(localStorage.getItem(key)).toBe('true');
    await fixture.whenStable();
  });

  it('previews on hover with a delay, keeps the collapsed preference and collapses after leaving', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    localStorage.setItem(key, 'true');
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    const sidebar = fixture.nativeElement.querySelector('.sidebar') as HTMLElement;
    const enter = () => {
      const event = new Event('pointerenter');
      Object.assign(event, { pointerType: 'mouse', buttons: 0 });
      sidebar.dispatchEvent(event);
    };
    enter();
    expect(fixture.componentInstance.sidebarPreview()).toBe(false);
    vi.advanceTimersByTime(99);
    expect(fixture.componentInstance.sidebarPreview()).toBe(false);
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('sidebar-preview')).toBe(true);
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(true);
    expect(localStorage.getItem(key)).toBe('true');
    sidebar.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(100);
    enter();
    vi.advanceTimersByTime(220);
    expect(fixture.componentInstance.sidebarPreview()).toBe(true);
    sidebar.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(220);
    expect(fixture.componentInstance.sidebarPreview()).toBe(false);
  });

  it('ignores passing pointers, dragging, touch and devices without desktop hover', () => {
    vi.useFakeTimers();
    const media = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal('matchMedia', media);
    localStorage.setItem(key, 'true');
    const fixture = TestBed.createComponent(Shell);
    const component = fixture.componentInstance;
    for (const pointer of [{ pointerType: 'mouse', buttons: 1 }, { pointerType: 'touch', buttons: 0 }]) {
      component.previewSidebar(pointer as PointerEvent);
      vi.advanceTimersByTime(500);
      expect(component.sidebarPreview()).toBe(false);
    }
    component.previewSidebar({ pointerType: 'mouse', buttons: 0 } as PointerEvent);
    component.leaveSidebar();
    vi.advanceTimersByTime(500);
    expect(component.sidebarPreview()).toBe(false);
    media.mockReturnValue({ matches: false } as MediaQueryList);
    component.previewSidebar({ pointerType: 'mouse', buttons: 0 } as PointerEvent);
    vi.advanceTimersByTime(500);
    expect(component.sidebarPreview()).toBe(false);
  });

  it('keeps the same focused navigation targets through preview, pinning and collapse', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    localStorage.setItem(key, 'true');
    count.set(3);
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    const links = Array.from(fixture.nativeElement.querySelectorAll('nav a')) as HTMLAnchorElement[];
    const icons = links.map(link => link.querySelector('.nav-icon'));
    const destinations = links.map(link => link.getAttribute('href'));
    links[2].focus();
    const checkTargets = () => {
      fixture.detectChanges();
      expect(Array.from(fixture.nativeElement.querySelectorAll('nav a'))).toEqual(links);
      expect(links.map(link => link.querySelector('.nav-icon'))).toEqual(icons);
      expect(links.map(link => link.getAttribute('href'))).toEqual(destinations);
      expect(document.activeElement).toBe(links[2]);
      expect(links[2].getAttribute('aria-label')).toBe('Minhas Pendências');
    };
    fixture.componentInstance.previewSidebar({ pointerType: 'mouse', buttons: 0 } as PointerEvent);
    vi.advanceTimersByTime(100);
    checkTargets();
    fixture.componentInstance.toggleSidebar();
    checkTargets();
    fixture.componentInstance.toggleSidebar();
    checkTargets();
    fixture.componentInstance.leaveSidebar();
    vi.advanceTimersByTime(220);
    checkTargets();
    // Pixel coordinates and CSS transitions need a real browser; JSDOM has no layout engine.
  });

  it('keeps keyboard focus expanded until it leaves the sidebar and allows pinning', () => {
    localStorage.setItem(key, 'true');
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    const sidebar = fixture.nativeElement.querySelector('.sidebar') as HTMLElement;
    const links = sidebar.querySelectorAll('nav a');
    vi.spyOn(links[0], 'matches').mockReturnValue(true);
    links[0].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(fixture.componentInstance.sidebarPreview()).toBe(true);
    links[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: links[1] }));
    expect(fixture.componentInstance.sidebarPreview()).toBe(true);
    links[1].dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(fixture.componentInstance.sidebarPreview()).toBe(false);
    (sidebar.querySelector('.sidebar-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(false);
    expect(sidebar.querySelector('.sidebar-toggle')?.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem(key)).toBe('false');
  });

  it('hides administration when access is unavailable and reacts to permission changes', () => {
    canAccessAdministration.set(false);
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/administracao"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('nav a')).toHaveLength(5);
    canAccessAdministration.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/administracao"]')).not.toBeNull();
  });

  it('defaults to expanded and remains usable when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Unavailable');
    });
    const fixture = TestBed.createComponent(Shell);
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(false);
    expect(() => fixture.componentInstance.toggleSidebar()).not.toThrow();
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(true);
  });

  it('places requests before administration and exposes the decision count accessibly', () => {
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    const requestLink = fixture.nativeElement.querySelector('a[href="/solicitacoes"]');
    expect(requestLink.nextElementSibling.getAttribute('href')).toBe('/administracao');
    expect(requestLink.querySelector('.decision-badge')).toBeNull();
    count.set(3); fixture.detectChanges();
    expect(requestLink.getAttribute('aria-label')).toContain('3 decisões pendentes');
    expect(requestLink.querySelector('.decision-badge').textContent.trim()).toBe('3');
    count.set(0); fixture.detectChanges();
    expect(requestLink.querySelector('.decision-badge')).toBeNull();
  });
});
