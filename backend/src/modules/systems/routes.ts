import { Router } from 'express';
import { listSystems, getSystem, createSystem, updateSystem, deleteSystem } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, listSystems);
router.get('/:id', authenticate, getSystem);
router.post('/', authenticate, createSystem);
router.patch('/:id', authenticate, updateSystem);
router.delete('/:id', authenticate, deleteSystem);

export default router;
