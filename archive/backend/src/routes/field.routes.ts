import { Router } from 'express';
import { FieldController } from '../controllers/FieldController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';

const router = Router();
const fieldController = new FieldController();

router.get('/', authMiddleware, fieldController.getAll);
router.get('/:id', authMiddleware, fieldController.getById);
// Criação/edição/remoção de quadras restrita a admins (#801)
router.post('/', authMiddleware, adminMiddleware, fieldController.create);
router.put('/:id', authMiddleware, adminMiddleware, fieldController.update);
router.delete('/:id', authMiddleware, adminMiddleware, fieldController.delete);

export default router;
