import { UserStatistics } from '../entities/UserStatistics';
import { PlayerCard } from '../entities/PlayerCard';
import { User } from '../entities/User';

interface PlayerWithStats {
  userId: string;
  userName: string;
  attackRating: number;
  defenseRating: number;
  physicalRating: number;
  techniqueRating: number;
  overallRating: number;
  totalGames: number;
  presenceRate: number;
}

interface BalancedTeam {
  teamNumber: number;
  players: PlayerWithStats[];
  totalRating: number;
  avgAttack: number;
  avgDefense: number;
  avgPhysical: number;
  avgTechnique: number;
  overallAverage: number;
}

export class TeamBalancerService {
  /**
   * Algoritmo de sorteio inteligente que equilibra times baseado em estatísticas
   * Utiliza Player Cards (ratings) ou estatísticas históricas
   */
  async balanceTeams(
    confirmedPlayers: string[],
    numberOfTeams: number = 2,
    scheduleId?: string
  ): Promise<BalancedTeam[]> {
    // 1. Buscar dados dos jogadores
    const playersWithStats = await this.getPlayersStats(confirmedPlayers, scheduleId);

    // 2. Ordenar por overall rating (do maior para o menor)
    playersWithStats.sort((a, b) => b.overallRating - a.overallRating);

    // 3. Aplicar algoritmo de distribuição balanceada (Snake Draft)
    const teams = this.snakeDraft(playersWithStats, numberOfTeams);

    // 4. Calcular médias de cada time
    return teams.map((team, index) => this.calculateTeamStats(team, index + 1));
  }

  /**
   * Busca estatísticas e ratings dos jogadores
   */
  private async getPlayersStats(
    playerIds: string[],
    scheduleId?: string
  ): Promise<PlayerWithStats[]> {
    // Implementação simplificada - você deve buscar do banco
    // Este é um exemplo de estrutura
    const playersWithStats: PlayerWithStats[] = [];

    for (const userId of playerIds) {
      // Tentar buscar Player Card primeiro (mais preciso)
      let playerCard: any = null; // await PlayerCard.findOne({ user_id: userId })

      // Se não tiver card, usar estatísticas gerais
      let stats: any = null; // await UserStatistics.findOne({ user_id: userId, schedule_id: scheduleId })

      const rating = this.calculateRating(playerCard, stats);

      playersWithStats.push({
        userId,
        userName: `Player ${userId.substring(0, 8)}`, // Substituir por nome real
        ...rating,
      });
    }

    return playersWithStats;
  }

  /**
   * Calcula ratings baseado em Player Card ou estatísticas
   */
  private calculateRating(
    playerCard: any | null,
    stats: any | null
  ): Omit<PlayerWithStats, 'userId' | 'userName'> {
    // Se tem Player Card, usar os ratings dele
    if (playerCard) {
      return {
        attackRating: playerCard.attack_rating,
        defenseRating: playerCard.defense_rating,
        physicalRating: playerCard.physical_rating,
        techniqueRating: playerCard.technique_rating,
        overallRating: playerCard.overall_rating,
        totalGames: playerCard.total_games,
        presenceRate: 1.0,
      };
    }

    // Caso contrário, calcular baseado em estatísticas
    if (stats) {
      const attackRating = this.normalizeToRating(stats.total_goals, stats.total_games, 'attack');
      const defenseRating = this.normalizeToRating(stats.total_saves, stats.total_games, 'defense');
      const physicalRating = this.calculatePhysicalRating(stats);
      const techniqueRating = this.calculateTechniqueRating(stats);

      return {
        attackRating,
        defenseRating,
        physicalRating,
        techniqueRating,
        overallRating: Math.round((attackRating + defenseRating + physicalRating + techniqueRating) / 4),
        totalGames: stats.total_games,
        presenceRate: stats.presence_rate,
      };
    }

    // Jogador novo - rating padrão médio
    return {
      attackRating: 50,
      defenseRating: 50,
      physicalRating: 50,
      techniqueRating: 50,
      overallRating: 50,
      totalGames: 0,
      presenceRate: 0,
    };
  }

  /**
   * Normaliza estatística para rating 0-99
   */
  private normalizeToRating(value: number, games: number, type: 'attack' | 'defense'): number {
    if (games === 0) return 50;

    const avg = value / games;

    // Diferentes escalas para ataque e defesa
    const maxAvg = type === 'attack' ? 2.0 : 3.0; // 2 gols/jogo = 99, 3 defesas/jogo = 99
    const rating = Math.min((avg / maxAvg) * 99, 99);

    return Math.round(rating);
  }

  /**
   * Calcula rating físico baseado em presença e jogos
   */
  private calculatePhysicalRating(stats: any): number {
    const presenceFactor = stats.presence_rate * 50; // Até 50 pontos
    const experienceFactor = Math.min((stats.total_games / 100) * 50, 50); // Até 50 pontos

    return Math.round(presenceFactor + experienceFactor);
  }

  /**
   * Calcula rating de técnica baseado em MVPs e melhores gols
   */
  private calculateTechniqueRating(stats: any): number {
    const mvpFactor = Math.min((stats.best_player_count / 10) * 50, 50);
    const bestGoalFactor = Math.min((stats.best_goal_count / 5) * 50, 50);

    return Math.round((mvpFactor + bestGoalFactor) / 2);
  }

  /**
   * Snake Draft: distribui jogadores alternando ordem para equilibrar
   * Exemplo 4 jogadores, 2 times:
   * Time 1: Jogador 1 (melhor), Jogador 4
   * Time 2: Jogador 2, Jogador 3
   */
  private snakeDraft(players: PlayerWithStats[], numberOfTeams: number): PlayerWithStats[][] {
    const teams: PlayerWithStats[][] = Array.from({ length: numberOfTeams }, () => []);

    let currentTeam = 0;
    let direction = 1; // 1 = forward, -1 = backward

    for (const player of players) {
      teams[currentTeam].push(player);

      // Alternar direção quando chegar no fim
      if (currentTeam === numberOfTeams - 1 && direction === 1) {
        direction = -1;
      } else if (currentTeam === 0 && direction === -1) {
        direction = 1;
      } else {
        currentTeam += direction;
      }
    }

    return teams;
  }

  /**
   * Calcula estatísticas agregadas do time
   */
  private calculateTeamStats(players: PlayerWithStats[], teamNumber: number): BalancedTeam {
    const totalPlayers = players.length;

    if (totalPlayers === 0) {
      return {
        teamNumber,
        players: [],
        totalRating: 0,
        avgAttack: 0,
        avgDefense: 0,
        avgPhysical: 0,
        avgTechnique: 0,
        overallAverage: 0,
      };
    }

    const totals = players.reduce(
      (acc, player) => ({
        attack: acc.attack + player.attackRating,
        defense: acc.defense + player.defenseRating,
        physical: acc.physical + player.physicalRating,
        technique: acc.technique + player.techniqueRating,
        overall: acc.overall + player.overallRating,
      }),
      { attack: 0, defense: 0, physical: 0, technique: 0, overall: 0 }
    );

    return {
      teamNumber,
      players,
      totalRating: totals.overall,
      avgAttack: Math.round(totals.attack / totalPlayers),
      avgDefense: Math.round(totals.defense / totalPlayers),
      avgPhysical: Math.round(totals.physical / totalPlayers),
      avgTechnique: Math.round(totals.technique / totalPlayers),
      overallAverage: Math.round(totals.overall / totalPlayers),
    };
  }

  /**
   * Valida se os times estão balanceados (diferença máxima de 5 pontos)
   */
  validateBalance(teams: BalancedTeam[]): { isBalanced: boolean; maxDifference: number } {
    const overallAverages = teams.map(t => t.overallAverage);
    const max = Math.max(...overallAverages);
    const min = Math.min(...overallAverages);
    const maxDifference = max - min;

    return {
      isBalanced: maxDifference <= 5,
      maxDifference,
    };
  }

  /**
   * Algoritmo alternativo: Genetic Algorithm para melhor balanceamento
   * Mais lento mas mais preciso - usar para grupos pequenos (até 20 jogadores)
   */
  async geneticBalance(
    players: PlayerWithStats[],
    numberOfTeams: number,
    maxIterations: number = 1000
  ): Promise<BalancedTeam[]> {
    let bestSolution = this.snakeDraft(players, numberOfTeams);
    let bestScore = this.calculateBalanceScore(bestSolution);

    for (let i = 0; i < maxIterations; i++) {
      // Gerar nova solução com mutação
      const newSolution = this.mutateTeams(bestSolution);
      const newScore = this.calculateBalanceScore(newSolution);

      // Se a nova solução é melhor, adotar
      if (newScore < bestScore) {
        bestSolution = newSolution;
        bestScore = newScore;
      }
    }

    return bestSolution.map((team, index) => this.calculateTeamStats(team, index + 1));
  }

  /**
   * Calcula score de desbalanceamento (quanto menor, melhor)
   */
  private calculateBalanceScore(teams: PlayerWithStats[][]): number {
    const teamStats = teams.map((team, i) => this.calculateTeamStats(team, i + 1));
    const avgRatings = teamStats.map(t => t.overallAverage);

    const mean = avgRatings.reduce((a, b) => a + b, 0) / avgRatings.length;
    const variance = avgRatings.reduce((sum, rating) => sum + Math.pow(rating - mean, 2), 0);

    return variance;
  }

  /**
   * Mutação: troca 2 jogadores aleatórios entre times
   */
  private mutateTeams(teams: PlayerWithStats[][]): PlayerWithStats[][] {
    const newTeams = teams.map(team => [...team]);

    // Selecionar 2 times aleatórios
    const team1Index = Math.floor(Math.random() * newTeams.length);
    let team2Index = Math.floor(Math.random() * newTeams.length);
    while (team2Index === team1Index) {
      team2Index = Math.floor(Math.random() * newTeams.length);
    }

    // Selecionar jogador aleatório de cada time
    const player1Index = Math.floor(Math.random() * newTeams[team1Index].length);
    const player2Index = Math.floor(Math.random() * newTeams[team2Index].length);

    // Trocar jogadores
    const temp = newTeams[team1Index][player1Index];
    newTeams[team1Index][player1Index] = newTeams[team2Index][player2Index];
    newTeams[team2Index][player2Index] = temp;

    return newTeams;
  }
}
