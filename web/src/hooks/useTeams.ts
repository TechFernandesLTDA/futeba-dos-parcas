import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { FavoriteTeam } from '../types/team';
import { createLogger } from '../utils/logger';
import { useToast } from '../contexts/ToastContext';

const logger = createLogger('useTeams');

const COLLECTION = 'favorite_teams';

async function fetchTeams(): Promise<FavoriteTeam[]> {
  const coll = collection(db, COLLECTION);
  const q = query(coll, orderBy('name', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    ...snakeToCamel<FavoriteTeam>(d.data()),
    id: d.id,
  }));
}

export function useTeams() {
  const queryClient = useQueryClient();

  const {
    data: teams = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: [COLLECTION],
    queryFn: fetchTeams,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  const { showError } = useToast();
  const [listenerError, setListenerError] = useState<string | null>(null);

  useEffect(() => {
    const coll = collection(db, COLLECTION);
    const q = query(coll, orderBy('name', 'asc'));
    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(
      q,
      () => {
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return;
        }
        queryClient.invalidateQueries({ queryKey: [COLLECTION] });
      },
      (err) => {
        logger.error('Error in teams listener:', err);
        setListenerError(err.message);
        showError('Erro ao carregar times em tempo real');
      }
    );

    return () => unsubscribe();
  }, [queryClient, showError]);

  const teamsById = useMemo(() => {
    const map = new Map<string, FavoriteTeam>();
    for (const t of teams) {
      map.set(t.id, t);
    }
    return map;
  }, [teams]);

  const error = listenerError || (queryError ? (queryError as Error).message : null);

  return { teams, teamsById, loading, error };
}
