import { Response } from 'express';
import { MoreThanOrEqual, In } from 'typeorm';
import moment from 'moment';
import { AppDataSource } from '../config/database';
import { Game, GameStatus } from '../entities/Game';
import { GameConfirmation, ConfirmationStatus } from '../entities/GameConfirmation';
import { Team } from '../entities/Team';
import { TeamPlayer } from '../entities/TeamPlayer';
import { GameStats } from '../entities/GameStats';
import { PlayerScheduleMembership, MembershipStatus } from '../entities/PlayerScheduleMembership';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ApiResponse } from '../utils/api-response';
import { logger } from '../utils/logger';
import { StatisticsService } from '../services/StatisticsService';

export class GameController {
  private gameRepository = AppDataSource.getRepository(Game);
  private confirmationRepository = AppDataSource.getRepository(GameConfirmation);
  private teamRepository = AppDataSource.getRepository(Team);
  private teamPlayerRepository = AppDataSource.getRepository(TeamPlayer);
  private gameStatsRepository = AppDataSource.getRepository(GameStats);
  private membershipRepository = AppDataSource.getRepository(PlayerScheduleMembership);

  getUpcoming = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const today = moment().startOf('day').toDate();

      // Buscar horários do usuário (dono ou membro)
      const memberships = await this.membershipRepository.find({
        where: { user_id: userId, status: MembershipStatus.ACTIVE },
        relations: ['schedule'],
      });

      const scheduleIds = memberships.map((m) => m.schedule_id);

      // Buscar horários que é dono
      const ownedSchedules = await AppDataSource.getRepository('Schedule').find({
        where: { owner_id: userId },
      });

      const allScheduleIds = [
        ...new Set([...scheduleIds, ...ownedSchedules.map((s: any) => s.id)]),
      ];

      if (allScheduleIds.length === 0) {
        ApiResponse.success(res, []);
        return;
      }

      const games = await this.gameRepository.find({
        where: {
          schedule_id: In(allScheduleIds),
          date: MoreThanOrEqual(today),
          status: In([GameStatus.SCHEDULED, GameStatus.CONFIRMED]),
        },
        relations: [
          'schedule',
          'schedule.field',
          'schedule.field.location',
          'confirmations',
          'confirmations.user',
        ],
        order: { date: 'ASC', time: 'ASC' },
        take: 20,
      });

      // Adicionar informação de confirmação do usuário
      const gamesWithUserConfirmation = games.map((game) => {
        const userConfirmation = game.confirmations.find(
          (c) => c.user_id === userId && c.status === ConfirmationStatus.CONFIRMED
        );

        return {
          ...game,
          confirmations_count: game.confirmations.filter(
            (c) => c.status === ConfirmationStatus.CONFIRMED
          ).length,
          user_confirmation: userConfirmation || null,
        };
      });

      ApiResponse.success(res, gamesWithUserConfirmation);
    } catch (error) {
      logger.error('Error in getUpcoming games:', error);
      ApiResponse.internalError(res);
    }
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const game = await this.gameRepository.findOne({
        where: { id },
        relations: [
          'schedule',
          'schedule.field',
          'schedule.field.location',
          'schedule.owner',
          'confirmations',
          'confirmations.user',
          'teams',
          'teams.players',
          'teams.players.user',
          'stats',
          'stats.user',
        ],
      });

      if (!game) {
        ApiResponse.notFound(res, 'Jogo não encontrado');
        return;
      }

      ApiResponse.success(res, game);
    } catch (error) {
      logger.error('Error in getById game:', error);
      ApiResponse.internalError(res);
    }
  };

  confirmPresence = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const { is_casual_player } = req.body;

      const game = await this.gameRepository.findOne({
        where: { id },
        relations: ['confirmations', 'schedule'],
      });

      if (!game) {
        ApiResponse.notFound(res, 'Jogo não encontrado');
        return;
      }

      // Verifica se confirmações estão abertas
      if (game.confirmation_closes_at && new Date() > game.confirmation_closes_at) {
        ApiResponse.error(res, 'Confirmações encerradas para este jogo');
        return;
      }

      // Verifica limite de jogadores
      const confirmedCount = game.confirmations.filter(
        (c) => c.status === ConfirmationStatus.CONFIRMED
      ).length;

      if (game.max_players && confirmedCount >= game.max_players) {
        ApiResponse.error(res, 'Jogo já está cheio');
        return;
      }

      // Verifica se já confirmou
      let confirmation = await this.confirmationRepository.findOne({
        where: { game_id: id, user_id: userId },
      });

      if (confirmation && confirmation.status === ConfirmationStatus.CONFIRMED) {
        ApiResponse.error(res, 'Você já confirmou presença');
        return;
      }

      if (confirmation) {
        confirmation.status = ConfirmationStatus.CONFIRMED;
        confirmation.confirmed_at = new Date();
        confirmation.is_casual_player = is_casual_player || false;
      } else {
        confirmation = this.confirmationRepository.create({
          game_id: id,
          user_id: userId,
          status: ConfirmationStatus.CONFIRMED,
          confirmed_at: new Date(),
          is_casual_player: is_casual_player || false,
        });
      }

      await this.confirmationRepository.save(confirmation);

      logger.info(`User ${userId} confirmed presence for game ${id}`);

      ApiResponse.success(res, confirmation);
    } catch (error) {
      logger.error('Error in confirmPresence:', error);
      ApiResponse.internalError(res);
    }
  };

  cancelConfirmation = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const game = await this.gameRepository.findOne({
        where: { id },
      });

      if (!game) {
        ApiResponse.notFound(res, 'Jogo não encontrado');
        return;
      }

      // Verifica se pode cancelar (2 horas antes)
      const gameDateTime = moment(game.date).set({
        hour: parseInt(game.time.split(':')[0]),
        minute: parseInt(game.time.split(':')[1]),
      });

      const hoursUntilGame = gameDateTime.diff(moment(), 'hours');
      if (hoursUntilGame < 2) {
        ApiResponse.error(res, 'Não é possível cancelar com menos de 2 horas de antecedência');
        return;
      }

      const confirmation = await this.confirmationRepository.findOne({
        where: { game_id: id, user_id: userId },
      });

      if (!confirmation || confirmation.status !== ConfirmationStatus.CONFIRMED) {
        ApiResponse.error(res, 'Você não possui confirmação ativa');
        return;
      }

      confirmation.status = ConfirmationStatus.CANCELLED;
      await this.confirmationRepository.save(confirmation);

      logger.info(`User ${userId} cancelled confirmation for game ${id}`);

      ApiResponse.success(res, { message: 'Confirmação cancelada com sucesso' });
    } catch (error) {
      logger.error('Error in cancelConfirmation:', error);
      ApiResponse.internalError(res);
    }
  };

  closeConfirmations = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const game = await this.gameRepository.findOne({
        where: { id },
        relations: ['schedule'],
      });

      if (!game) {
        ApiResponse.notFound(res, 'Jogo não encontrado');
        return;
      }

      if (game.schedule.owner_id !== userId) {
        ApiResponse.forbidden(res, 'Apenas o dono pode fechar a lista');
        return;
      }

      game.status = GameStatus.CONFIRMED;
      game.confirmation_closes_at = new Date();

      await this.gameRepository.save(game);

      logger.info(`Confirmations closed for game ${id} by user ${userId}`);

      ApiResponse.success(res, game);
    } catch (error) {
      logger.error('Error in closeConfirmations:', error);
      ApiResponse.internalError(res);
    }
  };

  createTeams = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const { number_of_teams, teams } = req.body;

      const game = await this.gameRepository.findOne({
        where: { id },
        relations: ['schedule', 'confirmations'],
      });

      if (!game) {
        ApiResponse.notFound(res, 'Jogo não encontrado');
        return;
      }

      if (game.schedule.owner_id !== userId) {
        ApiResponse.forbidden(res, 'Apenas o dono pode definir times');
        return;
      }

      if (game.status !== GameStatus.CONFIRMED) {
        ApiResponse.error(res, 'A lista precisa estar fechada para definir times');
        return;
      }

      // Remove times existentes
      await this.teamPlayerRepository.delete({ team: { game_id: id } });
      await this.teamRepository.delete({ game_id: id });

      // Cria novos times
      const createdTeams = [];
      for (const teamData of teams) {
        const team = this.teamRepository.create({
          game_id: id,
          name: teamData.name,
          color: teamData.color,
        });

        await this.teamRepository.save(team);

        // Adiciona jogadores ao time
        for (const playerId of teamData.player_ids) {
          const teamPlayer = this.teamPlayerRepository.create({
            team_id: team.id,
            user_id: playerId,
          });
          await this.teamPlayerRepository.save(teamPlayer);
        }

        createdTeams.push(team);
      }

      game.number_of_teams = number_of_teams;
      await this.gameRepository.save(game);

      logger.info(`Teams created for game ${id}`);

      // Retorna game com times
      const updatedGame = await this.gameRepository.findOne({
        where: { id },
        relations: ['teams', 'teams.players', 'teams.players.user'],
      });

      ApiResponse.success(res, updatedGame);
    } catch (error) {
      logger.error('Error in createTeams:', error);
      ApiResponse.internalError(res);
    }
  };

  submitStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const { player_stats, best_player_id, worst_player_id, best_goal_player_id } = req.body;

      const game = await this.gameRepository.findOne({
        where: { id },
        relations: ['schedule'],
      });

      if (!game) {
        ApiResponse.notFound(res, 'Jogo não encontrado');
        return;
      }

      if (game.schedule.owner_id !== userId) {
        ApiResponse.forbidden(res, 'Apenas o dono pode lançar estatísticas');
        return;
      }

      // Remove stats existentes
      await this.gameStatsRepository.delete({ game_id: id });

      // Cria novas stats
      for (const stat of player_stats) {
        const gameStat = this.gameStatsRepository.create({
          game_id: id,
          user_id: stat.user_id,
          team_id: stat.team_id,
          goals: stat.goals || 0,
          saves: stat.saves || 0,
          is_best_player: stat.user_id === best_player_id,
          is_worst_player: stat.user_id === worst_player_id,
          best_goal: stat.user_id === best_goal_player_id,
        });

        await this.gameStatsRepository.save(gameStat);
      }

      // Atualiza status do jogo
      game.status = GameStatus.FINISHED;
      await this.gameRepository.save(game);

      // Recalcula estatísticas dos usuários
      const statisticsService = new StatisticsService();
      for (const stat of player_stats) {
        await statisticsService.recalculateUserStats(stat.user_id, game.schedule_id);
      }

      logger.info(`Stats submitted for game ${id}`);

      ApiResponse.success(res, { message: 'Estatísticas lançadas com sucesso' });
    } catch (error) {
      logger.error('Error in submitStats:', error);
      ApiResponse.internalError(res);
    }
  };
}
