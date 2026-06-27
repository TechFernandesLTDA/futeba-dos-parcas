import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';
import { snakeToCamel, toDate } from '../utils/firestoreHelpers';
import type { FavoriteSquad, FavoriteSquadInput } from '../types/favoriteSquad';
import {
  getFavoriteSquadType,
  normalizeFavoriteSquadInput,
  validateFavoriteSquadInput,
} from '../utils/favoriteSquads';

const logger = createLogger('useFavoriteSquads');

function parseFavoriteSquadDoc(id: string, raw: Record<string, unknown>): FavoriteSquad {
  const data = snakeToCamel(raw) as Record<string, unknown>;
  const playerIds = (data.playerIds as string[] | undefined) ?? (raw.player_ids as string[] | undefined) ?? [];
  const playerNames = (data.playerNames as string[] | undefined) ?? (raw.player_names as string[] | undefined) ?? [];
  return {
    id,
    ownerId: (data.ownerId as string) || (raw.owner_id as string) || '',
    name: (data.name as string) || 'Favorito',
    type: (data.type as FavoriteSquad['type']) || getFavoriteSquadType(playerIds.length),
    playerIds,
    playerNames,
    createdAt: toDate(raw.created_at as Timestamp | Date | null | undefined),
    updatedAt: toDate(raw.updated_at as Timestamp | Date | null | undefined),
  };
}

export function useFavoriteSquads() {
  const { t } = useTranslation();
  const { firebaseUser, user } = useAuth();
  const uid = firebaseUser?.uid || user?.id;
  const { showError, showSuccess } = useToast();
  const showErrorRef = useRef(showError);
  const tRef = useRef(t);
  showErrorRef.current = showError;
  tRef.current = t;

  const [squads, setSquads] = useState<FavoriteSquad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setSquads([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const squadsRef = collection(db, 'users', uid, 'favorite_squads');
    const q = query(squadsRef, orderBy('updated_at', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setSquads(snapshot.docs.map((docSnap) => parseFavoriteSquadDoc(docSnap.id, docSnap.data())));
        setLoading(false);
      },
      (err) => {
        logger.error('Error loading favorite squads:', err);
        setError(err.message);
        setLoading(false);
        showErrorRef.current(tRef.current('profile.favoriteSquads.loadError'));
      },
    );

    return unsubscribe;
  }, [uid]);

  const addFavoriteSquad = useCallback(async (input: FavoriteSquadInput): Promise<boolean> => {
    if (!uid) return false;
    const validationError = validateFavoriteSquadInput(input);
    if (validationError) {
      showError(t(`profile.favoriteSquads.validation.${validationError}`));
      return false;
    }

    const normalized = normalizeFavoriteSquadInput(input);
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', uid, 'favorite_squads'), {
        owner_id: uid,
        name: normalized.name,
        type: getFavoriteSquadType(normalized.playerIds.length),
        player_ids: normalized.playerIds,
        player_names: normalized.playerNames,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      showSuccess(t('profile.favoriteSquads.saveSuccess'));
      return true;
    } catch (err) {
      logger.error('Error saving favorite squad:', err);
      showError(t('profile.favoriteSquads.saveError'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [showError, showSuccess, t, uid]);

  const deleteFavoriteSquad = useCallback(async (squadId: string): Promise<boolean> => {
    if (!uid || !squadId) return false;
    setDeletingId(squadId);
    try {
      await deleteDoc(doc(db, 'users', uid, 'favorite_squads', squadId));
      showSuccess(t('profile.favoriteSquads.deleteSuccess'));
      return true;
    } catch (err) {
      logger.error('Error deleting favorite squad:', err);
      showError(t('profile.favoriteSquads.deleteError'));
      return false;
    } finally {
      setDeletingId(null);
    }
  }, [showError, showSuccess, t, uid]);

  return {
    squads,
    loading,
    error,
    saving,
    deletingId,
    addFavoriteSquad,
    deleteFavoriteSquad,
  };
}
