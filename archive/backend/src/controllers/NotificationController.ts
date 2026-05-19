import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Notification } from '../entities/Notification';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ApiResponse } from '../utils/api-response';
import { logger } from '../utils/logger';

export class NotificationController {
  private notificationRepository = AppDataSource.getRepository(Notification);

  getAll = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { unread_only } = req.query;

      const whereConditions: any = { user_id: userId };

      if (unread_only === 'true') {
        whereConditions.is_read = false;
      }

      const notifications = await this.notificationRepository.find({
        where: whereConditions,
        order: { created_at: 'DESC' },
        take: 50,
      });

      const unreadCount = await this.notificationRepository.count({
        where: { user_id: userId, is_read: false },
      });

      ApiResponse.success(res, {
        notifications,
        unread_count: unreadCount,
      });
    } catch (error) {
      logger.error('Error in getAll notifications:', error);
      ApiResponse.internalError(res);
    }
  };

  markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const notification = await this.notificationRepository.findOne({
        where: { id, user_id: userId },
      });

      if (!notification) {
        ApiResponse.notFound(res, 'Notificação não encontrada');
        return;
      }

      notification.is_read = true;
      await this.notificationRepository.save(notification);

      logger.info(`Notification ${id} marked as read`);

      ApiResponse.success(res, notification);
    } catch (error) {
      logger.error('Error in markAsRead:', error);
      ApiResponse.internalError(res);
    }
  };

  markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;

      await this.notificationRepository.update(
        { user_id: userId, is_read: false },
        { is_read: true }
      );

      logger.info(`All notifications marked as read for user ${userId}`);

      ApiResponse.success(res, { message: 'Todas notificações marcadas como lidas' });
    } catch (error) {
      logger.error('Error in markAllAsRead:', error);
      ApiResponse.internalError(res);
    }
  };
}
