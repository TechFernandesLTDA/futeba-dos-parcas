import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate, uuidParamValidation } from '../middlewares/validation.middleware';

const router = Router();
const notificationController = new NotificationController();

router.get('/', authMiddleware, notificationController.getAll);
router.put('/:id/read', authMiddleware, validate(uuidParamValidation('id')), notificationController.markAsRead);
router.put('/read-all', authMiddleware, notificationController.markAllAsRead);

export default router;
