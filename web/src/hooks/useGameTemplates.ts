import { useState, useEffect, useCallback, useRef } from 'react';
import {

  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { GameTemplate, FieldType } from '../types/game';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('useGameTemplates');

interface TemplateInput {
  name: string;
  max_players: number;
  max_goalkeepers: number;
  location_id?: string;
  location_name?: string;
  field_id?: string;
  field_name?: string;
  field_type?: FieldType;
  rules?: string;
}

export function useGameTemplates() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showError } = useToast();
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  // #2252: inicializa loading=true para distinguir "ainda não buscou" de "vazio".
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef(user);
  userRef.current = user;
  // #2278/#2252: flag de cancelamento para evitar setState após unmount.
  const cancelledRef = useRef(false);

  const fetchTemplates = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) {
      if (!cancelledRef.current) setLoading(false);
      return;
    }

    if (!cancelledRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const templatesRef = collection(db, 'users', currentUser.id, 'game_templates');
      const q = query(templatesRef, orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      const data: GameTemplate[] = snapshot.docs.map((d) => {
        const raw = snakeToCamel(d.data()) as Record<string, unknown>;
        const createdAt = raw.createdAt as Timestamp | Date | undefined;
        return {
          id: d.id,
          user_id: raw.userId as string,
          name: raw.name as string,
          max_players: raw.maxPlayers as number,
          max_goalkeepers: raw.maxGoalkeepers as number,
          location_id: raw.locationId as string | undefined,
          location_name: raw.locationName as string | undefined,
          field_id: raw.fieldId as string | undefined,
          field_name: raw.fieldName as string | undefined,
          field_type: raw.fieldType as FieldType | undefined,
          rules: raw.rules as string | undefined,
          created_at: createdAt instanceof Timestamp ? createdAt.toDate() : (createdAt as Date) ?? new Date(),
        };
      });
      if (!cancelledRef.current) setTemplates(data);
    } catch (err) {
      logger.error('Error fetching templates:', err);
      if (!cancelledRef.current) setError(t('feedback.templates.loadError'));
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    cancelledRef.current = false;
    fetchTemplates();
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchTemplates]);

  const saveTemplate = useCallback(async (input: TemplateInput): Promise<string | null> => {
    const currentUser = userRef.current;
    if (!currentUser) return null;

    if (!input.name?.trim()) {
      showError(t('feedback.templates.nameRequired'));
      return null;
    }
    if (!input.max_players || input.max_players < 1) {
      showError(t('feedback.templates.maxPlayersMinOne'));
      return null;
    }

    try {
      const templatesRef = collection(db, 'users', currentUser.id, 'game_templates');
      const docRef = await addDoc(templatesRef, {
        user_id: currentUser.id,
        name: input.name,
        max_players: input.max_players,
        max_goalkeepers: input.max_goalkeepers,
        location_id: input.location_id || null,
        location_name: input.location_name || null,
        field_id: input.field_id || null,
        field_name: input.field_name || null,
        field_type: input.field_type || null,
        rules: input.rules || null,
        created_at: serverTimestamp(),
      });
      await fetchTemplates();
      return docRef.id;
    } catch (err) {
      logger.error('Error saving template:', err);
      showError(t('feedback.templates.saveError'));
      throw err;
    }
  }, [fetchTemplates, showError, t]);

  const removeTemplate = useCallback(async (templateId: string): Promise<void> => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    if (!templateId) {
      showError(t('feedback.templates.notFound'));
      return;
    }

    try {
      const docRef = doc(db, 'users', currentUser.id, 'game_templates', templateId);
      await deleteDoc(docRef);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      logger.error('Error deleting template:', err);
      showError(t('feedback.templates.removeError'));
      throw err;
    }
  }, [showError, t]);

  return { templates, loading, error, saveTemplate, removeTemplate, refetch: fetchTemplates };
}
