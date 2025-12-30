import { Router } from 'express';
import { ScheduleController } from '../controllers/ScheduleController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate, createScheduleValidation, uuidParamValidation } from '../middlewares/validation.middleware';

const router = Router();
const scheduleController = new ScheduleController();

router.get('/', authMiddleware, scheduleController.getAll);
router.get('/:id', authMiddleware, validate(uuidParamValidation('id')), scheduleController.getById);
router.post('/', authMiddleware, validate(createScheduleValidation), scheduleController.create);
router.put('/:id', authMiddleware, validate(uuidParamValidation('id')), scheduleController.update);
router.delete('/:id', authMiddleware, validate(uuidParamValidation('id')), scheduleController.delete);
router.post('/:id/request-membership', authMiddleware, validate(uuidParamValidation('id')), scheduleController.requestMembership);
router.post('/:id/members/:userId/approve', authMiddleware, scheduleController.approveMembership);
router.delete('/:id/members/:userId', authMiddleware, scheduleController.removeMember);

export default router;
