import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Field } from '../entities/Field';
import { FieldType } from '../entities/User';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ApiResponse } from '../utils/api-response';
import { logger } from '../utils/logger';

export class FieldController {
  private fieldRepository = AppDataSource.getRepository(Field);

  getAll = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Paginação padrão para evitar retorno ilimitado de registros (#808)
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
      const skip = (page - 1) * limit;

      const { location_id, type } = req.query;

      const whereConditions: any = {};

      if (location_id) {
        whereConditions.location_id = location_id;
      }

      // Validar type contra enum para evitar injeção de valor arbitrário (#806)
      if (type) {
        const validTypes = Object.values(FieldType) as string[];
        if (!validTypes.includes(type as string)) {
          ApiResponse.error(res, `Tipo inválido. Valores aceitos: ${validTypes.join(', ')}`, 400);
          return;
        }
        whereConditions.type = type;
      }

      const [fields, total] = await this.fieldRepository.findAndCount({
        where: whereConditions,
        relations: ['location'],
        order: { name: 'ASC' },
        skip,
        take: limit,
      });

      ApiResponse.success(res, { data: fields, page, limit, total });
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
