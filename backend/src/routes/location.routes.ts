import { Router } from 'express';
import { LocationController } from '../controllers/LocationController';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const locationController = new LocationController();

router.get('/', authMiddleware, locationController.getAll);
router.get('/:id', authMiddleware, locationController.getById);
router.post('/', authMiddleware, locationController.create);
router.put('/:id', authMiddleware, locationController.update);
router.delete('/:id', authMiddleware, locationController.delete);

export default router;
