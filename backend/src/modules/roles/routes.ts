import { Router } from 'express';
import { listRoles, assignRole, removeRole } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';

const router = Router();

router.get('/', authenticate, listRoles);
router.post('/', authenticate, requireAdmin, assignRole);
router.delete('/:id', authenticate, requireAdmin, removeRole);

export default router;
