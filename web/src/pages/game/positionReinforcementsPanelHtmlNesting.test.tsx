/**
 * Regressão #3913 — PositionReinforcementsPanel gerava HTML inválido: o `secondary`
 * do ListItemText é sempre embrulhado pelo MUI num `<Typography variant="body2">`
 * (ListItemText.js) e, sem `component` explícito, `body2` mapeia para `<p>`
 * (defaultVariantMapping em Typography.js). O componente passava um `<Stack>` com
 * `<Chip>`s (ambos renderizam `<div>`) direto para `secondary` — resultando em
 * `<div>` dentro de `<p>`, HTML inválido que o React reporta como erro no console
 * (`validateDOMNesting`).
 *
 * Este teste renderiza o componente REAL com react-testing-library (mesmo padrão do
 * #3899 em positionReinforcementsI18n.test.tsx) e inspeciona a estrutura do DOM
 * resultante diretamente — nenhum `<p>` pode conter `<div>`/`<ul>`/`<li>` como
 * descendente. É uma asserção sobre o resultado observável (nós do DOM), não sobre a
 * string do warning do React, que é mais frágil a mudanças de versão.
 *
 * Verificado manualmente: sem `secondaryTypographyProps={{ component: 'div' }}` no
 * ListItemText (L182-203 do componente), este teste falha — o candidato com todos os
 * campos preenchidos (1 Stack + 5 Chips) produz 6 `<div>`s dentro de um `<p>`. Com o
 * fix, o `secondary` é embrulhado num `<div>` em vez de `<p>` e o teste passa.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../test/renderWithProviders';
import { PositionReinforcementsPanel } from './PositionReinforcementsPanel';
import type { Game, GameConfirmation } from '../../types/game';
import type { User } from '../../types/user';
import type { ReinforcementCandidate } from '../../utils/positionReinforcements';

const mockUsePositionReinforcements = vi.hoisted(() => vi.fn());

// Mesmo racional do #3899: evita a inicialização real do Firebase (services/firebase.ts
// lança se as env vars VITE_FIREBASE_* não estiverem definidas neste worktree de teste).
vi.mock('../../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
  messagingPromise: Promise.resolve(null),
}));

vi.mock('../../hooks/usePositionReinforcements', () => ({
  usePositionReinforcements: (...args: unknown[]) => mockUsePositionReinforcements(...args),
}));

// Candidato com TODOS os campos condicionais preenchidos — pior caso: 1 Stack +
// 5 Chips dentro do secondary, o cenário que mais elementos de bloco produz.
function buildFullCandidate(): ReinforcementCandidate {
  return {
    user: {
      id: 'u1',
      name: 'João Reforço Completo',
      preferredPosition: 'GOLEIRO',
    } as unknown as User,
    need: 'GOALKEEPER',
    isPreferredPositionMatch: true,
    isLookingToday: true,
    hasRecentPresence: true,
    rating: 4.5,
    score: 0,
  };
}

const game = { status: 'SCHEDULED' } as Game;
const confirmations: GameConfirmation[] = [];

describe('PositionReinforcementsPanel — aninhamento de HTML válido (#3913)', () => {
  it('não renderiza <div> (Stack/Chip) dentro de <p> (ListItemText secondary)', () => {
    mockUsePositionReinforcements.mockReturnValue({
      candidates: [buildFullCandidate()],
      loading: false,
      error: null,
      refetch: vi.fn(),
      sendReinforcement: vi.fn(),
      sendingUserId: null,
    });

    const { container } = renderWithProviders(
      <PositionReinforcementsPanel game={game} confirmations={confirmations} canManage />,
    );

    // Garante que o cenário de fato exercitou o Stack de chips (senão o teste
    // passaria trivialmente por não ter renderizado nada). "Goleiro" aparece tanto
    // no hint de busca quanto no chip, por isso getAllByText.
    expect(screen.getAllByText('Goleiro').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.MuiChip-root').length).toBe(5);
    expect(container.querySelectorAll('.MuiStack-root').length).toBeGreaterThan(0);

    const paragraphs = Array.from(container.querySelectorAll('p'));
    expect(paragraphs.length).toBeGreaterThan(0);

    const invalidDescendants = paragraphs.flatMap((p) =>
      Array.from(p.querySelectorAll('div, ul, li, table, form')),
    );

    expect(invalidDescendants).toHaveLength(0);
  });
});
