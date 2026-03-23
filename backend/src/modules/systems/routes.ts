import { Router } from 'express';
import { listSystems, getSystem, createSystem, updateSystem, deleteSystem } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireComplianceUser } from '../../middleware/requireComplianceUser';

const router = Router();

router.get('/', authenticate, listSystems);
router.get('/:id', authenticate, getSystem);
router.post('/', authenticate, requireComplianceUser, createSystem);
router.patch('/:id', authenticate, requireComplianceUser, updateSystem);
router.delete('/:id', authenticate, requireComplianceUser, deleteSystem);

export default router;
