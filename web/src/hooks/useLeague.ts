import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { LeagueDivision } from '../types/gamification';

export interface LeaguePlayer {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  level: number;
  points: number;
  gamesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  mvpCount: number;
  division: LeagueDivision;
  isCurrentUser?: boolean;
}

export const useLeague = (currentUserId?: string, division?: LeagueDivision) => {
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const seasonRef = collection(db, 'season_participation');
    const q = query(seasonRef, orderBy('points', 'desc'), limit(100));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const playersData = await Promise.all(
          snapshot.docs.map(async (docSnapshot) => {
            const raw = docSnapshot.data();
            const data = snakeToCamel(raw) as Record<string, any>;
            const userId = data.userId || raw.user_id || docSnapshot.id;

            let userData = { name: 'Jogador', photoUrl: null as string | null };
            try {
              const userDoc = await getDoc(doc(db, 'users', userId));
              if (userDoc.exists()) {
                const d = userDoc.data();
                userData = { name: d.name || 'Jogador', photoUrl: d.photo_url || d.photoUrl };
              }
            } catch { /* usuário não encontrado */ }

            return {
              id: docSnapshot.id,
              userId,
              userName: userData.name,
              userPhoto: userData.photoUrl || undefined,
              level: data.level || 1,
              points: data.points || 0,
              gamesPlayed: data.gamesPlayed || raw.games_played || 0,
              wins: data.wins || 0,
              goals: data.goals || 0,
              assists: data.assists || 0,
              mvpCount: data.mvpCount || raw.mvp_count || 0,
              division: data.division || 'BRONZE',
              isCurrentUser: userId === currentUserId,
            } as LeaguePlayer;
          })
        );

        const filtered = division 
          ? playersData.filter((p) => p.division === division)
          : playersData;

        setPlayers(filtered);
        setLoading(false);
      } catch (err: unknown) {
        setError((err as Error).message);
        setLoading(false);
      }
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserId, division]);

  return { players, loading, error };
};
