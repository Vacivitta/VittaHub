import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { BoardsService } from './boards.service';

describe('BoardsService', () => {
  const session = signal<{ user: { id: string } } | null>(null);
  const auth = { session, ready: Promise.resolve() };
  const result = vi.fn();
  const query = { select: vi.fn(), order: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), returns: result };
  const client = { from: vi.fn() };
  const boards = [{ id: 'board-1', title: 'Quadro local', description: null, department: { name: 'Equipe' } }];

  beforeEach(() => {
    session.set({ user: { id: 'user-1' } });
    auth.ready = Promise.resolve();
    client.from.mockReset().mockReturnValue(query);
    query.select.mockReset().mockReturnValue(query);
    query.order.mockReset().mockReturnValue(query);
    query.eq.mockReset().mockReturnValue(query);
    query.maybeSingle.mockReset();
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

  describe('getById', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const board = {
      id, title: 'Quadro de Testes', description: null, department: { name: 'Departamento de Testes' },
      columns: [
        { id: 'column-1', title: 'Entrada', position: 0, business_state: null },
        { id: 'column-2', title: 'Execução', position: 1, business_state: 'fazendo' },
      ],
    };

    beforeEach(() => {
      query.maybeSingle.mockResolvedValue({ data: board, error: null, status: 200 });
    });

    it('loads the actual board ID and its columns ordered by position under RLS', async () => {
      expect(await TestBed.inject(BoardsService).getById(id)).toEqual({ status: 'loaded', board });
      expect(client.from).toHaveBeenCalledExactlyOnceWith('boards');
      expect(query.select).toHaveBeenCalledExactlyOnceWith(
        'id, title, description, department:departments(name), columns:board_columns(id, title, position, business_state)',
      );
      expect(query.eq).toHaveBeenCalledExactlyOnceWith('id', id);
      expect(query.order).toHaveBeenCalledExactlyOnceWith('position', { referencedTable: 'columns', ascending: true });
    });

    it('waits for session restoration and rejects an absent session', async () => {
      let restore!: () => void;
      auth.ready = new Promise<void>((resolve) => { restore = resolve; });
      session.set(null);
      const pending = TestBed.inject(BoardsService).getById(id);
      expect(client.from).not.toHaveBeenCalled();
      restore();
      expect(await pending).toEqual({ status: 'forbidden' });
      expect(client.from).not.toHaveBeenCalled();
    });

    it('keeps a board without columns instead of treating it as missing', async () => {
      query.maybeSingle.mockResolvedValue({ data: { ...board, columns: [] }, error: null, status: 200 });
      expect(await TestBed.inject(BoardsService).getById(id)).toEqual({
        status: 'loaded', board: { ...board, columns: [] },
      });
    });

    it('does not distinguish missing boards from rows hidden by RLS', async () => {
      query.maybeSingle.mockResolvedValue({ data: null, error: null, status: 200 });
      expect(await TestBed.inject(BoardsService).getById(id)).toEqual({ status: 'unavailable' });
    });

    it('does not query malformed IDs', async () => {
      expect(await TestBed.inject(BoardsService).getById('rotina')).toEqual({ status: 'unavailable' });
      expect(client.from).not.toHaveBeenCalled();
    });

    it.each([
      [403, 'unknown', 'forbidden'],
      [400, '42501', 'forbidden'],
      [500, 'unknown', 'error'],
    ])('handles HTTP %s / code %s without leaking details', async (status, code, expected) => {
      query.maybeSingle.mockResolvedValue({ data: null, error: { code, message: 'private details' }, status });
      expect(await TestBed.inject(BoardsService).getById(id)).toEqual({ status: expected });
    });

    it('handles network errors safely', async () => {
      query.maybeSingle.mockRejectedValue(new Error('private network details'));
      expect(await TestBed.inject(BoardsService).getById(id)).toEqual({ status: 'error' });
    });

    it('discards results after the user signs out', async () => {
      query.maybeSingle.mockImplementation(async () => {
        session.set(null);
        return { data: board, error: null, status: 200 };
      });
      expect(await TestBed.inject(BoardsService).getById(id)).toEqual({ status: 'forbidden' });
    });
  });
});
