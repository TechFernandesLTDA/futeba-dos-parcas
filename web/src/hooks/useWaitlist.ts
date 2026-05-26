import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  addDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';

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
 * Coleção Firestore: `games/{gameId}/waitlist/{waitlistId}` — mesma
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

/**
 * Hook de lista de espera (#1336). Cliente só faz join/leave;
 * promoção/notificação/expiração é SERVER-ONLY (CF, Admin SDK) —
 * arquitetura anti-race da spec §3.1. Nunca promover no cliente.
 */
export function useWaitlist(gameId: string | null) {
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
              addedAt: (x.added_at as number) ?? null,
              notifiedAt: (x.notified_at as number) ?? null,
              responseDeadline: (x.response_deadline as number) ?? null,
            } as WaitlistEntry;
          })
          .filter((e) => ACTIVE_STATUSES.includes(e.status));
        setWaitlist(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        logger.error('Erro no listener da lista de espera:', err);
        setError('Erro ao carregar a lista de espera');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [gameId]);

  const myEntry = useMemo<WaitlistEntry | null>(() => {
    if (!currentUser) return null;
    return waitlist.find((e) => e.userId === currentUser.uid) ?? null;
  }, [waitlist, currentUser]);

  const joinWaitlist = useCallback(
    async (position: string = 'LINE'): Promise<boolean> => {
      if (!gameId || !currentUser) {
        showError('Você precisa estar logado para entrar na lista de espera');
        return false;
      }
      setActing(true);
      try {
        // Idempotência (paridade Android addToWaitlist): não duplica se
        // já há entrada ativa do usuário.
        const existing = await getDocs(
          query(
            collection(db, 'games', gameId, 'waitlist'),
            where('user_id', '==', currentUser.uid),
            limit(10)
          )
        );
        const alreadyActive = existing.docs.some((d) =>
          ACTIVE_STATUSES.includes(d.data().status as WaitlistStatus)
        );
        if (alreadyActive) {
          showError('Você já está na lista de espera deste jogo');
          return false;
        }
        await addDoc(collection(db, 'games', gameId, 'waitlist'), {
          game_id: gameId,
          user_id: currentUser.uid,
          user_name: currentUser.displayName || 'Jogador',
          user_photo: currentUser.photoURL ?? null,
          position,
          // queue_position provisório (nº de ativos + 1). A CF reordena
          // a fila no servidor; cliente nunca promove.
          queue_position: waitlist.length + 1,
          status: 'WAITING',
          // added_at em epoch millis (NÃO serverTimestamp): paridade com
          // o schema Android (`Date().time`) e a CF
          // processExpiredWaitlistEntries faz comparação NUMÉRICA de
          // deadline. Um Timestamp quebraria a CF e a paridade.
          added_at: Date.now(),
          notified_at: null,
          response_deadline: null,
        });
        showSuccess('Você entrou na lista de espera!');
        return true;
      } catch (err) {
        logger.error('Erro ao entrar na lista de espera:', err);
        showError(
          'Não foi possível entrar na lista de espera. Tente novamente.'
        );
        return false;
      } finally {
        setActing(false);
      }
    },
    [gameId, currentUser, waitlist.length, showSuccess, showError]
  );

  const leaveWaitlist = useCallback(async (): Promise<boolean> => {
    if (!gameId || !currentUser) return false;
    setActing(true);
    try {
      const mine = await getDocs(
        query(
          collection(db, 'games', gameId, 'waitlist'),
          where('user_id', '==', currentUser.uid),
          limit(10)
        )
      );
      if (mine.empty) {
        return true;
      }
      // Reordenação da fila é SERVER-ONLY (CF). Cliente só remove a
      // própria entrada (regra firestore: delete só do próprio user_id).
      const batch = writeBatch(db);
      mine.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      showSuccess('Você saiu da lista de espera');
      return true;
    } catch (err) {
      logger.error('Erro ao sair da lista de espera:', err);
      showError('Não foi possível sair da lista de espera. Tente novamente.');
      return false;
    } finally {
      setActing(false);
    }
  }, [gameId, currentUser, showSuccess, showError]);

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
