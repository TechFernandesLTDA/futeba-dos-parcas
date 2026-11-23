import { useQuery } from '@tanstack/react-query';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { createLogger } from '../utils/logger';

const logger = createLogger('useGroupFinishedGameCounts');

/**
 * Quantos jogos finalizados cada grupo tem, contados no servidor.
 *
 * O campo `total_games_played` do grupo não é atualizado por nenhuma função
 * (#4629, item 13), por isso o card mostrava "0 jogos" para grupo com 13.
 * A contagem custa uma leitura por grupo (até 1000 jogos) e usa só igualdades,
 * sem índice composto. A regra de LIST de `games` aceita a consulta para quem é
 * membro do grupo (`isGroupMember(resource.data.group_id)`).
 *
 * Grupo cuja contagem falhou fica fora do mapa: a tela esconde o número em vez
 * de mostrar 0.
 */
export function useGroupFinishedGameCounts(groupIds: string[]) {
  const ids = [...new Set(groupIds)].sort();
  return useQuery({
    queryKey: ['groupFinishedGameCounts', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const entries = await Promise.all(
        ids.map(async (groupId) => {
          try {
            const snap = await getCountFromServer(
              query(
                collection(db, 'games'),
                where('group_id', '==', groupId),
                where('status', '==', 'FINISHED'),
              ),
            );
            return [groupId, snap.data().count] as const;
          } catch (err) {
            // Falha num grupo não derruba os outros; o card só não mostra o número.
            logger.warn('Falha ao contar jogos do grupo:', err);
            return null;
          }
        }),
      );
      const counts: Record<string, number> = {};
      for (const entry of entries) {
        if (entry) counts[entry[0]] = entry[1];
      }
      return counts;
    },
  });
}
