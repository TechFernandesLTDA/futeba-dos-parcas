import { Router } from 'express';
import { FieldController } from '../controllers/FieldController';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const fieldController = new FieldController();

router.get('/', authMiddleware, fieldController.getAll);
router.get('/:id', authMiddleware, fieldController.getById);
router.post('/', authMiddleware, fieldController.create);
router.put('/:id', authMiddleware, fieldController.update);
router.delete('/:id', authMiddleware, fieldController.delete);

export default router;
