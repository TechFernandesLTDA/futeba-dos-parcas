import { Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Schedule } from '../entities/Schedule';
import { PlayerScheduleMembership, MembershipStatus, MembershipType } from '../entities/PlayerScheduleMembership';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ApiResponse } from '../utils/api-response';
import { logger } from '../utils/logger';
import { GameGeneratorService } from '../services/GameGeneratorService';

export class ScheduleController {
  private scheduleRepository = AppDataSource.getRepository(Schedule);
  private membershipRepository = AppDataSource.getRepository(PlayerScheduleMembership);

  getAll = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;

      // Horários que o usuário é dono
      const owned = await this.scheduleRepository.find({
        where: { owner_id: userId },
        relations: ['field', 'field.location', 'owner'],
        order: { created_at: 'DESC' },
      });

      // Horários que o usuário é membro
      const memberships = await this.membershipRepository.find({
        where: { user_id: userId, status: MembershipStatus.ACTIVE },
      });

      const memberScheduleIds = memberships.map((m) => m.schedule_id);

      let member: Schedule[] = [];
      if (memberScheduleIds.length > 0) {
        member = await this.scheduleRepository.find({
          where: { id: In(memberScheduleIds) },
          relations: ['field', 'field.location', 'owner'],
        });
      }

      // Horários públicos (exceto os que já é dono ou membro)
      const excludeIds = [...owned.map((s) => s.id), ...memberScheduleIds];

      const publicSchedules = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.field', 'field')
        .leftJoinAndSelect('field.location', 'location')
        .leftJoinAndSelect('schedule.owner', 'owner')
        .where('schedule.is_public = :isPublic', { isPublic: true })
        .andWhere(excludeIds.length > 0 ? 'schedule.id NOT IN (:...excludeIds)' : '1=1', { excludeIds })
        .orderBy('schedule.created_at', 'DESC')
        .take(20)
        .getMany();

      ApiResponse.success(res, {
        owned,
        member,
        public: publicSchedules,
      });
    } catch (error) {
      logger.error('Error in getAll schedules:', error);
      ApiResponse.internalError(res);
    }
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const schedule = await this.scheduleRepository.findOne({
        where: { id },
        relations: ['field', 'field.location', 'owner', 'memberships', 'memberships.user'],
      });

      if (!schedule) {
        ApiResponse.notFound(res, 'Horário não encontrado');
        return;
      }

      ApiResponse.success(res, schedule);
    } catch (error) {
      logger.error('Error in getById schedule:', error);
      ApiResponse.internalError(res);
    }
  };

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const {
        field_id,
        name,
        recurrence_type,
        recurrence_config,
        time,
        duration,
        is_public,
        max_players,
        daily_price,
        monthly_price,
      } = req.body;

      const schedule = this.scheduleRepository.create({
        field_id,
        owner_id: userId,
        name,
        recurrence_type,
        recurrence_config,
        time,
        duration,
        is_public: is_public || false,
        max_players,
        daily_price,
        monthly_price,
      });

      await this.scheduleRepository.save(schedule);

      // Gerar jogos para os próximos 30 dias
      const gameGenerator = new GameGeneratorService();
      await gameGenerator.generateGamesForSchedule(schedule);

      const savedSchedule = await this.scheduleRepository.findOne({
        where: { id: schedule.id },
        relations: ['field', 'field.location', 'owner'],
      });

      logger.info(`New schedule created: ${name} by user ${userId}`);

      ApiResponse.created(res, savedSchedule);
    } catch (error) {
      logger.error('Error in create schedule:', error);
      ApiResponse.internalError(res);
    }
  };

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const schedule = await this.scheduleRepository.findOne({
        where: { id },
      });

      if (!schedule) {
        ApiResponse.notFound(res, 'Horário não encontrado');
        return;
      }

      if (schedule.owner_id !== userId) {
        ApiResponse.forbidden(res, 'Apenas o dono pode editar este horário');
        return;
      }

      const { name, recurrence_type, recurrence_config, time, duration, is_public, max_players, daily_price, monthly_price } = req.body;

      if (name !== undefined) schedule.name = name;
      if (recurrence_type !== undefined) schedule.recurrence_type = recurrence_type;
      if (recurrence_config !== undefined) schedule.recurrence_config = recurrence_config;
      if (time !== undefined) schedule.time = time;
      if (duration !== undefined) schedule.duration = duration;
      if (is_public !== undefined) schedule.is_public = is_public;
      if (max_players !== undefined) schedule.max_players = max_players;
      if (daily_price !== undefined) schedule.daily_price = daily_price;
      if (monthly_price !== undefined) schedule.monthly_price = monthly_price;

      await this.scheduleRepository.save(schedule);

      const updatedSchedule = await this.scheduleRepository.findOne({
        where: { id },
        relations: ['field', 'field.location', 'owner'],
      });

      logger.info(`Schedule updated: ${id}`);

      ApiResponse.success(res, updatedSchedule);
    } catch (error) {
      logger.error('Error in update schedule:', error);
      ApiResponse.internalError(res);
    }
  };

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const schedule = await this.scheduleRepository.findOne({
        where: { id },
      });

      if (!schedule) {
        ApiResponse.notFound(res, 'Horário não encontrado');
        return;
      }

      if (schedule.owner_id !== userId) {
        ApiResponse.forbidden(res, 'Apenas o dono pode remover este horário');
        return;
      }

      await this.scheduleRepository.remove(schedule);

      logger.info(`Schedule deleted: ${id}`);

      ApiResponse.success(res, { message: 'Horário removido com sucesso' });
    } catch (error) {
      logger.error('Error in delete schedule:', error);
      ApiResponse.internalError(res);
    }
  };

  requestMembership = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const schedule = await this.scheduleRepository.findOne({
        where: { id },
      });

      if (!schedule) {
        ApiResponse.notFound(res, 'Horário não encontrado');
        return;
      }

      if (!schedule.is_public) {
        ApiResponse.forbidden(res, 'Este horário não é público');
        return;
      }

      // Verifica se já existe solicitação
      const existingMembership = await this.membershipRepository.findOne({
        where: { user_id: userId, schedule_id: id },
      });

      if (existingMembership) {
        ApiResponse.error(res, 'Você já solicitou participação neste horário');
        return;
      }

      const membership = this.membershipRepository.create({
        user_id: userId,
        schedule_id: id,
        membership_type: MembershipType.CASUAL,
        status: MembershipStatus.PENDING,
      });

      await this.membershipRepository.save(membership);

      logger.info(`Membership requested: user ${userId} -> schedule ${id}`);

      ApiResponse.created(res, membership);
    } catch (error) {
      logger.error('Error in requestMembership:', error);
      ApiResponse.internalError(res);
    }
  };

  approveMembership = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id, userId: memberUserId } = req.params;
      const ownerId = req.user!.userId;

      const schedule = await this.scheduleRepository.findOne({
        where: { id },
      });

      if (!schedule) {
        ApiResponse.notFound(res, 'Horário não encontrado');
        return;
      }

      if (schedule.owner_id !== ownerId) {
        ApiResponse.forbidden(res, 'Apenas o dono pode aprovar membros');
        return;
      }

      const membership = await this.membershipRepository.findOne({
        where: { user_id: memberUserId, schedule_id: id },
      });

      if (!membership) {
        ApiResponse.notFound(res, 'Solicitação não encontrada');
        return;
      }

      membership.status = MembershipStatus.ACTIVE;
      membership.started_at = new Date();

      await this.membershipRepository.save(membership);

      logger.info(`Membership approved: user ${memberUserId} -> schedule ${id}`);

      ApiResponse.success(res, membership);
    } catch (error) {
      logger.error('Error in approveMembership:', error);
      ApiResponse.internalError(res);
    }
  };

  removeMember = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id, userId: memberUserId } = req.params;
      const ownerId = req.user!.userId;

      const schedule = await this.scheduleRepository.findOne({
        where: { id },
      });

      if (!schedule) {
        ApiResponse.notFound(res, 'Horário não encontrado');
        return;
      }

      if (schedule.owner_id !== ownerId) {
        ApiResponse.forbidden(res, 'Apenas o dono pode remover membros');
        return;
      }

      const membership = await this.membershipRepository.findOne({
        where: { user_id: memberUserId, schedule_id: id },
      });

      if (!membership) {
        ApiResponse.notFound(res, 'Membro não encontrado');
        return;
      }

      await this.membershipRepository.remove(membership);

      logger.info(`Member removed: user ${memberUserId} from schedule ${id}`);

      ApiResponse.success(res, { message: 'Membro removido com sucesso' });
    } catch (error) {
      logger.error('Error in removeMember:', error);
      ApiResponse.internalError(res);
    }
  };
}
