import { useEffect, useState, useCallback } from 'react';
import {

  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('useJoinRequests');

export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface JoinRequest {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string | null;
  status: JoinRequestStatus;
  requestedAt?: Date;
  respondedAt?: Date | null;
  respondedBy?: string | null;
}

/**
 * Hook para gerenciar o request de entrada do USUARIO ATUAL em um grupo
 * publico (issue #517 Phase 2).
 *
 * Estados:
 *  - status: PENDING/APPROVED/REJECTED ou null se nao tem request
 *  - loading: carregando estado inicial
 *  - submitting: ação em curso (criar/cancelar)
 *
 * Operações:
 *  - request(): cria novo request com status PENDING
 *  - cancel(): deleta proprio request (so funciona se PENDING)
 */
export function useMyJoinRequest(groupId: string | undefined) {
  const { t } = useTranslation();
  const { user, firebaseUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const uid = firebaseUser?.uid || user?.id;

  const [request, setRequest] = useState<JoinRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId || !uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, `groups/${groupId}/join_requests/${uid}`);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setRequest(null);
        } else {
          const data = snap.data();
          setRequest({
            id: snap.id,
            userId: data.user_id,
            userName: data.user_name,
            userPhoto: data.user_photo ?? null,
            status: data.status,
            requestedAt: data.requested_at?.toDate(),
            respondedAt: data.responded_at?.toDate() ?? null,
            respondedBy: data.responded_by ?? null,
          });
        }
        setLoading(false);
      },
      (err) => {
        logger.error('useMyJoinRequest snapshot error', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [groupId, uid]);

  const requestJoin = useCallback(async () => {
    if (!groupId || !uid || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const ref = doc(db, `groups/${groupId}/join_requests/${uid}`);
      await setDoc(ref, {
        user_id: uid,
        user_name: user.name || user.email || 'Anonimo',
        user_photo: user.photoUrl ?? null,
        status: 'PENDING',
        requested_at: serverTimestamp(),
      });
      showSuccess(t('feedback.joinRequests.sendSuccess'));
    } catch (e) {
      const err = e as Error;
      logger.error('requestJoin failed', err);
      setError(err.message);
      showError(t('feedback.joinRequests.sendError'));
    } finally {
      setSubmitting(false);
    }
  }, [groupId, uid, user, showSuccess, showError]);

  const cancelRequest = useCallback(async () => {
    if (!groupId || !uid) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, `groups/${groupId}/join_requests/${uid}`));
      showSuccess(t('feedback.joinRequests.cancelSuccess'));
    } catch (e) {
      const err = e as Error;
      logger.error('cancelRequest failed', err);
      setError(err.message);
      showError(t('feedback.joinRequests.cancelError'));
    } finally {
      setSubmitting(false);
    }
  }, [groupId, uid, showSuccess, showError]);

  return {
    request,
    loading,
    submitting,
    error,
    requestJoin,
    cancelRequest,
  };
}

/**
 * Hook para owner/admin gerenciar requests pendentes de UM grupo.
 *
 * Estados:
 *  - requests: lista de requests com status PENDING
 *  - loading: carregando snapshot inicial
 *
 * Operações:
 *  - approve(requesterId): muda status -> APPROVED. Cloud Function
 *    onJoinRequestApproved cria o member automaticamente.
 *  - reject(requesterId): muda status -> REJECTED.
 */
export function usePendingJoinRequests(groupId: string | undefined) {
  const { t } = useTranslation();
  const { user, firebaseUser } = useAuth();
  const { showError } = useToast();
  const uid = firebaseUser?.uid || user?.id;

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId || !uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, `groups/${groupId}/join_requests`),
      where('status', '==', 'PENDING')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: JoinRequest[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.user_id,
            userName: data.user_name,
            userPhoto: data.user_photo ?? null,
            status: data.status,
            requestedAt: data.requested_at?.toDate(),
          };
        });
        // Ordenar por requested_at ASC (mais antigos primeiro)
        items.sort((a, b) => {
          const aTs = a.requestedAt?.getTime() ?? 0;
          const bTs = b.requestedAt?.getTime() ?? 0;
          return aTs - bTs;
        });
        setRequests(items);
        setLoading(false);
      },
      (err) => {
        logger.error('usePendingJoinRequests snapshot error', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [groupId, uid]);

  const approve = useCallback(
    async (requesterId: string) => {
      if (!groupId || !uid) return;
      try {
        await updateDoc(doc(db, `groups/${groupId}/join_requests/${requesterId}`), {
          status: 'APPROVED',
          responded_at: serverTimestamp(),
          responded_by: uid,
        });
      } catch (e) {
        const err = e as Error;
        logger.error('approve failed', err);
        setError(err.message);
        showError(t('feedback.joinRequests.approveError'));
      }
    },
    [groupId, uid, showError]
  );

  const reject = useCallback(
    async (requesterId: string) => {
      if (!groupId || !uid) return;
      try {
        await updateDoc(doc(db, `groups/${groupId}/join_requests/${requesterId}`), {
          status: 'REJECTED',
          responded_at: serverTimestamp(),
          responded_by: uid,
        });
      } catch (e) {
        const err = e as Error;
        logger.error('reject failed', err);
        setError(err.message);
        showError(t('feedback.joinRequests.rejectError'));
      }
    },
    [groupId, uid, showError]
  );

  return { requests, loading, error, approve, reject };
}
