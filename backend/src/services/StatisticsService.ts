import { AppDataSource } from '../config/database';
import { GameStats } from '../entities/GameStats';
import { UserStatistics } from '../entities/UserStatistics';
import { GameConfirmation, ConfirmationStatus } from '../entities/GameConfirmation';
import { Game, GameStatus } from '../entities/Game';
import { logger } from '../utils/logger';

export class StatisticsService {
  private gameStatsRepository = AppDataSource.getRepository(GameStats);
  private userStatsRepository = AppDataSource.getRepository(UserStatistics);
  private confirmationRepository = AppDataSource.getRepository(GameConfirmation);
  private gameRepository = AppDataSource.getRepository(Game);

  /**
   * Recalcula estatísticas de um usuário após novo jogo
   */
  async recalculateUserStats(userId: string, scheduleId?: string): Promise<void> {
    try {
      // Estatísticas gerais (sem scheduleId)
      await this.calculateAndSaveStats(userId, null);

      // Estatísticas do horário específico
      if (scheduleId) {
        await this.calculateAndSaveStats(userId, scheduleId);
      }

      logger.info(`Statistics recalculated for user ${userId}`);
    } catch (error) {
      logger.error('Error recalculating user stats:', error);
    }
  }

  private async calculateAndSaveStats(userId: string, scheduleId: string | null): Promise<void> {
    const queryBuilder = this.gameStatsRepository
      .createQueryBuilder('stats')
      .leftJoinAndSelect('stats.game', 'game')
      .where('stats.user_id = :userId', { userId });

    if (scheduleId) {
      queryBuilder.andWhere('game.schedule_id = :scheduleId', { scheduleId });
    }

    const allStats = await queryBuilder.getMany();

    const totalGames = new Set(allStats.map((s) => s.game_id)).size;
    const totalGoals = allStats.reduce((sum, s) => sum + s.goals, 0);
    const totalSaves = allStats.reduce((sum, s) => sum + s.saves, 0);
    const bestPlayerCount = allStats.filter((s) => s.is_best_player).length;
    const worstPlayerCount = allStats.filter((s) => s.is_worst_player).length;
    const bestGoalCount = allStats.filter((s) => s.best_goal).length;

    const presenceRate = await this.calculatePresenceRate(userId, scheduleId);

    // Busca estatística existente ou cria nova
    let userStats = await this.userStatsRepository.findOne({
      where: {
        user_id: userId,
        schedule_id: scheduleId as any,
      },
    });

    if (!userStats) {
      userStats = this.userStatsRepository.create({
        user_id: userId,
        schedule_id: scheduleId as any,
      });
    }

    userStats.total_games = totalGames;
    userStats.total_goals = totalGoals;
    userStats.total_saves = totalSaves;
    userStats.best_player_count = bestPlayerCount;
    userStats.worst_player_count = worstPlayerCount;
    userStats.best_goal_count = bestGoalCount;
    userStats.presence_rate = presenceRate;

    await this.userStatsRepository.save(userStats);
  }

  private async calculatePresenceRate(userId: string, scheduleId: string | null): Promise<number> {
    try {
      // Buscar total de jogos disponíveis
      const gamesQueryBuilder = this.gameRepository
        .createQueryBuilder('game')
        .where('game.status = :status', { status: GameStatus.FINISHED });

      if (scheduleId) {
        gamesQueryBuilder.andWhere('game.schedule_id = :scheduleId', { scheduleId });
      }

      const totalGames = await gamesQueryBuilder.getCount();

      if (totalGames === 0) return 0;

      // Buscar confirmações do usuário
      const confirmationsQueryBuilder = this.confirmationRepository
        .createQueryBuilder('confirmation')
        .leftJoin('confirmation.game', 'game')
        .where('confirmation.user_id = :userId', { userId })
        .andWhere('confirmation.status = :status', { status: ConfirmationStatus.CONFIRMED })
        .andWhere('game.status = :gameStatus', { gameStatus: GameStatus.FINISHED });

      if (scheduleId) {
        confirmationsQueryBuilder.andWhere('game.schedule_id = :scheduleId', { scheduleId });
      }

      const confirmedGames = await confirmationsQueryBuilder.getCount();

      return confirmedGames / totalGames;
    } catch (error) {
      logger.error('Error calculating presence rate:', error);
      return 0;
    }
  }

  /**
   * Retorna rankings de um horário/grupo
   */
  async getScheduleRankings(scheduleId: string) {
    const topScorers = await this.userStatsRepository
      .createQueryBuilder('stats')
      .leftJoinAndSelect('stats.user', 'user')
      .where('stats.schedule_id = :scheduleId', { scheduleId })
      .orderBy('stats.total_goals', 'DESC')
      .limit(10)
      .getMany();

    const topGoalkeepers = await this.userStatsRepository
      .createQueryBuilder('stats')
      .leftJoinAndSelect('stats.user', 'user')
      .where('stats.schedule_id = :scheduleId', { scheduleId })
      .andWhere('stats.total_saves > 0')
      .orderBy('stats.total_saves', 'DESC')
      .limit(10)
      .getMany();

    const bestPlayers = await this.userStatsRepository
      .createQueryBuilder('stats')
      .leftJoinAndSelect('stats.user', 'user')
      .where('stats.schedule_id = :scheduleId', { scheduleId })
      .orderBy('stats.best_player_count', 'DESC')
      .limit(10)
      .getMany();

    return {
      top_scorers: topScorers.map((s) => ({
        user: s.user ? { id: s.user.id, name: s.user.name, photo_url: s.user.photo_url } : null,
        total_goals: s.total_goals,
        total_games: s.total_games,
        avg_goals_per_game: s.total_games > 0 ? s.total_goals / s.total_games : 0,
      })),
      top_goalkeepers: topGoalkeepers.map((s) => ({
        user: s.user ? { id: s.user.id, name: s.user.name, photo_url: s.user.photo_url } : null,
        total_saves: s.total_saves,
        total_games: s.total_games,
        avg_saves_per_game: s.total_games > 0 ? s.total_saves / s.total_games : 0,
      })),
      best_players: bestPlayers.map((s) => ({
        user: s.user ? { id: s.user.id, name: s.user.name, photo_url: s.user.photo_url } : null,
        best_player_count: s.best_player_count,
        total_games: s.total_games,
      })),
    };
  }
}
