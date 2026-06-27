import { describe, expect, it } from 'vitest';
import type { OfficialGroup } from '../types/group';
import {
  buildGroupMatchSuggestion,
  rankOfficialGroupsForMatchmaking,
  type GroupMatchmakingLabels,
} from './groupMatchmaking';

const labels: GroupMatchmakingLabels = {
  officialSuggestion: 'Sugestao oficial',
  regionMatch: 'Regiao compativel',
  scheduleMatch: 'Horario compativel',
  regionCategory: 'Grupo por regiao',
  scheduleCategory: 'Grupo por horario',
  activeCommunity: 'Comunidade ativa',
};

function group(overrides: Partial<OfficialGroup>): OfficialGroup {
  return {
    id: 'g',
    name: 'Grupo',
    description: '',
    category: 'REGIAO',
    icon: '',
    memberCount: 0,
    createdAt: new Date('2026-06-27T12:00:00Z'),
    ...overrides,
  };
}

describe('group matchmaking', () => {
  it('boosts groups that match region text directly', () => {
    const suggestion = buildGroupMatchSuggestion(
      group({ name: 'Mooca Fut 7', description: 'Toda semana na Mooca' }),
      { region: 'mooca', schedule: '' },
      labels
    );

    expect(suggestion.score).toBeGreaterThanOrEqual(75);
    expect(suggestion.reasons).toContain('Regiao compativel');
  });

  it('uses day/time category when text does not match exactly', () => {
    const suggestion = buildGroupMatchSuggestion(
      group({ category: 'DIA_SEMANA', name: 'Pelada noturna' }),
      { region: '', schedule: 'sabado' },
      labels
    );

    expect(suggestion.reasons).toContain('Grupo por horario');
  });

  it('orders best matches before generic official suggestions', () => {
    const ranked = rankOfficialGroupsForMatchmaking(
      [
        group({ id: 'generic', name: 'Aberto Geral', memberCount: 30 }),
        group({ id: 'match', name: 'Sábado na Lapa', description: 'Grupo da Lapa', category: 'DIA_SEMANA' }),
      ],
      { region: 'lapa', schedule: 'sabado' },
      labels
    );

    expect(ranked[0].group.id).toBe('match');
  });
});
