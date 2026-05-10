import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { collection, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { Team } from '../types/team';
import { createLogger } from '../utils/logger';

const logger = createLogger('useTeams');

const COLLECTION = 'favorite_teams';

async function fetchTeams(): Promise<Team[]> {
  const coll = collection(db, COLLECTION);
  const q = query(coll, orderBy('name', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    ...snakeToCamel<Team>(d.data()),
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
      }
    );

    return () => unsubscribe();
  }, [queryClient]);

  const teamsById = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teams) {
      map.set(t.id, t);
    }
    return map;
  }, [teams]);

  const error = queryError ? (queryError as Error).message : null;

  return { teams, teamsById, loading, error };
}
