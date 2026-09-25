import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { BoardsService } from './boards.service';

describe('BoardsService', () => {
  const session = signal<{ user: { id: string } } | null>(null);
  const auth = { session, ready: Promise.resolve() };
  const result = vi.fn();
  const query = { select: vi.fn(), order: vi.fn(), returns: result };
  const client = { from: vi.fn() };
  const boards = [{ id: 'board-1', title: 'Quadro local', description: null, department: { name: 'Equipe' } }];

  beforeEach(() => {
    session.set({ user: { id: 'user-1' } });
    auth.ready = Promise.resolve();
    client.from.mockReset().mockReturnValue(query);
    query.select.mockReset().mockReturnValue(query);
    query.order.mockReset().mockReturnValue(query);
    result.mockReset().mockResolvedValue({ data: boards, error: null });
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: auth },
      { provide: SUPABASE_CLIENT, useValue: client },
    ] });
  });

  it('reads boards and their department without imposing membership or department filters', async () => {
    expect(await TestBed.inject(BoardsService).list()).toEqual(boards);
    expect(client.from).toHaveBeenCalledExactlyOnceWith('boards');
    expect(query.select).toHaveBeenCalledExactlyOnceWith('id, title, description, department:departments(name)');
    expect(query.order).toHaveBeenCalledExactlyOnceWith('title', { ascending: true });
  });

  it('waits for the existing session restoration before querying', async () => {
    let restore!: () => void;
    auth.ready = new Promise<void>((resolve) => { restore = resolve; });
    const pending = TestBed.inject(BoardsService).list();
    expect(client.from).not.toHaveBeenCalled();
    restore();
    expect(await pending).toEqual(boards);
  });

  it('does not query without an authenticated session', async () => {
    session.set(null);
    await expect(TestBed.inject(BoardsService).list()).rejects.toThrow('Não foi possível carregar os quadros.');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('returns an empty list when RLS returns no visible boards', async () => {
    result.mockResolvedValue({ data: [], error: null });
    expect(await TestBed.inject(BoardsService).list()).toEqual([]);
  });

  it.each(['response', 'network'])('hides details of a %s error', async (failure) => {
    if (failure === 'network') result.mockRejectedValue(new Error('private detail'));
    else result.mockResolvedValue({ data: null, error: { message: 'private detail' } });
    await expect(TestBed.inject(BoardsService).list()).rejects.toThrow(
      'Não foi possível carregar os quadros. Tente novamente.',
    );
  });

  it('discards a response after the authenticated user changes', async () => {
    result.mockImplementation(async () => {
      session.set({ user: { id: 'user-2' } });
      return { data: boards, error: null };
    });
    await expect(TestBed.inject(BoardsService).list()).rejects.toThrow('Não foi possível carregar os quadros.');
  });
});
