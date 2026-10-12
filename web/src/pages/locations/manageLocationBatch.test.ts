import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Location } from '../../types/location';

const mockCommit = vi.fn();
const mockUpdate = vi.fn();
const mockWriteBatch = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, col: string, id: string) => `${col}/${id}`),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));
vi.mock('../../services/firebase', () => ({ db: {} }));

import {
  BATCH_PUBLISH_MAX,
  BATCH_WRITE_CHUNK,
  batchLimit,
  chunk,
  getBatchTargets,
  runSequentially,
  summarizeBatch,
  writeLocationPatches,
} from './manageLocationBatch';
import { sortManageLocations } from './manageLocationSort';

const loc = (id: string, extra: Partial<Location> = {}) =>
  ({ id, name: `Quadra ${id}`, city: 'Curitiba', state: 'PR', isVerified: true, isActive: true, publicationStatus: 'PUBLISHED', ...extra }) as Location;

describe('getBatchTargets', () => {
  const selected = [
    loc('pub'),
    loc('draft', { publicationStatus: 'DRAFT', isVerified: false }),
    loc('inactive', { isActive: false }),
  ];

  it('publicar: ignora as que já estão publicadas', () => {
    const { eligible, skipped } = getBatchTargets(selected, 'PUBLISH');
    expect(eligible.map((l) => l.id)).toEqual(['draft']);
    expect(skipped.map((l) => l.id)).toEqual(['pub', 'inactive']);
  });

  it('marcar verificada: ignora as já verificadas', () => {
    expect(getBatchTargets(selected, 'VERIFY').eligible.map((l) => l.id)).toEqual(['draft']);
  });

  it('desativar: ignora as já inativas (isActive ausente conta como ativa)', () => {
    const { eligible } = getBatchTargets([...selected, loc('sem-flag', { isActive: undefined as unknown as boolean })], 'DEACTIVATE');
    expect(eligible.map((l) => l.id)).toEqual(['pub', 'draft', 'sem-flag']);
  });
});

describe('limites do lote', () => {
  it('publicar respeita o rate limit do servidor (20/min); as demais não têm teto', () => {
    expect(batchLimit('PUBLISH')).toBe(BATCH_PUBLISH_MAX);
    expect(BATCH_PUBLISH_MAX).toBe(20);
    expect(batchLimit('VERIFY')).toBe(Number.POSITIVE_INFINITY);
  });

  it('chunk divide em grupos', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

describe('runSequentially / summarizeBatch', () => {
  it('executa um por vez, em ordem, e uma falha não interrompe as demais', async () => {
    const order: string[] = [];
    const run = vi.fn(async (l: Location) => {
      order.push(l.id);
      if (l.id === 'b') throw new Error('failed-precondition: sem fotos');
    });
    const progress = vi.fn();

    const outcomes = await runSequentially([loc('a'), loc('b'), loc('c')], run, progress);

    expect(order).toEqual(['a', 'b', 'c']);
    expect(outcomes.map((o) => o.ok)).toEqual([true, false, true]);
    expect(outcomes[1].error).toContain('sem fotos');
    expect(progress).toHaveBeenLastCalledWith(3, 3);

    const summary = summarizeBatch(outcomes);
    expect(summary).toMatchObject({ total: 3, succeeded: 2, failed: 1 });
    expect(summary.failures[0].id).toBe('b');
  });

  it('erro que não é Error vira texto', async () => {
    const [outcome] = await runSequentially([loc('a')], async () => { throw 'boom'; });
    expect(outcome.error).toBe('boom');
  });
});

describe('writeLocationPatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommit.mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({ update: mockUpdate, commit: mockCommit });
  });

  it('marcar verificada grava is_verified + auditoria mínima', async () => {
    const outcomes = await writeLocationPatches([loc('a'), loc('b')], 'VERIFY', 'admin-1');
    expect(mockUpdate).toHaveBeenCalledWith('locations/a', { is_verified: true, updated_at: 'SERVER_TS', updated_by: 'admin-1' });
    expect(mockUpdate).toHaveBeenCalledWith('locations/b', expect.objectContaining({ is_verified: true }));
    expect(mockCommit).toHaveBeenCalledTimes(1);
    expect(outcomes.every((o) => o.ok)).toBe(true);
  });

  it('desativar grava is_active=false', async () => {
    await writeLocationPatches([loc('a')], 'DEACTIVATE', 'admin-1');
    expect(mockUpdate).toHaveBeenCalledWith('locations/a', expect.objectContaining({ is_active: false }));
  });

  it('divide em writeBatch de até 400 e marca só o grupo que falhou', async () => {
    const many = Array.from({ length: BATCH_WRITE_CHUNK + 5 }, (_, i) => loc(`l${i}`));
    mockCommit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('permission-denied'));

    const outcomes = await writeLocationPatches(many, 'VERIFY', 'admin-1');

    expect(mockWriteBatch).toHaveBeenCalledTimes(2);
    expect(outcomes.filter((o) => o.ok)).toHaveLength(BATCH_WRITE_CHUNK);
    expect(outcomes.filter((o) => !o.ok)).toHaveLength(5);
    expect(outcomes[outcomes.length - 1].error).toBe('permission-denied');
  });
});

describe('sortManageLocations', () => {
  const list = [
    loc('1', { name: 'Zeta', city: 'Curitiba', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-09-01') }),
    loc('2', { name: 'Álamo', city: 'Londrina', createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-02-01') }),
    loc('3', { name: 'Beta', city: 'Belém', state: 'PA', createdAt: new Date('2026-03-01'), publicationStatus: 'DRAFT', isVerified: false }),
    loc('4', { name: 'Arena', city: 'Curitiba', publicationStatus: 'PENDING_REVIEW' }),
  ];
  const ids = (sort: Parameters<typeof sortManageLocations>[1]) => sortManageLocations(list, sort).map((l) => l.id);

  it('por nome (pt-BR, sem acento/caixa)', () => {
    expect(ids('NAME')).toEqual(['2', '4', '3', '1']);
  });

  it('por cidade (UF, cidade, nome)', () => {
    expect(ids('CITY')).toEqual(['3', '4', '1', '2']);
  });

  it('mais recentes primeiro (sem data vai para o fim)', () => {
    expect(ids('NEWEST')).toEqual(['2', '3', '1', '4']);
  });

  it('última atualização (cai para a criação quando não há atualização)', () => {
    expect(ids('UPDATED')).toEqual(['1', '3', '2', '4']);
  });

  it('status: pendentes e rascunhos antes das publicadas', () => {
    expect(ids('STATUS')).toEqual(['4', '3', '2', '1']);
  });

  it('não altera a lista original', () => {
    const copy = [...list];
    sortManageLocations(list, 'CITY');
    expect(list).toEqual(copy);
  });

  it('aceita Timestamp do Firestore (toMillis)', () => {
    const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Date;
    const sorted = sortManageLocations([
      loc('old', { createdAt: ts(1) }),
      loc('new', { createdAt: ts(2) }),
    ], 'NEWEST');
    expect(sorted.map((l) => l.id)).toEqual(['new', 'old']);
  });
});
