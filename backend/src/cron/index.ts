import { startGameGeneratorCron } from './gameGenerator.cron';
import { startConfirmationCloserCron } from './confirmationCloser.cron';

export const initializeCronJobs = (): void => {
  startGameGeneratorCron();
  startConfirmationCloserCron();
};
