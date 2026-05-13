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
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { useToast } from '../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import type { Notification, NotificationType } from '../types';

const logger = createLogger('useNotifications');

export type { Notification, NotificationType };

export const useNotifications = (userId?: string) => {
  const { showError, showSuccess } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (err) {
      logger.error('Error marking notification as read:', err);
      showError('Erro ao marcar notificação como lida.');
    }
  };

  const markAllAsRead = async () => {
    try {
      const updates = notifications
        .filter((n) => !n.read)
        .map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true }));
      const results = await Promise.allSettled(updates);
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        logger.error(`${failures.length} notificações falharam ao marcar como lida`);
        showError('Algumas notificações não puderam ser marcadas como lidas.');
      }
    } catch (err) {
      logger.error('Error marking all notifications as read:', err);
      showError('Erro ao marcar todas as notificações como lidas.');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (err) {
      logger.error('Error deleting notification:', err);
      showError('Erro ao excluir notificação.');
    }
  };

  const toggleRead = useCallback(async (notificationId: string, currentRead: boolean) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: !currentRead });
    } catch (err) {
      logger.error('Error toggling notification read status:', err);
      showError('Erro ao alterar status da notificação.');
    }
  }, [showError]);

  const restoreNotification = useCallback(async (notification: Notification) => {
    try {
      const { addDoc } = await import('firebase/firestore');
      const notifRef = collection(db, 'notifications');
      await addDoc(notifRef, {
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
        created_at: notification.createdAt || new Date(),
      });
      showSuccess('Notificação restaurada.');
    } catch (err) {
      logger.error('Error restoring notification:', err);
      showError('Erro ao restaurar notificação.');
    }
  }, [showSuccess, showError]);

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

      showSuccess(`${toDelete.length} notificações antigas removidas.`);
    } catch (err) {
      logger.error('Error deleting old notifications:', err);
      showError('Erro ao remover notificações antigas.');
    }
  }, [userId, showSuccess, showError]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    toggleRead,
    restoreNotification,
    deleteOldNotifications,
  };
};
