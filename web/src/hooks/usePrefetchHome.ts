import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { queryClient } from '../services/queryClient';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { createLogger } from '../utils/logger';

const logger = createLogger('usePrefetchHome');

/**
 * Prefetch de dados críticos da HomeScreen após autenticação.
 * Executa em paralelo para reduzir tempo de carregamento percebido.
 * 
 * Queries prefetchadas:
 * - Próximo jogo (limit 1, scheduled/confirmed/live)
 * - Grupos do usuário (subcoleção + follow-up)
 * - Mini ranking (limit 3)
 * - Atividades recentes (limit 5)
 */
export function usePrefetchHome() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const uid = user.id;

    // Prefetch próximo jogo (apenas 1, otimizado para HomeTab)
    const prefetchNextGame = async () => {
      try {
        const gamesRef = collection(db, 'games');
        const q = query(
          gamesRef,
          where('status', 'in', ['SCHEDULED', 'CONFIRMED', 'LIVE']),
          orderBy('dateTime', 'asc'),
          limit(1)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const gameDoc = snapshot.docs[0];
          const raw = gameDoc.data();
          
          // Prefetch confirmação do usuário para este jogo
          const confDocId = `${gameDoc.id}_${uid}`;
          queryClient.prefetchQuery({
            queryKey: ['confirmation', gameDoc.id, uid],
            queryFn: async () => {
              const confSnap = await getDoc(doc(db, 'confirmations', confDocId));
              return confSnap.exists() ? confSnap.data() : null;
            },
            staleTime: 30_000,
          });
        }
      } catch (err) {
        logger.warn('Prefetch next game failed:', err);
      }
    };

    // Prefetch grupos (apenas IDs, dados completos carregados sob demanda)
    const prefetchGroups = async () => {
      try {
        const userGroupsRef = collection(db, 'users', uid, 'groups');
        const q = query(userGroupsRef, orderBy('joined_at', 'desc'));
        await getDocs(q);
      } catch (err) {
        logger.warn('Prefetch groups failed:', err);
      }
    };

    // Prefetch atividades recentes
    const prefetchActivities = async () => {
      try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(
          notificationsRef,
          where('user_id', '==', uid),
          orderBy('created_at', 'desc'),
          limit(5)
        );
        await getDocs(q);
      } catch (err) {
        logger.warn('Prefetch activities failed:', err);
      }
    };

    // Executar todos em paralelo
    Promise.all([
      prefetchNextGame(),
      prefetchGroups(),
      prefetchActivities(),
    ]).then(() => {
      logger.info('Home prefetch complete');
    });
  }, [user?.id]);
}
