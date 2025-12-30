import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Location } from '../entities/Location';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ApiResponse } from '../utils/api-response';
import { logger } from '../utils/logger';

export class LocationController {
  private locationRepository = AppDataSource.getRepository(Location);

  getAll = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const locations = await this.locationRepository.find({
        relations: ['fields'],
        order: { name: 'ASC' },
      });

      ApiResponse.success(res, locations);
    } catch (error) {
      logger.error('Error in getAll locations:', error);
      ApiResponse.internalError(res);
    }
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const location = await this.locationRepository.findOne({
        where: { id },
        relations: ['fields'],
      });

      if (!location) {
        ApiResponse.notFound(res, 'Local não encontrado');
        return;
      }

      ApiResponse.success(res, location);
    } catch (error) {
      logger.error('Error in getById location:', error);
      ApiResponse.internalError(res);
    }
  };

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, address, city, state, latitude, longitude } = req.body;

      const location = this.locationRepository.create({
        name,
        address,
        city,
        state,
        latitude,
        longitude,
      });

      await this.locationRepository.save(location);

      logger.info(`New location created: ${name}`);

      ApiResponse.created(res, location);
    } catch (error) {
      logger.error('Error in create location:', error);
      ApiResponse.internalError(res);
    }
  };

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, address, city, state, latitude, longitude } = req.body;

      const location = await this.locationRepository.findOne({
        where: { id },
      });

      if (!location) {
        ApiResponse.notFound(res, 'Local não encontrado');
        return;
      }

      if (name !== undefined) location.name = name;
      if (address !== undefined) location.address = address;
      if (city !== undefined) location.city = city;
      if (state !== undefined) location.state = state;
      if (latitude !== undefined) location.latitude = latitude;
      if (longitude !== undefined) location.longitude = longitude;

      await this.locationRepository.save(location);

      logger.info(`Location updated: ${id}`);

      ApiResponse.success(res, location);
    } catch (error) {
      logger.error('Error in update location:', error);
      ApiResponse.internalError(res);
    }
  };

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const location = await this.locationRepository.findOne({
        where: { id },
      });

      if (!location) {
        ApiResponse.notFound(res, 'Local não encontrado');
        return;
      }

      await this.locationRepository.remove(location);

      logger.info(`Location deleted: ${id}`);

      ApiResponse.success(res, { message: 'Local removido com sucesso' });
    } catch (error) {
      logger.error('Error in delete location:', error);
      ApiResponse.internalError(res);
    }
  };
}
