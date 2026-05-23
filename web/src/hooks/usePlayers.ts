import { useState, useEffect } from 'react';
import { collection, doc, documentId, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';

const logger = createLogger('usePlayers');

export interface Player {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  favoriteTeam?: string;
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

          // Agrupa em chunks de 10 (limite do whereIn do Firestore) para
          // evitar N+1 reads individuais — reduz custo de N para ⌈N/10⌉ reads.
          const chunks: string[][] = [];
          for (let i = 0; i < memberIds.length; i += 10) {
            chunks.push(memberIds.slice(i, i + 10));
          }

          // #1547: Promise.allSettled garante que 1 chunk com falha não derruba
          // a lista inteira — os chunks bem-sucedidos ainda são exibidos.
          const chunkResults = await Promise.allSettled(
            chunks.map((chunk) =>
              getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)))
            )
          );

          if (cancelled) return;

          const allUserDocs = chunkResults.flatMap((result) => {
            if (result.status === 'rejected') {
              logger.error('Falha ao ler chunk de jogadores:', result.reason);
              return [];
            }
            return result.value.docs;
          });
          const playersData = allUserDocs.map((userDoc) => {
            const raw = userDoc.data();
          const data = snakeToCamel(raw) as Record<string, unknown>;
          return {
            id: userDoc.id,
            name: (data.name as string) || 'Jogador',
            email: (data.email as string) || '',
            photoUrl: (data.photoUrl as string) || raw.photo_url || '',
            favoriteTeam: (data.favoriteTeam as string) ?? raw.favorite_team ?? undefined,
            level: (data.level as number) || 1,
            xp: (data.experiencePoints as number) ?? (data.xp as number) ?? 0,
            division: (data.division as string) || 'BRONZE',
            gamesPlayed: (data.gamesPlayed as number) || (raw.games_played as number) || 0,
            wins: (data.wins as number) || 0,
            goals: (data.goals as number) || 0,
            assists: (data.assists as number) || 0,
            mvpCount: (data.mvpCount as number) || (raw.mvp_count as number) || 0,
            streak: (data.streak as number) || 0,
            createdAt: raw.created_at?.toDate?.() || (data.createdAt as { toDate?: () => Date })?.toDate?.(),
          } as Player;
          });

          if (cancelled) return;
          setPlayers(playersData);
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
          const data = snakeToCamel(raw) as Record<string, unknown>;
          if (!cancelled) {
            setPlayer({
              id: userId,
              name: (data.name as string) || 'Jogador',
              email: (data.email as string) || '',
              photoUrl: (data.photoUrl as string) || raw.photo_url || '',
              favoriteTeam: (data.favoriteTeam as string) ?? raw.favorite_team ?? undefined,
              level: (data.level as number) || 1,
              xp: (data.experiencePoints as number) ?? (data.xp as number) ?? 0,
              division: (data.division as string) || 'BRONZE',
              gamesPlayed: (data.gamesPlayed as number) || (raw.games_played as number) || 0,
              wins: (data.wins as number) || 0,
              goals: (data.goals as number) || 0,
              assists: (data.assists as number) || 0,
              mvpCount: (data.mvpCount as number) || (raw.mvp_count as number) || 0,
              streak: (data.streak as number) || 0,
              createdAt: raw.created_at?.toDate?.() || (data.createdAt as Date | undefined),
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
