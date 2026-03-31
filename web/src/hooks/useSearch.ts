import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface SearchResult {
  id: string;
  type: 'user' | 'group' | 'game' | 'location';
  name: string;
  subtitle: string;
  photoUrl?: string;
}

export const useSearch = (searchQuery: string, type: 'all' | 'users' | 'groups' | 'games' = 'all') => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

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

        setResults(allResults);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, type]);

  return { results, loading, error };
};
