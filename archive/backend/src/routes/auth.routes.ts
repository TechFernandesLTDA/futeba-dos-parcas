import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { validate, registerValidation, loginValidation } from '../middlewares/validation.middleware';
import { authLimiter, registerLimiter } from '../middlewares/rate-limit.middleware';

const router = Router();
const authController = new AuthController();

router.post('/register', registerLimiter, validate(registerValidation), authController.register);
router.post('/login', authLimiter, validate(loginValidation), authController.login);

export default router;
