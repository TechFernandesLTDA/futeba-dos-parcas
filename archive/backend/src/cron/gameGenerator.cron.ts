import cron from 'node-cron';
import { GameGeneratorService } from '../services/GameGeneratorService';
import { logger } from '../utils/logger';

export const startGameGeneratorCron = (): void => {
  // Executa todos os dias à meia-noite
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running game generator cron job...');

    try {
      const gameGenerator = new GameGeneratorService();
      await gameGenerator.generateUpcomingGames();
      logger.info('Game generator cron job completed successfully');
    } catch (error) {
      logger.error('Error in game generator cron job:', error);
    }
  });

  logger.info('Game generator cron job scheduled (daily at midnight)');
};
