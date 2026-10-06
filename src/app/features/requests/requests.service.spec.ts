import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { TaskChanges } from '../tasks/task-changes';
import { RequestsService } from './requests.service';

describe('RequestsService', () => {
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'me' } });
  const profile = signal({ id: 'me', is_active: true });
  const rpc = vi.fn();
  const rows = [
    { item_key: 'acceptance-a', area: 'decide', kind: 'acceptance' },
    { item_key: 'postponement-b', area: 'decide', kind: 'postponement' },
    { item_key: 'reassignment-c', area: 'decide', kind: 'reassignment' },
    { item_key: 'acceptance-d', area: 'waiting', kind: 'acceptance' },
    { item_key: 'postponement-e', area: 'waiting', kind: 'postponement' },
  ];
  beforeEach(() => {
    session.set({ user: { id: 'me' } });
    profile.set({ id: 'me', is_active: true });
    rpc.mockReset().mockResolvedValue({ data: rows, error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { session, profile } },
        { provide: SUPABASE_CLIENT, useValue: { rpc } },
      ],
    });
  });

  it('counts only database-classified decisions, not waiting items, without sending identity', async () => {
    const service = TestBed.inject(RequestsService);
    await service.refresh();
    expect(rpc).toHaveBeenCalledWith('list_my_requests');
    expect(service.count()).toBe(3);
    expect(service.waiting()).toHaveLength(2);
    expect(service.highlighted()).toBe('acceptance-a');
  });

  it('removes a resolved item and immediately updates the shared count', async () => {
    const service = TestBed.inject(RequestsService);
    await service.refresh();
    rpc.mockReturnValue(new Promise(() => {}));
    service.resolved('postponement-b');
    expect(service.count()).toBe(2);
    expect(service.items().some((i) => i.item_key === 'postponement-b')).toBe(false);
  });

  it.each([false, true])(
    'does not load for inactive or absent sessions (absent=%s)',
    async (absent) => {
      if (absent) session.set(null);
      else profile.set({ id: 'me', is_active: false });
      const service = TestBed.inject(RequestsService);
      await service.refresh();
      expect(rpc).not.toHaveBeenCalled();
      expect(service.count()).toBe(0);
    },
  );

  it('hides cached data immediately and discards late responses after a session change', async () => {
    const service = TestBed.inject(RequestsService);
    await service.refresh();
    let resolve!: (value: unknown) => void;
    rpc.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = service.refresh();
    session.set({ user: { id: 'other' } });
    expect(service.items()).toEqual([]);
    resolve({ data: rows, error: null });
    await pending;
    expect(service.count()).toBe(0);
  });

  it('shows a safe load error and supports retry', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'secret' } });
    const service = TestBed.inject(RequestsService);
    await service.refresh();
    expect(service.error()).toContain('Não foi possível');
    expect(service.error()).not.toContain('secret');
    await service.refresh();
    expect(service.error()).toBe('');
    expect(service.count()).toBe(3);
  });

  it('refreshes after a task mutation invalidates the local read model', async () => {
    const service = TestBed.inject(RequestsService);
    TestBed.tick();
    await service.refresh();
    rpc.mockResolvedValue({ data: [], error: null });
    TestBed.inject(TaskChanges).notify();
    TestBed.tick();
    await vi.waitFor(() => expect(service.count()).toBe(0));
  });
});
