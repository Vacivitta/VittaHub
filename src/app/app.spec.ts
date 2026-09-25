import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('Vacivitta interface', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes)] }),
  );

  it('creates the application', () => {
    expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
  });

  it.each([
    ['/inicio', 'Olá, Pessoa Demo'],
    ['/quadros', 'Quadros'],
    ['/quadros/rotina', 'Rotina da equipe'],
    ['/minhas-pendencias', 'Minhas Pendências'],
    ['/chat', 'Chat'],
    ['/administracao', 'Administração'],
    ['/endereco-inexistente', 'Página não encontrada'],
    ['/quadros/inexistente', 'Quadro não encontrado'],
  ])('renders %s', async (url, heading) => {
    const harness = await RouterTestingHarness.create(url);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(heading);
    expect(harness.routeNativeElement?.querySelectorAll('nav a').length).toBe(5);
  });

  it('redirects the root to the home page', async () => {
    await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/inicio');
  });

  it('opens the demo from login without credentials', async () => {
    const harness = await RouterTestingHarness.create('/login');
    expect(harness.routeNativeElement?.querySelector('input')?.readOnly).toBe(true);
    (harness.routeNativeElement?.querySelector('.button') as HTMLAnchorElement).click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/inicio');
  });

  it('filters boards and shows an empty result', async () => {
    const harness = await RouterTestingHarness.create('/quadros');
    const input = harness.routeNativeElement!.querySelector('input')!;
    input.value = 'inexistente';
    input.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Nenhum quadro encontrado');
    expect(harness.routeNativeElement?.querySelectorAll('.board-tile').length).toBe(0);
  });

  it('filters only the demo user tasks by state', async () => {
    const harness = await RouterTestingHarness.create('/minhas-pendencias');
    expect(harness.routeNativeElement?.querySelectorAll('app-task-card').length).toBe(5);
    const select = harness.routeNativeElement!.querySelector('select')!;
    select.value = 'concluido';
    select.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelectorAll('app-task-card').length).toBe(1);
    expect(harness.routeNativeElement?.textContent).toContain('Conferir lista de materiais');
  });

  it('selects a conversation and keeps sending disabled', async () => {
    const harness = await RouterTestingHarness.create('/chat');
    (harness.routeNativeElement?.querySelectorAll('.conversation')[1] as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    expect(
      harness.routeNativeElement?.querySelector('.conversation-header')?.textContent,
    ).toContain('Colega Alfa');
    expect(harness.routeNativeElement?.querySelectorAll('.message').length).toBe(1);
    expect(
      harness.routeNativeElement?.querySelector<HTMLButtonElement>('.composer button')?.disabled,
    ).toBe(true);
  });
});
