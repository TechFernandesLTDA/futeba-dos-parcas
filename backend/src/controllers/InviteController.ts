import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { GameInvite, InviteStatus } from '../entities/GameInvite';
import { Game } from '../entities/Game';
import { GameConfirmation, ConfirmationStatus } from '../entities/GameConfirmation';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ApiResponse } from '../utils/api-response';
import { logger } from '../utils/logger';

export class InviteController {
  private inviteRepository = AppDataSource.getRepository(GameInvite);
  private gameRepository = AppDataSource.getRepository(Game);
  private confirmationRepository = AppDataSource.getRepository(GameConfirmation);

  sendInvite = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const senderId = req.user!.userId;
      const { game_id, receiver_ids, message } = req.body;

      const game = await this.gameRepository.findOne({
        where: { id: game_id },
      });

      if (!game) {
        ApiResponse.notFound(res, 'Jogo não encontrado');
        return;
      }

      const invites = [];
      for (const receiverId of receiver_ids) {
        // Verifica se já existe convite
        const existingInvite = await this.inviteRepository.findOne({
          where: {
            game_id,
            receiver_id: receiverId,
            status: InviteStatus.PENDING,
          },
        });

        if (!existingInvite) {
          const invite = this.inviteRepository.create({
            game_id,
            sender_id: senderId,
            receiver_id: receiverId,
            message,
            status: InviteStatus.PENDING,
          });

          await this.inviteRepository.save(invite);
          invites.push(invite);
        }
      }

      logger.info(`User ${senderId} sent ${invites.length} invites for game ${game_id}`);

      ApiResponse.created(res, invites);
    } catch (error) {
      logger.error('Error in sendInvite:', error);
      ApiResponse.internalError(res);
    }
  };

  getReceived = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;

      const invites = await this.inviteRepository.find({
        where: { receiver_id: userId, status: InviteStatus.PENDING },
        relations: [
          'game',
          'game.schedule',
          'game.schedule.field',
          'game.schedule.field.location',
          'sender',
        ],
        order: { sent_at: 'DESC' },
      });

      // Formata os dados para não expor informações sensíveis
      const formattedInvites = invites.map((invite) => ({
        id: invite.id,
        game: {
          id: invite.game.id,
          date: invite.game.date,
          time: invite.game.time,
          daily_price: invite.game.daily_price,
          field: invite.game.schedule?.field,
        },
        sender: {
          id: invite.sender.id,
          name: invite.sender.name,
          photo_url: invite.sender.photo_url,
        },
        message: invite.message,
        status: invite.status,
        sent_at: invite.sent_at,
      }));

      ApiResponse.success(res, formattedInvites);
    } catch (error) {
      logger.error('Error in getReceived:', error);
      ApiResponse.internalError(res);
    }
  };

  getSent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;

      const invites = await this.inviteRepository.find({
        where: { sender_id: userId },
        relations: [
          'game',
          'game.schedule',
          'receiver',
        ],
        order: { sent_at: 'DESC' },
        take: 50,
      });

      const formattedInvites = invites.map((invite) => ({
        id: invite.id,
        game: {
          id: invite.game.id,
          date: invite.game.date,
          time: invite.game.time,
          schedule_name: invite.game.schedule?.name,
        },
        receiver: {
          id: invite.receiver.id,
          name: invite.receiver.name,
          photo_url: invite.receiver.photo_url,
        },
        message: invite.message,
        status: invite.status,
        sent_at: invite.sent_at,
        responded_at: invite.responded_at,
      }));

      ApiResponse.success(res, formattedInvites);
    } catch (error) {
      logger.error('Error in getSent:', error);
      ApiResponse.internalError(res);
    }
  };

  accept = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const invite = await this.inviteRepository.findOne({
        where: { id, receiver_id: userId },
        relations: ['game', 'game.confirmations'],
      });

      if (!invite) {
        ApiResponse.notFound(res, 'Convite não encontrado');
        return;
      }

      if (invite.status !== InviteStatus.PENDING) {
        ApiResponse.error(res, 'Convite já foi respondido');
        return;
      }

      // Verifica se jogo está cheio
      const confirmedCount = invite.game.confirmations.filter(
        (c) => c.status === ConfirmationStatus.CONFIRMED
      ).length;

      if (invite.game.max_players && confirmedCount >= invite.game.max_players) {
        ApiResponse.error(res, 'Jogo já está cheio');
        return;
      }

      // Atualiza convite
      invite.status = InviteStatus.ACCEPTED;
      invite.responded_at = new Date();
      await this.inviteRepository.save(invite);

      // Cria confirmação automaticamente
      let confirmation = await this.confirmationRepository.findOne({
        where: { game_id: invite.game_id, user_id: userId },
      });

      if (!confirmation) {
        confirmation = this.confirmationRepository.create({
          game_id: invite.game_id,
          user_id: userId,
          status: ConfirmationStatus.CONFIRMED,
          confirmed_at: new Date(),
          is_casual_player: true,
        });
      } else {
        confirmation.status = ConfirmationStatus.CONFIRMED;
        confirmation.confirmed_at = new Date();
      }

      await this.confirmationRepository.save(confirmation);

      logger.info(`User ${userId} accepted invite ${id}`);

      ApiResponse.success(res, { invite, confirmation });
    } catch (error) {
      logger.error('Error in accept invite:', error);
      ApiResponse.internalError(res);
    }
  };

  decline = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const invite = await this.inviteRepository.findOne({
        where: { id, receiver_id: userId },
      });

      if (!invite) {
        ApiResponse.notFound(res, 'Convite não encontrado');
        return;
      }

      if (invite.status !== InviteStatus.PENDING) {
        ApiResponse.error(res, 'Convite já foi respondido');
        return;
      }

      invite.status = InviteStatus.DECLINED;
      invite.responded_at = new Date();
      await this.inviteRepository.save(invite);

      logger.info(`User ${userId} declined invite ${id}`);

      ApiResponse.success(res, invite);
    } catch (error) {
      logger.error('Error in decline invite:', error);
      ApiResponse.internalError(res);
    }
  };
}
