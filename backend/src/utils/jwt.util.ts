import jwt from 'jsonwebtoken';
import { appConfig } from '../config';

export interface JwtPayload {
  userId: string;
  email: string;
}

export class JwtUtil {
  static generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, appConfig.jwt.secret, {
      expiresIn: appConfig.jwt.expiration,
    });
  }

  static verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, appConfig.jwt.secret) as JwtPayload;
    } catch (error) {
      throw new Error('Token inválido ou expirado');
    }
  }

  static decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }
}
