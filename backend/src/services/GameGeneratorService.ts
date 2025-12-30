import moment from 'moment';
import { MoreThan } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Schedule, RecurrenceType } from '../entities/Schedule';
import { Game, GameStatus } from '../entities/Game';
import { logger } from '../utils/logger';

export class GameGeneratorService {
  private scheduleRepository = AppDataSource.getRepository(Schedule);
  private gameRepository = AppDataSource.getRepository(Game);

  /**
   * Gera jogos para os próximos 30 dias baseado nos horários recorrentes
   */
  async generateUpcomingGames(): Promise<void> {
    const schedules = await this.scheduleRepository.find({
      relations: ['field'],
    });

    for (const schedule of schedules) {
      await this.generateGamesForSchedule(schedule);
    }

    logger.info(`Games generated for ${schedules.length} schedules`);
  }

  /**
   * Gera jogos para um horário específico
   */
  async generateGamesForSchedule(schedule: Schedule): Promise<void> {
    const today = moment().startOf('day');
    const endDate = moment().add(30, 'days').endOf('day');

    const existingGames = await this.gameRepository.find({
      where: {
        schedule_id: schedule.id,
        date: MoreThan(today.toDate()),
      },
    });

    const existingDates = new Set(
      existingGames.map((g) => moment(g.date).format('YYYY-MM-DD'))
    );

    const gamesToCreate = this.calculateGameDates(
      schedule,
      today,
      endDate,
      existingDates
    );

    if (gamesToCreate.length > 0) {
      await this.gameRepository.save(gamesToCreate);
      logger.info(`Created ${gamesToCreate.length} games for schedule ${schedule.id}`);
    }
  }

  private calculateGameDates(
    schedule: Schedule,
    startDate: moment.Moment,
    endDate: moment.Moment,
    existingDates: Set<string>
  ): Partial<Game>[] {
    const games: Partial<Game>[] = [];
    const currentDate = startDate.clone();

    switch (schedule.recurrence_type) {
      case RecurrenceType.DAILY:
        const interval = schedule.recurrence_config.interval || 1;
        while (currentDate.isSameOrBefore(endDate)) {
          const dateStr = currentDate.format('YYYY-MM-DD');
          if (!existingDates.has(dateStr)) {
            games.push(this.createGameFromSchedule(schedule, currentDate.clone()));
          }
          currentDate.add(interval, 'days');
        }
        break;

      case RecurrenceType.WEEKLY:
        const daysOfWeek = schedule.recurrence_config.days || [];
        while (currentDate.isSameOrBefore(endDate)) {
          if (daysOfWeek.includes(currentDate.day())) {
            const dateStr = currentDate.format('YYYY-MM-DD');
            if (!existingDates.has(dateStr)) {
              games.push(this.createGameFromSchedule(schedule, currentDate.clone()));
            }
          }
          currentDate.add(1, 'day');
        }
        break;

      case RecurrenceType.CUSTOM:
        const specificDates = schedule.recurrence_config.specific_dates || [];
        specificDates.forEach((dateStr) => {
          const date = moment(dateStr);
          if (
            date.isBetween(startDate, endDate, 'day', '[]') &&
            !existingDates.has(dateStr)
          ) {
            games.push(this.createGameFromSchedule(schedule, date));
          }
        });
        break;
    }

    return games;
  }

  private createGameFromSchedule(
    schedule: Schedule,
    date: moment.Moment
  ): Partial<Game> {
    const [hours, minutes] = schedule.time.split(':').map(Number);

    const gameDateTime = date.clone().set({
      hour: hours,
      minute: minutes,
      second: 0,
    });

    // Confirmações fecham 30 minutos antes do jogo
    const confirmationCloses = gameDateTime.clone().subtract(30, 'minutes');

    return {
      schedule_id: schedule.id,
      date: date.toDate(),
      time: schedule.time,
      status: GameStatus.SCHEDULED,
      max_players: schedule.max_players,
      daily_price: schedule.daily_price,
      confirmation_closes_at: confirmationCloses.toDate(),
    };
  }
}
