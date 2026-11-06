/**
 * Sorteio equilibrado de times na Web (`SNAKE_DRAFT` ou `GREEDY` + Otimização por Trocas).
 *
 * ### Regras e Algoritmos:
 * 1. **Goleiros (`distributeGoalkeepers`)**: Ordenados por `level` decrescente e alocados
 *    em round-robin respeitando `goalkeepersPerTeam`; goleiros excedentes vão para o time
 *    com menos jogadores.
 * 2. **Jogadores de Linha** (ordenados por `level` decrescente):
 *    - `SNAKE_DRAFT` (padrão): distribuição em serpentina (`0..N-1` nas rodadas pares,
 *      `N-1..0` nas rodadas ímpares).
 *    - `GREEDY`: cada jogador é alocado ao time com menor soma total de `level` no momento.
 * 3. **Refinamento Local (`optimizeBalance`)**: Até `MAX_OPTIMIZE_ITERATIONS` (100) trocas
 *    1-para-1 de jogadores de linha entre o time de maior média e o de menor média enquanto
 *    houver troca que reduza a diferença de média (`diff >= 0.1`).
 * 4. **Critério de Equilíbrio (`balanceScore`)**: Coeficiente de variação (`stdDev / mean * 100`)
 *    das médias dos times; considerado equilibrado quando `balanceScore < 5`.
 */
export type DrawStrategy = 'SNAKE_DRAFT' | 'GREEDY';

export interface PlayerForDraw {
  id: string;
  name: string;
  photoUrl?: string;
  level: number;
  position: 'GOALKEEPER' | 'FIELD';
}

export interface DrawTeam {
  index: number;
  name: string;
  players: PlayerForDraw[];
  averageRating: number;
  totalRating: number;
}

export interface BalancedDrawResult {
  teams: DrawTeam[];
  balanceScore: number;
  strategy: DrawStrategy;
  isBalanced: boolean;
}

const MAX_OPTIMIZE_ITERATIONS = 100;

export function balancedDraw(
  players: PlayerForDraw[],
  numberOfTeams: number = 2,
  goalkeepersPerTeam: number = 1,
  strategy: DrawStrategy = 'SNAKE_DRAFT'
): BalancedDrawResult {
  if (players.length === 0) {
    const emptyTeams: DrawTeam[] = Array.from({ length: numberOfTeams }, (_, i) => ({
      index: i,
      name: `Time ${String.fromCharCode(65 + i)}`,
      players: [],
      averageRating: 0,
      totalRating: 0,
    }));
    return { teams: emptyTeams, balanceScore: 0, strategy, isBalanced: true };
  }

  const goalkeepers = players
    .filter((p) => p.position === 'GOALKEEPER')
    .sort((a, b) => b.level - a.level);
  const linePlayers = players
    .filter((p) => p.position !== 'GOALKEEPER')
    .sort((a, b) => b.level - a.level);

  const teamSlots: PlayerForDraw[][] = Array.from({ length: numberOfTeams }, () => []);

  distributeGoalkeepers(goalkeepers, teamSlots, goalkeepersPerTeam);

  if (strategy === 'SNAKE_DRAFT') {
    distributeSnakeDraft(linePlayers, teamSlots);
  } else {
    distributeGreedy(linePlayers, teamSlots);
  }

  optimizeBalance(teamSlots);

  const teams: DrawTeam[] = teamSlots.map((teamPlayers, index) => {
    const total = teamPlayers.reduce((sum, p) => sum + p.level, 0);
    const avg = teamPlayers.length > 0 ? total / teamPlayers.length : 0;
    return {
      index,
      name: `Time ${String.fromCharCode(65 + index)}`,
      players: [...teamPlayers],
      averageRating: avg,
      totalRating: total,
    };
  });

  const balanceScore = calculateBalanceScore(teams);

  return {
    teams,
    balanceScore,
    strategy,
    isBalanced: balanceScore < 5,
  };
}

function distributeGoalkeepers(
  goalkeepers: PlayerForDraw[],
  teamSlots: PlayerForDraw[][],
  minPerTeam: number
): void {
  const numTeams = teamSlots.length;
  let teamIndex = 0;

  for (const gk of goalkeepers) {
    const gkCountInTeam = teamSlots[teamIndex].filter((p) => p.position === 'GOALKEEPER').length;

    if (gkCountInTeam < minPerTeam) {
      teamSlots[teamIndex].push(gk);
    } else {
      let placed = false;
      for (let i = 0; i < numTeams; i++) {
        const candidateIdx = (teamIndex + 1 + i) % numTeams;
        const gkCount = teamSlots[candidateIdx].filter((p) => p.position === 'GOALKEEPER').length;
        if (gkCount < minPerTeam) {
          teamSlots[candidateIdx].push(gk);
          teamIndex = candidateIdx;
          placed = true;
          break;
        }
      }
      if (!placed) {
        const smallestTeam = teamSlots.reduce(
          (minIdx, slot, idx) => (slot.length < teamSlots[minIdx].length ? idx : minIdx),
          0
        );
        teamSlots[smallestTeam].push(gk);
      }
    }
    teamIndex = (teamIndex + 1) % numTeams;
  }
}

function distributeSnakeDraft(players: PlayerForDraw[], teamSlots: PlayerForDraw[][]): void {
  const numTeams = teamSlots.length;

  players.forEach((player, index) => {
    const round = Math.floor(index / numTeams);
    const pickInRound = index % numTeams;

    const targetTeam = round % 2 === 0 ? pickInRound : numTeams - 1 - pickInRound;
    teamSlots[targetTeam].push(player);
  });
}

function distributeGreedy(players: PlayerForDraw[], teamSlots: PlayerForDraw[][]): void {
  for (const player of players) {
    let minTotal = Infinity;
    let targetTeam = 0;

    for (let i = 0; i < teamSlots.length; i++) {
      const total = teamSlots[i].reduce((sum, p) => sum + p.level, 0);
      if (total < minTotal) {
        minTotal = total;
        targetTeam = i;
      }
    }

    teamSlots[targetTeam].push(player);
  }
}

function optimizeBalance(teamSlots: PlayerForDraw[][]): void {
  const numTeams = teamSlots.length;
  if (numTeams < 2) return;

  for (let iter = 0; iter < MAX_OPTIMIZE_ITERATIONS; iter++) {
    const ratings = teamSlots.map((slot) => {
      if (slot.length === 0) return 0;
      return slot.reduce((sum, p) => sum + p.level, 0) / slot.length;
    });

    let maxIdx = 0;
    let minIdx = 0;
    for (let i = 1; i < ratings.length; i++) {
      if (ratings[i] > ratings[maxIdx]) maxIdx = i;
      if (ratings[i] < ratings[minIdx]) minIdx = i;
    }

    if (maxIdx === minIdx) return;

    const diff = ratings[maxIdx] - ratings[minIdx];
    if (diff < 0.1) return;

    const swap = findBestSwap(teamSlots[maxIdx], teamSlots[minIdx], diff);
    if (swap) {
      const [fromMax, fromMin] = swap;

      const maxRemoveIdx = teamSlots[maxIdx].findIndex((p) => p.id === fromMax.id);
      const minRemoveIdx = teamSlots[minIdx].findIndex((p) => p.id === fromMin.id);

      teamSlots[maxIdx].splice(maxRemoveIdx, 1);
      teamSlots[minIdx].splice(minRemoveIdx, 1);
      teamSlots[maxIdx].push(fromMin);
      teamSlots[minIdx].push(fromMax);
    } else {
      return;
    }
  }
}

function findBestSwap(
  higherTeam: PlayerForDraw[],
  lowerTeam: PlayerForDraw[],
  targetDiff: number
): [PlayerForDraw, PlayerForDraw] | null {
  let bestSwap: [PlayerForDraw, PlayerForDraw] | null = null;
  let bestImprovement = 0;

  const higherLine = higherTeam.filter((p) => p.position !== 'GOALKEEPER');
  const lowerLine = lowerTeam.filter((p) => p.position !== 'GOALKEEPER');

  for (const higher of higherLine) {
    for (const lower of lowerLine) {
      const ratingDiff = higher.level - lower.level;
      if (ratingDiff > 0 && ratingDiff < targetDiff) {
        const improvement = targetDiff - Math.abs(targetDiff - 2 * ratingDiff);
        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestSwap = [higher, lower];
        }
      }
    }
  }

  return bestSwap;
}

function calculateBalanceScore(teams: DrawTeam[]): number {
  if (teams.length < 2) return 0;

  const ratings = teams.map((t) => t.averageRating);
  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  if (mean === 0) return 0;

  const variance = ratings.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratings.length;
  const stdDev = Math.sqrt(variance);

  return (stdDev / mean) * 100;
}
