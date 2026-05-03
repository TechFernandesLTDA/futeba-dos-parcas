import jwt, { SignOptions } from 'jsonwebtoken';
import { appConfig } from '../config';

export interface JwtPayload {
  userId: string;
  email: string;
}

export class JwtUtil {
  static generateToken(payload: JwtPayload): string {
    // expiresIn aceita number (segundos) ou string (ex: "7d", "1h"); cast necessário
    // pois @types/jsonwebtoken usa tipo literal StringValue ao invés de string
    const options: SignOptions = {
      expiresIn: appConfig.jwt.expiration as SignOptions['expiresIn'],
    };
    return jwt.sign(payload, appConfig.jwt.secret, options);
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
