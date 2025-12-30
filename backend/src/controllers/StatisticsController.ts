import { Response } from 'express';
import { IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { UserStatistics } from '../entities/UserStatistics';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ApiResponse } from '../utils/api-response';
import { logger } from '../utils/logger';
import { StatisticsService } from '../services/StatisticsService';

export class StatisticsController {
  private userStatsRepository = AppDataSource.getRepository(UserStatistics);
  private statisticsService = new StatisticsService();

  getMyStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;

      // Estatísticas gerais
      const overall = await this.userStatsRepository.findOne({
        where: { user_id: userId, schedule_id: IsNull() },
      });

      // Estatísticas por horário
      const bySchedule = await this.userStatsRepository.find({
        where: { user_id: userId },
        relations: ['schedule'],
      });

      const byScheduleFiltered = bySchedule.filter((s) => s.schedule_id !== null);

      ApiResponse.success(res, {
        overall: overall
          ? {
              total_games: overall.total_games,
              total_goals: overall.total_goals,
              total_saves: overall.total_saves,
              best_player_count: overall.best_player_count,
              worst_player_count: overall.worst_player_count,
              best_goal_count: overall.best_goal_count,
              presence_rate: overall.presence_rate,
              avg_goals_per_game:
                overall.total_games > 0
                  ? overall.total_goals / overall.total_games
                  : 0,
            }
          : null,
        by_schedule: byScheduleFiltered.map((s) => ({
          schedule: s.schedule
            ? {
                id: s.schedule.id,
                name: s.schedule.name,
              }
            : null,
          total_games: s.total_games,
          total_goals: s.total_goals,
          total_saves: s.total_saves,
          presence_rate: s.presence_rate,
          avg_goals_per_game:
            s.total_games > 0 ? s.total_goals / s.total_games : 0,
        })),
      });
    } catch (error) {
      logger.error('Error in getMyStats:', error);
      ApiResponse.internalError(res);
    }
  };

  getUserStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      const overall = await this.userStatsRepository.findOne({
        where: { user_id: userId, schedule_id: IsNull() },
        relations: ['user'],
      });

      if (!overall) {
        ApiResponse.success(res, {
          user: null,
          stats: null,
        });
        return;
      }

      ApiResponse.success(res, {
        user: overall.user
          ? {
              id: overall.user.id,
              name: overall.user.name,
              photo_url: overall.user.photo_url,
            }
          : null,
        stats: {
          total_games: overall.total_games,
          total_goals: overall.total_goals,
          total_saves: overall.total_saves,
          best_player_count: overall.best_player_count,
          worst_player_count: overall.worst_player_count,
          best_goal_count: overall.best_goal_count,
          presence_rate: overall.presence_rate,
          avg_goals_per_game:
            overall.total_games > 0
              ? overall.total_goals / overall.total_games
              : 0,
        },
      });
    } catch (error) {
      logger.error('Error in getUserStats:', error);
      ApiResponse.internalError(res);
    }
  };

  getScheduleStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { scheduleId } = req.params;

      const stats = await this.userStatsRepository.find({
        where: { schedule_id: scheduleId },
        relations: ['user'],
        order: { total_games: 'DESC' },
      });

      const totalGamesPlayed = stats.reduce((sum, s) => sum + s.total_games, 0);
      const totalGoalsScored = stats.reduce((sum, s) => sum + s.total_goals, 0);

      ApiResponse.success(res, {
        general_stats: {
          total_players: stats.length,
          total_games_played: totalGamesPlayed,
          total_goals_scored: totalGoalsScored,
          avg_goals_per_game:
            totalGamesPlayed > 0 ? totalGoalsScored / totalGamesPlayed : 0,
        },
        players: stats.map((s) => ({
          user: s.user
            ? {
                id: s.user.id,
                name: s.user.name,
                photo_url: s.user.photo_url,
              }
            : null,
          total_games: s.total_games,
          total_goals: s.total_goals,
          total_saves: s.total_saves,
          best_player_count: s.best_player_count,
          presence_rate: s.presence_rate,
        })),
      });
    } catch (error) {
      logger.error('Error in getScheduleStats:', error);
      ApiResponse.internalError(res);
    }
  };

  getScheduleRankings = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { scheduleId } = req.params;

      const rankings = await this.statisticsService.getScheduleRankings(scheduleId);

      ApiResponse.success(res, rankings);
    } catch (error) {
      logger.error('Error in getScheduleRankings:', error);
      ApiResponse.internalError(res);
    }
  };
}
