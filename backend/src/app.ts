import 'reflect-metadata';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { appConfig } from './config';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';
import { logger } from './utils/logger';
import routes from './routes';

const app: Application = express();

// Necessário para que express-rate-limit leia o IP real quando o app
// estiver atrás de um proxy (ex: Cloud Run, nginx). Sem isso, o IP
// reportado é sempre o do proxy, tornando o rate-limit ineficaz.
app.set('trust proxy', 1);

// Security middlewares
app.use(helmet());
app.use(
  cors({
    origin: appConfig.cors.allowedOrigins,
    credentials: true,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Error handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
