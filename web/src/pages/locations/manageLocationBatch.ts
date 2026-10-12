/**
 * Ações em lote do admin de quadras (#4372): publicar, marcar verificada e
 * desativar. A lógica de elegibilidade e o executor sequencial são puros; as
 * escritas diretas (verificar/desativar) usam `writeBatch` de admin.
 */
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Location } from '../../types/location';
import { getLocationPublicationStatus } from './manageLocationFilters';

export type BatchAction = 'PUBLISH' | 'VERIFY' | 'DEACTIVATE';

/** `setLocationPublicationStatus` aceita 20 chamadas/min por usuário. */
export const BATCH_PUBLISH_MAX = 20;
/** Limite de operações por `writeBatch` do Firestore é 500; fica folga. */
export const BATCH_WRITE_CHUNK = 400;

export const BATCH_ACTIONS: readonly BatchAction[] = ['PUBLISH', 'VERIFY', 'DEACTIVATE'];

export interface BatchTargets {
  eligible: Location[];
  /** Selecionadas que já estão no estado desejado (nada a fazer). */
  skipped: Location[];
}

const needsAction: Record<BatchAction, (location: Location) => boolean> = {
  PUBLISH: (location) => getLocationPublicationStatus(location) !== 'PUBLISHED',
  VERIFY: (location) => location.isVerified !== true,
  DEACTIVATE: (location) => location.isActive !== false,
};

export function getBatchTargets(selected: readonly Location[], action: BatchAction): BatchTargets {
  const eligible: Location[] = [];
  const skipped: Location[] = [];
  for (const location of selected) {
    (needsAction[action](location) ? eligible : skipped).push(location);
  }
  return { eligible, skipped };
}

export const batchLimit = (action: BatchAction): number =>
  action === 'PUBLISH' ? BATCH_PUBLISH_MAX : Number.POSITIVE_INFINITY;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export interface BatchOutcome {
  id: string;
  name: string;
  ok: boolean;
  error?: string;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Erro desconhecido';

/** Executa um por vez (a callable tem rate limit); uma falha não interrompe as demais. */
export async function runSequentially(
  items: readonly Location[],
  run: (location: Location) => Promise<unknown>,
  onProgress?: (done: number, total: number) => void,
): Promise<BatchOutcome[]> {
  const outcomes: BatchOutcome[] = [];
  for (const location of items) {
    try {
      await run(location);
      outcomes.push({ id: location.id, name: location.name, ok: true });
    } catch (error) {
      outcomes.push({ id: location.id, name: location.name, ok: false, error: errorMessage(error) });
    }
    onProgress?.(outcomes.length, items.length);
  }
  return outcomes;
}

export function summarizeBatch(outcomes: readonly BatchOutcome[]) {
  const failures = outcomes.filter((outcome) => !outcome.ok);
  return {
    total: outcomes.length,
    succeeded: outcomes.length - failures.length,
    failed: failures.length,
    failures,
  };
}

/** Marca como verificada / desativa em `writeBatch` (admin escreve direto nas rules). */
export async function writeLocationPatches(
  locations: readonly Location[],
  action: Exclude<BatchAction, 'PUBLISH'>,
  adminUid: string,
): Promise<BatchOutcome[]> {
  const patch = action === 'VERIFY' ? { is_verified: true } : { is_active: false };
  const outcomes: BatchOutcome[] = [];

  for (const group of chunk(locations, BATCH_WRITE_CHUNK)) {
    try {
      const batch = writeBatch(db);
      for (const location of group) {
        batch.update(doc(db, 'locations', location.id), {
          ...patch,
          updated_at: serverTimestamp(),
          updated_by: adminUid,
        });
      }
      await batch.commit();
      group.forEach((location) => outcomes.push({ id: location.id, name: location.name, ok: true }));
    } catch (error) {
      group.forEach((location) =>
        outcomes.push({ id: location.id, name: location.name, ok: false, error: errorMessage(error) }));
    }
  }
  return outcomes;
}
