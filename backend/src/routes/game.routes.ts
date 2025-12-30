import { Router } from 'express';
import { GameController } from '../controllers/GameController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate, uuidParamValidation, submitStatsValidation } from '../middlewares/validation.middleware';

const router = Router();
const gameController = new GameController();

router.get('/upcoming', authMiddleware, gameController.getUpcoming);
router.get('/:id', authMiddleware, validate(uuidParamValidation('id')), gameController.getById);
router.post('/:id/confirm', authMiddleware, validate(uuidParamValidation('id')), gameController.confirmPresence);
router.delete('/:id/confirm', authMiddleware, validate(uuidParamValidation('id')), gameController.cancelConfirmation);
router.post('/:id/close-confirmations', authMiddleware, validate(uuidParamValidation('id')), gameController.closeConfirmations);
router.post('/:id/teams', authMiddleware, validate(uuidParamValidation('id')), gameController.createTeams);
router.post('/:id/stats', authMiddleware, validate([...uuidParamValidation('id'), ...submitStatsValidation]), gameController.submitStats);

export default router;
