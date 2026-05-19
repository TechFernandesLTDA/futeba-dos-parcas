import app from './app';
import { appConfig } from './config';
import { initializeDatabase } from './config/database';
import { initializeFirebase } from './config/firebase';
import { logger } from './utils/logger';
import { initializeCronJobs } from './cron';

const startServer = async (): Promise<void> => {
  try {
    // Initialize services
    initializeFirebase();

    // Initialize database connection
    await initializeDatabase();

    // Seed initial data
    const { seedBadges } = await import('./utils/seed-badges');
    await seedBadges();

    // Initialize cron jobs
    initializeCronJobs();

    // Start HTTP server
    app.listen(appConfig.port, () => {
      logger.info(`Server running on port ${appConfig.port}`);
      logger.info(`Environment: ${appConfig.env}`);
      logger.info(`Health check: http://localhost:${appConfig.port}/health`);
      logger.info(`API Base URL: http://localhost:${appConfig.port}/api`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
