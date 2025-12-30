import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { validate, registerValidation, loginValidation } from '../middlewares/validation.middleware';

const router = Router();
const authController = new AuthController();

router.post('/register', validate(registerValidation), authController.register);
router.post('/login', validate(loginValidation), authController.login);

export default router;
