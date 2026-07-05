import { useState, useEffect, useCallback } from 'react';
import {

  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { useToast } from '../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import type { Notification, NotificationType } from '../types';
import { useTranslation } from 'react-i18next';

const logger = createLogger('useNotifications');

export type { Notification, NotificationType };

export const useNotifications = (userId?: string) => {
  const { t } = useTranslation();
  const { showError, showSuccess } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // #2263: estado de "acting" exposto por mutação, espelhando o padrão de useWaitlist.
  // Permite que a UI desabilite botões e mostre progresso durante escritas.
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const notifRef = collection(db, 'notifications');
    const q = query(
      notifRef,
      where('user_id', '==', userId),
      orderBy('created_at', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const raw = d.data();
        const converted = snakeToCamel(raw);
        return {
          id: d.id,
          ...converted,
          createdAt: (raw.created_at || raw.createdAt)?.toDate?.() || new Date(),
        };
      }) as Notification[];

      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
      setLoading(false);
    }, (err) => {
      logger.error('Erro no listener de notificações:', err);
      setError(getFirestoreErrorMessage(err));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // #2289: envolvidas em useCallback para identidade estável entre renders.
  const markAsRead = useCallback(async (notificationId: string) => {
    setActing(true);
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (err) {
      logger.error('Error marking notification as read:', err);
      showError(t('feedback.notifications.markReadError'));
    } finally {
      setActing(false);
    }
  }, [showError, t]);

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    setActing(true);
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();

      showSuccess(t('feedback.notifications.markAllReadSuccess', { count: unread.length }));
    } catch (err) {
      logger.error('Error marking all notifications as read:', err);
      showError(t('feedback.notifications.markAllReadError'));
    } finally {
      setActing(false);
    }
  }, [notifications, showSuccess, showError, t]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    setActing(true);
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (err) {
      logger.error('Error deleting notification:', err);
      showError(t('feedback.notifications.deleteError'));
    } finally {
      setActing(false);
    }
  }, [showError, t]);

  const toggleRead = useCallback(async (notificationId: string, currentRead: boolean) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: !currentRead });
    } catch (err) {
      logger.error('Error toggling notification read status:', err);
      showError(t('feedback.notifications.statusError'));
    }
  }, [showError, t]);

  const declineGameInvite = useCallback(async (notificationId: string, gameId: string) => {
    if (!userId) return;
    setActing(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'confirmations', `${gameId}_${userId}`));
      batch.update(doc(db, 'notifications', notificationId), {
        read: true,
        read_at: serverTimestamp(),
      });
      await batch.commit();
      showSuccess(t('feedback.notifications.inviteDeclined'));
    } catch (err) {
      logger.error('Error declining game invite:', err);
      try {
        await updateDoc(doc(db, 'notifications', notificationId), {
          read: true,
          read_at: serverTimestamp(),
        });
        showSuccess(t('feedback.notifications.inviteDeclined'));
      } catch (fallbackErr) {
        logger.error('Error marking declined invite as read:', fallbackErr);
        showError(t('feedback.notifications.declineError'));
      }
    } finally {
      setActing(false);
    }
  }, [userId, showSuccess, showError, t]);

  const respondToGroupInvite = useCallback(async (
    notificationId: string,
    inviteId: string,
    status: 'ACCEPTED' | 'DECLINED',
  ) => {
    setActing(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'group_invites', inviteId), {
        status,
        updated_at: serverTimestamp(),
      });
      batch.update(doc(db, 'notifications', notificationId), {
        read: true,
        read_at: serverTimestamp(),
      });
      await batch.commit();
      showSuccess(status === 'ACCEPTED'
        ? t('feedback.notifications.inviteAccepted')
        : t('feedback.notifications.inviteDeclined'));
    } catch (err) {
      logger.error('Error responding group invite:', err);
      showError(t('feedback.notifications.groupInviteResponseError'));
      throw err;
    } finally {
      setActing(false);
    }
  }, [showSuccess, showError, t]);

  const restoreNotification = useCallback(async (notification: Notification) => {
    try {
      const { addDoc } = await import('firebase/firestore');
      const notifRef = collection(db, 'notifications');
      await addDoc(notifRef, {
        created_by: userId,
        user_id: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: notification.read,
        reference_id: notification.referenceId || null,
        reference_type: notification.referenceType || null,
        sender_id: notification.senderId || null,
        sender_name: notification.senderName || null,
        sender_photo: notification.senderPhoto || null,
        group_id: notification.groupId || null,
        action_type: notification.actionType || null,
        created_at: notification.createdAt || serverTimestamp(),
      });
      showSuccess(t('feedback.notifications.restoreSuccess'));
    } catch (err) {
      logger.error('Error restoring notification:', err);
      showError(t('feedback.notifications.restoreError'));
    }
  }, [showSuccess, showError, userId, t]);

  const deleteOldNotifications = useCallback(async (daysOld: number) => {
    if (!userId) return;
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysOld);

      const notifRef = collection(db, 'notifications');
      const q = query(
        notifRef,
        where('user_id', '==', userId),
        orderBy('created_at', 'asc'),
        limit(100)
      );

      const snapshot = await getDocs(q);
      const toDelete = snapshot.docs.filter((d) => {
        const raw = d.data();
        const createdAt = (raw.created_at || raw.createdAt)?.toDate?.() || new Date();
        return createdAt < cutoff;
      });

      if (toDelete.length === 0) return;

      const batch = writeBatch(db);
      toDelete.forEach((d) => batch.delete(doc(db, 'notifications', d.id)));
      await batch.commit();

      showSuccess(t('feedback.notifications.cleanupSuccess', { count: toDelete.length }));
    } catch (err) {
      logger.error('Error deleting old notifications:', err);
      showError(t('feedback.notifications.cleanupError'));
    }
  }, [userId, showSuccess, showError, t]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    acting,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    toggleRead,
    declineGameInvite,
    respondToGroupInvite,
    restoreNotification,
    deleteOldNotifications,
  };
};
