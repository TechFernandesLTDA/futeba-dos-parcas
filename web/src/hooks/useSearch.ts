import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface SearchResult {
  id: string;
  type: 'user' | 'group' | 'game' | 'location';
  name: string;
  subtitle: string;
  photoUrl?: string;
}

export const useSearch = (searchQuery: string, type: 'all' | 'users' | 'groups' | 'games' | 'locations' = 'all') => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    let cancelled = false;

    const performSearch = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const allResults: SearchResult[] = [];

        if (type === 'all' || type === 'users') {
          const usersRef = collection(db, 'users');
          const usersQ = query(
            usersRef,
            where('name', '>=', searchQuery),
            where('name', '<=', searchQuery + '\uf8ff'),
            limit(10)
          );
          const usersSnap = await getDocs(usersQ);
          if (cancelled) return;
          usersSnap.docs.forEach((d) => {
            const data = d.data();
            allResults.push({
              id: d.id,
              type: 'user',
              name: data.name || 'Jogador',
              subtitle: `Nível ${data.level || 1}`,
              photoUrl: data.photo_url || data.photoUrl,
            });
          });
        }

        if (type === 'all' || type === 'groups') {
          const groupsRef = collection(db, 'groups');
          const groupsQ = query(
            groupsRef,
            where('name', '>=', searchQuery),
            where('name', '<=', searchQuery + '\uf8ff'),
            limit(10)
          );
          const groupsSnap = await getDocs(groupsQ);
          if (cancelled) return;
          groupsSnap.docs.forEach((d) => {
            const data = d.data();
            allResults.push({
              id: d.id,
              type: 'group',
              name: data.name || 'Grupo',
              subtitle: `${data.member_count || data.memberCount || 0} membros`,
              photoUrl: data.photo_url || data.photoUrl,
            });
          });
        }

        if (type === 'all' || type === 'games') {
          const gamesRef = collection(db, 'games');
          const gamesQ = query(
            gamesRef,
            where('location_name', '>=', searchQuery),
            where('location_name', '<=', searchQuery + '\uf8ff'),
            orderBy('location_name'),
            limit(10)
          );
          const gamesSnap = await getDocs(gamesQ);
          if (cancelled) return;
          gamesSnap.docs.forEach((d) => {
            const data = d.data();
            allResults.push({
              id: d.id,
              type: 'game',
              name: data.location_name || 'Jogo',
              subtitle: data.date ? new Date(data.date.toDate?.() || data.date).toLocaleDateString('pt-BR') : '',
              photoUrl: data.photo_url || data.photoUrl,
            });
          });
        }

        if (type === 'all' || type === 'locations') {
          const locRef = collection(db, 'locations');
          const locQ = query(
            locRef,
            where('name', '>=', searchQuery),
            where('name', '<=', searchQuery + '\uf8ff'),
            limit(10)
          );
          const locSnap = await getDocs(locQ);
          if (cancelled) return;
          locSnap.docs.forEach((d) => {
            const data = d.data();
            allResults.push({
              id: d.id,
              type: 'location',
              name: data.name || 'Local',
              subtitle: `${data.city || ''}`,
              photoUrl: data.photo_url || data.photoUrl,
            });
          });
        }

        if (!cancelled) {
          setResults(allResults);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const debounce = setTimeout(performSearch, 300);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [searchQuery, type]);

  return { results, loading, error };
};
