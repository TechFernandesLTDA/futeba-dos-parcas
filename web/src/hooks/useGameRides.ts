import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Game } from '../types/game';
import { toDate } from '../utils/firestoreHelpers';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';
import { createLogger } from '../utils/logger';

const logger = createLogger('useGameRides');

export type GameRideType = 'OFFER' | 'REQUEST';
export type GameRideStatus = 'ACTIVE' | 'CANCELLED';

export interface GameRide {
  id: string;
  gameId: string;
  groupId?: string | null;
  userId: string;
  userName: string;
  userPhoto: string;
  type: GameRideType;
  originLabel: string;
  destinationLabel: string;
  seats: number | null;
  note: string;
  status: GameRideStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SaveGameRideInput {
  type: GameRideType;
  originLabel: string;
  destinationLabel: string;
  seats: number | null;
  note: string;
}

function parseRideDoc(id: string, raw: Record<string, unknown>): GameRide {
  return {
    id,
    gameId: String(raw.game_id ?? ''),
    groupId: (raw.group_id as string | null | undefined) ?? null,
    userId: String(raw.user_id ?? ''),
    userName: String(raw.user_name ?? ''),
    userPhoto: String(raw.user_photo ?? ''),
    type: raw.type === 'REQUEST' ? 'REQUEST' : 'OFFER',
    originLabel: String(raw.origin_label ?? ''),
    destinationLabel: String(raw.destination_label ?? ''),
    seats: typeof raw.seats === 'number' ? raw.seats : null,
    note: String(raw.note ?? ''),
    status: raw.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
    createdAt: toDate(raw.created_at as Parameters<typeof toDate>[0]),
    updatedAt: toDate(raw.updated_at as Parameters<typeof toDate>[0]),
  };
}

function normalizeLabel(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function buildRideNotificationMessage(ride: SaveGameRideInput, senderName: string, game: Game) {
  const destination = normalizeLabel(ride.destinationLabel || game.locationName, 120);
  if (ride.type === 'OFFER') {
    const seatsText = ride.seats && ride.seats > 1 ? `${ride.seats} vagas` : '1 vaga';
    return `${senderName} ofereceu carona para ${destination} saindo de ${normalizeLabel(ride.originLabel, 120)} (${seatsText}).`;
  }

  return `${senderName} pediu carona para ${destination} saindo de ${normalizeLabel(ride.originLabel, 120)}.`;
}

export function useGameRides(game: Game | null, enabled: boolean) {
  const { user, firebaseUser } = useAuth();
  const [rides, setRides] = useState<GameRide[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const currentUserId = firebaseUser?.uid || user?.id || null;
  const currentUserRide = useMemo(
    () => rides.find((ride) => ride.userId === currentUserId && ride.status === 'ACTIVE') ?? null,
    [currentUserId, rides],
  );

  const refetch = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !game?.id) {
      setRides([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const ridesQuery = query(
      collection(db, 'game_rides'),
      where('game_id', '==', game.id),
      where('status', '==', 'ACTIVE'),
    );

    const unsubscribe = onSnapshot(
      ridesQuery,
      (snapshot) => {
        const nextRides = snapshot.docs
          .map((rideDoc) => parseRideDoc(rideDoc.id, rideDoc.data()))
          .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
        setRides(nextRides);
        setLoading(false);
        setError(null);
      },
      (err) => {
        logger.error('Error loading game rides:', err);
        setRides([]);
        setLoading(false);
        setError(getFirestoreErrorMessage(err));
      },
    );

    return unsubscribe;
  }, [enabled, game?.id, refreshToken]);

  const saveRide = useCallback(async (input: SaveGameRideInput) => {
    if (!game?.id || !currentUserId) return false;

    const originLabel = normalizeLabel(input.originLabel, 120);
    const destinationLabel = normalizeLabel(input.destinationLabel || game.locationName, 120);
    const note = normalizeLabel(input.note, 180);
    const offeredSeats = Number(input.seats || 1);
    const seats = input.type === 'OFFER' ? offeredSeats : null;

    if (originLabel.length < 2 || destinationLabel.length < 2) {
      throw new Error('Informe origem e destino aproximados.');
    }
    if (input.type === 'OFFER' && (!Number.isInteger(offeredSeats) || offeredSeats < 1 || offeredSeats > 8)) {
      throw new Error('Informe entre 1 e 8 vagas.');
    }

    setSaving(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      const senderName = firebaseUser?.displayName || user?.name || user?.nickname || 'Jogador';
      const senderPhoto = firebaseUser?.photoURL || user?.photoUrl || '';
      const rideRef = doc(db, 'game_rides', `${game.id}_${currentUserId}`);
      const ridePayload = {
        game_id: game.id,
        group_id: game.groupId || null,
        user_id: currentUserId,
        user_name: senderName,
        user_photo: senderPhoto,
        type: input.type,
        origin_label: originLabel,
        destination_label: destinationLabel,
        seats,
        note,
        status: 'ACTIVE',
        updated_at: serverTimestamp(),
      };

      if (currentUserRide) {
        batch.set(rideRef, ridePayload, { merge: true });
      } else {
        batch.set(rideRef, {
          ...ridePayload,
          created_at: serverTimestamp(),
        });
      }

      const oppositeType: GameRideType = input.type === 'OFFER' ? 'REQUEST' : 'OFFER';
      const interestedUserIds = new Set(
        rides
          .filter((ride) => ride.type === oppositeType && ride.userId !== currentUserId)
          .map((ride) => ride.userId),
      );

      const notificationMessage = buildRideNotificationMessage(input, senderName, game);
      Array.from(interestedUserIds).slice(0, 20).forEach((targetUserId) => {
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
          user_id: targetUserId,
          created_by: currentUserId,
          type: 'GAME_RIDE',
          title: input.type === 'OFFER' ? 'Carona oferecida' : 'Pedido de carona',
          body: notificationMessage,
          message: notificationMessage,
          reference_id: game.id,
          reference_type: 'game',
          action_type: 'OPEN_GAME',
          game_id: game.id,
          group_id: game.groupId || null,
          read: false,
          created_at: serverTimestamp(),
        });
      });

      await batch.commit();
      return true;
    } catch (err) {
      logger.error('Error saving game ride:', err);
      setError(getFirestoreErrorMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [currentUserId, currentUserRide, firebaseUser, game, rides, user]);

  const cancelRide = useCallback(async () => {
    if (!game?.id || !currentUserId) return false;

    setCancelling(true);
    setError(null);
    try {
      const rideRef = doc(db, 'game_rides', `${game.id}_${currentUserId}`);
      const batch = writeBatch(db);
      batch.update(rideRef, {
        status: 'CANCELLED',
        updated_at: serverTimestamp(),
      });
      await batch.commit();
      return true;
    } catch (err) {
      logger.error('Error cancelling game ride:', err);
      setError(getFirestoreErrorMessage(err));
      throw err;
    } finally {
      setCancelling(false);
    }
  }, [currentUserId, game?.id]);

  return {
    rides,
    currentUserRide,
    loading,
    saving,
    cancelling,
    error,
    refetch,
    saveRide,
    cancelRide,
  };
}
