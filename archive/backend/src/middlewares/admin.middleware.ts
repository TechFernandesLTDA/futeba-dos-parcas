import { Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { AuthRequest } from './auth.middleware';
import { ApiResponse } from '../utils/api-response';

/**
 * Middleware que verifica se o usuário autenticado tem role ADMIN.
 * Deve ser usado após authMiddleware nas rotas que exigem privilégio (#801).
 */
export const adminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      ApiResponse.unauthorized(res, 'Token não fornecido');
      return;
    }

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.user.userId },
      select: ['id', 'role'],
    });

    if (!user || user.role !== 'ADMIN') {
      ApiResponse.forbidden(res, 'Acesso restrito a administradores');
      return;
    }

    next();
  } catch (error) {
    ApiResponse.internalError(res);
  }
};
