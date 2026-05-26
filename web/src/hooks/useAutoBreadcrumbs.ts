import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import type { BreadcrumbItem } from '../components/layout/AppBreadcrumbs';

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Início',
  '/games': 'Jogos',
  '/groups': 'Grupos',
  '/league': 'Liga',
  '/badges': 'Badges',
  '/profile': 'Perfil',
  '/settings': 'Configurações',
  '/statistics': 'Estatísticas',
  '/notifications': 'Notificações',
  '/search': 'Busca',
  '/about': 'Sobre',
  '/whats-new': 'Novidades',
  '/locations': 'Locais',
  '/map': 'Mapa',
  '/public-games': 'Jogos Públicos',
  '/invite-friend': 'Convidar Amigo',
  '/dream-team': 'Seleção dos Sonhos',
  '/weekly-ranking': 'Ranking Semanal',
  '/weekly-recap': 'Resumo Semanal',
  '/evolution': 'Evolução',
  '/head-to-head': 'Confronto Direto',
};

const DYNAMIC_LABELS: Record<string, string> = {
  'game': 'Jogo',
  'group': 'Grupo',
  'location': 'Local',
  'player': 'Jogador',
  'user': 'Usuário',
  'profile': 'Perfil',
};

const SUB_ROUTE_LABELS: Record<string, string> = {
  'edit': 'Editar',
  'create': 'Criar',
  'settings': 'Configurações',
  'cashbox': 'Caixinha',
  'players': 'Jogadores',
  'schedules': 'Horários',
  'invite': 'Convidar',
  'league': 'Liga',
  'challenges': 'Desafios',
  'live': 'Ao Vivo',
  'vote': 'Votação MVP',
  'results': 'Resultados',
  'teams': 'Formação de Times',
  'report': 'Relatório',
  'blocked': 'Bloqueados',
  'stats': 'Estatísticas',
  'events': 'Eventos',
  'theme': 'Tema',
  'notifications': 'Notificações',
  'gamification': 'Gamificação',
  'feedbacks': 'Feedbacks',
  'verify': 'Verificar',
  'owner': 'Proprietário',
  'discover': 'Descobrir',
  'map': 'Mapa',
};

export function useAutoBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();

  return useMemo(() => {
    const pathname = location.pathname;
    if (pathname === '/' || pathname === '') return [];

    const segments = pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [];
    let accumulatedPath = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      accumulatedPath += `/${segment}`;

      // Check if this segment looks like an ID (Firebase IDs are long alphanumeric)
      const isId = /^[a-zA-Z0-9_-]{10,}$/.test(segment);

      if (isId && i > 0) {
        // Use the previous segment's label + the ID as a shortened display
        const parentSegment = segments[i - 1];
        const parentLabel = DYNAMIC_LABELS[parentSegment] || parentSegment;
        items.push({
          label: `${parentLabel}`,
          to: accumulatedPath,
        });
      } else if (SUB_ROUTE_LABELS[segment]) {
        items.push({
          label: SUB_ROUTE_LABELS[segment],
          to: accumulatedPath,
        });
      } else if (ROUTE_LABELS[accumulatedPath]) {
        items.push({
          label: ROUTE_LABELS[accumulatedPath],
          to: accumulatedPath,
        });
      } else if (DYNAMIC_LABELS[segment]) {
        items.push({
          label: DYNAMIC_LABELS[segment],
          to: accumulatedPath,
        });
      }
    }

    return items;
  }, [location.pathname]);
}
