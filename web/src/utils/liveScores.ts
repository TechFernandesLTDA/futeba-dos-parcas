/**
 * #3942 — Resolução de placares ao vivo para 2-4 times.
 *
 * O backend passou a gravar `live_scores.scores` como um mapa
 * `{ [teamId]: number }` (suportando 2-4 times), mantendo os campos
 * legados `team1_id`/`team2_id`/`team1_score`/`team2_score` em dual-write.
 *
 * Este módulo é o espelho web de `functions/src/game/helpers.ts readScoresMap()`
 * (leitura do mapa canônico com fallback legado) e também resolve a lista
 * ordenada de placares consumida pela UI (`LiveScoreboard`). Mantendo a
 * leitura aqui (pura e testável) garantimos um único ponto de verdade no web
 * para a normalização, independente de Firestore/React.
 */
import type { Team } from '../types/game';

/**
 * Chave do MUI palette atribuída a cada time por posição (0-3). Todas as
 * variantes existem em light E dark theme, então nenhum hex é hardcoded e o
 * contraste se mantém em ambos os modos (audit: nunca hardcodear cores).
 */
export type TeamPaletteKey = 'primary' | 'secondary' | 'info' | 'warning';

/** Limite superior de times suportados pelo app (CreateGameScreen GAME_VALIDATION.MAX_TEAMS). */
export const MAX_LIVE_TEAMS = 4;

/** Paleta determinística por índice do time (0..MAX-1). */
export const TEAM_PALETTE_KEYS: readonly TeamPaletteKey[] = [
  'primary',
  'secondary',
  'info',
  'warning',
] as const;

/** Placar normalizado de um time para renderização. */
export interface TeamScore {
  teamId: string;
  name: string;
  score: number;
  paletteKey: TeamPaletteKey;
  /** True quando há empate no topo (2+ times lideram com > 0). */
  isTied: boolean;
  /** True quando este time está na liderança (maior placar > 0). */
  isLeader: boolean;
}

function clampScore(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Lê o mapa canônico de placares `scores` de um doc de live_scores.
 *
 * Caminho canônico (#3942): `scores: { [teamId]: n }` presente e não vazio.
 * Fallback legado: reconstitui o mapa a partir de `team1_id`/`team2_id` +
 * `team1_score`/`team2_score` — garante suporte a jogos gravados antes da
 * migração e a jogos LIVE já em andamento no momento do deploy.
 *
 * Espelha `functions/src/game/helpers.ts` e `functions/src/games/live-events.ts
 * readScoresMap()`. Se a regra mudar, sincronize os três locais.
 *
 * @param data Doc bruto de live_scores (snake_case, formato do Firestore).
 * @returns Mapa teamId → placar (sempre definido; pode ser vazio).
 */
export function readScoresMap(
  data?: Record<string, unknown> | null,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!isPlainObject(data)) return map;

  const rawScores = data.scores;
  if (isPlainObject(rawScores)) {
    for (const [teamId, value] of Object.entries(rawScores)) {
      if (typeof teamId === 'string' && teamId.trim().length > 0) {
        map.set(teamId.trim(), clampScore(value));
      }
    }
    if (map.size > 0) return map;
  }

  // Fallback legado: mapa com apenas team1/team2.
  const team1Id = typeof data.team1_id === 'string' ? data.team1_id.trim() : '';
  const team2Id = typeof data.team2_id === 'string' ? data.team2_id.trim() : '';
  if (team1Id) map.set(team1Id, clampScore(data.team1_score));
  if (team2Id) map.set(team2Id, clampScore(data.team2_score));
  return map;
}

export interface BuildTeamScoresInput {
  /** Mapa canônico teamId → placar (ex.: de readScoresMap). Pode ser vazio. */
  scoresMap?: Map<string, number> | null;
  /** Times da collection `teams/{gameId}` (id → metadados). */
  teams?: Record<string, Pick<Team, 'id' | 'name'>>;
  /**
   * IDs de times na ordem canônica legada (ex.: [team1Id, team2Id]).
   * Usado para estabilizar a ordem de exibição mesmo quando o mapa `scores`
   * chega em ordem arbitrária do Firestore.
   */
  seedTeamIds?: ReadonlyArray<string | undefined | null>;
  /** Nomes legados por teamId (ex.: {[team1Id]: game.team1Name}). */
  fallbackNames?: Record<string, string>;
  /** Rótulo gerado para times sem nome conhecido (ex.: "Time 3"). */
  fallbackLabel?: (index: number) => string;
}

/**
 * Resolve a lista ordenada de placares por time (2-4) combinando o mapa
 * canônico de placares, os metadados da collection `teams` e os nomes
 * legados do doc `games`. Ordem determinística:
 *   1. seedTeamIds (team1, team2) — preserva a ordem visual A/B legada;
 *   2. demais teamIds presentes em `scoresMap`;
 *   3. demais teamIds presentes em `teams`.
 *
 * Determina liderança/empate para destaque visual. Retorna no máximo
 * {@link MAX_LIVE_TEAMS} times.
 */
export function buildTeamScores({
  scoresMap,
  teams = {},
  seedTeamIds = [],
  fallbackNames = {},
  fallbackLabel,
}: BuildTeamScoresInput): TeamScore[] {
  const map = scoresMap ?? new Map<string, number>();
  const labelFn = fallbackLabel ?? ((index: number) => `Time ${index + 1}`);

  // 1. Ordem determinística sem duplicatas.
  const ordered: string[] = [];
  const pushIfNew = (id: unknown) => {
    if (typeof id !== 'string') return;
    const trimmed = id.trim();
    if (trimmed && !ordered.includes(trimmed)) ordered.push(trimmed);
  };
  seedTeamIds.forEach(pushIfNew);
  for (const id of map.keys()) pushIfNew(id);
  for (const id of Object.keys(teams)) pushIfNew(id);

  // 2. Limita ao máximo de times suportados.
  const capped = ordered.slice(0, MAX_LIVE_TEAMS);
  if (capped.length === 0) return [];

  // 3. Resolve nome + placar + paleta.
  const resolved = capped.map<TeamScore>((teamId, index) => ({
    teamId,
    name:
      teams[teamId]?.name?.trim() ||
      fallbackNames[teamId]?.trim() ||
      labelFn(index),
    score: map.get(teamId) ?? 0,
    paletteKey: TEAM_PALETTE_KEYS[index] ?? 'primary',
    isTied: false,
    isLeader: false,
  }));

  // 4. Liderança/empate (apenas quando há 2+ times com placar > 0).
  const maxScore = resolved.reduce((max, t) => Math.max(max, t.score), 0);
  if (maxScore > 0) {
    const leaders = resolved.filter((t) => t.score === maxScore);
    const tied = leaders.length >= 2;
    resolved.forEach((t) => {
      t.isLeader = t.score === maxScore;
      t.isTied = tied;
    });
  }

  return resolved;
}
