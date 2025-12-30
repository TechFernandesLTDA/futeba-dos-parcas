import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import locationRoutes from './location.routes';
import fieldRoutes from './field.routes';
import scheduleRoutes from './schedule.routes';
import gameRoutes from './game.routes';
import inviteRoutes from './invite.routes';
import statisticsRoutes from './statistics.routes';
import notificationRoutes from './notification.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/locations', locationRoutes);
router.use('/fields', fieldRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/games', gameRoutes);
router.use('/invites', inviteRoutes);
router.use('/statistics', statisticsRoutes);
router.use('/notifications', notificationRoutes);

export default router;
