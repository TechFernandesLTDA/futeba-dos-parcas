import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';

export interface Player {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  level: number;
  gamesPlayed: number;
  goals: number;
  assists: number;
  mvpCount: number;
  division: string;
}

export const usePlayers = (groupId?: string) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    const fetchPlayers = async () => {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (groupDoc.exists()) {
          const memberIds = groupDoc.data().members || [];
          
          const playersData = await Promise.all(
            memberIds.map(async (uid: string) => {
              const userDoc = await getDoc(doc(db, 'users', uid));
              if (userDoc.exists()) {
                const raw = userDoc.data();
                const data = snakeToCamel(raw) as Record<string, any>;
                return {
                  id: uid,
                  name: data.name || 'Jogador',
                  email: data.email || '',
                  photoUrl: data.photoUrl || raw.photo_url,
                  level: data.level || 1,
                  gamesPlayed: data.gamesPlayed || raw.games_played || 0,
                  goals: data.goals || 0,
                  assists: data.assists || 0,
                  mvpCount: data.mvpCount || raw.mvp_count || 0,
                  division: data.division || 'BRONZE',
                } as Player;
              }
              return null;
            })
          );

          setPlayers(playersData.filter(Boolean) as Player[]);
        }
        setLoading(false);
      } catch (err: unknown) {
        setError((err as Error).message);
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [groupId]);

  return { players, loading, error };
};

export const usePlayerDetail = (userId?: string) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchPlayer = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const raw = userDoc.data();
          const data = snakeToCamel(raw) as Record<string, any>;
          setPlayer({
            id: userId,
            name: data.name || 'Jogador',
            email: data.email || '',
            photoUrl: data.photoUrl || raw.photo_url,
            level: data.level || 1,
            gamesPlayed: data.gamesPlayed || raw.games_played || 0,
            goals: data.goals || 0,
            assists: data.assists || 0,
            mvpCount: data.mvpCount || raw.mvp_count || 0,
            division: data.division || 'BRONZE',
          });
        }
        setLoading(false);
      } catch (err: unknown) {
        setError((err as Error).message);
        setLoading(false);
      }
    };

    fetchPlayer();
  }, [userId]);

  return { player, loading, error };
};
