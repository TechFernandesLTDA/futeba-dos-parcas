import { Request, Response, NextFunction } from 'express';
import { JwtUtil } from '../utils/jwt.util';
import { ApiResponse } from '../utils/api-response';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ApiResponse.unauthorized(res, 'Token não fornecido');
      return;
    }

    const token = authHeader.substring(7);
    const payload = JwtUtil.verifyToken(token);

    req.user = {
      userId: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error) {
    ApiResponse.unauthorized(res, 'Token inválido ou expirado');
  }
};
