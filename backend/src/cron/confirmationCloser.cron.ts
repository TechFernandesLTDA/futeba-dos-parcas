import cron from 'node-cron';
import { LessThanOrEqual } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Game, GameStatus } from '../entities/Game';
import { logger } from '../utils/logger';

export const startConfirmationCloserCron = (): void => {
  // Executa a cada 5 minutos
  cron.schedule('*/5 * * * *', async () => {
    try {
      const gameRepository = AppDataSource.getRepository(Game);

      // Busca jogos que precisam ter as confirmações fechadas
      const gamesToClose = await gameRepository.find({
        where: {
          status: GameStatus.SCHEDULED,
          confirmation_closes_at: LessThanOrEqual(new Date()),
        },
      });

      if (gamesToClose.length === 0) return;

      for (const game of gamesToClose) {
        game.status = GameStatus.CONFIRMED;
        await gameRepository.save(game);
        logger.info(`Confirmations auto-closed for game ${game.id}`);
      }

      logger.info(`Confirmation closer: ${gamesToClose.length} games updated`);
    } catch (error) {
      logger.error('Error in confirmation closer cron job:', error);
    }
  });

  logger.info('Confirmation closer cron job scheduled (every 5 minutes)');
};
