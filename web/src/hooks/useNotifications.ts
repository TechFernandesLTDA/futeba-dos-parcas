import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { useToast } from '../contexts/ToastContext';

const logger = createLogger('useNotifications');

export interface Notification {
  id: string;
  userId: string;
  type: 'GAME_INVITE' | 'GAME_REMINDER' | 'MVP_VOTE' | 'LEVEL_UP' | 'BADGE' | 'GROUP_INVITE' | 'SYSTEM';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

export const useNotifications = (userId?: string) => {
  const { showError } = useToast();
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
      setError(err.message);
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

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
};
