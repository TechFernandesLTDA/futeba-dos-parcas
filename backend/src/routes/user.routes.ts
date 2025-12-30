import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const userController = new UserController();

router.get('/me', authMiddleware, userController.getProfile);
router.put('/me', authMiddleware, userController.updateProfile);
router.get('/search', authMiddleware, userController.searchUsers);
router.put('/fcm-token', authMiddleware, userController.updateFcmToken);

export default router;
