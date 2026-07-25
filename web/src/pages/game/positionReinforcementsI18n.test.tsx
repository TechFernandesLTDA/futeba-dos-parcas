/**
 * Regressão #3899 — painel de reforço de posições exibia a chave crua
 * "profile.positions.GOLEIRO" em vez de "Goleiro" (e equivalentes em en/es).
 *
 * Causa: PositionReinforcementsPanel.tsx montava t(`profile.positions.${position}`),
 * mas as traduções das 6 posições (PreferredPosition) vivem sob `player.positions.*`
 * nos 3 locales. Chave ausente ⇒ i18next devolve a própria chave (sem
 * parseMissingKeyHandler configurado) — exatamente a string crua que a issue reportou.
 *
 * Este teste renderiza o componente REAL com react-testing-library, sem mockar
 * `react-i18next` — o setup global (`src/test/setup.ts`) inicializa um i18next real
 * com os JSONs de locale reais em pt-BR. Só o hook de dados (`usePositionReinforcements`,
 * que depende de Firestore/Cloud Functions) é mockado. Isso garante que o teste exercita
 * o mesmo call site (`t(\`...${position}\`)`) que causou o bug — ao contrário de uma
 * checagem isolada de chave, que não teria pego uma regressão de prefixo no componente.
 *
 * Verificado manualmente: com `profile.positions.` (prefixo antigo) este teste falha —
 * a tela mostra "Buscando por: profile.positions.GOLEIRO" e o chip mostra a chave crua.
 * Com `player.positions.` (fix) o teste passa.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../test/renderWithProviders';
import { PositionReinforcementsPanel } from './PositionReinforcementsPanel';
import type { Game, GameConfirmation } from '../../types/game';
import type { User } from '../../types/user';
import type { ReinforcementCandidate } from '../../utils/positionReinforcements';

const mockUsePositionReinforcements = vi.hoisted(() => vi.fn());

// Evita a inicialização real do Firebase (services/firebase.ts lança se as env
// vars VITE_FIREBASE_* não estiverem definidas — não é o caso neste worktree de
// teste). O componente só usa firebaseErrors -> errorLogger -> services/firebase
// transitivamente, nunca de fato toca o Firestore neste teste.
vi.mock('../../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
  messagingPromise: Promise.resolve(null),
}));

vi.mock('../../hooks/usePositionReinforcements', () => ({
  usePositionReinforcements: (...args: unknown[]) => mockUsePositionReinforcements(...args),
}));

function buildCandidate(overrides: Partial<ReinforcementCandidate> = {}): ReinforcementCandidate {
  return {
    user: {
      id: 'u1',
      name: 'João Reforço',
      preferredPosition: 'GOLEIRO',
    } as unknown as User,
    need: 'GOALKEEPER',
    isPreferredPositionMatch: true,
    isLookingToday: false,
    hasRecentPresence: false,
    rating: 0,
    score: 0,
    ...overrides,
  };
}

function setHookResult(candidates: ReinforcementCandidate[]) {
  mockUsePositionReinforcements.mockReturnValue({
    candidates,
    loading: false,
    error: null,
    refetch: vi.fn(),
    sendReinforcement: vi.fn(),
    sendingUserId: null,
  });
}

const game = { status: 'SCHEDULED' } as Game;
const confirmations: GameConfirmation[] = [];

describe('PositionReinforcementsPanel — chave de tradução de posições (#3899)', () => {
  it('exibe o texto traduzido da posição no hint de busca, não a chave crua', () => {
    setHookResult([buildCandidate()]);

    renderWithProviders(
      <PositionReinforcementsPanel game={game} confirmations={confirmations} canManage />,
    );

    // Need padrão é GOALKEEPER → getPreferredPositionsForNeed devolve ['GOLEIRO'].
    expect(screen.getByText('Buscando por: Goleiro')).toBeVisible();
    expect(screen.queryByText(/profile\.positions\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/player\.positions\./)).not.toBeInTheDocument();
  });

  it('exibe o texto traduzido da posição no chip de cada candidato, não a chave crua', () => {
    setHookResult([
      buildCandidate({ user: { id: 'u1', name: 'Zagueiro Solto', preferredPosition: 'ZAGUEIRO' } as unknown as User }),
    ]);

    renderWithProviders(
      <PositionReinforcementsPanel game={game} confirmations={confirmations} canManage />,
    );

    expect(screen.getByText('Defensor')).toBeVisible();
    expect(screen.queryByText(/profile\.positions\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/player\.positions\./)).not.toBeInTheDocument();
  });
});
