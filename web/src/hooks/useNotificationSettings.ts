import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { useToast } from '../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';

const logger = createLogger('useNotificationSettings');

interface NotificationSettings {
  pushEnabled: boolean;
  gameReminders: boolean;
  gameInvites: boolean;
  groupInvites: boolean;
  achievements: boolean;
  mvpVotes: boolean;
  levelUp: boolean;
  systemAnnouncements: boolean;
  reminderTime: number;
  muteUntil: Date | null;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  pushEnabled: true,
  gameReminders: true,
  gameInvites: true,
  groupInvites: true,
  achievements: true,
  mvpVotes: true,
  levelUp: true,
  systemAnnouncements: true,
  reminderTime: 30,
  muteUntil: null,
};

export function useNotificationSettings(userId?: string) {
  const { showSuccess, showError } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const settingsRef = doc(db, 'notification_settings', userId);
      const docSnap = await getDoc(settingsRef);
      if (docSnap.exists()) {
        const raw = docSnap.data();
        const converted = snakeToCamel<Record<string, unknown>>(raw);
        setSettings({
          pushEnabled: (converted.pushEnabled as boolean) ?? DEFAULT_SETTINGS.pushEnabled,
          gameReminders: (converted.gameReminders as boolean) ?? DEFAULT_SETTINGS.gameReminders,
          gameInvites: (converted.gameInvites as boolean) ?? DEFAULT_SETTINGS.gameInvites,
          groupInvites: (converted.groupInvites as boolean) ?? DEFAULT_SETTINGS.groupInvites,
          achievements: (converted.achievements as boolean) ?? DEFAULT_SETTINGS.achievements,
          mvpVotes: (converted.mvpVotes as boolean) ?? DEFAULT_SETTINGS.mvpVotes,
          levelUp: (converted.levelUp as boolean) ?? DEFAULT_SETTINGS.levelUp,
          systemAnnouncements: (converted.systemAnnouncements as boolean) ?? DEFAULT_SETTINGS.systemAnnouncements,
          reminderTime: (converted.reminderTime as number) ?? DEFAULT_SETTINGS.reminderTime,
          muteUntil: (raw.mute_until as { toDate?: () => Date })?.toDate?.() || (converted.muteUntil as Date) || null,
        });
      }
    } catch (err) {
      logger.error('Error loading notification settings:', err);
      setError(getFirestoreErrorMessage(err));
      // FIX #1557: não re-lança o erro para evitar unhandled promise rejection no useEffect
      // O erro já está logado e disponível via state
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadSettings();
    } else {
      setLoading(false);
    }
  }, [userId, loadSettings]);

  const saveSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    if (!userId) return;
    try {
      const settingsRef = doc(db, 'notification_settings', userId);
      await setDoc(settingsRef, {
        push_enabled: newSettings.pushEnabled,
        game_reminders: newSettings.gameReminders,
        game_invites: newSettings.gameInvites,
        group_invites: newSettings.groupInvites,
        achievements: newSettings.achievements,
        mvp_votes: newSettings.mvpVotes,
        level_up: newSettings.levelUp,
        system_announcements: newSettings.systemAnnouncements,
        reminder_time: newSettings.reminderTime,
        mute_until: newSettings.muteUntil,
        updated_at: serverTimestamp(),
      }, { merge: true });

      showSuccess('Configurações salvas.');
    } catch (err) {
      logger.error('Error saving notification settings:', err);
      showError('Erro ao salvar configurações.');
      throw err;
    }
  }, [userId, showSuccess, showError]);

  const setPreference = useCallback((key: keyof NotificationSettings, value: boolean | number) => {
    const update = { [key]: value } as Partial<NotificationSettings>;
    let previous: NotificationSettings | null = null;
    setSettings((prev) => { previous = prev; return { ...prev, ...update }; });
    saveSettings(update).catch(() => {
      if (previous) setSettings(previous);
    });
  }, [saveSettings]);

  const setMuteUntil = useCallback((hours: number) => {
    const muteDate = new Date(Date.now() + hours * 60 * 60 * 1000);
    let previous: NotificationSettings | null = null;
    setSettings((prev) => { previous = prev; return { ...prev, muteUntil: muteDate }; });
    saveSettings({ muteUntil: muteDate }).catch(() => {
      if (previous) setSettings(previous);
    });
  }, [saveSettings]);

  const clearMute = useCallback(() => {
    let previous: NotificationSettings | null = null;
    setSettings((prev) => { previous = prev; return { ...prev, muteUntil: null }; });
    saveSettings({ muteUntil: null }).catch(() => {
      if (previous) setSettings(previous);
    });
  }, [saveSettings]);

  return {
    settings,
    loading,
    error,
    setPreference,
    setMuteUntil,
    clearMute,
    saveSettings,
    refresh: loadSettings,
  };
}
