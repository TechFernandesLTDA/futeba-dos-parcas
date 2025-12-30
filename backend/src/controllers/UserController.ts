import { Response } from 'express';
import { Like } from 'typeorm';
import { AppDataSource } from '../config/database';
import { User, FieldType } from '../entities/User';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ApiResponse } from '../utils/api-response';
import { logger } from '../utils/logger';

export class UserController {
  private userRepository = AppDataSource.getRepository(User);

  getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await this.userRepository.findOne({
        where: { id: req.user!.userId },
      });

      if (!user) {
        ApiResponse.notFound(res, 'Usuário não encontrado');
        return;
      }

      ApiResponse.success(res, user.toPublic());
    } catch (error) {
      logger.error('Error in getProfile:', error);
      ApiResponse.internalError(res);
    }
  };

  updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, phone, preferred_field_type, is_searchable, photo_url } = req.body;

      const user = await this.userRepository.findOne({
        where: { id: req.user!.userId },
      });

      if (!user) {
        ApiResponse.notFound(res, 'Usuário não encontrado');
        return;
      }

      // Update fields
      if (name !== undefined) user.name = name;
      if (phone !== undefined) user.phone = phone;
      if (preferred_field_type !== undefined) user.preferred_field_type = preferred_field_type;
      if (is_searchable !== undefined) user.is_searchable = is_searchable;
      if (photo_url !== undefined) user.photo_url = photo_url;

      await this.userRepository.save(user);

      logger.info(`User profile updated: ${user.email}`);

      ApiResponse.success(res, user.toPublic());
    } catch (error) {
      logger.error('Error in updateProfile:', error);
      ApiResponse.internalError(res);
    }
  };

  searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { q, field_type } = req.query;

      const whereConditions: any = {
        is_searchable: true,
      };

      if (q) {
        whereConditions.name = Like(`%${q}%`);
      }

      if (field_type && Object.values(FieldType).includes(field_type as FieldType)) {
        whereConditions.preferred_field_type = field_type;
      }

      const users = await this.userRepository.find({
        where: whereConditions,
        select: ['id', 'name', 'photo_url', 'preferred_field_type'],
        take: 20,
      });

      // Remove current user from results
      const filteredUsers = users.filter((u) => u.id !== req.user!.userId);

      ApiResponse.success(res, filteredUsers);
    } catch (error) {
      logger.error('Error in searchUsers:', error);
      ApiResponse.internalError(res);
    }
  };

  updateFcmToken = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { fcm_token } = req.body;

      if (!fcm_token) {
        ApiResponse.error(res, 'fcm_token é obrigatório');
        return;
      }

      await this.userRepository.update(req.user!.userId, { fcm_token });

      logger.info(`FCM token updated for user: ${req.user!.userId}`);

      ApiResponse.success(res, { message: 'Token atualizado com sucesso' });
    } catch (error) {
      logger.error('Error in updateFcmToken:', error);
      ApiResponse.internalError(res);
    }
  };
}
