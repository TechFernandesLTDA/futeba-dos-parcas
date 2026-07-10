import { useQuery } from '@tanstack/react-query';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Season } from '../types/gamification';
import { createLogger } from '../utils/logger';

const logger = createLogger('useSeasons');

export function useSeasons(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { data: seasons = [], isLoading: loading, error } = useQuery<Season[], Error>({
    queryKey: ['seasons'],
    queryFn: async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'seasons'), orderBy('start_date', 'desc'))
        );
        return snap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            name: (d.name as string) || 'Temporada',
            startDate: (d.start_date as string) || '',
            endDate: (d.end_date as string) || '',
            isActive: (d.is_active ?? d.isActive) as boolean,
            scheduleId: (d.schedule_id as string) || undefined,
            createdAt: d.created_at?.toDate?.() ?? undefined,
            closedAt: d.closed_at?.toDate?.() ?? undefined,
          };
        });
      } catch (err) {
        logger.error('Error fetching seasons:', err);
        throw err;
      }
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    enabled,
  });

  return { seasons, loading, error };
}
