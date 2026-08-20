import { useState, useEffect, useCallback, useMemo } from 'react';
import {

  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { joinGameWaitlist } from '../services/cloudFunctions';

const logger = createLogger('useWaitlist');

/**
 * Status de uma entrada na lista de espera.
 * Paridade com Android `WaitlistStatus` (shared/.../GameWaitlist.kt).
 */
export type WaitlistStatus =
  | 'WAITING'
  | 'NOTIFIED'
  | 'PROMOTED'
  | 'EXPIRED'
  | 'CANCELLED';

/**
 * Entrada na lista de espera de um jogo.
 *
 * Coleção Firestore: `games/{gameId}/waitlist/{userId}` — mesma
 * subcoleção que o Android (`WaitlistRepositoryImpl`) e que a Cloud
 * Function `processExpiredWaitlistEntries` (paridade cross-platform).
 */
export interface WaitlistEntry {
  id: string;
  gameId: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  position: string;
  queuePosition: number;
  status: WaitlistStatus;
  /** epoch millis — NÃO Timestamp (ver nota em joinWaitlist) */
  addedAt: number | null;
  notifiedAt: number | null;
  responseDeadline: number | null;
}

/** Status que ocupam vaga na fila (igual Android getWaitlist). */
const ACTIVE_STATUSES: WaitlistStatus[] = ['WAITING', 'NOTIFIED'];

function toEpochMillis(value: unknown): number | null {
  if (value && typeof value === 'object' && 'toMillis' in value &&
      typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' ? value : null;
}

/**
 * Hook de lista de espera (#1336). Cliente só faz join/leave;
 * promoção/notificação/expiração é SERVER-ONLY (CF, Admin SDK) —
 * arquitetura anti-race da spec §3.1. Nunca promover no cliente.
 */
export function useWaitlist(gameId: string | null) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();

  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!gameId) {
      setWaitlist([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Ordena por queue_position e filtra status ativo no cliente: a fila
    // é pequena (limit 50) e isso evita exigir índice composto
    // (status + queue_position) no deploy.
    const q = query(
      collection(db, 'games', gameId, 'waitlist'),
      orderBy('queue_position', 'asc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const x = d.data();
            return {
              id: d.id,
              gameId: (x.game_id as string) || gameId,
              userId: (x.user_id as string) || '',
              userName: (x.user_name as string) || '',
              userPhoto: (x.user_photo as string | null) ?? null,
              position: (x.position as string) || 'LINE',
              queuePosition: (x.queue_position as number) ?? 0,
              status: (x.status as WaitlistStatus) || 'WAITING',
              addedAt: toEpochMillis(x.added_at),
              notifiedAt: toEpochMillis(x.notified_at),
              responseDeadline: toEpochMillis(x.response_deadline),
            } as WaitlistEntry;
          })
          .filter((e) => ACTIVE_STATUSES.includes(e.status));
        setWaitlist(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        logger.error('Erro no listener da lista de espera:', err);
        setError(t('feedback.waitlist.loadError'));
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [gameId, t]);

  const myEntry = useMemo<WaitlistEntry | null>(() => {
    if (!currentUser) return null;
    return waitlist.find((e) => e.userId === currentUser.uid) ?? null;
  }, [waitlist, currentUser]);

  const joinWaitlist = useCallback(
    async (position: string = 'LINE'): Promise<boolean> => {
      if (!gameId || !currentUser) {
        showError(t('feedback.waitlist.loginRequired'));
        return false;
      }
      setActing(true);
      try {
        const result = await joinGameWaitlist({ gameId, position });
        if (result.data.alreadyActive) {
          showError(t('feedback.waitlist.alreadyIn'));
          return false;
        }
        showSuccess(t('feedback.waitlist.joinSuccess'));
        return true;
      } catch (err) {
        logger.error('Erro ao entrar na lista de espera:', err);
        showError(t('feedback.waitlist.joinError'));
        return false;
      } finally {
        setActing(false);
      }
    },
    [gameId, currentUser, showSuccess, showError, t]
  );

  const leaveWaitlist = useCallback(async (): Promise<boolean> => {
    if (!gameId || !currentUser) return false;
    setActing(true);
    try {
      // O documento é canônico por UID; a posição não é renumerada ao sair.
      await deleteDoc(doc(db, 'games', gameId, 'waitlist', currentUser.uid));
      showSuccess(t('feedback.waitlist.leaveSuccess'));
      return true;
    } catch (err) {
      logger.error('Erro ao sair da lista de espera:', err);
      showError(t('feedback.waitlist.leaveError'));
      return false;
    } finally {
      setActing(false);
    }
  }, [gameId, currentUser, showSuccess, showError, t]);

  return {
    waitlist,
    myEntry,
    loading,
    error,
    acting,
    joinWaitlist,
    leaveWaitlist,
  };
}
