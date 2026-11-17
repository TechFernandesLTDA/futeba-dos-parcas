/**
 * Regras de marcação de jogo, lista de espera, gestão do jogo e votação pós-jogo.
 *
 * Papéis: dono do jogo, co-organizador, membro comum, visitante e usuário de outro grupo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isGameWaitlistEligible } from '../../pages/game/gameWaitlistEligibility';
import { hasContradictoryVoteSelection } from '../../pages/game/mvpVoteSemantics';
import { canManageGame, isVotingOpen, type Game } from '../../types/game';

const DONO = 'user-owner';
const CO_ORGANIZADOR = 'user-admin';
const MEMBRO = 'user-member';
const VISITANTE = 'user-visitor';

// Fixture mínima de jogo: só os campos lidos pelas funções testadas.
function jogo(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1',
    ownerId: DONO,
    coOrganizers: [CO_ORGANIZADOR],
    status: 'SCHEDULED',
    playersCount: 10,
    maxPlayers: 10,
    votingConcluded: false,
    votingDeadline: undefined,
    ...overrides,
  } as unknown as Game;
}

describe('isGameWaitlistEligible: lista de espera só abre quando o jogo lota', () => {
  it('jogo SCHEDULED lotado aceita entrada na espera', () => {
    expect(isGameWaitlistEligible(jogo({ status: 'SCHEDULED' }), false)).toBe(true);
  });

  it('jogo CONFIRMED lotado aceita entrada na espera', () => {
    expect(isGameWaitlistEligible(jogo({ status: 'CONFIRMED' }), false)).toBe(true);
  });

  it('jogo com vagas sobrando NÃO abre espera', () => {
    expect(isGameWaitlistEligible(jogo({ playersCount: 9, maxPlayers: 10 }), false)).toBe(false);
  });

  it('jogador já confirmado NÃO entra na espera', () => {
    expect(isGameWaitlistEligible(jogo(), true)).toBe(false);
  });

  it('jogo LIVE lotado NÃO aceita espera', () => {
    expect(isGameWaitlistEligible(jogo({ status: 'LIVE' }), false)).toBe(false);
  });

  it('jogo FINISHED ou CANCELLED NÃO aceita espera', () => {
    expect(isGameWaitlistEligible(jogo({ status: 'FINISHED' }), false)).toBe(false);
    expect(isGameWaitlistEligible(jogo({ status: 'CANCELLED' }), false)).toBe(false);
  });

  it('jogo sem limite de vagas (maxPlayers 0) NÃO abre espera', () => {
    expect(isGameWaitlistEligible(jogo({ playersCount: 0, maxPlayers: 0 }), false)).toBe(false);
  });

  it('jogo nulo NÃO abre espera', () => {
    expect(isGameWaitlistEligible(null, false)).toBe(false);
  });
});

describe('hasContradictoryVoteSelection: Bola Murcha não pode coincidir com MVP ou melhor goleiro', () => {
  it('Bola Murcha igual ao MVP é contraditório', () => {
    expect(hasContradictoryVoteSelection('player-a', 'player-b', 'player-a')).toBe(true);
  });

  it('Bola Murcha igual ao melhor goleiro é contraditório', () => {
    expect(hasContradictoryVoteSelection('player-a', 'player-b', 'player-b')).toBe(true);
  });

  it('escolhas distintas não são contraditórias', () => {
    expect(hasContradictoryVoteSelection('player-a', 'player-b', 'player-c')).toBe(false);
  });

  it('sem Bola Murcha escolhido não há contradição', () => {
    expect(hasContradictoryVoteSelection('player-a', 'player-b', '')).toBe(false);
  });
});

describe('isVotingOpen: votação pós-jogo só abre em jogo finalizado e dentro do prazo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('jogo FINISHED sem prazo definido permanece aberto para voto', () => {
    expect(isVotingOpen(jogo({ status: 'FINISHED' }))).toBe(true);
  });

  it('jogo ainda SCHEDULED NÃO aceita voto', () => {
    expect(isVotingOpen(jogo({ status: 'SCHEDULED' }))).toBe(false);
  });

  it('votação já encerrada (votingConcluded) NÃO aceita voto', () => {
    expect(isVotingOpen(jogo({ status: 'FINISHED', votingConcluded: true }))).toBe(false);
  });

  it('voto após o prazo final NÃO é aceito', () => {
    expect(isVotingOpen(jogo({
      status: 'FINISHED',
      votingDeadline: new Date('2026-11-15T12:00:00Z'),
    }))).toBe(false);
  });

  it('voto dentro do prazo final é aceito', () => {
    expect(isVotingOpen(jogo({
      status: 'FINISHED',
      votingDeadline: new Date('2026-11-17T12:00:00Z'),
    }))).toBe(true);
  });
});

describe('canManageGame: quem gerencia o jogo (sem papel global)', () => {
  it('dono do jogo gerencia', () => {
    expect(canManageGame(jogo(), DONO)).toBe(true);
  });

  it('co-organizador gerencia', () => {
    expect(canManageGame(jogo(), CO_ORGANIZADOR)).toBe(true);
  });

  it('membro comum NÃO gerencia o jogo', () => {
    expect(canManageGame(jogo(), MEMBRO)).toBe(false);
  });

  it('visitante sem vínculo NÃO gerencia o jogo', () => {
    expect(canManageGame(jogo(), VISITANTE)).toBe(false);
  });

  // Corrigido (D6): a função agora tolera jogo sem o campo coOrganizers (dado legado),
  // como LiveGameScreen.tsx:95 e GameDetailScreen.tsx:351 já faziam com `?.`.
  it('membro comum sem coOrganizers no documento retorna false, não lança erro', () => {
    const legado = jogo();
    delete (legado as Partial<Game>).coOrganizers;
    expect(canManageGame(legado, MEMBRO)).toBe(false);
  });
});
