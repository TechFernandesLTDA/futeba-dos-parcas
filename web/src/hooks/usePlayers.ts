import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';

export interface Player {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  level: number;
  xp: number;
  division: string;
  gamesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  mvpCount: number;
  streak: number;
  createdAt?: Date;
}

export const usePlayers = (groupId?: string) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!groupId) {
      setLoading(false);
      return;
    }

    const fetchPlayers = async () => {
      try {
        // FIX #584/H2: era `groupDoc.data().members` (array flat) — campo
        // não existe; schema usa subcollection `groups/{id}/members/{uid}`.
        // Por isso a tela Players sempre vinha vazia. Agora lemos da
        // subcollection (consistente com useGroups e CF).
        const membersSnap = await getDocs(
          collection(db, 'groups', groupId, 'members')
        );
        if (cancelled) return;
        if (!membersSnap.empty) {
          const memberIds = membersSnap.docs.map((d) => d.id);

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
                  xp: data.experiencePoints ?? data.xp ?? 0,
                  division: data.division || 'BRONZE',
                  gamesPlayed: data.gamesPlayed || raw.games_played || 0,
                  wins: data.wins || 0,
                  goals: data.goals || 0,
                  assists: data.assists || 0,
                  mvpCount: data.mvpCount || raw.mvp_count || 0,
                  streak: data.streak || 0,
                  createdAt: raw.created_at?.toDate?.() || (data.createdAt as any)?.toDate?.(),
                } as Player;
              }
              return null;
            })
          );

          if (cancelled) return;
          setPlayers(playersData.filter(Boolean) as Player[]);
        }
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    };

    fetchPlayers();
    return () => { cancelled = true; };
  }, [groupId]);

  return { players, loading, error };
};

export const usePlayerDetail = (userId?: string) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchPlayer = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (cancelled) return;
        if (userDoc.exists()) {
          const raw = userDoc.data();
          const data = snakeToCamel(raw) as Record<string, any>;
          if (!cancelled) {
            setPlayer({
              id: userId,
              name: data.name || 'Jogador',
              email: data.email || '',
              photoUrl: data.photoUrl || raw.photo_url,
              level: data.level || 1,
              xp: data.experiencePoints ?? data.xp ?? 0,
              division: data.division || 'BRONZE',
              gamesPlayed: data.gamesPlayed || raw.games_played || 0,
              wins: data.wins || 0,
              goals: data.goals || 0,
              assists: data.assists || 0,
              mvpCount: data.mvpCount || raw.mvp_count || 0,
              streak: data.streak || 0,
              createdAt: raw.created_at?.toDate?.() || data.createdAt,
            });
          }
        }
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    };

    fetchPlayer();
    return () => { cancelled = true; };
  }, [userId]);

  return { player, loading, error };
};
