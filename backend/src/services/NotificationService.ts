import { AppDataSource } from '../config/database';
import { Notification, NotificationType } from '../entities/Notification';
import { User } from '../entities/User';
import { Game } from '../entities/Game';
import { logger } from '../utils/logger';
import * as admin from 'firebase-admin';

export class NotificationService {
  private notificationRepository = AppDataSource.getRepository(Notification);
  private userRepository = AppDataSource.getRepository(User);
  private gameRepository = AppDataSource.getRepository(Game);

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      user_id: userId,
      type,
      title,
      message,
      data,
      is_read: false,
    });

    await this.notificationRepository.save(notification);


    await this.sendPushNotification(userId, title, message, data);

    logger.info(`Notification created for user ${userId}: ${type}`);

    return notification;
  }

  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user || !user.fcm_token) {
        logger.debug(`User ${userId} has no FCM token`);
        return;
      }

      await admin.messaging().send({
        token: user.fcm_token,
        notification: { title, body },
        data: data ? Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, String(value)])
        ) : undefined,
      });

      logger.info(`Push notification sent to user ${userId}`);
    } catch (error) {
      logger.error('Error sending push notification:', error);
    }
  }

  async sendGameInviteNotification(
    receiverId: string,
    senderId: string,
    gameId: string
  ): Promise<void> {
    const sender = await this.userRepository.findOne({ where: { id: senderId } });
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['schedule', 'schedule.field'],
    });

    if (!sender || !game) return;

    await this.createNotification(
      receiverId,
      NotificationType.GAME_INVITE,
      'Novo Convite para Jogo',
      `${sender.name} te convidou para jogar em ${game.schedule?.field?.name || 'quadra'}`,
      { gameId, senderId }
    );
  }

  async sendGameReminderNotification(
    userId: string,
    gameId: string
  ): Promise<void> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['schedule', 'schedule.field', 'schedule.field.location'],
    });

    if (!game) return;

    const locationName = game.schedule?.field?.location?.name || 'local';

    await this.createNotification(
      userId,
      NotificationType.GAME_REMINDER,
      'Lembrete de Jogo',
      `Seu jogo é amanhã às ${game.time} em ${locationName}`,
      { gameId }
    );
  }

  async sendListClosedNotification(
    userId: string,
    gameId: string
  ): Promise<void> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['schedule'],
    });

    if (!game) return;

    await this.createNotification(
      userId,
      NotificationType.LIST_CLOSED,
      'Lista Fechada',
      `A lista do jogo ${game.schedule?.name || ''} foi fechada`,
      { gameId }
    );
  }

  async sendTeamsDefinedNotification(
    userId: string,
    gameId: string
  ): Promise<void> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['schedule'],
    });

    if (!game) return;

    await this.createNotification(
      userId,
      NotificationType.TEAMS_DEFINED,
      'Times Definidos',
      `Os times para o jogo ${game.schedule?.name || ''} foram definidos`,
      { gameId }
    );
  }

  async sendStatsPostedNotification(
    userId: string,
    gameId: string
  ): Promise<void> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['schedule'],
    });

    if (!game) return;

    await this.createNotification(
      userId,
      NotificationType.STATS_POSTED,
      'Estatísticas Lançadas',
      `As estatísticas do jogo ${game.schedule?.name || ''} foram lançadas`,
      { gameId }
    );
  }
}
