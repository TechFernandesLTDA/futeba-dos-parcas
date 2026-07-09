import { useCallback, useState } from 'react';
import { doc, getDoc, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Game } from '../types/game';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getIsPublicFromVisibility } from '../utils/gameLifecycle';
import { resolveExpectedPayment } from '../utils/gamePayment';
import { getGameDurationMinutes } from '../utils/gamePricing';
import { getNextRecurringDate } from '../pages/game/recurringGameHelpers';

const logger = createLogger('useDuplicateGameCopy');

function parseGameFromDoc(docId: string, raw: Record<string, unknown>): Game {
  const converted = snakeToCamel(raw);
  return {
    id: docId,
    ...converted,
    dateTime: raw.dateTime as Date | undefined,
    createdAt: raw.created_at as Date | undefined,
  } as Game;
}

export function useDuplicateGameCopy() {
  const { t } = useTranslation();
  const { firebaseUser, user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const duplicateGame = useCallback(
    async (gameId: string): Promise<string | null> => {
      const uid = firebaseUser?.uid || user?.id;
      if (!uid) {
        showError(t('feedback.auth.notAuthenticated'));
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const gameRef = doc(db, 'games', gameId);
        const gameSnap = await getDoc(gameRef);
        if (!gameSnap.exists()) {
          showError(t('feedback.games.notFound'));
          setLoading(false);
          return null;
        }

        const raw = gameSnap.data();
        const source = parseGameFromDoc(gameSnap.id, raw);

        const newDate = source.date
          ? getNextRecurringDate(source.date, source.recurrence === 'none' ? undefined : source.recurrence)
          : '';

        const [year, month, day] = newDate.split('-').map(Number);
        const [hours, minutes] = (source.time || '19:00').split(':').map(Number);
        const dateTime = Timestamp.fromDate(new Date(year, month - 1, day, hours, minutes));
        const expectedPayment = resolveExpectedPayment(source);

        const newGameData: Record<string, unknown> = {
          location_id: source.locationId,
          location_name: source.locationName,
          location_address: source.locationAddress,
          field_id: source.fieldId || null,
          field_name: source.fieldName || null,
          date: newDate,
          time: source.time,
          end_time: source.endTime || null,
          duration_minutes: source.durationMinutes ?? getGameDurationMinutes(source.time, source.endTime),
          dateTime: dateTime,
          field_type: source.fieldType,
          game_type: source.gameType || source.fieldType,
          max_players: source.maxPlayers,
          max_goalkeepers: source.maxGoalkeepers,
          number_of_teams: source.numberOfTeams,
          daily_price: expectedPayment,
          total_cost: source.totalCost,
          price_manual_override: source.priceManualOverride === true,
          pix_payment_enabled: source.pixPaymentEnabled,
          pix_key: source.pixKey || '',
          pix_key_type: source.pixKeyType || 'RANDOM',
          pix_beneficiary_name: source.pixBeneficiaryName || '',
          rules: source.rules || '',
          visibility: source.visibility,
          is_public: getIsPublicFromVisibility(source.visibility),
          recurrence: 'none',
          group_id: source.groupId || null,
          group_name: source.groupName || null,
          stream_url: source.streamUrl || null,
          team1_name: 'Time 1',
          team2_name: 'Time 2',
          confirmation_deadline_hours: 0,
          require_checkin: false,
          checkin_radius_meters: 100,
          owner_id: uid,
          owner_name: firebaseUser?.displayName || user?.name || 'Organizador',
          status: 'SCHEDULED',
          players_count: 0,
          goalkeepers_count: 0,
          players: [],
          team1_score: 0,
          team2_score: 0,
          xp_processed: false,
          voting_concluded: false,
          post_game_report_generated: false,
          auto_closed: false,
          co_organizers: [],
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        };

        if (source.locationLat) newGameData.location_lat = source.locationLat;
        if (source.locationLng) newGameData.location_lng = source.locationLng;

        const gamesRef = collection(db, 'games');
        const docRef = await addDoc(gamesRef, newGameData);

        queryClient.invalidateQueries({ queryKey: ['games'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['public-games'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['nextGame'] });

        showSuccess(t('feedback.duplicateGame.success'));
        setLoading(false);
        return docRef.id;
      } catch (err) {
        logger.error('Error duplicating game:', err);
        setError((err as Error).message);
        setLoading(false);
        showError((err as Error).message || 'Erro ao duplicar jogo.');
        return null;
      }
    },
    [firebaseUser, user, queryClient, showSuccess, showError, t],
  );

  return { duplicateGame, loading, error };
}
