import { Router } from 'express';
import { StatisticsController } from '../controllers/StatisticsController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate, uuidParamValidation } from '../middlewares/validation.middleware';

const router = Router();
const statisticsController = new StatisticsController();

router.get('/me', authMiddleware, statisticsController.getMyStats);
router.get('/user/:userId', authMiddleware, validate(uuidParamValidation('userId')), statisticsController.getUserStats);
router.get('/schedule/:scheduleId', authMiddleware, validate(uuidParamValidation('scheduleId')), statisticsController.getScheduleStats);
router.get('/schedule/:scheduleId/rankings', authMiddleware, validate(uuidParamValidation('scheduleId')), statisticsController.getScheduleRankings);

export default router;
