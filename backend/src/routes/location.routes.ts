import { Router } from 'express';
import { LocationController } from '../controllers/LocationController';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';

const router = Router();
const locationController = new LocationController();

router.get('/', authMiddleware, locationController.getAll);
router.get('/:id', authMiddleware, locationController.getById);
// Criação/edição/remoção de locais restrita a admins (#801)
router.post('/', authMiddleware, adminMiddleware, locationController.create);
router.put('/:id', authMiddleware, adminMiddleware, locationController.update);
router.delete('/:id', authMiddleware, adminMiddleware, locationController.delete);

export default router;
