import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User, FieldType } from '../entities/User';
import { HashUtil } from '../utils/hash.util';
import { JwtUtil } from '../utils/jwt.util';
import { ApiResponse } from '../utils/api-response';
import { logger } from '../utils/logger';

export class AuthController {
  private userRepository = AppDataSource.getRepository(User);

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, name, phone, preferred_field_type } = req.body;

      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: { email },
      });

      if (existingUser) {
        ApiResponse.error(res, 'Email já cadastrado', 400);
        return;
      }

      // Hash password
      const password_hash = await HashUtil.hashPassword(password);

      // Create user
      const user = this.userRepository.create({
        email,
        password_hash,
        name,
        phone,
        preferred_field_type: preferred_field_type || FieldType.SOCIETY,
      });

      await this.userRepository.save(user);

      // Generate token
      const token = JwtUtil.generateToken({
        userId: user.id,
        email: user.email,
      });

      logger.info(`New user registered: ${email}`);

      ApiResponse.created(res, {
        user: user.toPublic(),
        token,
      });
    } catch (error) {
      logger.error('Error in register:', error);
      ApiResponse.internalError(res);
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await this.userRepository.findOne({
        where: { email },
      });

      if (!user) {
        ApiResponse.unauthorized(res, 'Email ou senha inválidos');
        return;
      }

      // Verify password
      const isValidPassword = await HashUtil.comparePassword(
        password,
        user.password_hash
      );

      if (!isValidPassword) {
        ApiResponse.unauthorized(res, 'Email ou senha inválidos');
        return;
      }

      // Generate token
      const token = JwtUtil.generateToken({
        userId: user.id,
        email: user.email,
      });

      logger.info(`User logged in: ${email}`);

      ApiResponse.success(res, {
        user: user.toPublic(),
        token,
      });
    } catch (error) {
      logger.error('Error in login:', error);
      ApiResponse.internalError(res);
    }
  };
}
