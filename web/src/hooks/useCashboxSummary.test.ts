// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockOnSnapshot = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

vi.mock('../services/firebase', () => ({ db: {} }));

import { useCashboxSummary } from './useCashboxSummary';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

interface SnapshotCallbacks {
  next: (snapshot: unknown) => void;
  error: (error: unknown) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

let callbacks: SnapshotCallbacks[];

beforeEach(() => {
  vi.clearAllMocks();
  callbacks = [];
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockOnSnapshot.mockImplementation((_ref: unknown, next: SnapshotCallbacks['next'], error: SnapshotCallbacks['error']) => {
    callbacks.push({ next, error, unsubscribe: vi.fn() });
    return callbacks[callbacks.length - 1].unsubscribe;
  });
});

describe('useCashboxSummary', () => {
  it('sem groupId: zera valores, loading=false e não configura listener', async () => {
    const { result } = renderHook(() => useCashboxSummary(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entryCount).toBe(0);
    expect(result.current.balanceCents).toBe(0);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('escuta groups/{id}/cashbox_summary/current', () => {
    renderHook(() => useCashboxSummary('group-1'));
    expect(mockDoc).toHaveBeenCalledWith({}, 'groups', 'group-1', 'cashbox_summary', 'current');
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('snapshot inexistente: zeros e loading=false', async () => {
    const { result } = renderHook(() => useCashboxSummary('group-1'));
    act_emitting(() => callbacks[0].next({ exists: () => false }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entryCount).toBe(0);
    expect(result.current.balanceCents).toBe(0);
  });

  it('snapshot com dados: expõe entry_count e balance_cents', async () => {
    const { result } = renderHook(() => useCashboxSummary('group-1'));
    act_emitting(() => callbacks[0].next({
      exists: () => true,
      data: () => ({ entry_count: 12, balance_cents: 4530 }),
    }));
    await waitFor(() => expect(result.current.entryCount).toBe(12));
    expect(result.current.balanceCents).toBe(4530);
    expect(result.current.loading).toBe(false);
  });

  it('balance_cents não-inteiro (float): cai para 0', async () => {
    const { result } = renderHook(() => useCashboxSummary('group-1'));
    act_emitting(() => callbacks[0].next({
      exists: () => true,
      data: () => ({ entry_count: 3, balance_cents: 10.5 }),
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.balanceCents).toBe(0);
    expect(result.current.entryCount).toBe(3);
  });

  it('balance_cents como string: cai para 0 (Number.isSafeInteger rejeita)', async () => {
    const { result } = renderHook(() => useCashboxSummary('group-1'));
    act_emitting(() => callbacks[0].next({
      exists: () => true,
      data: () => ({ entry_count: 3, balance_cents: '4500' }),
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.balanceCents).toBe(0);
  });

  it('balance_cents negativo é preservado (caixa no vermelho)', async () => {
    const { result } = renderHook(() => useCashboxSummary('group-1'));
    act_emitting(() => callbacks[0].next({
      exists: () => true,
      data: () => ({ entry_count: 1, balance_cents: -990 }),
    }));
    await waitFor(() => expect(result.current.balanceCents).toBe(-990));
  });

  it('entry_count ausente/inválido: cai para 0', async () => {
    const { result } = renderHook(() => useCashboxSummary('group-1'));
    act_emitting(() => callbacks[0].next({
      exists: () => true,
      data: () => ({ balance_cents: 100 }),
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entryCount).toBe(0);
    expect(result.current.balanceCents).toBe(100);
  });

  it('atualiza valores em emissões subsequentes do snapshot', async () => {
    const { result } = renderHook(() => useCashboxSummary('group-1'));
    act_emitting(() => callbacks[0].next({
      exists: () => true,
      data: () => ({ entry_count: 1, balance_cents: 100 }),
    }));
    await waitFor(() => expect(result.current.balanceCents).toBe(100));
    act_emitting(() => callbacks[0].next({
      exists: () => true,
      data: () => ({ entry_count: 2, balance_cents: 350 }),
    }));
    await waitFor(() => expect(result.current.balanceCents).toBe(350));
    expect(result.current.entryCount).toBe(2);
  });

  it('erro do snapshot: desliga loading e mantém valores anteriores', async () => {
    const { result } = renderHook(() => useCashboxSummary('group-1'));
    act_emitting(() => callbacks[0].next({
      exists: () => true,
      data: () => ({ entry_count: 5, balance_cents: 500 }),
    }));
    await waitFor(() => expect(result.current.balanceCents).toBe(500));

    act_emitting(() => callbacks[0].error(new Error('stream aborted')));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // O callback de erro não zera nem reseta os valores — só loading.
    expect(result.current.balanceCents).toBe(500);
    expect(result.current.entryCount).toBe(5);
  });

  it('troca de groupId cancela o listener antigo e reconfigura', async () => {
    const { result, rerender } = renderHook(({ gid }: { gid: string | undefined }) => useCashboxSummary(gid), {
      initialProps: { gid: 'group-1' },
    });
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(1));

    rerender({ gid: 'group-2' });
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(2));
    expect(callbacks[0].unsubscribe).toHaveBeenCalled();
    expect(mockDoc).toHaveBeenCalledWith({}, 'groups', 'group-2', 'cashbox_summary', 'current');

    act_emitting(() => callbacks[1].next({
      exists: () => true,
      data: () => ({ entry_count: 7, balance_cents: 700 }),
    }));
    await waitFor(() => expect(result.current.balanceCents).toBe(700));
  });

  it('groupId → undefined: zera valores e cancela listener', async () => {
    const { result, rerender } = renderHook(({ gid }: { gid: string | undefined }) => useCashboxSummary(gid), {
      initialProps: { gid: 'group-1' as string | undefined },
    });
    act_emitting(() => callbacks[0].next({
      exists: () => true,
      data: () => ({ entry_count: 4, balance_cents: 400 }),
    }));
    await waitFor(() => expect(result.current.balanceCents).toBe(400));

    rerender({ gid: undefined });
    await waitFor(() => expect(result.current.entryCount).toBe(0));
    expect(result.current.balanceCents).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(callbacks[0].unsubscribe).toHaveBeenCalled();
  });

  it('unmount cancela o listener', async () => {
    const { unmount } = renderHook(() => useCashboxSummary('group-1'));
    unmount();
    expect(callbacks[0].unsubscribe).toHaveBeenCalledTimes(1);
  });
});

// Helper: emite callback dentro do act.
function act_emitting(emit: () => void) {
  act(() => emit());
}
