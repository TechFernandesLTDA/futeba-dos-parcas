import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Field } from '../entities/Field';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ApiResponse } from '../utils/api-response';
import { logger } from '../utils/logger';

export class FieldController {
  private fieldRepository = AppDataSource.getRepository(Field);

  getAll = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { location_id, type } = req.query;

      const whereConditions: any = {};

      if (location_id) {
        whereConditions.location_id = location_id;
      }

      if (type) {
        whereConditions.type = type;
      }

      const fields = await this.fieldRepository.find({
        where: whereConditions,
        relations: ['location'],
        order: { name: 'ASC' },
      });

      ApiResponse.success(res, fields);
    } catch (error) {
      logger.error('Error in getAll fields:', error);
      ApiResponse.internalError(res);
    }
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const field = await this.fieldRepository.findOne({
        where: { id },
        relations: ['location', 'schedules'],
      });

      if (!field) {
        ApiResponse.notFound(res, 'Quadra não encontrada');
        return;
      }

      ApiResponse.success(res, field);
    } catch (error) {
      logger.error('Error in getById field:', error);
      ApiResponse.internalError(res);
    }
  };

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { location_id, name, type, description, photo_url } = req.body;

      const field = this.fieldRepository.create({
        location_id,
        name,
        type,
        description,
        photo_url,
      });

      await this.fieldRepository.save(field);

      // Load with relations
      const savedField = await this.fieldRepository.findOne({
        where: { id: field.id },
        relations: ['location'],
      });

      logger.info(`New field created: ${name}`);

      ApiResponse.created(res, savedField);
    } catch (error) {
      logger.error('Error in create field:', error);
      ApiResponse.internalError(res);
    }
  };

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, type, description, photo_url } = req.body;

      const field = await this.fieldRepository.findOne({
        where: { id },
      });

      if (!field) {
        ApiResponse.notFound(res, 'Quadra não encontrada');
        return;
      }

      if (name !== undefined) field.name = name;
      if (type !== undefined) field.type = type;
      if (description !== undefined) field.description = description;
      if (photo_url !== undefined) field.photo_url = photo_url;

      await this.fieldRepository.save(field);

      const updatedField = await this.fieldRepository.findOne({
        where: { id },
        relations: ['location'],
      });

      logger.info(`Field updated: ${id}`);

      ApiResponse.success(res, updatedField);
    } catch (error) {
      logger.error('Error in update field:', error);
      ApiResponse.internalError(res);
    }
  };

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const field = await this.fieldRepository.findOne({
        where: { id },
      });

      if (!field) {
        ApiResponse.notFound(res, 'Quadra não encontrada');
        return;
      }

      await this.fieldRepository.remove(field);

      logger.info(`Field deleted: ${id}`);

      ApiResponse.success(res, { message: 'Quadra removida com sucesso' });
    } catch (error) {
      logger.error('Error in delete field:', error);
      ApiResponse.internalError(res);
    }
  };
}
