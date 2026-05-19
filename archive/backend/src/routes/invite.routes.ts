import { Router } from 'express';
import { InviteController } from '../controllers/InviteController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate, uuidParamValidation } from '../middlewares/validation.middleware';

const router = Router();
const inviteController = new InviteController();

router.post('/', authMiddleware, inviteController.sendInvite);
router.get('/received', authMiddleware, inviteController.getReceived);
router.get('/sent', authMiddleware, inviteController.getSent);
router.post('/:id/accept', authMiddleware, validate(uuidParamValidation('id')), inviteController.accept);
router.post('/:id/decline', authMiddleware, validate(uuidParamValidation('id')), inviteController.decline);

export default router;
