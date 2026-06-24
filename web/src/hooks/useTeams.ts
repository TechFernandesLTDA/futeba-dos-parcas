import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { FavoriteTeam } from '../types/team';
import { useAuth } from '../contexts/AuthContext';

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
  // favorite_teams exige auth (rule allow read: if isAuthenticated()).
  // O TeamsProvider envolve toda a arvore (inclusive login/register), entao
  // sem este gate a query/listener disparava nao-autenticado -> permission-denied
  // no console + toast de erro na tela de login.
  const { currentUser } = useAuth();

  const {
    data: teams = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: [COLLECTION],
    queryFn: fetchTeams,
    enabled: !!currentUser,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  const teamsById = useMemo(() => {
    const map = new Map<string, FavoriteTeam>();
    for (const t of teams) {
      map.set(t.id, t);
    }
    return map;
  }, [teams]);

  const error = queryError ? (queryError as Error).message : null;

  return { teams, teamsById, loading, error };
}
